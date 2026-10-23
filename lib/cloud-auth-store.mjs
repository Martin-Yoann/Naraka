import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {cloudPool,transaction} from './cloud-db.mjs';
import {readFile} from 'node:fs/promises';
export const digest=value=>createHash('sha256').update(value||'').digest('hex');
export const secret=()=>randomBytes(32).toString('hex');
const schemas=new WeakMap();
export async function ensureAuthSchema(db=cloudPool()){
 if(!schemas.has(db))schemas.set(db,readFile(new URL('./cloud-auth-schema.sql',import.meta.url),'utf8').then(sql=>db.query(sql)).catch(e=>{schemas.delete(db);throw e}));
 await schemas.get(db);
}
export function cloudAccounts(db=cloudPool()){
 const ready=()=>ensureAuthSchema(db);
 return {
  async user(token){if(!token)return null;await ready();return (await db.query('SELECT u.id,u.nickname,u.avatar FROM zx_auth_sessions s JOIN zx_auth_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires>now()',[digest(token)])).rows[0]??null},
  async identity(identity,profile={}){await ready();return (await db.query(`INSERT INTO zx_auth_users(id,appid,openid,unionid,nickname,avatar,last_login) VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(appid,openid) DO UPDATE SET unionid=COALESCE(excluded.unionid,zx_auth_users.unionid),nickname=COALESCE(excluded.nickname,zx_auth_users.nickname),avatar=COALESCE(excluded.avatar,zx_auth_users.avatar),last_login=now() RETURNING id`,[randomUUID(),identity.appid,identity.openid,identity.unionid||null,profile.nickname||null,profile.avatar||null])).rows[0].id},
  async session(userId){await ready();const token=secret();await db.query("INSERT INTO zx_auth_sessions VALUES($1,$2,now()+interval '7 days')",[digest(token),userId]);return token},
  async logout(token){if(!token)return;await ready();await db.query('DELETE FROM zx_auth_sessions WHERE token_hash=$1',[digest(token)])},
  async flow(mode,ticket=null){await ready();const state=secret();await db.query('DELETE FROM zx_auth_flows WHERE expires<now()');await db.query("INSERT INTO zx_auth_flows VALUES($1,$2,$3,now()+interval '10 minutes')",[digest(state),mode,ticket]);return state},
  async consumeFlow(state){await ready();return (await db.query('DELETE FROM zx_auth_flows WHERE state_hash=$1 AND expires>now() RETURNING mode,ticket_id',[digest(state)])).rows[0]??null},
  async ticket(){await ready();const id=randomUUID(),key=secret();await db.query('DELETE FROM zx_auth_tickets WHERE expires<now()');await db.query("DELETE FROM zx_auth_sessions WHERE expires<now()");await db.query("INSERT INTO zx_auth_tickets(id,secret_hash,status,expires) VALUES($1,$2,'pending',now()+interval '10 minutes')",[id,digest(key)]);return {id,key}},
  async scan(id){await ready();return (await db.query("UPDATE zx_auth_tickets SET status='scanned' WHERE id=$1 AND status IN ('pending','scanned') AND expires>now() RETURNING id",[id])).rowCount>0},
  async cancelTicket(id){if(!id)return;await ready();await db.query("UPDATE zx_auth_tickets SET status='cancelled' WHERE id=$1 AND status IN ('pending','scanned')",[id])},
  async prepareConfirmation(id,userId){await ready();const key=secret();const row=(await db.query("UPDATE zx_auth_tickets SET status='confirm',user_id=$2,confirm_hash=$3 WHERE id=$1 AND status='scanned' AND expires>now() RETURNING id",[id,userId,digest(key)])).rows[0];return row?key:null},
  async confirm(id,key,approve){await ready();return (await db.query("UPDATE zx_auth_tickets SET status=$3,confirm_hash=NULL WHERE id=$1 AND confirm_hash=$2 AND status='confirm' AND expires>now() RETURNING user_id",[id,digest(key),approve?'approved':'cancelled'])).rows[0]??null},
  async poll(id,key){await ready();return transaction(db,async client=>{
   const row=(await client.query('SELECT status,user_id FROM zx_auth_tickets WHERE id=$1 AND secret_hash=$2 AND expires>now() FOR UPDATE',[id,digest(key)])).rows[0];if(!row)return {status:'expired'};
   if(row.status!=='approved')return {status:row.status};
   const token=secret();await client.query("INSERT INTO zx_auth_sessions VALUES($1,$2,now()+interval '7 days')",[digest(token),row.user_id]);await client.query("UPDATE zx_auth_tickets SET status='consumed',user_id=NULL WHERE id=$1",[id]);return {status:'approved',token};
  })}
 };
}
