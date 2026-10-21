import {safeImageURL} from './media.js';
export function normalizeAtlasRow(row,type,slots){
 if(row.equip_type!==type||typeof row.variation_id!=='string'||!/^\d+(?:-\d+)*$/.test(row.variation_id))return null;
 const values=row.variation_id.split('-').map(Number),quality=String(row.variation_quality??'').split('-').map(Number);
 if(values.length!==slots||quality.length!==slots||values.some(n=>!Number.isSafeInteger(n))||quality.some(n=>!Number.isInteger(n)||n<1||n>5))return null;
 const base=String(row.storage_path??'').replace(/\/$/,'');
 if(!safeImageURL(base+'/1.png'))return null;
 return {id:String(row.id),variation:row.variation_id,values,quality,base,createdAt:row.created_at??null};
}
export function slotIndex(rows,count){const maps=Array.from({length:count},()=>new Map());for(const row of rows)for(let i=0;i<count;i++){const value=row.values[i];if(value==null)continue;const previous=maps[i].get(value);if(!previous||((previous.quality[i]??1)<=1&&(row.quality[i]??1)>1))maps[i].set(value,row)}return maps}
export function atlasItem(row,entry,includeFrames=true){return {id:'atlas:'+entry.id+':'+row.id,skin:entry.name,slots:row.values,unlocks:row.quality.map(q=>q>1?1:0),holesCount:row.quality.filter(q=>q>1).length,priceCents:null,favorites:null,status:'archive',observedAt:row.createdAt,thumbnail:row.base+'/1.png',previewFrames:includeFrames?Array.from({length:32},(_,i)=>row.base+'/'+(i+1)+'.png'):[],archive:true}}
