import {compactInventory} from './inventory-search.js';
export function compactMarket(data){return {...data,batches:data.batches.map(b=>({...b,items:b.items.map(compactInventory)})),...(data.lottery?{lottery:{...data.lottery,groups:data.lottery.groups.map(g=>({...g,item:g.item?compactInventory(g.item):g.item,current:g.current?compactInventory(g.current):null}))}}:{})}}
