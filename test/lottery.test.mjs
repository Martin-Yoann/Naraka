import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lotterySummary} from '../dist/lottery.js';
import {advanceLottery,currentLottery} from '../lib/cloud-lottery.mjs';
import {compactLottery} from '../dist/market-payload.js';
import {openAccounts} from '../lib/accounts.mjs';
import {authorizationURL,templateData,exchangeCode} from '../lib/wechat.mjs';
const item=(price,holes=3)=>({id:'a',skin:'谪星·测试',holesCount:holes,slots:[500,600,700],priceCents:price,status:'listed',isLottery:true,lotteryConfirmed:true,lotteryEndsAt:'2026-10-20T12:00:00Z',url:'https://yjwujian.cbg.163.com/'});
const batch=(hour,items)=>({at:`2026-10-20T0${hour}:00:00Z`,coverage:'partial',items});
test('首次建基线、持平不提醒，低于历史最低才产生一条事件；不同孔数分开',()=>{
 const batches=[batch(1,[item(10000),item(5000,4)]),batch(2,[item(10000)]),batch(3,[item(9000)]),batch(4,[item(9500)])];const s=lotterySummary(batches,Date.parse('2026-10-20T04:00:00Z'));
 assert.equal(s.events.length,1);assert.equal(s.events[0].previousCents,10000);assert.equal(s.groups.length,2);assert.equal(s.groups.find(g=>g.holesCount===3).priceCents,9000);
 assert.equal(lotterySummary([batches[0]]).events.length,0);
});
test('普通商品、未确认抽签、截止后的抽签均不记为抽签价；截止后不提供活跃购买链接',()=>{
 assert.equal(lotterySummary([batch(1,[{...item(100),lotteryConfirmed:false}])]).groups.length,0);
 assert.equal(lotterySummary([batch(1,[{...item(100),isLottery:false}])]).groups.length,0);
 assert.equal(lotterySummary([batch(1,[{...item(100),lotteryEndsAt:'2026-10-20T00:00:00Z'}])]).groups.length,0);
 const s=lotterySummary([batch(1,[item(100)])],Date.parse('2026-10-21T00:00:00Z'));assert.equal(s.groups[0].current,null);
});
test('长轮次中已截止的短窗口仍按真实详情观察时间记历史，不提供过期购买入口',()=>{const observed={...item(10000),observedAt:'2026-10-20T01:01:00Z',lotteryEndsAt:'2026-10-20T01:02:00Z'};const summary=lotterySummary([{at:'2026-10-20T01:06:00Z',coverage:'partial',items:[observed]}],Date.parse('2026-10-20T01:07:00Z'));assert.equal(summary.groups.length,1);assert.equal(summary.groups[0].at,observed.observedAt);assert.equal(summary.groups[0].current,null)});

test('截止或后续未采到样本时保留最近观察价、星格和截止时间，历史最低与最近观察分别保存',()=>{
 const low={...item(9000),slots:[100,200,300]},recent={...item(12000),id:'later',slots:[700,800,900]};
 const first=advanceLottery(null,batch(1,[low])),second=advanceLottery(first,batch(2,[recent])),empty=advanceLottery(second,batch(3,[]));
 assert.equal(second.groups[0].priceCents,9000);assert.equal(second.groups[0].lastObserved.priceCents,12000);assert.deepEqual(second.groups[0].item.slots,low.slots);
 const result=currentLottery(empty,Date.parse('2026-10-21T00:00:00Z')).groups[0];assert.equal(result.current,null);assert.equal(result.lastObserved.id,'later');assert.deepEqual(result.lastObserved.slots,recent.slots);assert.equal(result.lastObserved.lotteryEndsAt,recent.lotteryEndsAt);assert.equal(result.lastObserved.observedAt,batch(2,[]).at);
 assert.equal(lotterySummary([batch(1,[low]),batch(2,[recent])]).groups[0].lastObserved.id,'later');
 const legacy={...second,groups:second.groups.map(g=>({...g,lastObserved:undefined,current:recent}))};assert.equal(currentLottery(legacy,Date.parse('2026-10-21T00:00:00Z')).groups[0].lastObserved.id,'later');
 const compact=compactLottery({...second,groups:second.groups.map(g=>({...g,lastObserved:{...recent,previewFrames:['large']}}))});assert.ok(!('previewFrames' in compact.groups[0].lastObserved));
});
test('OAuth state一次性且会话不可用其他随机token替代',()=>{
 const db=openAccounts(':memory:');const state=db.state('oa');assert.equal(db.consumeState(state),'oa');assert.equal(db.consumeState(state),null);
 const token=db.login('app','openid',null,true);const user=db.user(token);assert.ok(user.id);assert.equal(user.oa_openid,'openid');assert.equal(db.user('forged'),null);db.logout(token);assert.equal(db.user(token),null);db.close();
});
test('只为事件发生前主动订阅的客户入队，重复事件不重复入队，退订可撤销',()=>{
 const db=openAccounts(':memory:');const token=db.login('app','openid',null,true),user=db.user(token);const event={id:'low-1',key:'group',at:new Date(Date.now()+1000).toISOString(),endsAt:new Date(Date.now()+60000).toISOString()};assert.equal(db.enqueue([event]),0);db.subscribe(user.id,'group',true);assert.equal(db.enqueue([event]),1);assert.equal(db.enqueue([event]),0);db.subscribe(user.id,'group',false);assert.equal(db.pending()[0].enabled,0);db.close();
});
test('微信地址使用配置域名与state，模板字段只允许已知数据语义',async()=>{
 const config={oaReady:true,origin:'https://example.com',oaId:'app',oaSecret:'secret'};const url=new URL(authorizationURL('oa','random-state',config));assert.equal(url.searchParams.get('state'),'random-state');assert.equal(url.searchParams.get('redirect_uri'),'https://example.com/api/auth/wechat/callback');assert.equal(url.searchParams.has('secret'),false);
 const data=templateData({skin:'谪星',priceCents:12345,previousCents:20000,at:'2026-10-20T00:00:00Z',holesCount:3},'{"thing1":"skin","amount2":"price"}');assert.equal(data.amount2.value,'123.45');assert.throws(()=>templateData({},'{"thing1":"unknown"}'));
 await assert.rejects(exchangeCode('oa','bad',async()=>({ok:true,json:async()=>({errcode:40029})}),config),/40029/);
});
