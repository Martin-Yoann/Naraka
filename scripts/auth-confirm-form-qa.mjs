// Browser regression fixture only: no real WeChat exchange or production database writes.
import {chromium,expect} from '@playwright/test';
import {createAuthHandler} from '../lib/cloud-auth-handler.mjs';
const origin='https://auth-fixture.invalid',id='11111111-1111-4111-8111-111111111111',key='confirmation-fixture-key';
let confirmations=0;
const store={consumeFlow:async()=>({mode:'oa',ticket_id:id}),identity:async()=>id,prepareConfirmation:async()=>key,confirm:async(ticket,secret)=>{if(ticket!==id||secret!==key)return null;confirmations++;return {user_id:id}},logout:async()=>{},session:async()=> 'session-fixture-only'};
const auth=createAuthHandler({config:()=>({origin,oaReady:true,webReady:false,sandbox:true}),accounts:()=>store,exchange:async()=>({appid:'fixture',openid:'fixture'}),profile:async()=>({})});
async function call(path,method,headers){const out={headers:{},status:200,body:''};await auth({method,headers:{host:new URL(origin).host,...headers}},{setHeader(k,v){out.headers[k.toLowerCase()]=v},set statusCode(s){out.status=s},end(b){out.body=b||''}},new URL(path,origin));return out}
const callback=await call('/api/auth/wechat/callback?state=fixture-state&code=fixture-code','GET',{cookie:'zx_oauth=fixture-state'});
expect(callback.headers['referrer-policy']).toBe('strict-origin');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 for(const policy of ['no-referrer','strict-origin']){
  const context=await browser.newContext({userAgent:'Mozilla/5.0 MicroMessenger/8.0'}),page=await context.newPage();let postedOrigin,postedReferer;
  await context.addCookies([{name:'zx_confirm',value:id+'.'+key,domain:new URL(origin).hostname,path:'/api/auth',httpOnly:true,secure:true,sameSite:'Lax'}]);
  await page.route('**/*',async route=>{
   const req=route.request();
   if(new URL(req.url()).pathname==='/api/auth/wechat/callback'){const headers={...callback.headers,'referrer-policy':policy};delete headers['set-cookie'];return route.fulfill({status:200,headers,body:callback.body})}
   if(new URL(req.url()).pathname==='/api/auth/wechat/confirm'){
    postedOrigin=req.headers().origin;postedReferer=req.headers().referer;const response=await call('/api/auth/wechat/confirm','POST',req.headers());delete response.headers['set-cookie'];return route.fulfill({status:response.status,headers:response.headers,body:response.body});
   }
   return route.abort();
  });
  await page.goto(origin+'/api/auth/wechat/callback?code=fixture-code');await page.getByRole('button',{name:'确认登录电脑端'}).click();await page.waitForURL('**/api/auth/wechat/confirm');
  if(policy==='no-referrer'){expect(postedOrigin).toBe('null');await expect(page.locator('body')).toContainText('请从本站页面发起操作');expect(confirmations).toBe(0)}
  else{expect(postedOrigin).toBe(origin);expect(postedReferer).toBe(origin+'/');await expect(page.locator('body')).toContainText('登录已确认');expect(confirmations).toBe(1)}
  await context.close();
 }
 console.log('Browser regression passed: old privacy policy reproduces rejection; fixed confirmation succeeds and sends no OAuth code in Referer.');
}finally{await browser.close()}
