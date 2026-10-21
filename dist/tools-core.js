import {matches} from './core.js';
import {verifiedLottery} from './lottery.js';
export function filterItems(items,filter,now=Date.now()){
 return items.filter(item=>item.status==='listed'&&matches(item,filter)&&(!filter.category||item.category===filter.category)&&(!filter.query||item.skin.toLowerCase().includes(filter.query.toLowerCase())||item.id.toLowerCase().includes(filter.query.toLowerCase()))&&(filter.priceMin==null||item.priceCents>=filter.priceMin)&&(filter.priceMax==null||item.priceCents<=filter.priceMax)&&(filter.favoritesMin==null||item.favorites>=filter.favoritesMin)&&(!filter.lotteryOnly||verifiedLottery(item,new Date(now).toISOString()))&&(filter.requireUnlocked??[]).every((required,index)=>!required||item.unlocks?.[index]===1)&&(filter.ranges??[]).every((range,index)=>(range.min==null&&range.max==null)||item.unlocks?.[index]!==0));
}
export function uniqueSamples(batches,skin){
 const samples=new Map();for(const batch of batches){if(batch.coverage==='failed')continue;for(const item of batch.items){if(skin&&item.skin!==skin)continue;const key=JSON.stringify([item.skin,item.slots,item.unlocks]);const existing=samples.get(key);if(!existing||Date.parse(batch.at)>Date.parse(existing.observedAt))samples.set(key,{...item,observedAt:batch.at})}}
 return [...samples.values()];
}
export function trendPoints(batches,filter,days=7,now=Date.now()){
 return batches.filter(batch=>Date.parse(batch.at)>=now-days*86400000).map(batch=>{const sorted=batch.coverage==='failed'?[]:filterItems(batch.items,filter,Date.parse(batch.at)).sort((a,b)=>a.priceCents-b.priceCents);return {at:batch.at,coverage:batch.coverage,count:batch.coverage==='failed'?null:sorted.length,min:sorted[0]?.priceCents??null,median:sorted.length>=3?sorted[1].priceCents:null,item:sorted[0]?.id??null}});
}
export function simulationCandidates(samples,base,locks){
 return samples.filter(sample=>sample.skin===base.skin&&(sample.holesCount??sample.slots.length)===(base.holesCount??base.slots.length)&&sample.slots.length===base.slots.length&&sample.unlocks?.join('-')===base.unlocks?.join('-')&&locks.every((locked,index)=>!locked||sample.slots[index]===base.slots[index]));
}
export function sampleHit(sample,ranges){return ranges.every((range,index)=>(range.min==null&&range.max==null)||(sample.slots[index]!=null&&sample.unlocks?.[index]!==0&&(range.min==null||sample.slots[index]>=range.min)&&(range.max==null||sample.slots[index]<=range.max)))}
export function drawSample(candidates,random=Math.random){if(!candidates.length)throw Error('没有满足固定条件的真实样本');return candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))]}
