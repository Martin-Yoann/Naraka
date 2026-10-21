import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loginWidgetConfig,fetchWeChatProfile} from '../lib/wechat.mjs';
import {openAccounts} from '../lib/accounts.mjs';
test('官方内嵌组件配置启用快捷登录，且不将密钥传给前端',()=>{
 const config=loginWidgetConfig('state-value',{webReady:true,webId:'wx-app',webSecret:'must-stay-server-side',origin:'https://example.com'});assert.equal(config.fastLogin,true);assert.equal(config.scope,'snsapi_login');assert.equal(config.redirectUri,'https://example.com/api/auth/wechat/callback');assert.equal(JSON.stringify(config).includes('must-stay-server-side'),false);assert.throws(()=>loginWidgetConfig('state',{webReady:false}));
});
test('微信身份首次自动注册，后续授权复用账号并保存真实资料',()=>{
 const db=openAccounts(':memory:');const first=db.login('web-app','openid','unionid',false);const firstID=db.user(first).id;db.profile(first,{nickname:'昵称',avatar:'https://thirdwx.qlogo.cn/avatar.png'});const next=db.login('web-app','openid','unionid',false);assert.equal(db.user(next).id,firstID);assert.equal(db.user(next).nickname,'昵称');const official=db.login('oa-app','oa-openid','unionid',true);assert.equal(db.user(official).id,firstID);assert.equal(db.user(official).oa_openid,'oa-openid');db.logout(next);assert.equal(db.user(next),null);db.close();
});
test('头像只使用微信官方域名，资料获取失败不伪造昵称头像',async()=>{
 const fetcher=async()=>({ok:true,json:async()=>({nickname:'微信昵称',headimgurl:'http://thirdwx.qlogo.cn/abc/0'})});const profile=await fetchWeChatProfile({access_token:'token',openid:'user'},fetcher);assert.equal(profile.nickname,'微信昵称');assert.equal(profile.avatar,'https://thirdwx.qlogo.cn/abc/0');const bad=await fetchWeChatProfile({access_token:'token',openid:'user'},async()=>({ok:true,json:async()=>({headimgurl:'https://evil.test/avatar.png'})}));assert.equal(bad.avatar,null);assert.deepEqual(await fetchWeChatProfile({access_token:'token',openid:'user'},async()=>{throw Error('offline')}),{});
});
