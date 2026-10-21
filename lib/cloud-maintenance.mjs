import {transaction} from './cloud-db.mjs';
import {dataPolicy} from './data-policy.mjs';
export async function maintainCloudData(db,{now=Date.now(),dryRun=false}={}){
 const at=new Date(now).toISOString(),cutoff=new Date(now-dataPolicy.retainHours*3600000).toISOString();
 const outcome=await transaction(db,async client=>{
  const previous=(await client.query("SELECT payload FROM zx_settings WHERE key='retention.json' FOR UPDATE")).rows[0]?.payload;
  const due=!previous?.lastCleanedAt||now-Date.parse(previous.lastCleanedAt)>=dataPolicy.cleanupIntervalHours*3600000;
  const summary=(await client.query("SELECT payload FROM zx_settings WHERE key='lottery.json' FOR UPDATE")).rows[0]?.payload;
  const pinned=[...new Set((summary?.groups??[]).flatMap(g=>[g.item?.id,g.current?.id,g.lastObserved?.id]).filter(Boolean))];
  const protectedCount=Number((await client.query('SELECT count(*) n FROM zx_inventory WHERE id=ANY($1::text[])',[pinned])).rows[0].n);
  const before=(await client.query('SELECT (SELECT count(*) FROM zx_inventory)::int inventory,(SELECT count(*) FROM zx_observations)::int observations,(SELECT count(*) FROM zx_batches)::int batches,(SELECT count(*) FROM zx_media)::int media')).rows[0];
  if(dryRun){const eligible=(await client.query('SELECT (SELECT count(*) FROM zx_inventory WHERE last_seen<$1 AND NOT(id=ANY($2::text[])))::int inventory,(SELECT count(*) FROM zx_observations WHERE at<$1)::int observations,(SELECT count(*) FROM zx_batches WHERE at<$1)::int batches',[cutoff,pinned])).rows[0];return {dryRun,at,due,cutoff,before,eligible,protectedCount,policy:dataPolicy}}
  const deleted={inventory:0,observations:0,batches:0,media:0};
  if(due){deleted.observations+=(await client.query('DELETE FROM zx_observations WHERE at<$1',[cutoff])).rowCount;deleted.batches+=(await client.query('DELETE FROM zx_batches WHERE at<$1',[cutoff])).rowCount;deleted.inventory+=(await client.query('DELETE FROM zx_inventory WHERE last_seen<$1 AND NOT(id=ANY($2::text[]))',[cutoff,pinned])).rowCount}
  deleted.inventory+=(await client.query('WITH oldest AS (SELECT id,last_seen FROM zx_inventory WHERE NOT(id=ANY($1::text[])) ORDER BY last_seen DESC,id OFFSET $2) DELETE FROM zx_inventory i USING oldest o WHERE i.id=o.id AND i.last_seen=o.last_seen',[pinned,Math.max(0,dataPolicy.maxInventory-protectedCount)])).rowCount;
  deleted.observations+=(await client.query('DELETE FROM zx_observations WHERE (id,at) IN (SELECT id,at FROM zx_observations ORDER BY at DESC,id OFFSET $1)',[dataPolicy.maxObservations])).rowCount;
  deleted.batches+=(await client.query('DELETE FROM zx_batches WHERE at IN (SELECT at FROM zx_batches ORDER BY at DESC OFFSET $1)',[dataPolicy.maxBatches])).rowCount;
  if(due||deleted.inventory||deleted.batches)deleted.media=(await client.query("WITH referenced AS (SELECT id FROM zx_inventory UNION SELECT item->>'id' FROM zx_batches CROSS JOIN LATERAL jsonb_array_elements(payload->'items') item) DELETE FROM zx_media WHERE id NOT IN (SELECT id FROM referenced WHERE id IS NOT NULL)")).rowCount;
  await client.query('DELETE FROM zx_leases WHERE expires<now()');
  const counts=(await client.query('SELECT (SELECT count(*) FROM zx_inventory)::int inventory,(SELECT count(*) FROM zx_observations)::int observations,(SELECT count(*) FROM zx_batches)::int batches,(SELECT count(*) FROM zx_media)::int media')).rows[0];
  const lastCleanedAt=due?at:previous.lastCleanedAt,result={at,lastCleanedAt,nextCleanupAt:new Date(Date.parse(lastCleanedAt)+dataPolicy.cleanupIntervalHours*3600000).toISOString(),cutoff:due?cutoff:previous.cutoff,due,counts,deleted,protectedCount,policy:dataPolicy};
  await client.query("INSERT INTO zx_settings VALUES('retention.json',$1) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload",[JSON.stringify(result)]);return result;
 });
 if(!dryRun){let bytes=null;try{bytes=Number((await db.query("SELECT sum(pg_total_relation_size(relid))::bigint bytes FROM pg_stat_user_tables WHERE relname LIKE 'zx_%'")).rows[0].bytes)}catch{}const result={...outcome,tableBytes:bytes};await db.query("INSERT INTO zx_settings VALUES('storage.json',$1) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload",[JSON.stringify(result)]);return result}return outcome;
}
