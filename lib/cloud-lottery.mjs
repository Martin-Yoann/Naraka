import {lotterySummary,verifiedLottery} from '../dist/lottery.js';
export function advanceLottery(previous,batch){
 if(batch.coverage==='failed'&&previous)return previous;
 const next=lotterySummary([batch]),groups=new Map((previous?.groups??[]).map(g=>[g.key,{...g,current:null}])),events=[...(previous?.events??[])];
 for(const incoming of next.groups){const old=groups.get(incoming.key);if(!old){groups.set(incoming.key,incoming);continue}const current=incoming.item;if(current.priceCents<old.priceCents){const event={id:`${incoming.key}:${current.priceCents}`,key:incoming.key,skin:incoming.skin,holesCount:incoming.holesCount,previousCents:old.priceCents,priceCents:current.priceCents,itemId:current.id,url:current.url,at:current.observedAt??batch.at,endsAt:current.lotteryEndsAt,slots:current.slots};if(!events.some(e=>e.id===event.id))events.push(event);groups.set(incoming.key,{...incoming,firstObservedAt:old.firstObservedAt})}}
 const active=new Map(next.groups.map(g=>[g.key,g.current]));return {groups:[...groups.values()].map(g=>({...g,current:active.get(g.key)??null})),events:events.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)),startedAt:previous?.startedAt??next.startedAt,observedAt:batch.coverage==='failed'?previous?.observedAt??null:batch.at};
}
export function currentLottery(summary){if(!summary)return null;return {...summary,groups:summary.groups.map(g=>({...g,current:g.current&&verifiedLottery(g.current,new Date().toISOString())?g.current:null}))}}
