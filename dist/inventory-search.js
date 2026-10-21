import {filterItems} from './tools-core.js';
export function compactInventory(item){const {frames,images,previewImages,previewFrames,...rest}=item;return rest}
export function freshness(item,now=Date.now()){if(item.status!=='listed')return '目前不可见';const age=now-Date.parse(item.observedAt);return Number.isFinite(age)&&age>=0&&age<=65*60000?'近期观察':'待重新核验'}
export function searchInventory(items,{filter={},sort='price'}={}){
 if(!filter||typeof filter!=='object'||Array.isArray(filter)||!['price','favorites','holes','recent'].includes(sort))throw Error('搜索条件无效');
 const result=filterItems(items,filter).filter(item=>!filter.recentOnly||freshness(item)==='近期观察');
 result.sort((a,b)=>(sort==='favorites'?b.favorites-a.favorites:sort==='holes'?(b.holesCount??b.slots.length)-(a.holesCount??a.slots.length):sort==='recent'?Date.parse(b.observedAt)-Date.parse(a.observedAt):a.priceCents-b.priceCents)||a.id.localeCompare(b.id));
 return {items:result,count:result.length,total:items.length,queriedAt:new Date().toISOString()};
}
