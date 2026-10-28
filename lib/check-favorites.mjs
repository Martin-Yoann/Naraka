import {queryDetail} from './cbg.mjs';
export async function recheckFavoriteItems(storage,candidates,{detail=queryDetail,sleep=ms=>new Promise(r=>setTimeout(r,ms)),clock=Date.now}={}){
 const started=clock(),items=[],checked=[],configured=Number((await storage.settings?.get?.('collection.json'))?.upcomingHours??6),upcomingHours=configured>=1&&configured<=24?configured:6;let failure=null,requests=0;
 const fetcher=(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(Math.max(1,Math.min(8000,55000-(clock()-started))))});
 for(const candidate of [...new Map(candidates.map(i=>[i.id,i])).values()].slice(0,12)){
  if(clock()-started>45000)break;if(requests)await sleep(1600);let lease=await storage.lease('public-detail',.025);if(!lease){await sleep(1600);lease=await storage.lease('public-detail',.025)}if(!lease)break;requests++;
  try{const raw=await detail(candidate,fetcher),at=new Date(clock()).toISOString(),fresh=raw?{...raw,skin:candidate.skin,observedAt:at}:{...candidate,status:'unknown',isLottery:false,lotteryConfirmed:false,lotteryWindowConfirmed:false,observedAt:at};items.push(fresh);checked.push({id:fresh.id,at,eligible:fresh.isLottery===true&&fresh.lotteryConfirmed===true&&Date.parse(fresh.lotteryEndsAt)>clock()})}catch(e){failure=e.message;break}
 }
 if(items.length){const at=new Date(clock()).toISOString();await storage.lottery.saveRefresh({at,items,checked,state:failure?'error':'idle',scope:'已收藏商品开抽核验',scopeType:'',requests,checkedCount:checked.length,eligibleCount:checked.filter(c=>c.eligible).length,upcomingHours,partial:true,error:failure,completedAt:at})}
 return {checked:checked.length,requests,error:failure};
}
