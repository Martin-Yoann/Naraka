import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {migrateCloud,cloudPool,transaction,closeCloud} from '../lib/cloud-db.mjs';
import {cloudStorage} from '../lib/cloud-storage.mjs';
import {openStore} from '../lib/store.mjs';
import {openInventory} from '../lib/inventory.mjs';
import {createHash} from 'node:crypto';
// Run on the machine holding the real SQLite databases. Secrets stay in .env.
let store,inventory,release;
try{await migrateCloud();const cloud=cloudStorage();release=await cloud.lease('collector',60);if(!release)throw Error('Collector active');
 store=openStore(fileURLToPath(new URL('../data/market.sqlite',import.meta.url)));inventory=openInventory(fileURLToPath(new URL('../data/inventory.sqlite',import.meta.url)));
 const batches=store.read().batches;if(!batches.length)throw Error('No source batches');const signature=createHash('sha256').update(JSON.stringify(batches.map(b=>b.at))).digest('hex'),marker=await cloud.settings.get('migration.json');
 if(marker&&marker.signature!==signature)throw Error('Migration source changed');
 if(!marker&&Number((await cloudPool().query('SELECT count(*) n FROM zx_batches')).rows[0].n)>0)throw Error('Cloud already contains batches');
 await cloud.settings.put('migration.json',{signature,state:'running'});
 for(const batch of batches){const items=[];for(const item of batch.items){const current=inventory.get(item.id);items.push(current?{...item,previewFrames:current.previewFrames,thumbnail:current.thumbnail,supports3d:current.supports3d}:item)}await cloud.store.import({...batch,items})}
 let total=0;for(let page=1;;page++){const data=inventory.list({page,limit:100});if(!data.items.length)break;await transaction(cloudPool(),async client=>{for(const item of data.items){await client.query('INSERT INTO zx_inventory VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING',[item.id,item.equipType,item.firstSeen,item.observedAt,JSON.stringify(item)])}});total+=data.items.length}
 for(const key of ['catalog.json','collection.json']){const value=JSON.parse(await readFile(new URL('../dist/'+key,import.meta.url),'utf8'));await cloud.settings.put(key,value)}
 // Copy cursors from the source DB in a consistent read-only statement.
 const {DatabaseSync}=await import('node:sqlite');const source=new DatabaseSync(fileURLToPath(new URL('../data/inventory.sqlite',import.meta.url)),{readOnly:true});try{for(const row of source.prepare('SELECT * FROM inventory_scan').all())await cloudPool().query('INSERT INTO zx_scan VALUES($1,$2) ON CONFLICT(type) DO NOTHING',[row.type,row.payload])}finally{source.close()}
 await cloud.settings.put('migration.json',{signature,state:'complete',at:new Date().toISOString()});console.log(JSON.stringify({migratedItems:total,migratedBatches:batches.length}));
}catch{console.error('Cloud migration did not complete. Check DATABASE_URL, use an empty Neon branch, and pause collection during the initial migration. No secrets are printed.');process.exitCode=1}finally{store?.close();inventory?.close();try{await release?.()}finally{await closeCloud()}}
