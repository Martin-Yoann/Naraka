import {cloudStorage} from '../lib/cloud-storage.mjs';
import {closeCloud} from '../lib/cloud-db.mjs';
import {compactInventory} from '../dist/inventory-search.js';
import {readFile,open,writeFile,rename,unlink,mkdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {openStore} from '../lib/store.mjs';
import {openInventory} from '../lib/inventory.mjs';
import {normalizeItem,queryPage,queryDetail,queryCatalog} from '../lib/cbg.mjs';
import {lotterySummary} from '../dist/lottery.js';
import {deliverAlerts} from './notify.mjs';
const cloud=process.env.DATABASE_URL?cloudStorage():null;
const root=new URL('../',import.meta.url),lock=new URL('data/collect.lock',root);
const releaseLease=cloud?await cloud.lease('collector'):null;if(cloud&&!releaseLease){console.log('Collector already running');await closeCloud();process.exit(0)}
if(!cloud)await mkdir(new URL('data/',root),{recursive:true});let handle;
try{if(!cloud)handle=await open(lock,'wx')}catch(error){if(error.code!=='EEXIST')throw error;if(Date.now()-(await stat(lock)).mtimeMs>10*60000){await unlink(lock);handle=await open(lock,'wx')}else{console.log('另一轮采集正在运行，跳过');process.exit(0)}}
const store=cloud?.store??openStore(fileURLToPath(new URL('data/market.sqlite',root))),inventory=cloud?.inventory??openInventory(fileURLToPath(new URL('data/inventory.sqlite',root))),startedAt=new Date().toISOString(),started=Date.now();
const config={intervalMinutes:30,requestLimit:220,maxDurationMs:360000,detailLimit:100,allPublicity:true,resumable:true};
const samples=new Map(),pending=new Map(),checked=new Set();let requests=0,details=0,pages=0,failure=null,catalog=[];
try{const cached=JSON.parse(await readFile(new URL('dist/catalog.json',root),'utf8'));if(Array.isArray(cached.items))catalog=cached.items}catch{}
async function atomic(name,data){if(cloud){if(['catalog.json','collection.json'].includes(name))await cloud.settings.put(name,data);return;}if(process.env.RUNTIME_EXPORT_DIR&&!name.includes('/')){const directory=new URL('../runtime/',import.meta.url);await mkdir(directory,{recursive:true});const target=new URL(name,directory),temp=new URL(name+'.tmp',directory);await writeFile(temp,JSON.stringify(data));await rename(temp,target)}const tmp=new URL('dist/'+name+'.tmp',root);await writeFile(tmp,JSON.stringify(data));await rename(tmp,new URL('dist/'+name,root))}
const budget=()=>requests<config.requestLimit&&Date.now()-started<config.maxDurationMs-28000;
async function throttle(){if(requests)await new Promise(resolve=>setTimeout(resolve,1600));requests++}
async function progress(state){await atomic('collection.json',{source:'藏宝阁公开商品接口',updatedAt:new Date().toISOString(),state,startedAt,requests,pages,details,error:failure,config,...await inventory.summary(catalog)})}
function normalize(raw){const item=normalizeItem(raw);if(!item)return null;const definition=catalog.find(entry=>entry.id===item.equipType);return {...item,skin:definition?.name??item.skin,observedAt:new Date().toISOString()}}
async function page(type,number,baseline=false){await throttle();const body=await queryPage({order_by:'price ASC',equip_type:type,page:String(number),pass_fair_show:''});const items=body.result.map(normalize).filter(Boolean);await inventory.recordPage(type,number,body,items);pages++;for(const item of items){if(baseline)samples.set(item.id,item);if(item.isLottery&&!checked.has(item.id))pending.set(item.id,item)}await progress('running');return items}
async function confirm(){for(const [id,item]of pending){if(!budget()||details>=config.detailLimit)break;pending.delete(id);checked.add(id);await throttle();details++;const raw=await queryDetail(item);if(raw){const definition=catalog.find(entry=>entry.id===raw.equipType),fresh={...raw,skin:definition?.name??raw.skin,observedAt:new Date().toISOString()};await inventory.saveDetails([fresh]);if(fresh.isLottery&&fresh.lotteryConfirmed)samples.set(id,fresh);else if(samples.has(id))samples.set(id,fresh)}else{samples.delete(id);await inventory.saveDetails([{...item,status:'unknown',isLottery:false,lotteryConfirmed:false,lotteryEndsAt:null,observedAt:new Date().toISOString()}])}if(details%10===0)await progress('running')}}
try{
 await throttle();catalog=await queryCatalog();await inventory.beginCycle(catalog);await atomic('catalog.json',{source:'藏宝阁公开游戏配置',observedAt:new Date().toISOString(),items:catalog});await progress('running');for(const item of await inventory.candidates())pending.set(item.id,item);
 for(const entry of catalog){if(!budget())break;await page(entry.id,1,true)}
 for(let hotPage=1;hotPage<=2&&budget();hotPage++){await throttle();const body=await queryPage({order_by:'collect_num DESC',page:String(hotPage),pass_fair_show:''});const hotItems=body.result.map(normalize).filter(Boolean);await inventory.saveDetails(hotItems);for(const item of hotItems){samples.set(item.id,item);if(item.isLottery)pending.set(item.id,item)}if(body.paging?.is_last_page)break}
 await confirm();let advanced=true;
 while(budget()&&advanced){advanced=false;for(const entry of catalog){const next=await inventory.next(entry.id);if(next==null)continue;if(!budget())break;await page(entry.id,next);await confirm();advanced=true}}
}catch(error){failure=error.message;process.exitCode=1}
try{
 const collected=await inventory.summary(catalog),at=new Date().toISOString();const batch={at,coverage:samples.size?'partial':'failed',items:[...samples.values()],metadata:{source:'cbg',scope:`官方${catalog.length}种谪星低价首页（含公示）＋收藏榜前2页＋本轮已确认抽签；公开分页断点收集 ${collected.pagesRead}/${collected.totalPages||'?'} 页，累计 ${collected.totalItems} 件。滚动收集非同时点全市场快照。`,catalog,requests,config,error:failure,startedAt,finishedAt:at,collection:{...collected,roundPages:pages,detailCount:details,pendingDetails:pending.size}}};
 await store.import(batch);let notification={channel:'not-configured',queued:0,accepted:0};if(!cloud){notification=await deliverAlerts(lotterySummary(store.read().batches).events,batch.items);await atomic('market.json',{...store.read(),source:'cbg',exportedAt:at,delivery:'snapshot'});await mkdir(new URL('dist/inventory/',root),{recursive:true});for(const entry of catalog){const data=await inventory.list({type:entry.id,limit:100000});await atomic('inventory/'+entry.id+'.json',{...data,updatedAt:at})}await atomic('inventory/index.json',{updatedAt:at,items:(await inventory.list({limit:100000})).items.map(compactInventory)})}await progress(failure?'error':'idle');console.log(JSON.stringify({at,sampleCount:samples.size,totalCollected:collected.totalItems,typesComplete:collected.completedTypes,types:collected.totalTypes,pagesRead:collected.pagesRead,totalPages:collected.totalPages,requests,details,error:failure,notification}));
}finally{try{await inventory.close();await store.close()}finally{if(cloud){await releaseLease();await closeCloud()}else{await handle.close();await unlink(lock)}}}
