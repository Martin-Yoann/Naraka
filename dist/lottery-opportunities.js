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
export function priceSignal(item,group){
 const samples=(group?.priceSamples??[]).filter(s=>s.id!==item.id&&Number.isSafeInteger(s.priceCents)&&s.priceCents>0);
 if(group?.item?.id!==item.id&&group?.priceCents>0&&!samples.some(s=>s.id===group.item?.id))samples.push({id:group.item?.id,priceCents:group.priceCents});
 const reference=group?.item?.id===item.id&&item.priceCents<=group.priceCents?group?.previousLowCents:group?.priceCents;
 if(reference>0&&item.priceCents<=reference)return {good:true,kind:item.priceCents<reference?'new-low':'historic-low',referenceCents:reference,referenceCount:samples.length,discount:Math.max(0,1-item.priceCents/reference)};
 if(samples.length>=opportunityPolicy.minReferenceItems){
  const prices=samples.map(s=>s.priceCents).sort((a,b)=>a-b),mid=Math.floor(prices.length/2),median=prices.length%2?prices[mid]:(prices[mid-1]+prices[mid])/2;
  if(item.priceCents<=prices[0]*opportunityPolicy.nearLowRatio&&item.priceCents<=median*opportunityPolicy.medianDiscountRatio)return {good:true,kind:'near-low',referenceCents:prices[0],medianCents:median,referenceCount:samples.length,discount:1-item.priceCents/median};
 }
 return {good:false,kind:samples.length<opportunityPolicy.minReferenceItems?'insufficient':'ordinary',referenceCents:reference??null,referenceCount:samples.length};
}
export function rankCandidates(items,groups=[],now=Date.now(),hours=opportunityPolicy.upcomingHours){
 const known=new Map(groups.map(g=>[g.key,g]));
 const priority=i=>{const signal=priceSignal(i,known.get(groupKey(i))),start=Date.parse(i.lotteryStartsAt);return (i.isLottery?1000:500)+(signal.good?200:0)+(start>now?Math.max(0,100-(start-now)/360000):0)};
 return [...new Map(items.filter(i=>isCandidate(i,now,hours)).map(i=>[i.id,i])).values()].sort((a,b)=>priority(b)-priority(a)||a.priceCents-b.priceCents||a.id.localeCompare(b.id));
}
export function lotteryOpportunities(items,groups=[],now=Date.now(),hours=opportunityPolicy.upcomingHours){
 const known=new Map(groups.map(g=>[g.key,g]));
 return [...new Map(items.map(i=>[i.id,i])).values()].filter(i=>{const age=now-Date.parse(i.observedAt);return age>=-60000&&age<=65*60000&&lotteryWindow(i,now,hours)}).map(i=>({...i,window:lotteryWindow(i,now,hours),deal:priceSignal(i,known.get(groupKey(i)))})).sort((a,b)=>Number(b.deal.good)-Number(a.deal.good)||(a.window==='active'?0:1)-(b.window==='active'?0:1)||Date.parse(a.lotteryStartsAt??0)-Date.parse(b.lotteryStartsAt??0)||a.priceCents-b.priceCents);
}
