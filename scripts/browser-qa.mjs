import {clickNav} from './qa-navigation.mjs';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3100/#market');await page.locator('#listings tr[data-id]').first().waitFor();
 assert.ok(await page.locator('#listings tr[data-id]').count()>0);
 
 await page.locator('.advanced summary').click();await page.fill('#slot-min-1','999999');await page.locator('#slot-min-1').blur();assert.equal(await page.locator('#listings tr[data-id]').count(),0);
 await page.fill('#slot-min-1','');await page.locator('#slot-min-1').blur();
 await page.click('#save-watch');await clickNav(page,'[data-view="watch"]');assert.equal(await page.locator('[data-watch]').count(),1);await page.locator('[data-watch]').click();
 await page.locator('#listings tr[data-id]').first().click();assert.ok(await page.locator('dialog[open]').isVisible());await page.click('#close-detail');
 await clickNav(page,'[data-view="calculator"]');await page.fill('#amount','1000');assert.equal(await page.locator('#result-value').textContent(),'¥920.00');await page.selectOption('#calc-mode','gross');assert.equal(await page.locator('#result-value').textContent(),'¥1,086.96');
 await clickNav(page,'[data-view="market"]');const downloadPromise=page.waitForEvent('download');await page.click('#export');const download=await downloadPromise;assert.equal(download.suggestedFilename(),'谪星条件行情.csv');
 await page.click('#source-switch');await expect(page.locator('#toast')).toContainText('真实采样');
 await page.selectOption('#holes','');await page.locator('.advanced summary').click();
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('Browser QA passed: filtering, watch, item details, calculator, export, source feedback, mobile overflow, no browser errors.');
}finally{await browser.close()}
