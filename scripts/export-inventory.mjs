import {compactInventory} from '../dist/inventory-search.js';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {openInventory} from '../lib/inventory.mjs';
const root=new URL('../',import.meta.url),db=openInventory(fileURLToPath(new URL('data/inventory.sqlite',root))),catalog=JSON.parse(await readFile(new URL('dist/catalog.json',root),'utf8')).items;
try{await mkdir(new URL('dist/inventory/',root),{recursive:true});for(const entry of catalog){const file=new URL('dist/inventory/'+entry.id+'.json',root),tmp=new URL(file.href+'.tmp'),data=db.list({type:entry.id,limit:100000});await writeFile(tmp,JSON.stringify({...data,updatedAt:new Date().toISOString()}));await rename(tmp,file)}await writeFile(new URL('dist/inventory/index.json',root),JSON.stringify({updatedAt:new Date().toISOString(),items:db.list({limit:100000}).items.map(compactInventory)}));console.log(JSON.stringify(db.summary(catalog),['totalItems','completedTypes','totalTypes','pagesRead','totalPages']))}finally{db.close()}
