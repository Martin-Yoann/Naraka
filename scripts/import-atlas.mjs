import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {normalizeAtlasRow,slotIndex} from '../dist/atlas-core.js';
const root=new URL('../dist/atlas/',import.meta.url),catalog=JSON.parse(await readFile(new URL('../dist/catalog.json',import.meta.url),'utf8')).items;
await mkdir(root,{recursive:true});
const source='https://zhexing.emoyilab.com/gallery',endpoint='https://zhexingmarket-production.up.railway.app/gallery/items',items=[];
for(const entry of catalog){
 const at=new Date().toISOString();try{
  const response=await fetch(endpoint+'?'+new URLSearchParams({equip_type:entry.id}),{signal:AbortSignal.timeout(90000),headers:{'user-agent':'ZhexingMarketAtlasImport/1.0'}});
  if(!response.ok)throw Error('HTTP '+response.status);const input=await response.json();if(!Array.isArray(input))throw Error('Invalid data');
  const seen=new Set(),rows=[];for(const raw of input){const row=normalizeAtlasRow(raw,entry.id,entry.slotNames.length);if(row&&!seen.has(row.variation)){seen.add(row.variation);rows.push(row)}}
  const counts=slotIndex(rows,entry.slotNames.length).map(map=>map.size),file=entry.id+'.json';
  await writeFile(new URL(file+'.tmp',root),JSON.stringify({source,endpoint,importedAt:at,equipType:entry.id,sourceCount:input.length,rejected:input.length-rows.length,rows}));await rename(new URL(file+'.tmp',root),new URL(file,root));
  items.push({id:entry.id,count:rows.length,sourceCount:input.length,slotCounts:counts,importedAt:at,status:'ok'});console.log(entry.name,rows.length,'rows',counts.join('/'));
 }catch(error){items.push({id:entry.id,status:'failed',error:error.message,importedAt:at});console.log(entry.name,'FAILED',error.message)}
 await new Promise(resolve=>setTimeout(resolve,1600));
}
const manifest={source,endpoint,importedAt:new Date().toISOString(),coverage:items.every(item=>item.status==='ok')?'complete':'partial',meaning:'complete仅指本次29种类型的公开接口请求均成功，不代表全部可能数值或组合。',items};
await writeFile(new URL('index.json.tmp',root),JSON.stringify(manifest));await rename(new URL('index.json.tmp',root),new URL('index.json',root));
console.log('TOTAL',items.reduce((n,item)=>n+(item.count??0),0),'coverage',manifest.coverage);
