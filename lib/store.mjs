import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {safeImageURL} from '../dist/media.js';
export function validateBatch(batch) {
  if (!batch || !Array.isArray(batch.items) || !['complete','partial','failed'].includes(batch.coverage) || typeof batch.at !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(batch.at) || !Number.isFinite(Date.parse(batch.at))) throw new Error('记录需包含带时区的有效 at、coverage（complete/partial/failed）与 items 数组');
  if (batch.items.length > 10000) throw new Error('单批最多10000件商品');
  if (batch.coverage === 'failed' && batch.items.length) throw new Error('失败批次不应包含商品');
  const ids = new Set();
  for (const item of batch.items) {
    if (typeof item.id !== 'string' || !item.id.trim() || item.id.length>200 || typeof item.skin !== 'string' || !item.skin.trim() || item.skin.length>100 || ids.has(item.id)) throw new Error('商品ID、外观名称不可为空，批次内ID不能重复');
    ids.add(item.id);
    if (!Array.isArray(item.slots) || (item.slots.length===0&&item.holesCount!==0) || item.slots.length>16 || !item.slots.every(v=>Number.isSafeInteger(v)&&v>=0)) throw new Error('星格需为非负整数数组');
    if (!Number.isSafeInteger(item.priceCents) || item.priceCents<0 || item.priceCents>1e12 || !Number.isSafeInteger(item.favorites) || item.favorites<0) throw new Error('价格需为非负整数分，收藏数需为非负整数');
    if (typeof item.publicity !== 'boolean' || !['listed','unlisted','sold','unknown'].includes(item.status)) throw new Error('商品需包含 publicity 布尔值与合法 status');
    if (item.url != null) { let url;try{url=new URL(item.url)}catch{throw new Error('无效商品链接')}if(url.protocol!=='https:'|| !(url.hostname==='cbg.163.com'||url.hostname.endsWith('.cbg.163.com')))throw new Error('商品链接须为 HTTPS 藏宝阁地址'); }
  }
  return {at:new Date(batch.at).toISOString(),coverage:batch.coverage,metadata:batch.metadata??{},items:batch.items.map(i=>({id:i.id,skin:i.skin,slots:i.slots,holesCount:i.holesCount??i.slots.length,unlocks:i.unlocks??i.slots.map(()=>1),priceCents:i.priceCents,favorites:i.favorites,publicity:i.publicity,status:i.status,url:i.url??null,equipType:i.equipType??null,serverId:i.serverId??null,ordersn:i.ordersn??null,isLottery:i.isLottery===true,lotteryConfirmed:i.lotteryConfirmed===true,lotteryEndsAt:i.lotteryEndsAt??null,lotteryStartsAt:i.lotteryStartsAt??null,lotteryWindowConfirmed:i.lotteryWindowConfirmed===true,previewFrames:Array.isArray(i.previewFrames)?[...new Set(i.previewFrames.map(safeImageURL).filter(Boolean))].slice(0,64):[],thumbnail:safeImageURL(i.thumbnail),supports3d:i.supports3d===true,...(typeof i.observedAt==='string'&&Number.isFinite(Date.parse(i.observedAt))&&Date.parse(i.observedAt)<=Date.parse(batch.at)?{observedAt:new Date(i.observedAt).toISOString()}:{})}))};
}
export function openStore(file) {
  if (file!==':memory:') mkdirSync(dirname(file),{recursive:true});
  const db=new DatabaseSync(file);db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS batches (at TEXT PRIMARY KEY, coverage TEXT NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, payload TEXT NOT NULL);');
  const insert=db.prepare('INSERT INTO batches(at,coverage,payload) VALUES(?,?,?) ON CONFLICT(at) DO UPDATE SET coverage=excluded.coverage,payload=excluded.payload');
  const saveMedia=db.prepare('INSERT INTO media VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload');
  return { import(batch){const b=validateBatch(batch);db.exec('BEGIN IMMEDIATE');try{const items=b.items.map(item=>{const {previewFrames,thumbnail,supports3d,...plain}=item;if(previewFrames.length||thumbnail)saveMedia.run(item.id,JSON.stringify({previewFrames,thumbnail,supports3d}));return plain});insert.run(b.at,b.coverage,JSON.stringify({items,metadata:b.metadata}));db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return {at:b.at,count:b.items.length,coverage:b.coverage}},read(){const batches=db.prepare('SELECT * FROM batches ORDER BY at').all().map(row=>{const payload=JSON.parse(row.payload);return {at:row.at,coverage:row.coverage,items:Array.isArray(payload)?payload:payload.items,metadata:payload.metadata??{}}});const latest=batches.filter(b=>b.coverage!=='failed').at(-1);if(latest){const get=db.prepare('SELECT payload FROM media WHERE id=?');latest.items=latest.items.map(item=>{const saved=get.get(item.id);return saved?{...item,...JSON.parse(saved.payload)}:item})}return {source:'cbg',batches}},close(){db.close()} };
}
