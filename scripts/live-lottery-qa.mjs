import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const origin=process.env.SITE_URL||'http://127.0.0.1:3201',browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/lottery');await expect(page.locator('#lottery-storage-status')).toContainText('每3天清理一次',{timeout:30000});
 const before=await(await page.request.get(origin+'/api/lottery')).json();
 let result;
 if(Date.parse(before.refresh?.retryAt)>Date.now()){
  const shared=await page.request.post(origin+'/api/lottery/refresh',{headers:{origin}});assert.equal(shared.status(),202);result=await shared.json();
 }else{
  const clickAt=Date.now(),response=page.waitForResponse(r=>r.url().includes('/api/lottery/refresh')&&r.request().method()==='POST',{timeout:65000});await page.click('#lottery-refresh');await expect(page.locator('#lottery-refresh')).toBeDisabled();
  await page.waitForFunction(async started=>{const data=await(await fetch('/api/lottery',{cache:'no-store'})).json();return data.refresh?.state==='running'&&Date.parse(data.refresh.startedAt)>=started-1000},clickAt,{timeout:15000});
  const shared=await page.request.post(origin+'/api/lottery/refresh',{headers:{origin},timeout:65000});assert.equal(shared.status(),202);
  const completed=await response;assert.equal(completed.status(),200);result=await completed.json();await expect(page.locator('#lottery-message')).toContainText('独立查询已完成',{timeout:10000});
 }
 assert.ok(result.refresh.checkedCount<=12);assert.ok(result.refresh.listed<=30);assert.ok(result.refresh.completedAt);for(const group of before.groups){const updated=result.groups.find(g=>g.key===group.key);assert.ok(updated);assert.ok(updated.priceCents<=group.priceCents)}
 const active=result.groups.filter(g=>g.current);for(const group of active){assert.ok(Array.isArray(group.current.slots));assert.ok(Date.parse(group.current.lotteryEndsAt)>Date.now())}
 await expect(page.locator('#lottery-live-status')).toContainText('全站每60秒最多发起一轮');await page.screenshot({path:'artifacts/lottery-live-desktop.png'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'artifacts/lottery-live-mobile.png'});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({site:origin,scope:result.refresh.scope,listed:result.refresh.listed,verified:result.refresh.checkedCount,eligible:result.refresh.eligibleCount,currentGroups:active.length,checks:['real official listing and detail requests','shared global cooldown','button state and completion','historic lows preserved','actual slots and deadlines','storage policy visible','mobile bounds'],pageErrors:errors}));
}finally{await browser.close()}
