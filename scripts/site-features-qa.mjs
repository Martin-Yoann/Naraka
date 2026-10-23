import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {clickNav} from './qa-navigation.mjs';
const origin=process.env.SITE_URL||'http://127.0.0.1:3201',browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];await page.addInitScript(()=>localStorage.setItem('zx-lottery-auto','false'));page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await expect(page.locator('.portal-product')).toHaveCount(4,{timeout:30000});
 await page.click('[data-highlight=four]');for(const b of await page.locator('.portal-product-badge').allTextContents())assert.ok(b.startsWith('4孔'));await page.locator('[data-home-compare]').first().click();await expect(page.locator('#compare-count')).toHaveText('1');
 await clickNav(page,'#calculator-nav');await page.selectOption('#calc-mode','bargain',{force:true});await page.fill('#amount','3000');await page.click('[data-discount="0.8"]');await expect(page.locator('#result-value')).toHaveText('¥552.00');
 await page.selectOption('#fee-share','0.5',{force:true});await expect(page.locator('#result-value')).toHaveText('¥576.00');await page.selectOption('#fee-share','0',{force:true});await expect(page.locator('#result-value')).toHaveText('¥600.00');
 await clickNav(page,'#market-nav');await page.click('#save-watch');await expect(page.locator('#login-dialog')).toBeVisible();await page.click('.login-close');await clickNav(page,'#watch-nav');await expect(page.locator('#pref-guest')).toBeVisible();
 await clickNav(page,'#gallery-nav');await expect(page.locator('#atlas-panel')).toBeVisible();await expect(page.locator('[data-atlas-preview]')).not.toHaveCount(0,{timeout:30000});await page.locator('[data-atlas-preview]').first().click();await expect(page.locator('.product-dialog')).toBeVisible();await page.keyboard.press('Escape');
 await clickNav(page,'#simulator-nav');await expect(page.locator('#sim-many')).toBeEnabled({timeout:30000});await page.click('#sim-many');await expect(page.locator('#sim-total')).toContainText('100 次');await page.click('#sim-reset');await expect(page.locator('#sim-total')).toContainText('尚未演练');
 await clickNav(page,'#trends-nav');await page.click('#trend-apply');await expect(page.locator('#trend-stats')).toContainText('最近有效样本底价');const download=page.waitForEvent('download');await page.click('#trend-export');assert.ok((await download).suggestedFilename().endsWith('.csv'));
 await clickNav(page,'#lottery-nav');await expect(page.locator('#lottery-rows')).toContainText('截止');await expect(page.locator('#lottery-refresh')).toBeVisible();
 assert.deepEqual(errors,[]);console.log('PASS: real highlights, compare handoff, 3 fee splits, local watch handoff, atlas source preview, sample simulation/reset, historical trend CSV and lottery metadata.');
}finally{await browser.close()}
