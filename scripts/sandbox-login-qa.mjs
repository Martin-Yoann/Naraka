import {chromium,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
const origin=process.env.SITE_URL||'https://www.gekiyan.com';
if(!origin.startsWith('https://'))throw new Error('Run authentication browser QA over HTTPS; login cookies are Secure.');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const status=await (await fetch(origin+'/api/auth/status')).json();expect(status.oaReady).toBe(true);expect(status.sandbox).toBe(true);expect(status.loggedIn).toBe(false);expect(status.notificationReady).toBe(false);
 await page.goto(origin);await page.waitForFunction(()=>window.portalRouteInitialized);
 await page.locator('#account-control').click();await expect(page.locator('.login-bridge-qr')).toBeVisible({timeout:20000});await expect(page.locator('.login-policy')).toContainText('测试号');
 await expect(page.locator('.login-status')).toContainText('扫码');await page.screenshot({path:'artifacts/sandbox-login-desktop.png'});
 const cookies=await page.context().cookies(origin);const ticket=cookies.find(c=>c.name==='zx_login');expect(ticket?.httpOnly).toBe(true);expect(ticket?.secure).toBe(true);
 const [id]=decodeURIComponent(ticket.value).split('.');const phone=await browser.newContext();
 const scan=await phone.request.get(origin+'/api/auth/wechat?mode=oa&ticket='+id,{maxRedirects:0});expect(scan.status()).toBe(302);const redirect=new URL(scan.headers().location);expect(redirect.hostname).toBe('open.weixin.qq.com');expect(redirect.searchParams.get('scope')).toBe('snsapi_userinfo');expect(redirect.searchParams.get('redirect_uri')).toBe('https://www.gekiyan.com/api/auth/wechat/callback');expect(redirect.searchParams.has('secret')).toBe(false);
 await expect(page.locator('.login-status')).toContainText('已扫码',{timeout:12000});await page.locator('.login-close').click();await expect(page.locator('#login-dialog')).not.toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.locator('#account-control').click();await expect(page.locator('.login-bridge-qr')).toBeVisible({timeout:20000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);const box=await page.locator('#login-dialog').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(391);await page.screenshot({path:'artifacts/sandbox-login-mobile.png'});
 const wx=await browser.newContext({userAgent:'Mozilla/5.0 MicroMessenger/8.0'}),wxPage=await wx.newPage();await wxPage.goto(origin);await wxPage.waitForFunction(()=>window.portalRouteInitialized);await wxPage.locator('#account-control').click();await expect(wxPage.locator('#login-oa')).toBeVisible();await expect(wxPage.locator('.login-bridge-qr')).toHaveCount(0);
 if(process.env.WECHAT_CALLBACK_TOKEN){const t=String(Math.floor(Date.now()/1000)),n='qa-nonce',signature=createHash('sha1').update([process.env.WECHAT_CALLBACK_TOKEN,t,n].sort().join('')).digest('hex');const response=await fetch(origin+'/api/wechat/callback?'+new URLSearchParams({signature,timestamp:t,nonce:n,echostr:'verified'}));expect(response.status).toBe(200);expect(await response.text()).toBe('verified');expect((await fetch(origin+'/api/wechat/callback?signature=bad')).status).toBe(403)}
 expect(errors).toEqual([]);console.log('Sandbox live API/UI checks passed: real ticket creation, cookies, official OAuth redirect, scan polling, mobile layout, WeChat in-app entry and signed verification. Real user authorization still requires WeChat confirmation.');await phone.close();await wx.close();
}finally{await browser.close()}
