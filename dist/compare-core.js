export const MAX_COMPARE=8;
export function parseCBGLink(value){
 let url;try{url=new URL(value.trim())}catch{throw Error('请输入完整的藏宝阁商品链接')}
 if(url.protocol!=='https:'||url.hostname!=='yjwujian.cbg.163.com'||url.username||url.password)throw Error('仅支持永劫无间藏宝阁HTTPS商品链接');
 const match=url.pathname.match(/^\/cgi\/mweb\/equip\/(\d+)\/([a-zA-Z0-9_-]+)\/?$/);
 const serverId=match?.[1]??url.searchParams.get('serverid'),ordersn=match?.[2]??url.searchParams.get('game_ordersn')??url.searchParams.get('ordersn');
 if(!/^\d{1,4}$/.test(serverId||'')||Number(serverId)<1||! /^[a-zA-Z0-9_-]{10,128}$/.test(ordersn||''))throw Error('链接中缺少有效区服或商品流水号');
 return {serverId:Number(serverId),ordersn};
}
export function frameAt(frames,angle){return frames.length?frames[Math.min(frames.length-1,Math.max(0,Math.round(angle/360*(frames.length-1))))]:null}
