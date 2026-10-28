import {userFavorites} from './user-favorites.mjs';
import {cloudAccounts} from './cloud-auth-store.mjs';
import {cloudStorage} from './cloud-storage.mjs';
import {userPreferences,validatePreference,PreferenceError} from './user-preferences.mjs';
import {wechatConfig} from './config.mjs';
import {pushReady} from './user-delivery.mjs';
import {userSettings} from './user-settings.mjs';
export const notificationReady=pushReady;
const header=(req,key)=>req.headers?.get?.(key)??req.headers?.[key];
function session(req){try{return decodeURIComponent((header(req,'cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('zx_session='))?.slice(11)||'')}catch{return ''}}
export function createUserHandler({accounts=cloudAccounts,preferences=userPreferences,storage=cloudStorage,config=wechatConfig,settings=userSettings,favorites=userFavorites}={}){return async(req,res,url)=>{
 if(!url.pathname.startsWith('/api/user/'))return false;
 const json=(status,value)=>{res.statusCode=status;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(value));return true};
 try{
  const token=session(req),user=token?await accounts().user(token):null;if(!user)return json(401,{error:'请先微信登录'});
  if(!['GET','POST','PUT','DELETE'].includes(req.method))return json(405,{error:'请求方法不支持'});
  if(req.method!=='GET'){
   const host=(header(req,'x-forwarded-host')??header(req,'host')??url.host).split(',')[0].trim(),proto=(header(req,'x-forwarded-proto')??url.protocol.slice(0,-1)).split(',')[0].trim();
   if(header(req,'origin')!==proto+'://'+host||(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)&&proto!=='https'))return json(403,{error:'请从本站页面发起操作'});
  }
  const path=url.pathname,store=preferences(),id=url.searchParams.get('id');
  if(path==='/api/user/settings'){
   if(req.method==='GET')return json(200,{settings:await settings().get(user.id),notificationReady:notificationReady(config())});
   if(req.method==='PUT')return json(200,{settings:await settings().save(user.id,await req.readJSON())});
  }
  if(path==='/api/user/favorites'){
   if(req.method==='GET')return json(200,{favorites:await favorites().list(user.id),notificationReady:notificationReady(config()),limit:100});
   if(req.method==='DELETE'){await favorites().remove(user.id,url.searchParams.get('itemId'));return json(200,{ok:true})}
   if(req.method==='PUT'){const input=await req.readJSON();if(typeof input?.itemId!=='string'||!input.itemId||input.itemId.length>200)throw new PreferenceError('请选择有效商品');if(input.wechat&&!notificationReady(config()))throw new PreferenceError('微信模板提醒尚未配置，可先使用站内提醒');const item=await storage().inventory.get(input.itemId);const favorite=await favorites().save(user.id,item,input);const match=await store.evaluate(user.id);return json(200,{favorite,...match})}
  }
  if(path==='/api/user/preferences'){

   if(req.method==='GET')return json(200,{preferences:await store.list(user.id),notificationReady:notificationReady(config()),scope:'lottery-only',limit:20});
   if(req.method==='DELETE'){await store.remove(user.id,id);return json(200,{ok:true})}
   if(req.method==='PUT'){
    const input=await req.readJSON(),catalog=(await storage().settings.get('catalog.json'))?.items??[],value=validatePreference(input,catalog);
    if(value.wechat&&value.enabled&&!notificationReady(config()))throw new PreferenceError('微信模板提醒尚未配置，请先使用站内消息');
    const preference=await store.save(user.id,id,value);const match=await store.evaluate(user.id);return json(200,{preference,...match});
   }
  }
  if(path==='/api/user/messages'&&req.method==='GET')return json(200,await store.messages(user.id,url.searchParams.get('before')));
  if(path==='/api/user/messages/read'&&req.method==='POST'){const input=await req.readJSON();if(!input||!Object.hasOwn(input,'id'))throw new PreferenceError('请选择消息');await store.read(user.id,input.id);return json(200,{ok:true})}
  if(path==='/api/user/check'&&req.method==='POST'){
   if(!await storage().lease('preference-check-'+user.id,1))return json(429,{error:'已检查过最新采样，请一分钟后重试'});
   return json(200,await store.evaluate(user.id));
  }
  return json(405,{error:'接口或请求方法不支持'});
 }catch(e){return json(e instanceof PreferenceError?e.status:[400,413].includes(e.status)?e.status:503,{error:e instanceof PreferenceError?e.message:e.status===413?'请求内容过大':e.status===400?'请输入有效JSON内容':'账号数据暂不可用，请稍后重试'})}
}}
export const userHandler=createUserHandler();
