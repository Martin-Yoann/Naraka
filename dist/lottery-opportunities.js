import {groupKey,verifiedLottery} from './lottery.js';
export const opportunityPolicy={upcomingHours:6,maxUpcomingHours:24,nearLowRatio:1.05,medianDiscountRatio:.9,minReferenceItems:3,maxSamples:64};
export function lotteryWindow(item,now=Date.now(),hours=opportunityPolicy.upcomingHours){
 const at=typeof now==='number'?now:Date.parse(now);
 if(verifiedLottery(item,new Date(at).toISOString()))return 'active';
 const start=Date.parse(item.lotteryStartsAt),end=Date.parse(item.lotteryEndsAt);
 return item.status==='listed'&&item.publicity===true&&item.lotteryWindowConfirmed===true&&start>at&&start<=at+hours*3600000&&end>start?'upcoming':null;
}
export function isCandidate(item,now=Date.now(),hours=opportunityPolicy.upcomingHours){
 if(item.status!=='listed'||!Number.isSafeInteger(item.priceCents)||item.priceCents<=0||!item.ordersn)return false;
 if(item.isLottery===true)return !item.lotteryEndsAt||Date.parse(item.lotteryEndsAt)>now;
 const start=Date.parse(item.lotteryStartsAt);
 // List timestamps discover candidates; only a detail response confirms a window.
 return item.publicity===true&&start>now-30*60000&&start<=now+hours*3600000&&(!item.lotteryEndsAt||Date.parse(item.lotteryEndsAt)>now);
}
const quantile=(values,q)=>{const pos=(values.length-1)*q,lo=Math.floor(pos);return values[lo]+(values[Math.ceil(pos)]-values[lo])*(pos-lo)};
export function priceSignal(item,group,now=Date.now()){
 const raw=(group?.priceSamples??[]).filter(s=>s.id!==item.id&&typeof s.id==='string'&&Number.isSafeInteger(s.priceCents)&&s.priceCents>0),samples=[...new Map(raw.map(s=>[s.id,s])).values()];
 if(group?.item?.id!==item.id&&group?.priceCents>0&&!samples.some(s=>s.id===group.item?.id))samples.push({id:group.item?.id,priceCents:group.priceCents,observedAt:group.at,unlocks:group.item?.unlocks});
 const reference=group?.item?.id===item.id&&item.priceCents<=group.priceCents?group?.previousLowCents:group?.priceCents;
 const mask=Array.isArray(item.unlocks)?item.unlocks.join(''):null;
 const recent=samples.filter(s=>{const age=now-Date.parse(s.observedAt);return Number.isFinite(age)&&age>=-60000&&age<=30*86400000&&(!mask||!Array.isArray(s.unlocks)||s.unlocks.join('')===mask)});
 const same=recent.filter(s=>Array.isArray(s.unlocks)&&s.unlocks.join('')===mask),comparable=same.length>=3?same:recent,basis=same.length>=3?'same-unlocks':'same-holes';
 const confidence=comparable.length>=8?'high':comparable.length>=3?'medium':'low';
 const common={referenceCount:comparable.length,totalReferenceCount:samples.length,confidence,basis,allTimeLowCents:group?.priceCents??null};
 if(reference>0&&item.priceCents<=reference)return {...common,good:true,kind:item.priceCents<reference?'new-low':'historic-low',referenceCents:reference,discount:Math.max(0,1-item.priceCents/reference),score:item.priceCents<reference?96:90,reasons:['按同款同孔数比较，达到此前已确认抽签低价',comparable.length>=3?'近期有 '+comparable.length+' 件独立商品作参考':'近期独立样本较少，请重点核对星格与外观']};
 if(comparable.length>=3){
  const prices=comparable.map(s=>s.priceCents).sort((a,b)=>a-b),q1=quantile(prices,.25),q3=quantile(prices,.75),iqr=q3-q1;
  const core=prices.length>=5&&iqr>0?prices.filter(p=>p>=q1-1.5*iqr&&p<=q3+1.5*iqr):prices;
  const median=quantile(core,.5),lower=quantile(core,.25),discount=1-item.priceCents/median;
  if(discount>=.1&&item.priceCents<=lower){const near=item.priceCents<=core[0]*1.05;return {...common,good:true,kind:near?'near-low':'recent-value',referenceCents:core[0],medianCents:median,discount,excludedOutliers:prices.length-core.length,score:Math.min(89,Math.round(65+discount*70+Math.min(core.length,10))),reasons:['低于近期中位价 '+(discount*100).toFixed(1)+'%，且处于较低四分位',basis==='same-unlocks'?'参考商品解锁位置一致':'按相同孔数比较，解锁位置样本有限',prices.length>core.length?'已排除 '+(prices.length-core.length)+' 件异常价格样本':'已排除本商品自身的重复观察']}}
 }
 return {...common,good:false,kind:comparable.length<3?'insufficient':'ordinary',referenceCents:reference??null,score:0,reasons:[comparable.length<3?'近期可比独立样本不足3件，暂不判定近期好价':'未达到史低或近期折价门槛']};
}
export function rankCandidates(items,groups=[],now=Date.now(),hours=opportunityPolicy.upcomingHours){
 const known=new Map(groups.map(g=>[g.key,g]));
 const priority=i=>{const signal=priceSignal(i,known.get(groupKey(i)),now),start=Date.parse(i.lotteryStartsAt);return (i.isLottery?1000:500)+(signal.good?200:0)+(start>now?Math.max(0,100-(start-now)/360000):0)};
 return [...new Map(items.filter(i=>isCandidate(i,now,hours)).map(i=>[i.id,i])).values()].sort((a,b)=>priority(b)-priority(a)||a.priceCents-b.priceCents||a.id.localeCompare(b.id));
}
export function lotteryOpportunities(items,groups=[],now=Date.now(),hours=opportunityPolicy.upcomingHours){
 const known=new Map(groups.map(g=>[g.key,g]));
 return [...new Map(items.map(i=>[i.id,i])).values()].filter(i=>{const age=now-Date.parse(i.observedAt);return age>=-60000&&age<=65*60000&&lotteryWindow(i,now,hours)}).map(i=>({...i,window:lotteryWindow(i,now,hours),deal:priceSignal(i,known.get(groupKey(i)))})).sort((a,b)=>Number(b.deal.good)-Number(a.deal.good)||(a.window==='active'?0:1)-(b.window==='active'?0:1)||Date.parse(a.lotteryStartsAt??0)-Date.parse(b.lotteryStartsAt??0)||a.priceCents-b.priceCents);
}
