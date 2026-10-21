import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function openAccounts(file){
 if(file!==':memory:')mkdirSync(dirname(file),{recursive:true});const db=new DatabaseSync(file);
 db.exec(`PRAGMA journal_mode=WAL;CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,unionid TEXT UNIQUE,oa_openid TEXT);CREATE TABLE IF NOT EXISTS identities(appid TEXT,openid TEXT,user_id TEXT,PRIMARY KEY(appid,openid));CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT,expires INTEGER);CREATE TABLE IF NOT EXISTS oauth_states(token TEXT PRIMARY KEY,mode TEXT,expires INTEGER);CREATE TABLE IF NOT EXISTS subscriptions(user_id TEXT,group_key TEXT,created TEXT,enabled INTEGER,PRIMARY KEY(user_id,group_key));CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,user_id TEXT,group_key TEXT,payload TEXT,status TEXT,created TEXT,result TEXT);`);
 const columns=db.prepare('PRAGMA table_info(users)').all().map(c=>c.name);if(!columns.includes('nickname'))db.exec('ALTER TABLE users ADD COLUMN nickname TEXT');if(!columns.includes('avatar'))db.exec('ALTER TABLE users ADD COLUMN avatar TEXT');
 return {
  state(mode){const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM oauth_states WHERE expires<?').run(Date.now());db.prepare('INSERT INTO oauth_states VALUES(?,?,?)').run(hash(token),mode,Date.now()+600000);return token},
  consumeState(token){const row=db.prepare('SELECT * FROM oauth_states WHERE token=? AND expires>?').get(hash(token),Date.now());if(row)db.prepare('DELETE FROM oauth_states WHERE token=?').run(hash(token));return row?.mode??null},
  login(appid,openid,unionid,official){db.exec('BEGIN IMMEDIATE');try{let user=db.prepare('SELECT u.* FROM identities i JOIN users u ON u.id=i.user_id WHERE i.appid=? AND i.openid=?').get(appid,openid);if(!user&&unionid)user=db.prepare('SELECT * FROM users WHERE unionid=?').get(unionid);if(!user){user={id:randomBytes(16).toString('hex')};db.prepare('INSERT INTO users(id,unionid,oa_openid) VALUES(?,?,?)').run(user.id,unionid||null,null)}db.prepare('INSERT OR IGNORE INTO identities VALUES(?,?,?)').run(appid,openid,user.id);if(official)db.prepare('UPDATE users SET oa_openid=? WHERE id=?').run(openid,user.id);const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),user.id,Date.now()+7*86400000);db.exec('COMMIT');return token}catch(e){db.exec('ROLLBACK');throw e}},
  profile(token,profile){const user=this.user(token);if(!user)return;db.prepare('UPDATE users SET nickname=COALESCE(?,nickname),avatar=COALESCE(?,avatar) WHERE id=?').run(profile.nickname??null,profile.avatar??null,user.id)},
  user(token){if(!token)return null;return db.prepare('SELECT u.id,u.oa_openid,u.nickname,u.avatar FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?').get(hash(token),Date.now())??null},
  logout(token){if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token))},
  subscriptions(user){return db.prepare('SELECT group_key,created,enabled FROM subscriptions WHERE user_id=?').all(user)},
  subscribe(user,key,enabled){db.prepare('INSERT INTO subscriptions VALUES(?,?,?,?) ON CONFLICT(user_id,group_key) DO UPDATE SET enabled=excluded.enabled,created=excluded.created').run(user,key,new Date().toISOString(),enabled?1:0)},
  enqueue(events){let added=0;for(const event of events){if(Date.parse(event.endsAt)<=Date.now()||Date.now()-Date.parse(event.at)>40*60000)continue;const subs=db.prepare('SELECT user_id FROM subscriptions WHERE group_key=? AND enabled=1 AND created<=?').all(event.key,event.at);for(const sub of subs){const id=hash(sub.user_id+event.id);added+=Number(db.prepare('INSERT OR IGNORE INTO outbox VALUES(?,?,?,?,?,?,?)').run(id,sub.user_id,event.key,JSON.stringify(event),'pending',new Date().toISOString(),null).changes)}}return added},
  pending(){return db.prepare("SELECT o.*,u.oa_openid,s.enabled FROM outbox o JOIN users u ON u.id=o.user_id JOIN subscriptions s ON s.user_id=o.user_id AND s.group_key=o.group_key WHERE o.status='pending' ORDER BY o.created LIMIT 30").all()},
  claim(id){return Number(db.prepare("UPDATE outbox SET status='sending' WHERE id=? AND status='pending'").run(id).changes)===1},
  finish(id,status,result){db.prepare('UPDATE outbox SET status=?,result=? WHERE id=?').run(status,String(result).slice(0,200),id)},
  sentCount(user){return db.prepare("SELECT COUNT(*) n FROM outbox WHERE user_id=? AND status IN ('accepted','sending') AND created>?").get(user,new Date(Date.now()-86400000).toISOString()).n},
  recent(user,key){return !!db.prepare("SELECT 1 FROM outbox WHERE user_id=? AND group_key=? AND status IN ('accepted','sending') AND created>? LIMIT 1").get(user,key,new Date(Date.now()-6*3600000).toISOString())},
  close(){db.close()}
 };
}
