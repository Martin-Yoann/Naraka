import {cloudPool,transaction} from './cloud-db.mjs';
import {ensureUserSchema,matchesPreference} from './user-preferences.mjs';
import {wechatConfig} from './config.mjs';
import {sendPriceNotice,templateData} from './wechat.mjs';
import {queryDetail} from './cbg.mjs';
export function pushReady(cfg=wechatConfig()){try{templateData({skin:'',priceCents:0,previousCents:0,at:new Date().toISOString(),holesCount:0},cfg.templateFields);return !!(cfg.oaReady&&cfg.sendEnabled&&cfg.templateId)}catch{return false}}
export async function deliverPreferenceMessages({db=cloudPool(),config=wechatConfig(),detail=queryDetail,send=sendPriceNotice}={}){
 if(!pushReady(config))return {configured:false,accepted:0};await ensureUserSchema(db);let accepted=0;const started=Date.now();
 // Claim once before network I/O. Ambiguous failures are never automatically retried.
 for(let n=0;n<3&&Date.now()-started<90000;n++){
  const job=await transaction(db,async client=>{
   const m=(await client.query("SELECT * FROM zx_user_messages WHERE wechat_status='pending' ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1")).rows[0];if(!m)return null;
   const p=(await client.query('SELECT p.*,u.openid,u.appid FROM zx_user_preferences p JOIN zx_auth_users u ON u.id=p.user_id WHERE p.id=$1 FOR UPDATE OF p,u',[m.preference_id])).rows[0];
   const settings=(await client.query('SELECT alerts_enabled FROM zx_user_settings WHERE user_id=$1',[m.user_id])).rows[0];
   let status='sending';if(settings?.alerts_enabled===false||!p?.enabled||!p.wechat||p.revision!==m.revision||p.appid!==config.oaId)status='cancelled';else if(!(Date.parse(m.payload.lotteryEndsAt)>Date.now())||Date.now()-new Date(m.created_at).getTime()>65*60000)status='expired';
   else if(Number((await client.query("SELECT count(*) n FROM zx_user_messages WHERE user_id=$1 AND delivery_at>now()-interval '24 hours'",[m.user_id])).rows[0].n)>=3)status='limited';
   await client.query("UPDATE zx_user_messages SET wechat_status=$2,delivery_at=CASE WHEN $2='sending' THEN now() ELSE NULL END WHERE id=$1",[m.id,status]);return {m,p,status};
  });if(!job)break;if(job.status!=='sending')continue;
  let status='failed';try{
   const original=(await db.query('SELECT payload FROM zx_inventory WHERE id=$1',[job.m.item_id])).rows[0]?.payload;
   const fresh=original&&await detail(original);const current=(await db.query('SELECT * FROM zx_user_preferences WHERE id=$1',[job.p.id])).rows[0];
   const settings=(await db.query('SELECT alerts_enabled FROM zx_user_settings WHERE user_id=$1',[job.m.user_id])).rows[0];
   if(settings?.alerts_enabled===false||!current?.enabled||!current.wechat||current.revision!==job.m.revision)status='cancelled';
   else if(!fresh||fresh.id!==job.m.item_id||fresh.priceCents!==Number(job.m.price_cents)||!matchesPreference({...fresh,observedAt:new Date().toISOString()},current.criteria))status='expired';
   else {
    // Once the send starts, an HTTP timeout could mean the provider accepted it.
    status='uncertain';const event={...job.m.payload,previousCents:job.m.payload.priceCents,at:job.m.payload.observedAt,url:config.origin+'/watch'};
    const result=await send(job.p.openid,event,fetch,config);if(result?.errcode===0&&result.msgid){status='accepted';accepted++}
   }
  }catch{}await db.query('UPDATE zx_user_messages SET wechat_status=$2 WHERE id=$1',[job.m.id,status]);
 }
 return {configured:true,accepted};
}
