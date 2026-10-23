import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {cloudAccounts,digest} from '../lib/cloud-auth-store.mjs';
import {createAuthHandler} from '../lib/cloud-auth-handler.mjs';

test('sandbox OAuth, browser-bound tickets, explicit confirmation, one-time sessions, expiry and CSRF',async()=>{
 const pg=new PGlite();
 const db={async query(sql,values){if(!values&&sql.split(';').length>2){await pg.exec(sql);return {rows:[],rowCount:0}}const r=await pg.query(sql,values);return {...r,rowCount:r.affectedRows??r.rows.length}},async connect(){return {...this,release(){}}}};
 const store=cloudAccounts(db),cfg={origin:'https://www.gekiyan.com',sandbox:true,oaReady:true,webReady:false,oaId:'test-app',oaSecret:'test-secret'};
 let exchanges=0;
 const auth=createAuthHandler({config:()=>cfg,accounts:()=>store,storage:()=>({lease:async()=>()=>{}}),exchange:async()=>{exchanges++;return {appid:'test-app',openid:'test-openid'}},profile:async()=>({nickname:'测试用户',avatar:null})});
 const call=async(path,method='GET',cookies='',extra={})=>{const headers={},res={setHeader(k,v){headers[k.toLowerCase()]=v},statusCode:200,end(body){this.body=body||''}};await auth({method,headers:{host:'www.gekiyan.com',origin:'https://www.gekiyan.com',cookie:cookies,...extra}},res,new URL(path,cfg.origin));return {status:res.statusCode,headers,text:res.body,get data(){return JSON.parse(res.body)}}};
 const cookies=result=>[].concat(result.headers['set-cookie']||[]).map(x=>x.split(';')[0]).join('; ');
 const start=async()=>{const qr=await call('/api/auth/wechat/qr','POST');assert.equal(qr.status,200);assert.match(qr.data.image,/^data:image\/png;base64,/);assert.equal(qr.data.kind,'oa-bridge');const browser=cookies(qr),id=decodeURIComponent(browser.split('=')[1]).split('.')[0];const scan=await call('/api/auth/wechat?mode=oa&ticket='+id);assert.equal(scan.status,302);const url=new URL(scan.headers.location);assert.equal(url.hostname,'open.weixin.qq.com');assert.equal(url.searchParams.get('scope'),'snsapi_userinfo');const phone=cookies(scan),state=url.searchParams.get('state');return {browser,id,phone,state}};
 try{
  const x=await start();
  assert.equal((await call('/api/auth/wechat/poll','POST',x.browser)).data.status,'scanned');
  assert.equal((await call('/api/auth/wechat/poll','POST',x.browser,{origin:'https://evil.example'})).status,403);
  assert.equal((await call('/api/auth/wechat/poll','POST','zx_login='+x.id+'.wrong')).data.status,'expired');
  await call('/api/auth/wechat/callback?state='+x.state+'&code=valid','GET','');assert.equal(exchanges,0);
  const callback=await call('/api/auth/wechat/callback?state='+x.state+'&code=valid','GET',x.phone);assert.match(callback.text,/确认登录电脑端/);assert.ok(!cookies(callback).includes('zx_session='));assert.equal(exchanges,1);
  assert.equal((await call('/api/auth/wechat/poll','POST',x.browser)).data.status,'confirm');
  const approved=await call('/api/auth/wechat/confirm','POST',cookies(callback));assert.match(approved.text,/登录已确认/);
  const poll=await call('/api/auth/wechat/poll','POST',x.browser);assert.equal(poll.data.status,'approved');assert.ok(!('token' in poll.data));assert.match(poll.headers['set-cookie'][0],/HttpOnly; Secure; SameSite=Lax/);
  const logged=cookies(poll);assert.equal((await call('/api/auth/status','GET',logged)).data.user.nickname,'测试用户');
  assert.equal((await call('/api/auth/wechat/poll','POST',x.browser)).data.status,'consumed');
  await call('/api/auth/wechat/callback?state='+x.state+'&code=valid','GET',x.phone);assert.equal(exchanges,1);
  await call('/api/auth/logout','POST',logged);assert.equal((await call('/api/auth/status','GET',logged)).data.loggedIn,false);
  const y=await start(),cb=await call('/api/auth/wechat/callback?state='+y.state+'&code=valid','GET',y.phone);await call('/api/auth/wechat/cancel','POST',cookies(cb));assert.equal((await call('/api/auth/wechat/poll','POST',y.browser)).data.status,'cancelled');
  const denied=await start();await call('/api/auth/wechat/callback?state='+denied.state,'GET',denied.phone);assert.equal((await call('/api/auth/wechat/poll','POST',denied.browser)).data.status,'cancelled');
  assert.equal(Number((await db.query('SELECT count(*) n FROM zx_auth_users')).rows[0].n),1,'same identity reuses its account');
  await db.query("UPDATE zx_auth_tickets SET expires=now()-interval '1 second' WHERE id=$1",[y.id]);assert.equal((await call('/api/auth/wechat/poll','POST',y.browser)).data.status,'expired');
  const rawSession=decodeURIComponent(logged.match(/zx_session=([^;]+)/)[1]);assert.equal((await db.query('SELECT token_hash FROM zx_auth_sessions WHERE token_hash=$1',[rawSession])).rows.length,0);assert.notEqual(rawSession,digest(rawSession));
 }finally{await pg.close()}
});

test('WeChat server verification echoes only signed challenges',async()=>{
 const previous=process.env.WECHAT_CALLBACK_TOKEN;process.env.WECHAT_CALLBACK_TOKEN='testVerificationToken';
 try{const auth=createAuthHandler({config:()=>({})});let status,body;const res={setHeader(){},set statusCode(s){status=s},end(b){body=b}};const signature=createHash('sha1').update(['testVerificationToken','123','nonce'].sort().join('')).digest('hex');await auth({method:'GET'},res,new URL('https://www.gekiyan.com/api/wechat/callback?timestamp=123&nonce=nonce&echostr=hello&signature='+signature));assert.equal(status,200);assert.equal(body,'hello');await auth({method:'GET'},res,new URL('https://www.gekiyan.com/api/wechat/callback?timestamp=123&nonce=nonce&echostr=hello&signature=bad'));assert.equal(status,403)}finally{if(previous===undefined)delete process.env.WECHAT_CALLBACK_TOKEN;else process.env.WECHAT_CALLBACK_TOKEN=previous}
});
