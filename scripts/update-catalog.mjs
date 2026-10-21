import {writeFile,rename} from 'node:fs/promises';
import {queryCatalog} from '../lib/cbg.mjs';
const items=await queryCatalog(),file=new URL('../dist/catalog.json',import.meta.url),temp=new URL('../dist/catalog.json.tmp',import.meta.url);
await writeFile(temp,JSON.stringify({source:'藏宝阁公开游戏配置',observedAt:new Date().toISOString(),items}));await rename(temp,file);console.log(`已更新${items.length}种谪星官方图鉴定义`);
