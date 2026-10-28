import {rankCandidates,isCandidate,lotteryWindow} from '../dist/lottery-opportunities.js';
import {normalizeItem,queryPage,queryDetail} from './cbg.mjs';
import {lotteryPolicy} from './data-policy.mjs';
import {verifiedLottery} from '../dist/lottery.js';
export async function refreshLotterySource(storage,{type='',pageQuery=queryPage,detailQuery=queryDetail,clock=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const catalog=(await storage.settings.get('catalog.json'))?.items??[];
 if(type&&!catalog.some(c=>c.id===type))return {status:400,error:'请选择已收录的谪星类型'};
 const configured=Number((await storage.settings.get('collection.json'))?.upcomingHours??6),upcomingHours=configured>=1&&configured<=24?configured:6;
 const started=clock(),startedAt=new Date(started).toISOString();
 if(!await storage.lease('lottery-refresh',lotteryPolicy.cooldownSeconds/60))return {status:202,shared:true};
 const retryAt=new Date(clock()+lotteryPolicy.cooldownSeconds*1000).toISOString();
 const scope=type?(catalog.find(c=>c.id===type).name+' · 最新上架前2页'):'全部商品最新上架前2页中的谪星';
 await storage.settings.put('lottery-refresh.json',{state:'running',startedAt,retryAt,scope,scopeType:type});
 const candidates=new Map(),items=[],checked=[];let pages=0,listed=0,requests=0,failure=null;
 const remaining=()=>lotteryPolicy.maxDurationMs-(clock()-started);
 const fetcher=(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(Math.max(1,Math.min(lotteryPolicy.requestTimeoutMs,remaining()-2500)))});
 async function throttle(){if(requests)await sleep(lotteryPolicy.requestIntervalMs);if(remaining()<4000)return false;let acquired=await storage.lease('public-detail',0.025);if(!acquired){await sleep(lotteryPolicy.requestIntervalMs);acquired=await storage.lease('public-detail',0.025)}if(!acquired)return false;requests++;return true}
 try{
  for(let page=1;page<=lotteryPolicy.listPages;page++){if(!await throttle())break;const body=await pageQuery({order_by:'selling_time DESC',page:String(page),pass_fair_show:'',...(type?{equip_type:type}:{})},fetcher);pages++;listed+=body.result.length;for(const raw of body.result){const item=normalizeItem(raw);if(item&&isCandidate(item,clock(),upcomingHours))candidates.set(item.id,item)}if(body.paging?.is_last_page)break}
  // Shared ranking prioritizes active windows, proven prices and imminent starts.
  for(const item of await storage.inventory.candidates())if((!type||item.equipType===type)&&isCandidate(item,clock(),upcomingHours)&&!candidates.has(item.id))candidates.set(item.id,item);
  for(const candidate of rankCandidates([...candidates.values()],(await storage.settings.get('lottery.json'))?.groups,clock(),upcomingHours)){if(checked.length>=lotteryPolicy.maxDetails||!await throttle())break;const raw=await detailQuery(candidate,fetcher),at=new Date(clock()).toISOString(),fresh=raw?{...raw,skin:catalog.find(c=>c.id===raw.equipType)?.name??raw.skin,observedAt:at}:{...candidate,status:'unknown',isLottery:false,lotteryConfirmed:false,lotteryWindowConfirmed:false,lotteryEndsAt:null,observedAt:at};items.push(fresh);checked.push({id:candidate.id,at,eligible:verifiedLottery(fresh,at)})}
 }catch(error){failure=error.message}
 const at=new Date(clock()).toISOString(),partial=!!failure||pages<lotteryPolicy.listPages||checked.length<candidates.size;
 const report={state:failure?'error':'idle',startedAt,completedAt:at,retryAt,scope,scopeType:type,upcomingHours,upcomingCount:items.filter(i=>lotteryWindow(i,clock(),upcomingHours)==='upcoming').length,pages,listed,candidateCount:candidates.size,checkedCount:checked.length,eligibleCount:items.filter(i=>verifiedLottery(i,at)).length,requests,partial,error:failure};
 await storage.lottery.saveRefresh({items,checked,at,...report});
 return {status:failure&&!checked.length?502:200,...report};
}
