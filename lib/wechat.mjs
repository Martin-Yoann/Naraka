import {wechatConfig} from './config.mjs';
let tokenCache=null;
async function wxJSON(url,options={},fetcher=fetch){const r=await fetcher(url,{...options,signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`微信HTTP ${r.status}`);const body=await r.json();if(body.errcode)throw new Error(`微信错误码 ${body.errcode}`);return body}
export function authorizationURL(mode,state,config=wechatConfig()){
 const web=mode==='web';if(!(web?config.webReady:config.oaReady))throw new Error('微信登录尚未配置');
 const url=new URL(web?'https://open.weixin.qq.com/connect/qrconnect':'https://open.weixin.qq.com/connect/oauth2/authorize');
 url.search=new URLSearchParams({appid:web?config.webId:config.oaId,redirect_uri:config.origin+'/api/auth/wechat/callback',response_type:'code',scope:web?'snsapi_login':'snsapi_base',state}).toString();url.hash='wechat_redirect';return url.href;
}
export function loginWidgetConfig(state,config=wechatConfig()){
 if(!config.webReady)throw Error('网站微信登录尚未配置');
 return {appId:config.webId,redirectUri:config.origin+'/api/auth/wechat/callback',scope:'snsapi_login',state,fastLogin:true,expiresIn:600};
}
export async function fetchWeChatProfile(identity,fetcher=fetch){
 if(!identity.access_token||!identity.openid)return {};
 try{const profile=await wxJSON('https://api.weixin.qq.com/sns/userinfo?'+new URLSearchParams({access_token:identity.access_token,openid:identity.openid,lang:'zh_CN'}),{},fetcher);let avatar=null;try{const u=new URL(profile.headimgurl);if(u.hostname==='qlogo.cn'||u.hostname.endsWith('.qlogo.cn')||u.hostname==='wxqlogo.cn'||u.hostname.endsWith('.wxqlogo.cn')){u.protocol='https:';avatar=u.href}}catch{}return {nickname:typeof profile.nickname==='string'?profile.nickname.slice(0,80):null,avatar}}catch{return {}}
}
export async function exchangeCode(mode,code,fetcher=fetch,config=wechatConfig()){
 const web=mode==='web';if(!(web?config.webReady:config.oaReady))throw Error('微信登录未配置');
 const params=new URLSearchParams({appid:web?config.webId:config.oaId,secret:web?config.webSecret:config.oaSecret,code,grant_type:'authorization_code'});
 const body=await wxJSON('https://api.weixin.qq.com/sns/oauth2/access_token?'+params,{},fetcher);if(!body.openid)throw Error('微信未返回身份');return {...body,appid:web?config.webId:config.oaId};
}
export async function officialToken(fetcher=fetch,config=wechatConfig()){
 if(tokenCache&&tokenCache.until>Date.now())return tokenCache.value;
 const body=await wxJSON('https://api.weixin.qq.com/cgi-bin/token?'+new URLSearchParams({grant_type:'client_credential',appid:config.oaId,secret:config.oaSecret}),{},fetcher);if(!body.access_token)throw Error('微信未返回服务端凭证');tokenCache={value:body.access_token,until:Date.now()+Math.max(0,body.expires_in-120)*1000};return body.access_token;
}
export function templateData(event,fields){
 const mapping=JSON.parse(fields||'{}');const values={skin:event.skin,price:(event.priceCents/100).toFixed(2),previous:(event.previousCents/100).toFixed(2),time:new Date(event.at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}),holes:String(event.holesCount)};
 const data={};for(const[key,value]of Object.entries(mapping)){if(!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)||!(value in values))throw Error('模板字段映射无效');data[key]={value:values[value]}}if(!Object.keys(data).length)throw Error('请配置已批准模板的字段映射');return data;
}
export async function sendPriceNotice(openid,event,fetcher=fetch,config=wechatConfig()){
 if(!config.oaReady||!config.sendEnabled||!config.templateId)throw Error('微信公众号通知尚未启用');
 const accessToken=await officialToken(fetcher,config);
 const user=await wxJSON('https://api.weixin.qq.com/cgi-bin/user/info?'+new URLSearchParams({access_token:accessToken,openid,lang:'zh_CN'}),{},fetcher);if(user.subscribe!==1)throw Error('客户未关注或已取消关注公众号');
 return wxJSON('https://api.weixin.qq.com/cgi-bin/message/template/send?'+new URLSearchParams({access_token:accessToken}),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({touser:openid,template_id:config.templateId,url:event.url,data:templateData(event,config.templateFields)})},fetcher);
}
