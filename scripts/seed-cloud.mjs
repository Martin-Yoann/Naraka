import {fileURLToPath} from 'node:url';
import {readFile,open,unlink} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {migrateCloud,cloudPool,closeCloud} from '../lib/cloud-db.mjs';
import {cloudStorage} from '../lib/cloud-storage.mjs';
import {openStore} from '../lib/store.mjs';
import {openInventory} from '../lib/inventory.mjs';
const root=new URL('../',import.meta.url),lock=new URL('data/collect.lock',root);
let store,inventory,source,release,lockHandle;
try{
 lockHandle=await open(lock,'wx');
 await migrateCloud();const cloud=cloudStorage();release=await cloud.lease('collector',60);if(!release)throw Error('Collector active');
 store=openStore(fileURLToPath(new URL('data/market.sqlite',root)));inventory=openInventory(fileURLToPath(new URL('data/inventory.sqlite',root)));
 source=new DatabaseSync(fileURLToPath(new URL('data/inventory.sqlite',root)),{readOnly:true});
 const batches=store.read().batches;if(!batches.length)throw Error('No source batches');
 const signature=createHash('sha256').update(JSON.stringify(batches.map(b=>b.at))).digest('hex'),marker=await cloud.settings.get('migration.json');
 if(marker&&marker.signature!==signature)throw Error('Migration source changed');
 if(!marker&&Number((await cloudPool().query('SELECT count(*) n FROM zx_batches')).rows[0].n)>0)throw Error('Cloud already contains batches');
 await cloud.settings.put('migration.json',{signature,state:'running'});
 for(let i=0;i<batches.length;i++){
  const batch=batches[i],items=batch.items.map(item=>{const current=inventory.get(item.id);return current?{...item,previewFrames:current.previewFrames,thumbnail:current.thumbnail,supports3d:current.supports3d}:item});
  await cloud.store.import({...batch,items});if((i+1)%10===0||i===batches.length-1)console.log(JSON.stringify({stage:'batches',done:i+1,total:batches.length}));
 }
 let total=0;for(let page=1;;page++){
  const data=inventory.list({page,limit:100});if(!data.items.length)break;
  await cloudPool().query(`INSERT INTO zx_inventory SELECT id,type,first_seen,last_seen,payload FROM jsonb_to_recordset($1::jsonb) AS r(id text,type text,first_seen timestamptz,last_seen timestamptz,payload jsonb) ON CONFLICT(id) DO NOTHING`,[JSON.stringify(data.items.map(item=>({id:item.id,type:item.equipType,first_seen:item.firstSeen,last_seen:item.observedAt,payload:item})))]);
  total+=data.items.length;if(page%10===0||data.items.length<100)console.log(JSON.stringify({stage:'inventory',done:total,total:data.count}));
 }
 const observations=source.prepare('SELECT * FROM inventory_observations ORDER BY id,at').all();
 for(let i=0;i<observations.length;i+=1000){await cloudPool().query(`INSERT INTO zx_observations SELECT id,at,price,favorites,lottery FROM jsonb_to_recordset($1::jsonb) AS r(id text,at timestamptz,price bigint,favorites bigint,lottery int) ON CONFLICT(id,at) DO NOTHING`,[JSON.stringify(observations.slice(i,i+1000))]);if(i%10000===0)console.log(JSON.stringify({stage:'observations',done:Math.min(i+1000,observations.length),total:observations.length}))}
 for(const key of ['catalog.json','collection.json'])await cloud.settings.put(key,JSON.parse(await readFile(new URL('dist/'+key,root),'utf8')));
 const scans=source.prepare('SELECT * FROM inventory_scan').all();for(const row of scans)await cloudPool().query('INSERT INTO zx_scan VALUES($1,$2) ON CONFLICT(type) DO NOTHING',[row.type,row.payload]);
 const counts=(await cloudPool().query('SELECT (SELECT count(*) FROM zx_inventory) items,(SELECT count(*) FROM zx_batches) batches,(SELECT count(*) FROM zx_observations) observations,(SELECT count(*) FROM zx_scan) scans')).rows[0];
 if(Number(counts.items)!==total||Number(counts.batches)!==batches.length||Number(counts.observations)!==observations.length||Number(counts.scans)!==scans.length)throw Error('Migration counts differ');
 await cloud.settings.put('migration.json',{signature,state:'complete',at:new Date().toISOString(),counts});console.log(JSON.stringify({migration:'complete',...counts}));
}catch(error){console.error('Cloud migration did not complete. '+(error.code==='EEXIST'?'A local collector or migration holds the lock.':'Check connectivity and migration state; the source databases are retained.'));process.exitCode=1}
finally{source?.close();store?.close();inventory?.close();try{await release?.()}finally{await closeCloud();if(lockHandle){await lockHandle.close();await unlink(lock)}}}
