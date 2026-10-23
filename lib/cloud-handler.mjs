import {refreshLotterySource} from './refresh-lottery.mjs';
import {cloudAuth} from './cloud-auth-handler.mjs';
import {compactLottery,compactMarket} from '../dist/market-payload.js';
import {cloudStorage} from './cloud-storage.mjs';
import {queryDetail} from './cbg.mjs';
import {parseCBGLink} from '../dist/compare-core.js';
import {compactInventory} from '../dist/inventory-search.js';
const json=(res,status,value)=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.statusCode=status;res.end(JSON.stringify(value))};
export function createCloudHandler(storageFactory=cloudStorage,detail=queryDetail,refresh=refreshLotterySource){return async function handler(req,res){try{
 const url=new URL(req.url,'http://localhost'),path=url.searchParams.has('route')?'/api/'+url.searchParams.get('route'):url.pathname;
 const authURL=new URL(url);authURL.pathname=path;if(await cloudAuth(req,res,authURL))return;
 if(req.method!=='GET'&&req.method!=='HEAD'&&!(path==='/api/lottery/refresh'&&req.method==='POST'))return json(res,405,{error:'此云端版本仅开放行情查询，微信功能尚未配置'});
 if(!process.env.DATABASE_URL&&storageFactory===cloudStorage)return json(res,503,{error:'云端数据库尚未配置，请设置 DATABASE_URL'});
 const storage=storageFactory(),{store,inventory,settings,lease}=storage;
 if(path==='/api/health'){await settings.get('catalog.json');const collection=await settings.get('collection.json');return json(res,200,{status:'ok',storage:'postgres',collector:'github-actions-30m',lastRun:collection?.updatedAt??null,lastError:collection?.error??null})}
 if(path==='/api/collection'||path==='/api/catalog'){const value=await settings.get(path==='/api/catalog'?'catalog.json':'collection.json');return json(res,value?200:503,value??{error:'等待首次云端采集或数据迁移'})}
 if(path==='/api/storage'){const saved=await settings.get('storage.json');return json(res,saved?200:503,saved??{error:'等待数据容量统计'})}
 if(path==='/api/lottery/refresh'){
  if(req.method!=='POST')return json(res,405,{error:'请使用页面的实时刷新按钮'});
  const header=name=>req.headers?.get?.(name)??req.headers?.[name],origin=header('origin'),host=header('x-forwarded-host')??header('host')??url.host,protocol=(header('x-forwarded-proto')??url.protocol.slice(0,-1)).split(',')[0].trim();if(origin&&origin!==protocol+'://'+host)return json(res,403,{error:'仅允许本站发起刷新'});
  const result=await refresh(storage,{type:url.searchParams.get('type')||''});if(result.status===400)return json(res,400,{error:result.error});
  const summary=await storage.lottery.read();if(result.shared){res.setHeader('Retry-After','60');return json(res,202,{...compactLottery(summary),shared:true})}
  return json(res,result.status,{...compactLottery(summary),...(result.error?{error:result.error}:{})});
 }
 if(path==='/api/lottery')return json(res,200,compactLottery(await storage.lottery.read()));
 if(path==='/api/data'){const before=url.searchParams.get('before'),after=url.searchParams.get('after'),latestOnly=url.searchParams.get('mode')==='latest',thin=latestOnly||url.searchParams.get('mode')==='updates';if(after&&!Number.isFinite(Date.parse(after)))return json(res,400,{error:'Invalid cursor'});if(before&&!Number.isFinite(Date.parse(before)))return json(res,400,{error:'无效历史游标'});const lottery=!before?await storage.lottery.read():null;let limit=12,data;do{data=await store.read({before,after,limit,media:before?false:thin?'thumbnail':true,latestOnly});if(!before)data.lottery=lottery;if(thin)data=compactMarket(data);if(latestOnly)data.nextBefore=data.batches[0]?.at??null;if(Buffer.byteLength(JSON.stringify(data))<3800000)break;limit=Math.floor(limit/2)}while(limit>=1);if(limit<1)return json(res,503,{error:'单批数据过大，需调整行情采样'});return json(res,200,data)}
 if(path==='/api/inventory/search'){let filter;try{filter=JSON.parse(url.searchParams.get('filter')||'{}')}catch{return json(res,400,{error:'无效搜索条件'})}let data;try{data=await inventory.search({filter,sort:url.searchParams.get('sort')||'price',page:Number(url.searchParams.get('page')||1),limit:20})}catch(error){if(error.message.startsWith('Invalid'))return json(res,400,{error:'搜索条件或页码无效'});throw error}return json(res,200,{...data,items:data.items.map(compactInventory),source:'cloud'})}
 if(path==='/api/inventory'){const page=Number(url.searchParams.get('page')||1);if(!Number.isInteger(page)||page<1||page>100000)return json(res,400,{error:'无效页码'});return json(res,200,await inventory.list({type:url.searchParams.get('type')||'',page,limit:20}))}
 if(path==='/api/inventory/item'){const item=await inventory.get(url.searchParams.get('id')||'');return json(res,item?200:404,item?{item}:{error:'商品未收录'})}
 if(['/api/lottery/verify','/api/inventory/verify','/api/compare/item'].includes(path)){
  let identity;if(path==='/api/compare/item'){try{identity=parseCBGLink(url.searchParams.get('url')||'')}catch{return json(res,400,{error:'请输入有效藏宝阁商品链接'})}}else identity=await inventory.get(url.searchParams.get('id')||'');
  if(!identity?.ordersn)return json(res,404,{error:'商品没有可核验的真实流水号'});
  if(!await lease('public-detail',0.025))return json(res,429,{error:'详情核验较快，请稍后重试'});
  let fresh;try{fresh=await detail(identity)}catch{return json(res,502,{error:'藏宝阁详情暂不可用，请稍后重试'})}const observedAt=new Date().toISOString();
  if(!fresh){if(identity.id)await inventory.saveDetails([{...identity,status:'unknown',isLottery:false,lotteryConfirmed:false}],observedAt);return json(res,404,{error:'商品目前不可见，无法判定是否成交'})}
  const catalog=(await settings.get('catalog.json'))?.items??[];fresh.skin=catalog.find(c=>c.id===fresh.equipType)?.name??fresh.skin;await inventory.saveDetails([fresh],observedAt);return json(res,200,{item:fresh,observedAt,eligible:fresh.status==='listed'&&fresh.isLottery&&fresh.lotteryConfirmed&&Date.parse(fresh.lotteryEndsAt)>Date.now()});
 }
 return json(res,404,{error:'接口不存在'});
 }catch{ return json(res,503,{error:'云端数据服务暂不可用，请稍后重试；若首次部署，请先初始化数据库'}) }};
}
export default createCloudHandler();
