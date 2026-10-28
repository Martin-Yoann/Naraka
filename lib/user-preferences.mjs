import {matchesFavorite} from './favorite-rules.mjs';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {cloudPool,transaction} from './cloud-db.mjs';
import {ensureAuthSchema} from './cloud-auth-store.mjs';
const ready=new WeakMap();
export async function ensureUserSchema(db=cloudPool()){
 if(!ready.has(db))ready.set(db,ensureAuthSchema(db).then(()=>readFile(new URL('./user-schema.sql',import.meta.url),'utf8')).then(sql=>db.query(sql)).catch(e=>{ready.delete(db);throw e}));
 await ready.get(db);
}
export class PreferenceError extends Error{constructor(message,status=400){super(message);this.status=status}}
export const isUUID=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
function integer(value,max){if(!Number.isSafeInteger(value)||value<0||value>max)throw new PreferenceError('请输入有效的非负整数范围');return value}
export function validatePreference(input,catalog){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new PreferenceError('偏好内容无效');
 const type=catalog.find(x=>x.id===input.type);if(!type)throw new PreferenceError('请选择已收录的谪星');
 const holes=input.holes===null?null:integer(input.holes,type.slotNames.length);
 const priceMin=input.priceMin===null?null:integer(input.priceMin,10000000000),priceMax=input.priceMax===null?null:integer(input.priceMax,10000000000);
 if(priceMin!==null&&priceMax!==null&&priceMin>priceMax)throw new PreferenceError('最低价格不能高于最高价格');
 if(!Array.isArray(input.ranges)||input.ranges.length!==type.slotNames.length)throw new PreferenceError('星格范围与外观不一致');
 const ranges=input.ranges.map(r=>{if(!r||typeof r!=='object')throw new PreferenceError('星格范围无效');const min=r.min===null?null:integer(r.min,999999),max=r.max===null?null:integer(r.max,999999);if(min!==null&&max!==null&&min>max)throw new PreferenceError('星格最小值不能超过最大值');return {min,max}});
 if(typeof input.wechat!=='boolean'||typeof input.enabled!=='boolean')throw new PreferenceError('提醒选项无效');
 const name=typeof input.name==='string'?input.name.trim():'';if(name.length>50)throw new PreferenceError('偏好名称最多50字');
 return {name:name||type.name,criteria:{type:type.id,skin:type.name,holes,priceMin,priceMax,ranges},wechat:input.wechat,enabled:input.enabled};
}
export function matchesPreference(item,criteria,now=Date.now()){
 const age=now-Date.parse(item.observedAt);
 if(item.status!=='listed'||item.isLottery!==true||item.lotteryConfirmed!==true||!Number.isFinite(age)||age< -60000||age>65*60000||!(Date.parse(item.lotteryEndsAt)>now))return false;
 if(String(item.equipType)!==criteria.type||!Number.isSafeInteger(item.priceCents)||item.priceCents<0)return false;
 if(criteria.holes!==null&&item.holesCount!==criteria.holes)return false;
 if(criteria.priceMin!==null&&item.priceCents<criteria.priceMin||criteria.priceMax!==null&&item.priceCents>criteria.priceMax)return false;
 return criteria.ranges.every((r,i)=>(r.min===null&&r.max===null)||(item.unlocks?.[i]===1&&Number.isInteger(item.slots?.[i])&&(r.min===null||item.slots[i]>=r.min)&&(r.max===null||item.slots[i]<=r.max)));
}
export function userPreferences(db=cloudPool()){
 return {
 async list(user){await ensureUserSchema(db);return (await db.query('SELECT * FROM zx_user_preferences WHERE user_id=$1 ORDER BY created_at,id',[user])).rows},
 async save(user,id,value){await ensureUserSchema(db);if(id&&!isUUID(id))throw new PreferenceError('偏好不存在',404);return transaction(db,async client=>{
  await client.query('SELECT id FROM zx_auth_users WHERE id=$1 FOR UPDATE',[user]);
  if(id){const old=(await client.query('SELECT * FROM zx_user_preferences WHERE id=$1 AND user_id=$2',[id,user])).rows[0];if(!old)throw new PreferenceError('偏好不存在',404);
   // Compare JSONB semantically: PostgreSQL normalizes key order.
   return (await client.query('UPDATE zx_user_preferences SET name=$3,criteria=$4,wechat=$5,enabled=$6,revision=CASE WHEN criteria IS DISTINCT FROM $4::jsonb OR wechat<>$5 THEN $7::uuid ELSE revision END,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *',[id,user,value.name,JSON.stringify(value.criteria),value.wechat,value.enabled,randomUUID()])).rows[0];
  }
  if(Number((await client.query('SELECT count(*) n FROM zx_user_preferences WHERE user_id=$1',[user])).rows[0].n)>=20)throw new PreferenceError('每个账号最多保存20条偏好');
  return (await client.query('INSERT INTO zx_user_preferences(id,user_id,name,criteria,wechat,enabled,revision) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[randomUUID(),user,value.name,JSON.stringify(value.criteria),value.wechat,value.enabled,randomUUID()])).rows[0];
 })},
 async remove(user,id){await ensureUserSchema(db);if(!isUUID(id))throw new PreferenceError('偏好不存在',404);if(!(await db.query('DELETE FROM zx_user_preferences WHERE id=$1 AND user_id=$2',[id,user])).rowCount)throw new PreferenceError('偏好不存在',404)},
 async messages(user,before=null){await ensureUserSchema(db);if(before&&!isUUID(before))throw new PreferenceError('消息游标无效');const rows=(await db.query(`SELECT * FROM zx_user_messages WHERE user_id=$1 AND ($2::uuid IS NULL OR (created_at,id)<(SELECT created_at,id FROM zx_user_messages WHERE id=$2 AND user_id=$1)) ORDER BY created_at DESC,id DESC LIMIT 51`,[user,before])).rows;return {messages:rows.slice(0,50),next:rows.length>50?rows[49].id:null,unread:Number((await db.query('SELECT count(*) n FROM zx_user_messages WHERE user_id=$1 AND read_at IS NULL',[user])).rows[0].n)}},
 async read(user,id){await ensureUserSchema(db);if(id!==null&&!isUUID(id))throw new PreferenceError('消息不存在',404);const result=await db.query('UPDATE zx_user_messages SET read_at=COALESCE(read_at,now()) WHERE user_id=$1 AND ($2::uuid IS NULL OR id=$2) RETURNING id',[user,id]);if(id&&!result.rowCount)throw new PreferenceError('消息不存在',404)},
 async evaluate(user=null){await ensureUserSchema(db);await db.query("DELETE FROM zx_user_messages WHERE created_at<now()-interval '30 days' AND ($1::uuid IS NULL OR user_id=$1)",[user]);return transaction(db,async client=>{
  // Per-account locks serialize saves and evaluators; never lock the entire market.
  const users=(await client.query('SELECT id FROM zx_auth_users WHERE ($1::uuid IS NULL OR id=$1) AND NOT EXISTS(SELECT 1 FROM zx_user_settings s WHERE s.user_id=zx_auth_users.id AND s.alerts_enabled=false) AND (EXISTS(SELECT 1 FROM zx_user_preferences p WHERE p.user_id=zx_auth_users.id AND p.enabled) OR EXISTS(SELECT 1 FROM zx_user_favorites f WHERE f.user_id=zx_auth_users.id AND f.remind)) ORDER BY id FOR UPDATE',[user])).rows;
  if(!users.length)return {created:0};
  const candidates=(await client.query("SELECT payload,last_seen FROM zx_inventory WHERE last_seen>now()-interval '65 minutes' AND payload->>'isLottery'='true' AND payload->>'lotteryConfirmed'='true' AND payload->>'status'='listed'")).rows.map(r=>({...r.payload,observedAt:new Date(r.last_seen).toISOString()}));let created=0;
  for(const u of users){if((await client.query('SELECT alerts_enabled FROM zx_user_settings WHERE user_id=$1',[u.id])).rows[0]?.alerts_enabled===false)continue;const prefs=(await client.query('SELECT * FROM zx_user_preferences WHERE user_id=$1 AND enabled=true',[u.id])).rows;
   for(const p of prefs)for(const item of candidates){if(!matchesPreference(item,p.criteria))continue;
    const payload={name:p.name,skin:item.skin,holesCount:item.holesCount,slots:item.slots,unlocks:item.unlocks,priceCents:item.priceCents,lotteryEndsAt:item.lotteryEndsAt,observedAt:item.observedAt,url:item.url,itemId:item.id};
    const r=await client.query(`INSERT INTO zx_user_messages(id,user_id,preference_id,revision,item_id,price_cents,payload,wechat_status) SELECT $1,$2,$3,$4,$5,$6,$7,$8 WHERE NOT EXISTS(SELECT 1 FROM zx_user_messages WHERE user_id=$2 AND preference_id=$3 AND revision=$4 AND item_id=$5 AND price_cents<=$6) ON CONFLICT DO NOTHING`,[randomUUID(),u.id,p.id,p.revision,item.id,item.priceCents,JSON.stringify(payload),p.wechat?'pending':'not-requested']);created+=r.rowCount;
   }
   const favorites=(await client.query('SELECT * FROM zx_user_favorites WHERE user_id=$1 AND remind=true',[u.id])).rows;
   for(const favorite of favorites)for(const item of candidates){if(!matchesFavorite(item,favorite))continue;
    const payload={kind:'favorite-open',favoriteId:favorite.id,name:'收藏商品已开抽',skin:item.skin,holesCount:item.holesCount,slots:item.slots,unlocks:item.unlocks,priceCents:item.priceCents,savedPriceCents:favorite.payload.priceCents,lotteryEndsAt:item.lotteryEndsAt,observedAt:item.observedAt,url:item.url,itemId:item.id};
    const r=await client.query(`INSERT INTO zx_user_messages(id,user_id,preference_id,revision,item_id,price_cents,payload,wechat_status) SELECT $1,$2,NULL,$3,$4,$5,$6,$7 WHERE NOT EXISTS(SELECT 1 FROM zx_user_messages WHERE user_id=$2 AND revision=$3 AND item_id=$4 AND payload->>'kind'='favorite-open')`,[randomUUID(),u.id,favorite.revision,item.id,item.priceCents,JSON.stringify(payload),favorite.wechat?'pending':'not-requested']);created+=r.rowCount;
   }
   await client.query("DELETE FROM zx_user_messages WHERE user_id=$1 AND (created_at<now()-interval '30 days' OR id IN(SELECT id FROM zx_user_messages WHERE user_id=$1 ORDER BY created_at DESC,id DESC OFFSET 1000))",[u.id]);
  }return {created};
 })}
 };
}
