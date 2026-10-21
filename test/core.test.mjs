import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculate,aggregate} from '../dist/core.js';
import {openStore} from '../lib/store.mjs';
test('反推挂价达到目标，且少一分不满足目标，包括最低费用和封顶',()=>{
  for(const rule of [{rate:6,min:0,max:null,extra:0},{rate:6,min:1000,max:5000,extra:399},{rate:0,min:100,max:null,extra:200},{rate:99.99,min:0,max:null,extra:0}]){
    for(const amount of [0,1,10000,100000,1234567]){const r=calculate(amount,rule,true);assert.ok(r.net>=amount);if(r.price>0)assert.ok(calculate(r.price-1,rule).net<amount)}
  }
});
test('费用封顶与最低费用生效，负数与矛盾规则拒绝',()=>{
  assert.equal(calculate(10000,{rate:6,min:1000,max:2000,extra:0}).fee,1000);
  assert.equal(calculate(100000,{rate:6,min:1000,max:2000,extra:0}).fee,2000);
  assert.throws(()=>calculate(-1,{rate:6,min:0,max:null,extra:0}));
  assert.throws(()=>calculate(100,{rate:6,min:100,max:50,extra:0}));
});
test('最低价只统计同条件在售商品，缺少三件不显示中位数',()=>{
  const base={skin:'狼主',slots:[500,600,700],publicity:false,status:'listed'};
  const items=[{...base,id:'a',priceCents:100},{...base,id:'b',priceCents:200},{...base,id:'c',priceCents:300},{...base,id:'d',status:'sold',priceCents:1},{...base,id:'e',publicity:true,priceCents:2}];
  assert.deepEqual(aggregate(items,{skin:'狼主',publicity:'no'}),{count:3,min:100,median:200,item:'a'});
  assert.equal(aggregate(items,{minimum:999}).min,null);
  assert.equal(aggregate(items.slice(0,2),{}).median,null);
});
test('导入校验、幂等写入、失败状态和顺序保留',()=>{
  const db=openStore(':memory:');const item={id:'a',skin:'测试',slots:[500],priceCents:100,favorites:2,publicity:false,status:'listed'};
  const batch={at:'2026-10-20T00:00:00Z',coverage:'partial',items:[item]};db.import(batch);db.import(batch);db.import({at:'2026-10-20T01:00:00Z',coverage:'failed',items:[]});assert.equal(db.read().batches.length,2);assert.equal(db.read().batches[1].coverage,'failed');
  assert.throws(()=>db.import({...batch,items:[{...item,priceCents:1.2}]}));assert.throws(()=>db.import({...batch,items:[item,item]}));assert.throws(()=>db.import({...batch,items:[{...item,url:'javascript:alert(1)'}]}));db.close();
});
