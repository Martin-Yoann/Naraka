import {normalizeItem,queryPage,queryDetail} from './cbg.mjs';
import {rankCandidates,lotteryWindow} from '../dist/lottery-opportunities.js';
export const collectionPolicy={listPages:6,maxDetails:32,maxCandidates:96,maxDurationMs:120000,requestIntervalMs:1600,upcomingHours:6};
export async function collectOpportunities(storage,{catalog=[],policy={},pageQuery=queryPage,detailQuery=queryDetail,clock=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const config={...collectionPolicy,...policy},started=clock(),atStart=new Date(started).toISOString(),candidates=new Map(),items=[],checked=[];let pages=0,listed=0,requests=0,failure=null;
 const historical=await storage.settings.get('lottery.json'),remaining=()=>config.maxDurationMs-(clock()-started);
 const fetcher=(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(Math.max(1,Math.min(8000,remaining()-1500)))});
 async function throttle(){if(requests)await sleep(config.requestIntervalMs);if(remaining()<10000)return false;if(storage.lease){let lease=await storage.lease('public-detail',.025);if(!lease){await sleep(config.requestIntervalMs);lease=await storage.lease('public-detail',.025)}if(!lease)return false}requests++;return true}
 try{
  for(let n=0;n<config.listPages;n++){
   if(!await throttle())break;
   const low=n>=4,body=await pageQuery({order_by:low?'price ASC':'selling_time DESC',page:String(low?n-3:n+1),pass_fair_show:''},fetcher);pages++;listed+=body.result.length;
   for(const raw of body.result){const item=normalizeItem(raw);if(item)candidates.set(item.id,item)}
   if(body.paging?.is_last_page&&!low)n=3;else if(body.paging?.is_last_page&&low)break;
  }
  for(const item of await storage.inventory.candidates())if(!candidates.has(item.id))candidates.set(item.id,item);
  const queue=rankCandidates([...candidates.values()],historical?.groups,clock(),config.upcomingHours).slice(0,config.maxCandidates);
  candidates.clear();for(const item of queue)candidates.set(item.id,item);
  for(const candidate of queue){
   if(checked.length>=config.maxDetails||!await throttle())break;
   const raw=await detailQuery(candidate,fetcher),at=new Date(clock()).toISOString();
   const fresh=raw?{...raw,skin:catalog.find(c=>c.id===raw.equipType)?.name??raw.skin,observedAt:at}:{...candidate,status:'unknown',isLottery:false,lotteryConfirmed:false,lotteryWindowConfirmed:false,lotteryEndsAt:null,observedAt:at};
   items.push(fresh);checked.push({id:fresh.id,at,eligible:lotteryWindow(fresh,clock(),config.upcomingHours)==='active'});
  }
 }catch(error){failure=error.message}
 const at=new Date(clock()).toISOString(),eligible=items.filter(i=>lotteryWindow(i,clock(),config.upcomingHours));
 const report={mode:'opportunities',state:failure?'error':'idle',startedAt:atStart,completedAt:at,at,upcomingHours:config.upcomingHours,scope:`最新上架最多4页＋低价最多2页；仅核验当前抽签及未来${config.upcomingHours}小时候选`,pages,listed,requests,candidateCount:candidates.size,checkedCount:checked.length,eligibleCount:eligible.filter(i=>lotteryWindow(i,clock(),config.upcomingHours)==='active').length,upcomingCount:eligible.filter(i=>lotteryWindow(i,clock(),config.upcomingHours)==='upcoming').length,partial:true,error:failure,config};
 if(storage.lottery)await storage.lottery.saveRefresh({...report,items,checked});else await storage.inventory.saveDetails(items,at);
 const batch={at,coverage:eligible.length||!failure?'partial':'failed',items:eligible,metadata:{source:'cbg',mode:'opportunities',scope:report.scope,catalog,requests,config,error:failure,startedAt:atStart,finishedAt:at}};
 await storage.store.import(batch);return {...report,batch};
}
