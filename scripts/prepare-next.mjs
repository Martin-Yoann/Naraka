import {cp,mkdir} from 'node:fs/promises';
// Only public visual assets are copied; live market/catalog/inventory data stays in Neon.
await mkdir('public',{recursive:true});
for(const name of ['assets','atlas'])await cp('dist/'+name,'public/'+name,{recursive:true});
console.log('Next.js public assets prepared; live data remains server-side.');
