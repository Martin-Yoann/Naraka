import {randomUUID} from 'node:crypto';
import {cloudPool,transaction} from './cloud-db.mjs';
import {ensureUserSchema,PreferenceError} from './user-preferences.mjs';
import {compactInventory} from '../dist/inventory-search.js';
export function userFavorites(db=cloudPool()){
 return {
  async list(user){await ensureUserSchema(db);return (await db.query('SELECT f.*,i.payload current_payload,i.last_seen FROM zx_user_favorites f LEFT JOIN zx_inventory i ON i.id=f.item_id WHERE f.user_id=$1 ORDER BY f.created_at DESC,f.id',[user])).rows.map(({current_payload,last_seen,...row})=>({...row,payload:compactInventory(current_payload?{...current_payload,observedAt:new Date(last_seen).toISOString()}:row.payload)}))},
  async save(user,item,input){
   await ensureUserSchema(db);if(!input||typeof input.remind!=='boolean'||typeof input.wechat!=='boolean')throw new PreferenceError('收藏提醒选项无效');
   if(!item?.id||!item.ordersn)throw new PreferenceError('商品当前不可见，请刷新后再收藏',404);
   return transaction(db,async client=>{
    await client.query('SELECT id FROM zx_auth_users WHERE id=$1 FOR UPDATE',[user]);
    const existing=(await client.query('SELECT * FROM zx_user_favorites WHERE user_id=$1 AND item_id=$2',[user,item.id])).rows[0];
    if(!existing&&item.status!=='listed')throw new PreferenceError('商品当前不可见，请刷新后再收藏',404);
    if(input.remind&&(item.status!=='listed'||!(Date.parse(item.lotteryEndsAt)>Date.now())))throw new PreferenceError('商品已截止或状态待核验，暂不能开启提醒');
    if(!existing&&Number((await client.query('SELECT count(*) n FROM zx_user_favorites WHERE user_id=$1',[user])).rows[0].n)>=100)throw new PreferenceError('每个账号最多收藏100件商品');
    const value=await client.query(`INSERT INTO zx_user_favorites(id,user_id,item_id,payload,remind,wechat,revision) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,item_id) DO UPDATE SET payload=excluded.payload,remind=excluded.remind,wechat=excluded.wechat,revision=CASE WHEN zx_user_favorites.remind IS DISTINCT FROM excluded.remind OR zx_user_favorites.wechat IS DISTINCT FROM excluded.wechat THEN excluded.revision ELSE zx_user_favorites.revision END,updated_at=now() RETURNING *`,[randomUUID(),user,item.id,JSON.stringify(compactInventory(item)),input.remind,input.wechat,randomUUID()]);return value.rows[0];
   });
  },
  async remove(user,itemId){await ensureUserSchema(db);return transaction(db,async client=>{await client.query('SELECT id FROM zx_auth_users WHERE id=$1 FOR UPDATE',[user]);const row=(await client.query('DELETE FROM zx_user_favorites WHERE user_id=$1 AND item_id=$2 RETURNING id',[user,itemId])).rows[0];if(!row)throw new PreferenceError('收藏不存在',404);await client.query("UPDATE zx_user_messages SET wechat_status='cancelled' WHERE user_id=$1 AND payload->>'favoriteId'=$2 AND wechat_status='pending'",[user,row.id]);return true})}
 };
}
