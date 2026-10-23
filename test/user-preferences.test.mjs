import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {cloudAccounts} from '../lib/cloud-auth-store.mjs';
import {userPreferences,validatePreference,matchesPreference} from '../lib/user-preferences.mjs';
import {createUserHandler} from '../lib/user-handler.mjs';
import {deliverPreferenceMessages} from '../lib/user-delivery.mjs';
const catalog=[{id:'unit-type',name:'单元测试外观',slotNames:['颜色','外形']}];
const input={type:'unit-type',name:'我的偏好',holes:1,priceMin:0,priceMax:10000,ranges:[{min:0,max:10},{min:null,max:null}],wechat:false,enabled:true};
const item={id:'unit-item',equipType:'unit-type',skin:'单元测试外观',holesCount:1,slots:[0,5],unlocks:[1,0],priceCents:9000,status:'listed',isLottery:true,lotteryConfirmed:true,observedAt:new Date().toISOString(),lotteryEndsAt:new Date(Date.now()+3600000).toISOString()};
test('抽签偏好严格验证，零值可匹配；锁孔、过期、陈旧、普通商品不提醒',()=>{
 const c=validatePreference(input,catalog).criteria;assert.ok(matchesPreference(item,c));
 for(const changed of [{status:'unknown'},{isLottery:false},{lotteryConfirmed:false},{observedAt:new Date(Date.now()-66*60000).toISOString()},{lotteryEndsAt:new Date(Date.now()-1).toISOString()},{unlocks:[0,1]},{priceCents:10001},{equipType:'other'},{holesCount:2}])assert.equal(matchesPreference({...item,...changed},c),false,JSON.stringify(changed));
 for(const changed of [{type:'fake'},{holes:3},{priceMin:-1},{priceMin:10001},{ranges:[{min:5,max:2}]},{priceMax:NaN},{ranges:[{min:null,max:null},{min:0.5,max:1}]}])assert.throws(()=>validatePreference({...input,...changed},catalog));
});
test('云端偏好隔离账号、同价去重、只在降价提醒、暂停删除与消息已读均限本人',async()=>{
 const pg=new PGlite();const db={async query(sql,values){if(!values&&sql.split(';').length>2){await pg.exec(sql);return {rows:[],rowCount:0}}const r=await pg.query(sql,values);return {...r,rowCount:r.affectedRows??r.rows.length}},async connect(){return {...this,release(){}}}};
 try{
  await db.query(await readFile(new URL('../lib/cloud-schema.sql',import.meta.url),'utf8'));
  const accounts=cloudAccounts(db),a=await accounts.identity({appid:'unit-app',openid:'a'}),b=await accounts.identity({appid:'unit-app',openid:'b'}),token=await accounts.session(a),store=userPreferences(db);
  const value=validatePreference(input,catalog),p=await store.save(a,null,value);assert.equal((await store.list(b)).length,0);
  await assert.rejects(()=>store.save(b,p.id,value),/不存在/);await assert.rejects(()=>store.remove(b,p.id),/不存在/);
  const insert=async candidate=>db.query('INSERT INTO zx_inventory VALUES($1,$2,now(),$3,$4) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,last_seen=excluded.last_seen',[candidate.id,candidate.equipType,candidate.observedAt,JSON.stringify(candidate)]);
  await insert(item);assert.equal((await store.evaluate(a)).created,1);assert.equal((await store.evaluate(a)).created,0);
  await insert({...item,priceCents:9500});assert.equal((await store.evaluate(a)).created,0);
  await insert({...item,priceCents:8000});assert.equal((await store.evaluate(a)).created,1);
  await store.save(a,p.id,value);assert.equal((await store.evaluate(a)).created,0,'no-op save must not reset dedup');
  assert.equal((await store.messages(a)).unread,2);assert.equal((await store.messages(b)).unread,0);
  const message=(await store.messages(a)).messages[0];await assert.rejects(()=>store.read(b,message.id),/不存在/);await store.read(a,message.id);assert.equal((await store.messages(a)).unread,1);
  await store.save(a,p.id,{...value,enabled:false});await insert({...item,priceCents:7000});assert.equal((await store.evaluate()).created,0);await store.save(a,p.id,value);assert.equal((await store.evaluate()).created,1);
  const handler=createUserHandler({accounts:()=>accounts,preferences:()=>store,storage:()=>({settings:{get:async()=>({items:catalog})},lease:async()=>()=>{}}),config:()=>({})});
  const call=async(path,method='GET',origin='https://www.gekiyan.com',cookie='zx_session='+token,body=input)=>{const res={statusCode:200,setHeader(){},end(value){this.data=JSON.parse(value)}};await handler({method,headers:{host:'www.gekiyan.com',origin,cookie},readJSON:async()=>body},res,new URL(path,'https://www.gekiyan.com'));return res};
  assert.equal((await call('/api/user/preferences','GET',undefined,'')).statusCode,401);
  assert.equal((await call('/api/user/preferences','PUT','https://evil.test')).statusCode,403);
  assert.equal((await call('/api/user/preferences','PUT','null')).statusCode,403);
  assert.equal((await call('/api/user/preferences','PUT',undefined,undefined,{...input,wechat:true})).statusCode,400);
  assert.equal((await call('/api/user/preferences')).data.preferences.length,1);
  assert.equal((await call('/api/user/messages/read','POST',undefined,undefined,{})).statusCode,400);
  // Delivery fixture sends only to a test double, never a real WeChat user.
  const pushPref=await store.save(a,p.id,{...value,wechat:true});await insert({...item,priceCents:6000});await store.evaluate(a);
  let sends=0;const cfg={oaReady:true,sendEnabled:true,oaId:'unit-app',templateId:'fixture-template',templateFields:'{"content":"summary"}',origin:'https://www.gekiyan.com'};
  const delivery=()=>deliverPreferenceMessages({db,config:cfg,detail:async()=>({...item,priceCents:6000}),send:async()=>{sends++;return {errcode:0,msgid:123}}});
  assert.equal((await delivery()).accepted,1);assert.equal((await delivery()).accepted,0);assert.equal(sends,1);
  await insert({...item,priceCents:5000});await store.evaluate(a);await store.save(a,pushPref.id,{...value,wechat:true,enabled:false});await delivery();assert.equal(sends,1,'paused preferences must cancel pending sends');
  await store.remove(a,p.id);assert.equal((await store.list(a)).length,0);assert.ok((await store.messages(a)).messages.length>0);await store.read(a,null);assert.equal((await store.messages(a)).unread,0);
  await db.query("UPDATE zx_user_messages SET created_at=now()-interval '31 days'");await store.evaluate();assert.equal((await store.messages(a)).messages.length,0,'retention runs even if all preferences were deleted or paused');
 }finally{await pg.close()}
});
