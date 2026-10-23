import test from 'node:test';
import assert from 'node:assert/strict';
import {feeEstimate,minimumOffer,moneyCents} from '../dist/fee-model.js';
test('参考口径：挂价3000、还价2400，三种分配完整收支一致',()=>{
 for(const [share,supplement,total,net]of [['buyer',55200,295200,276000],['split',57600,297600,278400],['seller',60000,300000,280800]]){const r=feeEstimate({amount:'3000',offer:'2400',share});assert.equal(r.supplement,supplement);assert.equal(r.buyerTotal,total);assert.equal(r.sellerNet,net);assert.equal(r.fee,19200);assert.equal(r.saving,4800)}
});
test('填到手使用原始基准反推，八折进位到分，不提前对费率和挂价舍入',()=>{
 assert.equal(minimumOffer('target','3000'),260870);const r=feeEstimate({mode:'target',amount:'3000',offer:'2608.70',share:'buyer'});assert.equal(r.quote,326087);assert.equal(r.supplement,60000);assert.equal(r.sellerNet,300000);assert.equal(r.fee,20870);assert.equal(r.buyerTotal,320870);
 assert.equal(minimumOffer('quote','100.01'),8001);assert.throws(()=>feeEstimate({amount:'100.01',offer:'80.00'}),/八折/);
 const tiny=feeEstimate({amount:'0.07',offer:'0.06'});assert.equal(tiny.supplement,1);assert.equal(tiny.buyerTotal,7);assert.equal(tiny.saving,0,'差额按完整精度计算，再显示到分');
});
test('金额、边界、非法输入明确拒绝，不保留旧的成功结果',()=>{
 for(const value of ['', '1e3','-1','NaN','Infinity','1.001','100000001'])assert.throws(()=>moneyCents(value));
 for(const [amount,offer]of [['0','0'],['3000','0'],['3000','2399.99'],['3000','3000.01']])assert.throws(()=>feeEstimate({amount,offer}));
 assert.equal(feeEstimate({amount:'3000',offer:'3000'}).supplement,0);assert.throws(()=>feeEstimate({amount:'3000',offer:'2400',share:'invalid'}));
});
