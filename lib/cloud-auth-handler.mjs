import {createHash,timingSafeEqual} from 'node:crypto';
import QRCode from 'qrcode';
import {wechatConfig} from './config.mjs';
import {authorizationURL,exchangeCode,fetchWeChatProfile,loginWidgetConfig} from './wechat.mjs';
import {cloudAccounts} from './cloud-auth-store.mjs';
import {cloudStorage} from './cloud-storage.mjs';
const header=(req,key)=>req.headers?.get?.(key)??req.headers?.[key];
const cookie=(req,key)=>{try{return decodeURIComponent((header(req,'cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(key+'='))?.slice(key.length+1)||'')}catch{return ''}};
const ck=(name,value,age,path='/api/auth')=>`${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;
const session=token=>ck('zx_session',token,604800,'/');
const equal=(a,b)=>!!a&&!!b&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const validId=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id||'');
function json(res,status,body,cookies=[]){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');if(cookies.length)res.setHeader('Set-Cookie',cookies);res.end(JSON.stringify(body))}
function redirect(res,path,cookies=[]){res.statusCode=303;res.setHeader('Location',path);if(cookies.length)res.setHeader('Set-Cookie',cookies);res.end()}
function page(res,title,text,form=''){
 // no-referrer makes navigational form POSTs send Origin:null. strict-origin
 // keeps the source check valid while withholding OAuth query strings.
 res.setHeader('Referrer-Policy','strict-origin');
 res.statusCode=200;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
 res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · 谪星阁</title><style>body{margin:0;background:#f7f8fa;color:#1c2338;font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:100svh}main{width:min(380px,calc(100vw - 64px));background:white;padding:28px 22px;border:1px solid #e3e6ed;border-radius:18px}h1{font-size:23px}p{color:#647084;line-height:1.9}button,a{box-sizing:border-box;display:block;width:100%;padding:14px;margin-top:12px;border:0;border-radius:9px;background:#1c2338;color:white;text-align:center;text-decoration:none;font:inherit;cursor:pointer}.cancel{color:#1c2338;background:#f0f2f5}.mark{color:#e23b2e}</style><main><span class="mark">✦ 谪星阁</span><h1>${title}</h1><p>${text}</p>${form}</main></html>`);
}
async function limited(req,storage){const ip=(header(req,'x-forwarded-for')||'shared').split(',')[0].trim();const key=createHash('sha256').update(ip).digest('hex').slice(0,24);return !!await storage().lease('auth-login-'+key,0.02)}
export function createAuthHandler({config=wechatConfig,accounts=cloudAccounts,storage=cloudStorage,exchange=exchangeCode,profile=fetchWeChatProfile}={}){
 return async function auth(req,res,url){
  const path=url.pathname;if(!path.startsWith('/api/auth/')&&path!=='/api/wechat/callback')return false;
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');const cfg=config();
  if(path==='/api/wechat/callback'){
   const token=process.env.WECHAT_CALLBACK_TOKEN,t=url.searchParams.get('timestamp')||'',n=url.searchParams.get('nonce')||'';
   const expected=token&&t&&n?createHash('sha1').update([token,t,n].sort().join('')).digest('hex'):'';
   if(!equal(expected,url.searchParams.get('signature'))){json(res,403,{error:'微信签名校验失败'});return true}
   res.setHeader('Content-Type','text/plain; charset=utf-8');
   if(req.method==='GET'){const echo=url.searchParams.get('echostr')||'';if(echo.length>512){json(res,400,{error:'无效验证请求'});return true}res.statusCode=200;res.end(echo);return true}
   if(req.method==='POST'){res.statusCode=200;res.end('success');return true}json(res,405,{error:'请求方法不支持'});return true;
  }
  if(path==='/api/auth/status'&&req.method==='GET'){
   const token=cookie(req,'zx_session'),user=token&&(cfg.oaReady||cfg.webReady)?await accounts().user(token):null;
   json(res,200,{oaReady:cfg.oaReady,webReady:cfg.webReady,notificationReady:false,sandbox:cfg.sandbox,loggedIn:!!user,user:user?{nickname:user.nickname||'微信用户',avatar:user.avatar||null}:null,officialBound:false,subscriptions:[]});return true;
  }
  if(!cfg.oaReady&&!cfg.webReady){json(res,503,{error:'微信登录尚未配置'});return true}
  if(req.method==='POST'){
   const host=(header(req,'x-forwarded-host')??header(req,'host')??'').split(',')[0].trim();
   const protocol=(header(req,'x-forwarded-proto')??url.protocol.slice(0,-1)).split(',')[0].trim(),local=/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
   if(!host||(!local&&protocol!=='https')||header(req,'origin')!==protocol+'://'+host){json(res,403,{error:'请从本站页面发起操作'});return true}
  }
  const store=accounts();
  if(path==='/api/auth/logout'&&req.method==='POST'){await store.logout(cookie(req,'zx_session'));json(res,200,{ok:true},[ck('zx_session','',0,'/')]);return true}
  if(path==='/api/auth/wechat/qr'&&req.method==='POST'){
   if(!await limited(req,storage)){json(res,429,{error:'请求较快，请稍后重试'});return true}
   if(cfg.webReady&&!cfg.sandbox){const state=await store.flow('web');json(res,200,loginWidgetConfig(state,cfg),[ck('zx_oauth',state,600)]);return true}
   if(!cfg.oaReady){json(res,503,{error:'公众号授权暂未配置'});return true}
   const {id,key}=await store.ticket(),scanURL=cfg.origin+'/api/auth/wechat?mode=oa&ticket='+id;
   const image=await QRCode.toDataURL(scanURL,{width:256,margin:4,color:{dark:'#1c2338',light:'#ffffff'},errorCorrectionLevel:'M'});
   json(res,200,{kind:'oa-bridge',image,expiresIn:600,sandbox:cfg.sandbox},[ck('zx_login',id+'.'+key,600)]);return true;
  }
  if(path==='/api/auth/wechat/poll'&&req.method==='POST'){
   const [id,key]=cookie(req,'zx_login').split('.');if(!validId(id)||!key){json(res,200,{status:'expired'});return true}
   const result=await store.poll(id,key);if(result.token){await store.logout(cookie(req,'zx_session'));json(res,200,{status:'approved'},[session(result.token),ck('zx_login','',0)]);return true}json(res,200,{status:result.status});return true;
  }
  if(path==='/api/auth/wechat'&&req.method==='GET'){
   const host=(header(req,'x-forwarded-host')??header(req,'host')??'').split(',')[0].trim();
   if(host&&host!==new URL(cfg.origin).host&&!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)){redirect(res,cfg.origin+path+url.search);return true}
   if(!await limited(req,storage)){json(res,429,{error:'请求较快，请稍后重试'});return true}
   const mode=url.searchParams.get('mode')==='web'?'web':'oa',ticket=url.searchParams.get('ticket');
   if(!(mode==='web'?cfg.webReady:cfg.oaReady)){json(res,503,{error:'该微信登录方式未配置'});return true}
   if(ticket&&(mode!=='oa'||!validId(ticket)||!await store.scan(ticket))){page(res,'二维码已失效','请回到电脑刷新二维码，重新扫码。');return true}
   const state=await store.flow(mode,ticket);res.statusCode=302;res.setHeader('Location',authorizationURL(mode,state,cfg));res.setHeader('Set-Cookie',ck('zx_oauth',state,600));res.end();return true;
  }
  if(path==='/api/auth/wechat/callback'&&req.method==='GET'){
   const state=url.searchParams.get('state');if(!equal(state,cookie(req,'zx_oauth'))){page(res,'授权校验失败','请从登录页面重新发起微信授权。');return true}
   const flow=await store.consumeFlow(state);if(!flow){redirect(res,'/?login_error=expired',[ck('zx_oauth','',0)]);return true}
   const code=url.searchParams.get('code');if(!code){await store.cancelTicket(flow.ticket_id);redirect(res,'/?login_error=cancelled',[ck('zx_oauth','',0)]);return true}
   try{
    const identity=await exchange(flow.mode,code,fetch,cfg),userId=await store.identity(identity,await profile(identity));
    if(flow.ticket_id){
     const key=await store.prepareConfirmation(flow.ticket_id,userId);if(!key){page(res,'二维码已失效','请回到电脑刷新二维码。');return true}
     res.setHeader('Set-Cookie',[ck('zx_confirm',flow.ticket_id+'.'+key,600),ck('zx_oauth','',0)]);
     page(res,'确认登录电脑端','你正在授权展示此二维码的电脑登录谪星阁。请仅在自己的设备上确认。','<form method="post" action="/api/auth/wechat/confirm"><button type="submit">确认登录电脑端</button></form><form method="post" action="/api/auth/wechat/cancel"><button class="cancel" type="submit">取消登录</button></form>');return true;
    }
    await store.logout(cookie(req,'zx_session'));redirect(res,'/',[session(await store.session(userId)),ck('zx_oauth','',0)]);return true;
   }catch{await store.cancelTicket(flow.ticket_id);redirect(res,'/?login_error=unavailable',[ck('zx_oauth','',0)]);return true}
  }
  if(['/api/auth/wechat/confirm','/api/auth/wechat/cancel'].includes(path)&&req.method==='POST'){
   const [id,key]=cookie(req,'zx_confirm').split('.');if(!validId(id)||!key){page(res,'授权已过期','请回到电脑刷新二维码。');return true}
   const approve=path.endsWith('/confirm'),result=await store.confirm(id,key,approve);if(!result){page(res,'授权已过期','请回到电脑刷新二维码。');return true}
   const cookies=[ck('zx_confirm','',0)];if(approve){await store.logout(cookie(req,'zx_session'));cookies.push(session(await store.session(result.user_id)))}res.setHeader('Set-Cookie',cookies);
   page(res,approve?'登录已确认':'已取消登录',approve?'电脑端将自动完成登录，此手机也已登录。':'电脑端未获授权，可关闭此页面。','<a href="/">返回谪星阁</a>');return true;
  }
  json(res,405,{error:'请求方法或登录接口不支持'});return true;
 };
}
export const cloudAuth=createAuthHandler();
