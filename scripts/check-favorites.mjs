import '../lib/config.mjs';
import {cloudPool,closeCloud} from '../lib/cloud-db.mjs';
import {cloudStorage} from '../lib/cloud-storage.mjs';
import {ensureUserSchema,userPreferences} from '../lib/user-preferences.mjs';
import {recheckFavoriteItems} from '../lib/check-favorites.mjs';
import {deliverPreferenceMessages} from '../lib/user-delivery.mjs';
let release;
try{
 const db=cloudPool(),storage=cloudStorage(db);await ensureUserSchema(db);release=await storage.lease('favorite-reminders',2);if(release){
  const rows=(await db.query(`SELECT payload,last_seen FROM (SELECT DISTINCT ON(i.id) i.id,i.payload,i.last_seen FROM zx_user_favorites f JOIN zx_inventory i ON i.id=f.item_id WHERE f.remind=true AND NOT EXISTS(SELECT 1 FROM zx_user_settings s WHERE s.user_id=f.user_id AND s.alerts_enabled=false) AND NOT EXISTS(SELECT 1 FROM zx_user_messages m WHERE m.user_id=f.user_id AND m.revision=f.revision AND m.item_id=f.item_id AND m.payload->>'kind'='favorite-open') AND i.payload->>'status'='listed' AND (i.payload->>'lotteryEndsAt')::timestamptz>now() AND (i.payload->>'isLottery'='true' OR (i.payload->>'lotteryStartsAt')::timestamptz<=now()+interval '1 minute') ORDER BY i.id) due ORDER BY last_seen ASC,(payload->>'lotteryEndsAt')::timestamptz ASC LIMIT 12`)).rows;
  const result=await recheckFavoriteItems(storage,rows.map(r=>({...r.payload,observedAt:new Date(r.last_seen).toISOString()})));console.log('Favorite recheck:',result);
  console.log('Account messages:',await userPreferences().evaluate());console.log('WeChat delivery:',await deliverPreferenceMessages());if(result.error)process.exitCode=1;
 }
}finally{if(release)await release();await closeCloud()}
