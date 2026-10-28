import {extractMedia} from '../dist/media.js';
const endpoint='https://yjwujian.cbg.163.com/cgi-bin/recommend.py?client_type=h5&act=recommd_by_role';
export function sourceTime(value){if(typeof value!=='string')return null;const text=value.trim(),at=Date.parse(/(Z|[+-]\d{2}:?\d{2})$/i.test(text)?text:text.replace(' ','T')+'+08:00');return Number.isFinite(at)?new Date(at).toISOString():null}
async function sourceFetch(fetcher,url,options){try{return await fetcher(url,options)}catch(error){const causes=error.cause?.errors??[error.cause??error],codes=[...new Set(causes.map(c=>c?.code??c?.name).filter(c=>typeof c==='string'&&/^[A-Za-z0-9_]+$/.test(c)))];throw Error('藏宝阁连接失败：'+(codes.join(',')||'NETWORK_ERROR'))}}
export function normalizeItem(raw){
  const skin=raw.format_equip_name;
  if(typeof skin!=='string'||!skin.startsWith('谪星'))return null;
  const variation=raw.other_info?.variation_info;
  const noSlots=String(raw.equip_type)==='3400046'&&variation&&Object.keys(variation).length===0;
  if(!noSlots&&(!variation||!/^\d+(?:-\d+)*$/.test(variation.variation_id||'')))throw new Error('谪星星格字段异常，停止采集');
  const slots=noSlots?[]:variation.variation_id.split('-').map(Number),unlocks=noSlots?[]:String(variation.variation_unlock||'').split('-').map(Number);
  if(unlocks.length!==slots.length||!unlocks.every(x=>x===0||x===1))throw new Error('星格解锁字段异常');
  if(!Number.isSafeInteger(raw.price)||!Number.isSafeInteger(raw.collect_num)||!raw.eid||!Number.isInteger(raw.pass_fair_show))throw new Error('商品价格、收藏或公示字段异常');
  const id=String(raw.eid);
  return {...extractMedia(raw),id,skin,slots,unlocks,holesCount:unlocks.filter(x=>x===1).length,priceCents:raw.price,favorites:raw.collect_num,publicity:raw.pass_fair_show!==1,status:raw.status===2?'listed':'unknown',url:raw.game_ordersn?`https://yjwujian.cbg.163.com/cgi/mweb/equip/${encodeURIComponent(raw.serverid)}/${encodeURIComponent(raw.game_ordersn)}`:null,equipType:String(raw.equip_type),serverId:raw.serverid,ordersn:raw.game_ordersn??null,isLottery:raw.is_random_draw_period===true,lotteryConfirmed:false,lotteryStartsAt:sourceTime(raw.fair_show_end_time),lotteryWindowConfirmed:false,lotteryEndsAt:null};
}
export async function queryCatalog(){
 const response=await fetch('https://cbg-yjwujian.res.netease.com/js/game_auto_config.js',{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('谪星图鉴请求失败');const text=await response.text();const config=JSON.parse(text.slice(text.indexOf('{')).replace(/;\s*$/,''));
 const list=Object.keys(config.format_rare_skin_config??{}).map(id=>{const weapon=config.WeaponSkin_WeaponSkin?.[id],body=config.FashionConfig_FashionBody?.[id],variation=config.format_rare_skin_config[id],skin=weapon??body;return {id,name:weapon?.SkinName??body?.FashionName,category:weapon?'weapon':'character',owner:config.Enum_Content?.[weapon?.WeaponTypePresentation??body?.HeroId]??'',quality:config.Enum_Content?.[skin?.Quality]??'',slotNames:(variation.variation_name||'').split('-').filter(Boolean),format:variation.variation_id||''}}).filter(i=>/^\d+$/.test(i.id)&&i.name?.startsWith('谪星'));
 if(!list.length||list.length>100)throw Error('谪星图鉴结构异常');return list;
}
export async function queryDetail(item,fetcher=fetch){
 if(!item.ordersn)throw new Error('缺少真实商品流水号');
 const response=await sourceFetch(fetcher,'https://yjwujian.cbg.163.com/cgi/api/get_equip_detail?client_type=h5',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({serverid:String(item.serverId),ordersn:item.ordersn,exclude_equip_desc:'1'}),signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw new Error(`详情 HTTP ${response.status}`);
 const body=await response.json();if(body.status!==1||!body.equip){if(body.msg==='物品不存在')return null;throw new Error('详情未成功，停止确认抽签')}
 const normalized=normalizeItem(body.equip);if(!normalized)return null;
 const start=sourceTime(body.equip.fair_show_end_time),end=sourceTime(body.equip.random_draw_finish_time);
 return {...normalized,lotteryStartsAt:start,lotteryConfirmed:!!end,lotteryWindowConfirmed:!!start&&!!end&&Date.parse(end)>Date.parse(start),lotteryEndsAt:end};
}
export async function queryPage(params,fetcher=fetch){
  const response=await sourceFetch(fetcher,endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',referer:'https://yjwujian.cbg.163.com/cgi/mweb/'},body:new URLSearchParams({search_type:'normal_equip',count:'15',pass_fair_show:'1',page:'1',...params}),signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error(`藏宝阁 HTTP ${response.status}，本轮停止，不自动绕过验证`);
  let body;try{body=await response.json()}catch{throw new Error('返回非JSON，可能需要验证；本轮停止')}
  if(body.status!==1||!Array.isArray(body.result))throw new Error(`藏宝阁请求未成功：${body.status_code||body.msg||body.status}`);
  if(body.order_field!==params.order_by.split(' ')[0])throw new Error('来源排序与请求不一致，停止避免错误标注低价范围');
  if(params.equip_type&&body.result.some(item=>String(item.equip_type)!==params.equip_type))throw new Error('来源外观筛选未生效，本轮停止');
  return body;
}
