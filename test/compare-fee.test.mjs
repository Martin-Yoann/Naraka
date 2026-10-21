import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bargain} from '../dist/bargain.js';
import {parseCBGLink,frameAt} from '../dist/compare-core.js';
const rule={rate:8,min:0,max:null,extra:0};
test('3000挂价2400还价：买家、各半、卖家分配对应552、576、600元补差',()=>{
 for(const[share,supplement,buyer,seller]of [[1,55200,295200,276000],[.5,57600,297600,278400],[0,60000,300000,280800]]){const r=bargain(300000,240000,rule,share);assert.equal(r.supplement,supplement);assert.equal(r.buyerTotal,buyer);assert.equal(r.sellerNet,seller);assert.equal(r.saving,4800);assert.equal(r.buyerSaving+r.sellerGain,r.saving)}
});
test('分摊始终守恒，最低费、封顶、其他费用与分取整均不产生消失金额',()=>{
 for(const r of [rule,{rate:8,min:1000,max:2000,extra:99},{rate:0,min:0,max:null,extra:0}])for(const quote of [0,1,19,125,10000,234567])for(const share of [0,.5,1]){const offer=Math.ceil(quote*.9),b=bargain(quote,offer,r,share);assert.equal(b.buyerTotal-b.fee-r.extra,b.sellerNet);assert.equal(b.sellerNet-b.originalNet,b.sellerGain);assert.equal(quote-b.buyerTotal,b.buyerSaving)}
 assert.throws(()=>bargain(10000,7999,rule),/下限/);assert.throws(()=>bargain(10000,10001,rule));
});
test('商品链接解析仅允许官方域名，不将用户URL作为服务端任意抓取地址',()=>{
 assert.deepEqual(parseCBGLink('https://yjwujian.cbg.163.com/cgi/mweb/equip/2/61c5759dc3264efcb4a0ad5173e5036e?foo=1'),{serverId:2,ordersn:'61c5759dc3264efcb4a0ad5173e5036e'});assert.throws(()=>parseCBGLink('https://evil.test/cgi/mweb/equip/2/61c5759dc3264efcb4a0ad5173e5036e'));assert.throws(()=>parseCBGLink('https://yjwujian.cbg.163.com/'));assert.throws(()=>parseCBGLink('http://127.0.0.1:3100/'));assert.equal(frameAt(['a','b','c'],180),'b');assert.equal(frameAt([],30),null);
});
