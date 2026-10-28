import {cloudStorage} from '../lib/cloud-storage.mjs';
import {closeCloud} from '../lib/cloud-db.mjs';
import {openStore} from '../lib/store.mjs';
import {openInventory} from '../lib/inventory.mjs';
import {queryCatalog} from '../lib/cbg.mjs';
import {collectOpportunities} from '../lib/collect-opportunities.mjs';
import {readFile,writeFile,mkdir,open,stat,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),cloud=process.env.DATABASE_URL?cloudStorage():null;
const hours=Number(process.env.LOTTERY_UPCOMING_HOURS??6);
if(!Number.isFinite(hours)||hours<1||hours>24)throw Error('LOTTERY_UPCOMING_HOURS 需在1至24之间');
const lock=new URL('data/collect.lock',root);let release,store,inventory,localHandle;
try{
 if(cloud){release=await cloud.lease('collector');if(!release){console.log('Collector already running')}else{store=cloud.store;inventory=cloud.inventory}}
 else{await mkdir(new URL('data/',root),{recursive:true});try{localHandle=await open(lock,'wx')}catch(error){if(error.code!=='EEXIST')throw error;if(Date.now()-(await stat(lock)).mtimeMs>10*60000){await unlink(lock);localHandle=await open(lock,'wx')}else console.log('Collector already running')}if(localHandle){store=openStore(fileURLToPath(new URL('data/market.sqlite',root)));inventory=openInventory(fileURLToPath(new URL('data/inventory.sqlite',root)))}}
 if(store){
  const settings=cloud?.settings??{async get(key){try{return JSON.parse(await readFile(new URL('dist/'+key,root),'utf8'))}catch{return null}},async put(key,value){await writeFile(new URL('dist/'+key,root),JSON.stringify(value))}};
  let saved=await settings.get('catalog.json');if(!saved?.items?.length||!Number.isFinite(Date.parse(saved.observedAt))||Date.now()-Date.parse(saved.observedAt)>86400000){saved={source:'藏宝阁公开游戏配置',observedAt:new Date().toISOString(),items:await queryCatalog()};await settings.put('catalog.json',saved)}
  const report=await collectOpportunities(cloud??{store,inventory,settings},{catalog:saved.items,policy:{upcomingHours:hours}});
  await settings.put('collection.json',{...await inventory.summary(saved.items),...Object.fromEntries(Object.entries(report).filter(([k])=>k!=='batch')),updatedAt:report.at});
  if(!cloud)await settings.put('market.json',{...store.read(),delivery:'snapshot',exportedAt:report.at});
  console.log(JSON.stringify(Object.fromEntries(Object.entries(report).filter(([k])=>k!=='batch'))));if(report.error)process.exitCode=1;
 }
}finally{await inventory?.close();await store?.close();if(localHandle){await localHandle.close();await unlink(lock)}if(release)await release();if(cloud)await closeCloud()}
