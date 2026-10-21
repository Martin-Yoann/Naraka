import {fileURLToPath} from 'node:url';
import {openAccounts} from '../lib/accounts.mjs';
import {wechatConfig,} from '../lib/config.mjs';
import {sendPriceNotice} from '../lib/wechat.mjs';
import {queryDetail} from '../lib/cbg.mjs';
export async function deliverAlerts(events,marketItems){
 const accounts=openAccounts(fileURLToPath(new URL('../data/accounts.sqlite',import.meta.url)));let accepted=0;
 try{const queued=accounts.enqueue(events);const config=wechatConfig();if(!config.oaReady||!config.sendEnabled||!config.templateId)return {queued,accepted,channel:'not-configured'};
  for(const job of accounts.pending()){
   const event=JSON.parse(job.payload),item=marketItems.find(i=>i.id===event.itemId);
   if(!job.enabled||!item?.lotteryConfirmed||!item.isLottery||item.status!=='listed'||item.priceCents!==event.priceCents||Date.parse(item.lotteryEndsAt)<=Date.now()||Date.now()-Date.parse(event.at)>40*60000){accounts.finish(job.id,'expired','已过期、已退订或价格变化');continue}
   if(!job.oa_openid){accounts.finish(job.id,'blocked','需绑定公众号微信身份');continue}
   if(accounts.sentCount(job.user_id)>=3||accounts.recent(job.user_id,job.group_key)){accounts.finish(job.id,'limited','24小时最多3条，同配置6小时内最多1条');continue}
   if(!accounts.claim(job.id))continue;
   try{await new Promise(r=>setTimeout(r,1500));const fresh=await queryDetail(item);if(!fresh?.lotteryConfirmed||!fresh.isLottery||fresh.status!=='listed'||fresh.priceCents!==event.priceCents||Date.parse(fresh.lotteryEndsAt)<=Date.now()){accounts.finish(job.id,'expired','发送前复核发现已失效或改价');continue}const result=await sendPriceNotice(job.oa_openid,{...event,url:fresh.url});accounts.finish(job.id,'accepted',`msgid:${result.msgid}`);accepted++}catch{accounts.finish(job.id,'failed','详情复核或微信未确认受理；不自动重试，避免重复提醒')}
  }return {queued,accepted,channel:'wechat'};
 }finally{accounts.close()}
}
