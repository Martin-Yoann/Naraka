import {cloudStorage} from '../lib/cloud-storage.mjs';
import {closeCloud} from '../lib/cloud-db.mjs';
try{
 const storage=cloudStorage(),release=await storage.lease('maintenance',2);
 if(!release)console.log('Maintenance already running');
 else try{
  const result=await storage.maintenance({dryRun:process.argv.includes('--dry-run')});
  if(!result.dryRun&&result.deleted.inventory){
   const catalog=(await storage.settings.get('catalog.json'))?.items??[],collection=await storage.settings.get('collection.json');
   if(collection&&catalog.length)await storage.settings.put('collection.json',{...collection,...await storage.inventory.summary(catalog),retentionUpdatedAt:result.at});
  }
  console.log(JSON.stringify(result));
 }finally{await release()}
}finally{await closeCloud()}
