import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { openStore } from './lib/store.mjs';
import {openInventory} from './lib/inventory.mjs';
import {openAccounts} from './lib/accounts.mjs';
import {wechatConfig} from './lib/config.mjs';
import {authorizationURL,exchangeCode,loginWidgetConfig,fetchWeChatProfile} from './lib/wechat.mjs';
import {lotterySummary} from './dist/lottery.js';
import {parseCBGLink} from './dist/compare-core.js';
import {queryDetail} from './lib/cbg.mjs';
import {compactInventory} from './dist/inventory-search.js';
const root=resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const store=openStore(fileURLToPath(new URL('./data/market.sqlite',import.meta.url)));
const inventory=openInventory(fileURLToPath(new URL('./data/inventory.sqlite',import.meta.url)));
const accounts=openAccounts(fileURLToPath(new URL('./data/accounts.sqlite',import.meta.url)));
const port=Number(process.env.PORT||3100),host=process.env.HOST||'127.0.0.1';
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
function json(res,status,body){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body))}
function authorized(req){const expected=process.env.IMPORT_TOKEN;if(!expected)return false;const a=Buffer.from(req.headers.authorization||''),b=Buffer.from('Bearer '+expected);return a.length===b.length&&timingSafeEqual(a,b)}
function cookie(req,name){return (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||''}
function sessionUser(req){return accounts.user(cookie(req,'zx_session'))}
function safeMutation(req){return req.headers.origin===(wechatConfig().origin||`http://${host}:${port}`)}
function sessionCookie(name,value,age){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`}
const comparisonCache=new Map();let lastComparisonQuery=0;
const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/collection'&&req.method==='GET'){try{return json(res,200,JSON.parse(await readFile(resolve(process.env.RUNTIME_EXPORT_DIR||root,'collection.json'),'utf8')))}catch{return json(res,503,{error:'等待首次全量收集'})}}
  if(url.pathname==='/api/inventory/search'&&req.method==='GET'){try{const filter=JSON.parse(url.searchParams.get('filter')||'{}'),data=inventory.search({filter,sort:url.searchParams.get('sort')||'price'});return json(res,200,{...data,items:data.items.map(compactInventory)})}catch{return json(res,400,{error:'搜索条件无效'})}}
  if(url.pathname==='/api/inventory'&&req.method==='GET'){try{return json(res,200,inventory.list({type:url.searchParams.get('type')||'',page:Number(url.searchParams.get('page')||1)}))}catch{return json(res,400,{error:'无效查询参数'})}}
  if((url.pathname==='/api/lottery/verify'||url.pathname==='/api/inventory/verify')&&req.method==='GET'){
   const id=url.searchParams.get('id'),item=inventory.get(id??'')??store.read().batches.filter(b=>b.coverage!=='failed').at(-1)?.items.find(item=>item.id===id);if(!item?.ordersn)return json(res,404,{error:'该商品没有可核验的真实流水号'});
   if(Date.now()-lastComparisonQuery<1500)return json(res,429,{error:'核验较快，请稍后重试'});lastComparisonQuery=Date.now();try{const fresh=await queryDetail(item),at=new Date().toISOString();if(!fresh){inventory.saveDetails([{...item,status:'unknown',isLottery:false,lotteryConfirmed:false}],at);return json(res,404,{error:'该商品目前不可见，无法判定是否成交'})}fresh.skin=item.skin;inventory.saveDetails([fresh],at);return json(res,200,{item:fresh,observedAt:at,eligible:fresh.status==='listed'&&fresh.isLottery&&fresh.lotteryConfirmed&&Date.parse(fresh.lotteryEndsAt)>Date.now()})}catch{return json(res,502,{error:'藏宝阁暂未完成详情核验，请稍后重试'})}
  }
  if(url.pathname==='/api/compare/item'&&req.method==='GET'){
   let identity;try{identity=parseCBGLink(url.searchParams.get('url')||'')}catch(error){return json(res,400,{error:error.message})}
   const key=identity.serverId+':'+identity.ordersn,cached=comparisonCache.get(key);if(cached&&Date.now()-cached.at<300000)return json(res,200,{item:cached.item,observedAt:new Date(cached.at).toISOString()});
   if(Date.now()-lastComparisonQuery<1500)return json(res,429,{error:'请求较快，请稍后重试'});lastComparisonQuery=Date.now();
   try{const item=await queryDetail(identity);if(!item)return json(res,404,{error:'商品已下架、失效或并非谪星'});if(comparisonCache.size>1000)comparisonCache.clear();comparisonCache.set(key,{item,at:Date.now()});return json(res,200,{item,observedAt:new Date().toISOString()})}catch{return json(res,502,{error:'藏宝阁详情暂不可用，请稍后重试'})}
  }
  if(url.pathname==='/api/auth/status'&&req.method==='GET'){const config=wechatConfig(),user=sessionUser(req);return json(res,200,{oaReady:config.oaReady,webReady:config.webReady,notificationReady:config.oaReady&&config.sendEnabled&&!!config.templateId,loggedIn:!!user,user:user?{nickname:user.nickname||'微信用户',avatar:user.avatar||null}:null,officialBound:!!user?.oa_openid,subscriptions:user?accounts.subscriptions(user.id):[]})}
  if(url.pathname==='/api/auth/wechat/qr'&&req.method==='POST'){
   if(!safeMutation(req))return json(res,403,{error:'请求来源不合法'});const config=wechatConfig();if(!config.webReady)return json(res,503,{error:'微信扫码登录暂未开通'});
   const state=accounts.state('web');res.setHeader('set-cookie',sessionCookie('zx_oauth',state,600));return json(res,200,loginWidgetConfig(state,config));
  }
  if(url.pathname==='/api/auth/wechat'&&req.method==='GET'){
   const mode=url.searchParams.get('mode')==='web'?'web':'oa',config=wechatConfig();if(!(mode==='web'?config.webReady:config.oaReady))return json(res,503,{error:'微信登录尚未配置，请联系站点管理员'});
   const state=accounts.state(mode);res.writeHead(302,{location:authorizationURL(mode,state,config),'set-cookie':sessionCookie('zx_oauth',state,600),'cache-control':'no-store'});return res.end();
  }
  if(url.pathname==='/api/auth/wechat/callback'&&req.method==='GET'){
   const state=url.searchParams.get('state'),code=url.searchParams.get('code');if(!state||state!==cookie(req,'zx_oauth'))return json(res,400,{error:'授权状态无效'});
   const loginError=reason=>{res.writeHead(303,{location:'/?login_error='+reason,'set-cookie':sessionCookie('zx_oauth','',0),'cache-control':'no-store','referrer-policy':'no-referrer'});res.end()};
   const mode=accounts.consumeState(state);if(!mode)return loginError('expired');if(!code)return loginError('cancelled');
   try{const identity=await exchangeCode(mode,code);const token=accounts.login(identity.appid,identity.openid,identity.unionid,mode==='oa');if(mode==='web')accounts.profile(token,await fetchWeChatProfile(identity));res.writeHead(303,{location:'/#lottery','set-cookie':[sessionCookie('zx_session',token,604800),sessionCookie('zx_oauth','',0)],'cache-control':'no-store','referrer-policy':'no-referrer'});return res.end()}catch{return loginError('unavailable')}
  }
  if(url.pathname==='/api/auth/logout'&&req.method==='POST'){if(!safeMutation(req))return json(res,403,{error:'请求来源不合法'});accounts.logout(cookie(req,'zx_session'));res.setHeader('set-cookie',sessionCookie('zx_session','',0));return json(res,200,{ok:true})}
  if(url.pathname==='/api/subscriptions'&&req.method==='POST'){
   if(!safeMutation(req))return json(res,403,{error:'请求来源不合法'});const user=sessionUser(req);if(!user)return json(res,401,{error:'请先微信登录'});
   let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>4096)return json(res,413,{error:'请求过大'});chunks.push(chunk)}
   let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return json(res,400,{error:'无效JSON'})}
   let parsed;try{parsed=JSON.parse(body.key)}catch{return json(res,400,{error:'无效监控条件'})}
   const allowed=Array.isArray(parsed)&&parsed.length===2&&typeof parsed[0]==='string'&&Number.isInteger(parsed[1])&&parsed[1]>=0&&parsed[1]<=4;
   const known=store.read().batches.some(batch=>batch.metadata?.catalog?.some(entry=>entry.name===parsed?.[0]));
   if(typeof body.enabled!=='boolean'||!allowed||!known)return json(res,400,{error:'无效监控条件'});
   accounts.subscribe(user.id,body.key,body.enabled);return json(res,200,{ok:true,subscriptions:accounts.subscriptions(user.id)});
  }
  if(url.pathname==='/api/data'&&req.method==='GET')return json(res,200,store.read());
  if(url.pathname==='/api/health'&&req.method==='GET'){const batches=store.read().batches;return json(res,200,{status:'ok',collector:'windows-task-30m',lastRun:batches.at(-1)?.at??null,lastError:batches.at(-1)?.metadata?.error??null})}
  if(url.pathname==='/api/import'&&req.method==='POST'){
    if(!authorized(req))return json(res,401,{error:'需设置 IMPORT_TOKEN 并提交匹配的 Bearer token'});
    let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>5*1024*1024)return json(res,413,{error:'最多5MB'});chunks.push(chunk)}
    try{return json(res,200,store.import(JSON.parse(Buffer.concat(chunks).toString('utf8'))))}catch(error){return json(res,400,{error:error.message})}
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
  let pathname;try{pathname=decodeURIComponent(url.pathname)}catch{return json(res,400,{error:'Invalid URL'})}
  const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+sep))return json(res,403,{error:'Forbidden'});
  try{let content;const name=pathname.slice(1);if(process.env.RUNTIME_EXPORT_DIR&&['market.json','catalog.json','collection.json'].includes(name)){try{content=await readFile(resolve(process.env.RUNTIME_EXPORT_DIR,name))}catch{}}content??=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','x-content-type-options':'nosniff','cache-control':'no-cache'});res.end(req.method==='HEAD'?undefined:content)}catch{return json(res,404,{error:'Not found'})}
}catch(error){console.error(error.message);if(!res.headersSent)json(res,500,{error:'Internal server error'});else res.end()}});
server.listen(port,host,()=>console.log(`谪星行情台 http://${host}:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{store.close();accounts.close();inventory.close();process.exit(0)}));
