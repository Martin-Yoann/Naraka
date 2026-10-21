import test from 'node:test';import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {cloudStorage} from '../lib/cloud-storage.mjs';
import {createCloudHandler} from '../api/index.js';
const sample=(id,overrides={})=>({id,equipType:'3400046',skin:'谪星·2P',holesCount:0,slots:[],unlocks:[],priceCents:100,favorites:1,publicity:false,status:'listed',isLottery:false,lotteryConfirmed:false,lotteryEndsAt:null,...overrides});
test('PostgreSQL schema, durable pagination/search/leases, real history and cloud HTTP contract',async()=>{
 const pg=new PGlite();try{await pg.exec(await readFile(new URL('../lib/cloud-schema.sql',import.meta.url),'utf8'));
 const db={async query(text,values){const r=await pg.query(text,values);return {...r,rowCount:r.affectedRows??r.rows.length}},async connect(){return {...this,release(){}}}};
 const cloud=cloudStorage(db),now=new Date().toISOString(),items=Array.from({length:43},(_,i)=>sample('item-'+String(i).padStart(2,'0'),{priceCents:100+i}));await cloud.inventory.saveDetails(items,now);
 assert.equal((await cloud.inventory.search()).count,43);assert.equal((await cloud.inventory.search({page:3})).items.length,3);
 assert.equal((await cloud.inventory.search({filter:{category:'character',holes:'0',priceMin:120}})).count,23);
 assert.equal((await cloud.inventory.search({filter:{query:'%'}})).count,0);assert.equal((await cloud.inventory.search({filter:{query:'2P'}})).count,43);
 await assert.rejects(()=>cloud.inventory.search({filter:{priceMin:'bad'}}));await assert.rejects(()=>cloud.inventory.search({sort:'price;drop table'}));
 await cloud.inventory.saveDetails([sample('locked',{equipType:'2310450',skin:'狼主',holesCount:1,slots:[0,5],unlocks:[1,0]})],now);
 assert.equal((await cloud.inventory.search({filter:{ranges:[{min:0,max:0}]}})).count,1);assert.equal((await cloud.inventory.search({filter:{ranges:[{}, {min:5}]}})).count,0);
 await cloud.inventory.saveDetails([sample('old')],'2020-01-01T00:00:00Z');assert.equal((await cloud.inventory.search({filter:{recentOnly:true}})).count,44);
 await cloud.inventory.saveDetails([sample('item-00',{priceCents:1})],'2020-01-01T00:00:00Z');assert.equal((await cloud.inventory.get('item-00')).priceCents,100);
 const body=(n)=>({pager:{cur_page:n,total_pages:3},paging:{is_last_page:n===3}}),catalog=[{id:'3400046',name:'2P'}];await cloud.inventory.recordPage('3400046',1,body(1),[],now);await cloud.inventory.recordPage('3400046',3,body(3),[],now);assert.equal(await cloud.inventory.next('3400046'),2);assert.equal((await cloud.inventory.summary(catalog)).completedTypes,0);await cloud.inventory.recordPage('3400046',2,body(2),[],now);assert.equal((await cloud.inventory.summary(catalog)).completedTypes,1);assert.equal(await cloud.inventory.beginCycle(catalog),true);
 const release=await cloud.lease('collector');assert.ok(release);assert.equal(await cloud.lease('collector'),null);await release();assert.ok(await cloud.lease('collector'));
 const at1=new Date(Date.now()-60000).toISOString(),at2=new Date(Date.now()-30000).toISOString();const lottery=sample('lottery',{isLottery:true,lotteryConfirmed:true,lotteryEndsAt:new Date(Date.now()+3600000).toISOString(),previewFrames:['https://cbg-yjwujian.res.netease.com/1.png']});
 await cloud.store.import({at:at1,coverage:'partial',items:[lottery]});await cloud.store.import({at:at2,coverage:'partial',items:[{...lottery,priceCents:90}]});await cloud.store.import({at:at2,coverage:'partial',items:[{...lottery,priceCents:90}]});assert.equal((await cloud.settings.get('lottery.json')).events.length,1);
 const first=await cloud.store.read({limit:1});assert.equal(first.batches.length,1);assert.ok(first.nextBefore);assert.equal((await cloud.store.read({before:first.nextBefore})).batches[0].at,at1);assert.equal((await cloud.store.read({after:at2})).batches.length,0);
 const handler=createCloudHandler(()=>cloud,async item=>({...item,priceCents:80}));async function request(url){let result;const res={setHeader(){},end(body){result={status:this.statusCode,body:JSON.parse(body)}}};await handler({url,method:'GET'},res);return result}
 assert.equal((await request('/api/index?route=inventory/search&page=2')).body.items.length,20);assert.equal((await request('/api/inventory/search?page=-1')).status,400);
 assert.equal((await request('/api/data')).body.lottery.events.length,1);assert.equal((await request('/api/auth/status')).body.webReady,false);
 assert.equal((await request('/api/inventory/item?id=item-00')).body.item.id,'item-00');assert.equal((await request('/api/inventory/verify?id=unknown')).status,404);
 }finally{await pg.close()}
});
