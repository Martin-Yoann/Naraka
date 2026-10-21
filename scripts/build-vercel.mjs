import {cp,mkdir,rm} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
const output=resolve('.vercel-static');
if(relative(process.cwd(),output)!=='.vercel-static')throw Error('Unexpected output directory');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
await cp('dist',output,{recursive:true,filter:source=>!['market.json','catalog.json','collection.json','inventory'].includes(relative('dist',source).split(/[\\/]/)[0])});
console.log('Vercel static assets prepared; live data comes from PostgreSQL APIs.');
