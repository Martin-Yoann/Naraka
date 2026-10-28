export const groupKey=item=>JSON.stringify([item.skin,item.holesCount??item.slots.length]);
export function priceSamples(previous=[],items=[]){const samples=new Map(previous.map(s=>[s.id,s]));for(const item of items){samples.delete(item.id);samples.set(item.id,{id:item.id,priceCents:item.priceCents,observedAt:item.observedAt,slots:item.slots,unlocks:item.unlocks})}return [...samples.values()].slice(-64)}
export function verifiedLottery(item,at){return item.status==='listed'&&item.lotteryConfirmed===true&&item.isLottery===true&&Date.parse(item.lotteryEndsAt)>Date.parse(at)}
export function lotterySummary(batches,now=Date.now()){
 const groups=new Map(),events=[];
 for(const batch of [...batches].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))){
  if(batch.coverage==='failed')continue;
  const current=new Map();for(const item of batch.items){if(!verifiedLottery(item,item.observedAt??batch.at))continue;const key=groupKey(item);if(!current.has(key)||item.priceCents<current.get(key).priceCents)current.set(key,item)}
  for(const[key,item]of current){const old=groups.get(key);const isLow=old&&item.priceCents<old.priceCents;
   if(isLow)events.push({id:`${key}:${item.priceCents}`,key,skin:item.skin,holesCount:item.holesCount??item.slots.length,previousCents:old.priceCents,priceCents:item.priceCents,itemId:item.id,url:item.url,at:item.observedAt??batch.at,endsAt:item.lotteryEndsAt,slots:item.slots});
   if(!old||item.priceCents<old.priceCents)groups.set(key,{key,skin:item.skin,holesCount:item.holesCount??item.slots.length,priceCents:item.priceCents,at:item.observedAt??batch.at,firstObservedAt:old?.firstObservedAt??item.observedAt??batch.at,previousLowCents:isLow?old.priceCents:old?.previousLowCents??null,priceSamples:old?.priceSamples??[],item});
   groups.get(key).lastObserved={...item,observedAt:item.observedAt??batch.at};groups.get(key).priceSamples=priceSamples(groups.get(key).priceSamples,batch.items.filter(i=>groupKey(i)===key&&verifiedLottery(i,i.observedAt??batch.at)));
  }
 }
 const latest=batches.filter(b=>b.coverage!=='failed').at(-1),active=new Map();
 for(const item of latest?.items??[]){if(!verifiedLottery(item,new Date(now).toISOString()))continue;const key=groupKey(item);if(!active.has(key)||item.priceCents<active.get(key).priceCents)active.set(key,item)}
 return {groups:[...groups.values()].map(g=>({...g,current:active.get(g.key)??null})),events:events.reverse(),startedAt:batches.find(b=>b.items.some(i=>i.lotteryConfirmed))?.at??null,observedAt:latest?.at??null};
}
