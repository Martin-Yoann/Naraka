import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {cloudStorage} from '../lib/cloud-storage.mjs';
import {refreshLotterySource} from '../lib/refresh-lottery.mjs';
import {createCloudHandler} from '../lib/cloud-handler.mjs';
import {dataPolicy} from '../lib/data-policy.mjs';
import {compactLottery} from '../dist/market-payload.js';
const item=(id,at,extra={})=>({id,equipType:'3400046',skin:'谪星·2P',holesCount:0,slots:[],unlocks:[],priceCents:10000,favorites:1,publicity:false,status:'listed',isLottery:true,lotteryConfirmed:true,observedAt:at,lotteryEndsAt:new Date(Date.parse(at)+3600000).toISOString(),ordersn:id,serverId:2,previewFrames:['https://cbg-yjwujian.res.netease.com/1.png'],...extra});
async function fixture(){const pg=new PGlite();await pg.exec(await readFile('lib/cloud-schema.sql','utf8'));const db={async query(sql,values){const result=await pg.query(sql,values);return {...result,rowCount:result.affectedRows??result.rows.length}},async connect(){return {...this,release(){}}}};return {pg,db,storage:cloudStorage(db)}}

test('cloud saves upcoming detail windows through inventory, snapshot and compact API without changing confirmed lows',async()=>{
 const {pg,storage}=await fixture();try{
  const at=new Date().toISOString(),baseline=item('past',at,{priceCents:20000});await storage.store.import({at,coverage:'partial',items:[baseline]});
  const future={...item('future',at,{priceCents:10000}),isLottery:false,publicity:true,lotteryStartsAt:new Date(Date.now()+3600000).toISOString(),lotteryEndsAt:new Date(Date.now()+4500000).toISOString(),lotteryWindowConfirmed:true};
  await storage.lottery.saveRefresh({at,items:[future],checked:[{id:future.id,at,eligible:false}],upcomingHours:6,state:'idle'});
  assert.ok((await storage.inventory.candidates()).some(i=>i.id===future.id));const result=compactLottery(await storage.lottery.read());assert.equal(result.groups[0].priceCents,20000);assert.equal(result.events.length,0);assert.equal(result.opportunities.find(i=>i.id===future.id).window,'upcoming');assert.equal(result.opportunities.find(i=>i.id===future.id).deal.good,true);assert.equal(result.opportunities.find(i=>i.id===future.id).previewFrames,undefined);
  assert.ok(!(result.liveItems??[]).some(i=>i.id===future.id));await storage.store.import({at:new Date(Date.now()+1000).toISOString(),coverage:'partial',items:[future]});assert.equal((await storage.store.read()).batches.at(-1).items[0].lotteryWindowConfirmed,true);
 }finally{await pg.close()}
});
test('72-hour cleanup cadence preserves historic low and preview, while row caps prune oldest records',async()=>{
 const {pg,db,storage}=await fixture();try{
  const now=Date.now(),at=new Date(now).toISOString(),old=new Date(now-7*86400000).toISOString(),later=new Date(now+72*3600000).toISOString();
  const low=item('low',old,{priceCents:5000}),discard=item('discard',old,{isLottery:false,lotteryConfirmed:false});
  await storage.inventory.saveDetails([low,discard],old);await storage.store.import({at:old,coverage:'partial',items:[low,discard]});await storage.inventory.saveDetails([item('current',at)],at);await storage.store.import({at,coverage:'partial',items:[item('current',at)]});
  const baseline=(await storage.settings.get('lottery.json')).groups[0].priceCents;
  const dry=await storage.maintenance({now,dryRun:true});assert.equal(dry.dryRun,true);assert.equal(dry.eligible.inventory,1);assert.ok(await storage.inventory.get('discard'));
  const first=await storage.maintenance({now});assert.equal(first.deleted.inventory,1);assert.equal(first.deleted.batches,1);assert.ok(await storage.inventory.get('low'));assert.equal(await storage.inventory.get('discard'),null);assert.equal((await storage.lottery.read()).groups[0].priceCents,baseline);assert.equal((await storage.inventory.get('low')).previewFrames.length,1);
  await storage.inventory.saveDetails([item('late-import',old,{isLottery:false})],old);assert.equal((await storage.maintenance({now:now+86400000})).due,false);assert.ok(await storage.inventory.get('late-import'));assert.equal((await storage.maintenance({now:Date.parse(later)})).due,true);assert.equal(await storage.inventory.get('late-import'),null);
  await db.query("INSERT INTO zx_inventory SELECT 'bulk-'||n,'3400046',$1,$1,jsonb_build_object('id','bulk-'||n) FROM generate_series(1,$2) n",[at,dataPolicy.maxInventory+5]);
  await db.query("INSERT INTO zx_observations SELECT 'obs-'||n,$1,1,1,0 FROM generate_series(1,$2) n",[at,dataPolicy.maxObservations+5]);
  const capped=await storage.maintenance({now:Date.parse(later)+1000});assert.ok(capped.counts.inventory<=dataPolicy.maxInventory);assert.ok(capped.counts.observations<=dataPolicy.maxObservations);assert.ok(await storage.inventory.get('low'));assert.equal((await storage.settings.get('lottery.json')).groups[0].priceCents,baseline);
 }finally{await pg.close()}
});
test('independent lottery refresh uses new listings, has detail and shared cooldown limits, updates lows without market batches',async()=>{
 const {pg,db,storage}=await fixture();try{
  await storage.settings.put('catalog.json',{items:[{id:'3400046',name:'谪星·2P'}]});let now=Date.now(),calls=0;
  const raw=n=>({format_equip_name:'谪星·2P',equip_type:'3400046',other_info:{variation_info:{}},price:10000+n,collect_num:2,eid:'fresh-'+n,game_ordersn:'order-'+n,serverid:2,status:2,pass_fair_show:1,is_random_draw_period:true});
  const wrapped={...storage,lease:async(name,minutes)=>name==='public-detail'?()=>{}:storage.lease(name,minutes)};
  const options={clock:()=>now,sleep:async ms=>{now+=ms},pageQuery:async p=>({result:Array.from({length:15},(_,i)=>raw((Number(p.page)-1)*15+i)),paging:{is_last_page:false}}),detailQuery:async candidate=>{calls++;return {...candidate,lotteryConfirmed:true,lotteryEndsAt:new Date(now+3600000).toISOString()}}};
  const first=await refreshLotterySource(wrapped,options);assert.equal(first.status,200);assert.equal(first.checkedCount,12);assert.equal(first.listed,30);assert.equal(first.partial,true);assert.equal(calls,12);assert.equal((await refreshLotterySource(wrapped,options)).shared,true);assert.equal(calls,12);assert.equal((await db.query('SELECT count(*) n FROM zx_batches')).rows[0].n,0);
  const summary=await storage.lottery.read();assert.equal(summary.groups[0].priceCents,10000);assert.ok(summary.groups[0].current);assert.equal(summary.refresh.checkedCount,12);assert.equal(summary.live.eligibleCount,12);assert.equal((await storage.lottery.read()).live.eligibleCount,12);
  const before=summary.groups[0].current;const at=new Date(now+1000).toISOString();await storage.lottery.saveRefresh({at,items:[{...before,status:'unknown',isLottery:false,lotteryConfirmed:false,observedAt:at}],checked:[{id:before.id,at,eligible:false}],state:'idle'});const after=await storage.lottery.read();assert.notEqual(after.groups[0].current?.id,before.id);assert.equal(after.groups[0].priceCents,10000);
  const handler=createCloudHandler(()=>wrapped,undefined,async()=>({status:202,shared:true}));let result;const response={setHeader(){},end(body){result={status:this.statusCode,body:JSON.parse(body)}}};await handler({url:'https://site.test/api/lottery/refresh',method:'POST',headers:{origin:'https://evil.test'}},response);assert.equal(result.status,403);await handler({url:'https://site.test/api/lottery/refresh',method:'POST',headers:{origin:'https://site.test'}},response);assert.equal(result.status,202);await handler({url:'http://localhost:3201/api/lottery/refresh',method:'POST',headers:{origin:'https://public.test',host:'localhost:3201','x-forwarded-host':'public.test','x-forwarded-proto':'https'}},response);assert.equal(result.status,202);
 }finally{await pg.close()}
});
test('upstream failure keeps prior lottery observations and publishes an honest failed refresh state',async()=>{
 const {pg,storage}=await fixture();try{
  const at=new Date().toISOString(),known=item('known',at);await storage.lottery.saveRefresh({at,items:[known],checked:[{id:known.id,at,eligible:true}],state:'idle'});
  const result=await refreshLotterySource({...storage,lease:async()=>()=>{}},{pageQuery:async()=>{throw Error('HTTP 429')},sleep:async()=>{}});assert.equal(result.status,502);const summary=await storage.lottery.read();assert.equal(summary.groups[0].priceCents,10000);assert.equal(summary.groups[0].current.id,'known');assert.equal(summary.refresh.state,'error');assert.match(summary.refresh.error,/429/);
 }finally{await pg.close()}
});
test('a later-finishing refresh cannot overwrite a newer item observation; historical low still records the earlier valid price',async()=>{
 const {pg,storage}=await fixture();try{const end=Date.now(),old=new Date(end-20000).toISOString(),newer=new Date(end-10000).toISOString(),at=new Date(end).toISOString();await storage.inventory.saveDetails([item('race',newer,{priceCents:20000})],newer);await storage.lottery.saveRefresh({at,items:[item('race',old,{priceCents:10000})],checked:[{id:'race',at:old,eligible:true}],state:'idle'});const summary=await storage.lottery.read();assert.equal((await storage.inventory.get('race')).priceCents,20000);assert.equal(summary.groups[0].priceCents,10000);assert.equal(summary.groups[0].lastObserved.priceCents,20000);assert.equal(summary.groups[0].current.priceCents,20000)}finally{await pg.close()}
});
