import test from 'node:test';
import assert from 'node:assert/strict';
import {filterItems,uniqueSamples,trendPoints,simulationCandidates,sampleHit,drawSample} from '../dist/tools-core.js';
const item={id:'real-1',skin:'谪星·狼主',slots:[0,20,30,40],unlocks:[1,1,0,1],holesCount:3,priceCents:10000,favorites:7,status:'listed',category:'weapon'};
test('自定搜索保留零数值与零孔条件，未解锁格不能满足目标',()=>{
 assert.equal(filterItems([item],{ranges:[{min:0,max:0}]}).length,1);
 assert.equal(filterItems([item],{ranges:[{},{},{min:30}]}).length,0);
 assert.equal(filterItems([item],{requireUnlocked:[false,false,true]}).length,0);
 assert.equal(filterItems([item],{priceMax:9999}).length,0);
 assert.equal(filterItems([{...item,slots:[],unlocks:[],holesCount:0}],{holes:'0'}).length,1);
});
test('图鉴按完整数值和解锁状态去重，保留最新来源并跳过失败批次',()=>{
 const samples=uniqueSamples([{at:'2026-10-20T00:00:00Z',items:[item]},{at:'2026-10-20T00:30:00Z',items:[{...item,id:'real-2'}]},{at:'2026-10-20T01:00:00Z',coverage:'failed',items:[{...item,slots:[9]}]}]);
 assert.equal(samples.length,1);assert.equal(samples[0].id,'real-2');
});
test('趋势缺采和无匹配均为null，不用零补齐；不足三件不计算中位数',()=>{
 const points=trendPoints([{at:'2026-10-20T00:00:00Z',items:[item]},{at:'2026-10-20T00:30:00Z',coverage:'failed',items:[]},{at:'2026-10-20T01:00:00Z',items:[]}],{},1,Date.parse('2026-10-20T02:00:00Z'));
 assert.equal(points[0].min,10000);assert.equal(points[0].median,null);assert.equal(points[1].count,null);assert.equal(points[2].count,0);assert.equal(points[2].min,null);
});
test('样本演练仅选择相同孔数解锁形态且满足锁定的完整真实组合',()=>{
 const second={...item,id:'real-2',slots:[0,21,30,41]},wrong={...item,id:'wrong',unlocks:[1,1,1,1],holesCount:4};
 const candidates=simulationCandidates([item,second,wrong],item,[true,false,true,false]);
 assert.deepEqual(candidates,[item,second]);assert.equal(drawSample(candidates,()=>.9),second);assert.equal(drawSample(candidates,()=>0),item);
 assert.equal(sampleHit(second,[{min:0,max:0},{min:21}]),true);assert.equal(sampleHit(second,[{},{},{min:30}]),false);assert.throws(()=>drawSample([]));
});
