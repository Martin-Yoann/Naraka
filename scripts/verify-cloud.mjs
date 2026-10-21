import {DatabaseSync} from 'node:sqlite';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {cloudPool,closeCloud} from '../lib/cloud-db.mjs';import {cloudStorage} from '../lib/cloud-storage.mjs';import {openStore} from '../lib/store.mjs';import {lotterySummary} from '../dist/lottery.js';
const fingerprint=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
let source,store;
try{source=new DatabaseSync(fileURLToPath(new URL('../data/inventory.sqlite',import.meta.url)),{readOnly:true});store=openStore(fileURLToPath(new URL('../data/market.sqlite',import.meta.url)));
 const projection=(id,p,first,last)=>[id,p.equipType,p.priceCents,p.favorites,p.holesCount,p.slots,p.unlocks,p.status,p.publicity,p.url,p.previewFrames??[],new Date(first).toISOString(),new Date(last).toISOString()];
 const local=source.prepare('SELECT * FROM inventory ORDER BY id').all().map(r=>projection(r.id,JSON.parse(r.payload),r.first_seen,r.last_seen)),remote=(await cloudPool().query('SELECT * FROM zx_inventory ORDER BY id')).rows.map(r=>projection(r.id,r.payload,r.first_seen,r.last_seen));
 const inventoryMatches=fingerprint(local)===fingerprint(remote);
 const normalize=r=>[r.id,new Date(r.at).toISOString(),Number(r.price),Number(r.favorites),Number(r.lottery)];
 const old=source.prepare('SELECT * FROM inventory_observations ORDER BY id,at').all().map(normalize),saved=(await cloudPool().query('SELECT * FROM zx_observations ORDER BY id,at')).rows.map(normalize),observationsMatch=fingerprint(old)===fingerprint(saved);
 const cloud=cloudStorage(),baseline=lotterySummary(store.read().batches),current=await cloud.settings.get('lottery.json'),minima=s=>(s?.groups??[]).map(g=>[g.key,g.priceCents]).sort((a,b)=>a[0].localeCompare(b[0])),lotteryMinimaMatch=fingerprint(minima(baseline))===fingerprint(minima(current));
 const report={inventoryItems:local.length,inventoryMatches,observations:old.length,observationsMatch,lotteryGroups:baseline.groups.length,lotteryMinimaMatch};console.log(JSON.stringify(report));if(!inventoryMatches||!observationsMatch||!lotteryMinimaMatch)process.exitCode=1;
}catch{console.error('Cloud verification failed; check connectivity and migration completion.');process.exitCode=1}finally{source?.close();store?.close();await closeCloud()}
