import {cloudPool} from './cloud-db.mjs';
import {transaction} from './cloud-db.mjs';
import {ensureUserSchema,PreferenceError} from './user-preferences.mjs';
export function userSettings(db=cloudPool()){return {
 async get(user){await ensureUserSchema(db);return (await db.query('SELECT alerts_enabled,lottery_auto_refresh FROM zx_user_settings WHERE user_id=$1',[user])).rows[0]??{alerts_enabled:true,lottery_auto_refresh:true}},
 async save(user,input){if(!input||typeof input.alerts_enabled!=='boolean'||typeof input.lottery_auto_refresh!=='boolean')throw new PreferenceError('设置选项无效');await ensureUserSchema(db);return transaction(db,async client=>{await client.query('SELECT id FROM zx_auth_users WHERE id=$1 FOR UPDATE',[user]);return (await client.query('INSERT INTO zx_user_settings(user_id,alerts_enabled,lottery_auto_refresh) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET alerts_enabled=excluded.alerts_enabled,lottery_auto_refresh=excluded.lottery_auto_refresh,updated_at=now() RETURNING alerts_enabled,lottery_auto_refresh',[user,input.alerts_enabled,input.lottery_auto_refresh])).rows[0]})}
}}
