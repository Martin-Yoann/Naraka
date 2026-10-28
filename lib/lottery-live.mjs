import {lotteryWindow,lotteryOpportunities} from '../dist/lottery-opportunities.js';
import {groupKey,verifiedLottery} from '../dist/lottery.js';
import {advanceLottery,currentLottery} from './cloud-lottery.mjs';
import {lotteryPolicy,dataPolicy} from './data-policy.mjs';
export function mergeLotteryObservation(previous,items,at){
 const next=advanceLottery(previous,{at,coverage:'partial',items}),old=new Map((previous?.groups??[]).map(g=>[g.key,g])),touched=new Set(items.map(i=>i.id));
 for(const group of next.groups){const candidates=[old.get(group.key)?.current,group.current].filter(i=>i&&(!touched.has(i.id)||items.some(n=>n.id===i.id&&verifiedLottery(n,n.observedAt??at)))&&verifiedLottery(i,at));const replacements=new Map(items.map(i=>[i.id,i]));group.current=candidates.map(i=>replacements.get(i.id)??i).filter(i=>verifiedLottery(i,at)).sort((a,b)=>a.priceCents-b.priceCents)[0]??null}
 next.events=next.events.slice(0,dataPolicy.maxLotteryEvents);return next;
}
export function mergeLiveSnapshot(previous,{items,checked,at,...metadata}){
 const live=new Map((previous?.items??[]).map(i=>[i.id,i]));for(const record of checked)live.delete(record.id);for(const item of items)if(lotteryWindow(item,Date.parse(at),metadata.upcomingHours??6))live.set(item.id,item);
 const markers=new Map((previous?.checked??[]).filter(c=>Date.parse(c.at)>Date.parse(at)-65*60000).map(c=>[c.id,c]));for(const record of checked)markers.set(record.id,record);
 return {...metadata,observedAt:at,items:[...live.values()].filter(i=>lotteryWindow(i,Date.parse(at),metadata.upcomingHours??6)&&Date.parse(i.observedAt)>Date.parse(at)-65*60000).sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt)).slice(0,lotteryPolicy.maxLiveItems),checked:[...markers.values()].slice(-1000)};
}
export function lotteryWithLive(summary,live,refresh,now=Date.now()){
 const result=currentLottery(summary??{groups:[],events:[],observedAt:null,startedAt:null},now),checks=new Map((live?.checked??[]).map(c=>[c.id,c])),groups=new Map(result.groups.map(g=>[g.key,{...g}]));
 for(const group of groups.values()){const check=checks.get(group.current?.id);if(check&&Date.parse(check.at)>Date.parse(group.current?.observedAt??summary?.observedAt??0))group.current=null}
 for(const item of live?.items??[]){if(!verifiedLottery(item,new Date(now).toISOString())||Date.parse(item.observedAt)<now-65*60000)continue;const key=groupKey(item),group=groups.get(key);if(!group)continue;if(!group.current||item.priceCents<group.current.priceCents)group.current=item}
 const products=new Map();for(const item of [...(live?.items??[]),...[...groups.values()].map(g=>g.current).filter(Boolean)])if(verifiedLottery(item,new Date(now).toISOString())&&now-Date.parse(item.observedAt??result.observedAt)<=65*60000)products.set(item.id,item);
 return {...result,opportunities:lotteryOpportunities([...(live?.items??[]),...products.values()],[...groups.values()],now,live?.upcomingHours??6),upcomingHours:live?.upcomingHours??6,liveItems:[...products.values()],groups:[...groups.values()],observedAt:[result.observedAt,live?.observedAt].filter(Boolean).sort().at(-1)??null,refresh:refresh??null,live:{observedAt:live?.observedAt??null,scope:live?.scope??null,scopeType:live?.scopeType??'',checkedCount:live?.checkedCount??0,eligibleCount:(live?.items??[]).filter(i=>verifiedLottery(i,new Date(now).toISOString())).length,partial:live?.partial??true},policy:{...lotteryPolicy,...dataPolicy}};
}
