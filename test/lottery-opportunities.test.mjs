import test from 'node:test';
import assert from 'node:assert/strict';
import {lotteryWindow,priceSignal,rankCandidates,lotteryOpportunities} from '../dist/lottery-opportunities.js';
import {lotterySummary,groupKey} from '../dist/lottery.js';
import {advanceLottery} from '../lib/cloud-lottery.mjs';
import {mergeLiveSnapshot,lotteryWithLive} from '../lib/lottery-live.mjs';
import {collectOpportunities} from '../lib/collect-opportunities.mjs';
import {queryDetail,normalizeItem} from '../lib/cbg.mjs';
const now=Date.parse('2026-10-28T03:00:00Z'),iso=n=>new Date(n).toISOString();
const item=(id,price=10000,extra={})=>({id,skin:'谪星·测试',equipType:'1',slots:[1,2],unlocks:[1,1],holesCount:2,priceCents:price,favorites:1,status:'listed',publicity:false,ordersn:id,serverId:2,isLottery:true,lotteryConfirmed:true,lotteryEndsAt:iso(now+900000),observedAt:iso(now),...extra});
const upcoming=(id='future',price=10000,extra={})=>item(id,price,{publicity:true,isLottery:false,lotteryStartsAt:iso(now+7200000),lotteryEndsAt:iso(now+8100000),lotteryWindowConfirmed:true,...extra});
test('upcoming windows require real detail timing; never become active just because the clock reaches start',()=>{
 assert.equal(lotteryWindow(upcoming(),now),'upcoming');assert.equal(lotteryWindow(upcoming('far',1,{lotteryStartsAt:iso(now+7*3600000)}),now),null);
 assert.equal(lotteryWindow(upcoming('unverified',1,{lotteryWindowConfirmed:false}),now),null);assert.equal(lotteryWindow(upcoming(),now+7200000),null);assert.equal(lotteryWindow(item('active'),now),'active');
 assert.equal(rankCandidates([upcoming('due',100,{lotteryStartsAt:iso(now-60000),lotteryEndsAt:iso(now+600000)})],[],now).length,1);
});
test('first listing and repeated self observations do not establish a deal; independent confirmed lows do',()=>{
 const i=item('first'),batch={at:iso(now),coverage:'partial',items:[i]};let summary=lotterySummary([batch],now);assert.equal(priceSignal(i,summary.groups[0]).good,false);
 summary=advanceLottery(summary,{...batch,at:iso(now+1),items:[{...i,observedAt:iso(now+1)}]});assert.equal(summary.groups[0].priceSamples.length,1);assert.equal(priceSignal(i,summary.groups[0]).good,false);
 const lower=item('lower',9000);summary=advanceLottery(summary,{...batch,at:iso(now+2),items:[lower]});assert.equal(priceSignal(lower,summary.groups[0]).kind,'new-low');assert.equal(summary.groups[0].previousLowCents,10000);
 assert.equal(priceSignal(item('equal',9000),summary.groups[0]).kind,'historic-low');assert.equal(priceSignal(item('other',9000,{holesCount:1}),undefined).good,false);
 assert.equal(priceSignal({...lower,priceCents:9500},summary.groups[0]).good,false,'a rebound by the same listing must not be called a new low');
});
test('near low requires three independent references and a material median discount; excludes stale/expired/unconfirmed windows',()=>{
 const group={priceCents:10000,item:item('a'),priceSamples:[{id:'a',priceCents:10000},{id:'b',priceCents:12000},{id:'c',priceCents:13000}]};assert.equal(priceSignal(item('near',10400),group).kind,'near-low');assert.equal(priceSignal(item('ordinary',11000),group).good,false);assert.equal(priceSignal(item('few',10400),{...group,priceSamples:[]}).good,false);
 assert.equal(lotteryOpportunities([item('stale',9000,{observedAt:iso(now-66*60000)}),item('expired',9000,{lotteryEndsAt:iso(now)}),upcoming('unknown',9000,{lotteryWindowConfirmed:false})],[{...group,key:groupKey(item('x'))}],now).length,0);
});
test('upcoming snapshot persists without altering confirmed lottery low or generating new-low events',()=>{
 const active=item('old',10000),summary=lotterySummary([{at:iso(now),coverage:'partial',items:[active]}],now),future=upcoming('future',5000);
 const next=advanceLottery(summary,{at:iso(now+1),coverage:'partial',items:[future]});assert.equal(next.groups[0].priceCents,10000);assert.equal(next.events.length,0);
 const live=mergeLiveSnapshot(null,{at:iso(now),items:[future],checked:[{id:future.id,at:iso(now)}],upcomingHours:6});assert.equal(live.items.length,1);const result=lotteryWithLive(next,live,null,now);assert.equal(result.liveItems.length,0);assert.equal(result.opportunities[0].window,'upcoming');assert.equal(result.opportunities[0].deal.good,true);
 assert.equal(lotteryWithLive(next,live,null,now+7200000).opportunities.length,0);
});
test('official detail timestamps are parsed as China time; list times alone remain unconfirmed',async()=>{
 const raw={format_equip_name:'谪星·测试',equip_type:'1',other_info:{variation_info:{variation_id:'1-2',variation_unlock:'1-1'}},price:10000,collect_num:1,eid:'x',game_ordersn:'x',serverid:2,status:2,pass_fair_show:0,is_random_draw_period:false,fair_show_end_time:'2026-10-28 13:00:00',random_draw_finish_time:'2026-10-28 13:15:00'};
 const basic=normalizeItem(raw);assert.equal(basic.lotteryStartsAt,'2026-10-28T05:00:00.000Z');assert.equal(basic.lotteryWindowConfirmed,false);
 const detail=await queryDetail(basic,async()=>({ok:true,json:async()=>({status:1,equip:raw})}));assert.equal(lotteryWindow(detail,now),'upcoming');assert.equal(detail.lotteryEndsAt,'2026-10-28T05:15:00.000Z');
});
test('focused collector caps requests and writes, ignores ordinary merchandise, and does not paginate every catalog type',async()=>{
 let tick=now,saved,imported,queries=[],calls=0;
 const raw=(id,lottery)=>({format_equip_name:'谪星·测试',equip_type:'1',other_info:{variation_info:{variation_id:'1-2',variation_unlock:'1-1'}},price:10000,collect_num:1,eid:id,game_ordersn:id,serverid:2,status:2,pass_fair_show:1,is_random_draw_period:lottery});
 const storage={settings:{get:async()=>null},inventory:{candidates:async()=>[],saveDetails:async items=>{saved=items}},store:{import:async batch=>{imported=batch}}};
 const result=await collectOpportunities(storage,{catalog:Array.from({length:80},(_,n)=>({id:String(n)})),clock:()=>tick,sleep:async ms=>{tick+=ms},policy:{maxDetails:2},pageQuery:async p=>{queries.push(p);return {result:[raw('active-'+p.order_by+p.page,true),raw('ordinary',false)],paging:{is_last_page:false}}},detailQuery:async i=>{calls++;return {...i,lotteryConfirmed:true,lotteryEndsAt:iso(now+900000)}}});
 assert.equal(queries.length,6);assert.equal(calls,2);assert.equal(result.requests,8);assert.equal(saved.length,2);assert.equal(imported.items.length,2);assert.ok(queries.every(q=>!q.equip_type));assert.equal(result.mode,'opportunities');assert.equal(result.partial,true);
});
