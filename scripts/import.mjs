import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { openStore } from '../lib/store.mjs';
if(!process.argv[2]){console.error('用法: npm run import -- <观察记录.json>');process.exit(1)}
const store=openStore(fileURLToPath(new URL('../data/market.sqlite',import.meta.url)));
try{console.log(JSON.stringify(store.import(JSON.parse(await readFile(process.argv[2],'utf8')))))}catch(error){console.error(error.message);process.exitCode=1}finally{store.close()}
