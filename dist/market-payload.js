import {compactInventory} from './inventory-search.js';
export function compactLottery(summary){return summary?{...summary,liveItems:(summary.liveItems??[]).map(compactInventory),groups:summary.groups.map(g=>({...g,item:g.item?compactInventory(g.item):g.item,lastObserved:g.lastObserved?compactInventory(g.lastObserved):null,current:g.current?compactInventory(g.current):null}))}:null}
export function compactMarket(data){return {...data,batches:data.batches.map(b=>({...b,items:b.items.map(compactInventory)})),...(data.lottery?{lottery:compactLottery(data.lottery)}:{})}}
