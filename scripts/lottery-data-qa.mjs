import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import handler from '../api/index.js';
import {closeCloud} from '../lib/cloud-db.mjs';
const root=resolve('dist'),server=createServer(async(req,res)=>{try{if(req.url.startsWith('/api/'))return handler(req,res);if(req.url==='/catalog.json'){req.url='/api/catalog';return handler(req,res)}const path=resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));if(!path.startsWith(root+sep)){res.writeHead(403);return res.end()}res.setHeader('content-type',({'.js':'application/javascript','.css':'text/css','.json':'application/json','.html':'text/html'})[extname(path)]??'application/octet-stream');res.end(await readFile(path))}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=process.env.SITE_URL||'http://127.0.0.1:'+server.address().port,browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const response=await fetch(origin+'/api/lottery');assert.equal(response.status,200);const summary=await response.json();assert.ok(summary.groups.length>0);
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/#lottery');await expect(page.locator('#lottery-rows tr')).toHaveCount(summary.groups.length,{timeout:30000});
 const sample=summary.groups.find(g=>!g.current&&g.lastObserved?.slots?.length),name=sample?.skin;
 assert.ok(sample,'Real expired historical sample must exist');await page.selectOption('#lottery-filter-skin',sample.skin);await page.selectOption('#lottery-filter-holes',String(sample.holesCount));const row=page.locator('#lottery-rows tr');await expect(row).toHaveCount(1);await expect(row.locator('td').nth(1)).toContainText('¥');await expect(row.locator('td').nth(3)).toContainText(sample.lastObserved.slots.join(' / '));await expect(row.locator('td').nth(3)).toContainText('截止');await expect(row.locator('td').nth(3)).not.toHaveText('—');await expect(row.locator('a.lottery-link')).toHaveCount(0);
 await expect(row.locator('td').nth(2)).toContainText('星格');await row.locator('[data-lottery-preview]').click();await expect(page.locator('.product-dialog')).toBeVisible();await page.keyboard.press('Escape');
 await page.selectOption('#lottery-filter-skin','');await page.selectOption('#lottery-filter-holes','');await page.screenshot({path:'artifacts/lottery-data-desktop.png'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'artifacts/lottery-data-mobile.png'});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({site:origin,groups:summary.groups.length,withSlots:summary.groups.filter(g=>(g.current??g.lastObserved)?.slots?.length).length,withDeadline:summary.groups.filter(g=>(g.current??g.lastObserved)?.lotteryEndsAt).length,expiredSample:name,checks:['real Neon data','expired observation retains price, slots and deadline','historical low owns its slots','expired sample has no participation link','preview accessible','mobile bounds'],pageErrors:errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));await closeCloud()}
