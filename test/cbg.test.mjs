import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeItem,queryPage,queryDetail} from '../lib/cbg.mjs';
test('真实字段映射保留整数分、收藏与锁孔，不将未解锁格数算成孔数',()=>{
 const item=normalizeItem({format_equip_name:'谪星·测试',other_info:{variation_info:{variation_id:'2972-461-0',variation_unlock:'1-1-0'}},price:210000,collect_num:12,eid:'abc',serverid:2,status:2,pass_fair_show:1,equip_type:'1'});
 assert.equal(item.priceCents,210000);assert.equal(item.holesCount,2);assert.deepEqual(item.slots,[2972,461,0]);assert.equal(item.publicity,false);
 assert.equal(normalizeItem({format_equip_name:'宝箱'}),null);
});
test('无星格2P保留零孔，购买链接采用game_ordersn，详情确认抽签截止时间',async()=>{
 const raw={format_equip_name:'谪星·2P',equip_type:'3400046',other_info:{variation_info:{}},price:10000,collect_num:2,eid:'listing-id',game_ordersn:'real-order',serverid:2,status:2,pass_fair_show:1,is_random_draw_period:true,random_draw_finish_time:'2026-10-20 15:00:00'};
 const item=normalizeItem(raw);assert.equal(item.holesCount,0);assert.ok(item.url.endsWith('/real-order'));const detail=await queryDetail(item,async()=>({ok:true,json:async()=>({status:1,equip:raw})}));assert.equal(detail.lotteryEndsAt,'2026-10-20T07:00:00.000Z');assert.equal(detail.lotteryConfirmed,true);
});
test('验证页、限流和无效响应必须停止，不以空商品成功代替',async()=>{
 await assert.rejects(queryPage({},async()=>{throw new TypeError('fetch failed',{cause:{code:'UNABLE_TO_VERIFY_LEAF_SIGNATURE'}})}),/UNABLE_TO_VERIFY_LEAF_SIGNATURE/);
 await assert.rejects(queryPage({},async()=>({ok:false,status:429})),/429/);
 await assert.rejects(queryPage({},async()=>({ok:true,json:async()=>{throw Error()}})),/非JSON/);
 await assert.rejects(queryPage({},async()=>({ok:true,json:async()=>({status:0})})),/未成功/);
});
