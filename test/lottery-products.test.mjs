import test from 'node:test';
import assert from 'node:assert/strict';
import {lotteryWithLive} from '../lib/lottery-live.mjs';
import {currentLottery} from '../lib/cloud-lottery.mjs';
import {compactLottery} from '../dist/market-payload.js';
test('抽签商品列表保留同款同孔的不同商品，去重并剔除截止及过期观察',()=>{
 const now=Date.now(),at=new Date(now).toISOString(),make=(id,priceCents)=>({id,skin:'隔离测试',holesCount:1,priceCents,slots:[0],unlocks:[1],isLottery:true,lotteryConfirmed:true,status:'listed',observedAt:at,lotteryEndsAt:new Date(now+60000).toISOString(),previewFrames:['fixture']});
 const a=make('a',100),b=make('b',200),expired={...make('expired',1),lotteryEndsAt:new Date(now-1).toISOString()},stale={...make('stale',1),observedAt:new Date(now-66*60000).toISOString()};
 const summary={groups:[{key:JSON.stringify(['隔离测试',1]),skin:a.skin,holesCount:1,priceCents:100,current:a,item:a}],events:[],observedAt:at};
 const merged=lotteryWithLive(summary,{items:[a,b,expired,stale],observedAt:at},null,now);assert.deepEqual(merged.liveItems.map(i=>i.id),['a','b']);assert.equal(compactLottery(merged).liveItems[0].previewFrames,undefined);assert.equal(currentLottery(merged,now+60001).liveItems.length,0);
});
