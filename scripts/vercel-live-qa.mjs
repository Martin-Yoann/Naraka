import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const origin=process.env.SITE_URL||'https://naraka-kappa.vercel.app';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/#search');await expect(page.locator('#search-source')).toContainText('云端实时库存库',{timeout:60000});
 await expect(page.locator('#search-error')).toHaveText('');assert.equal(await page.locator('[data-search-preview]').count(),20);
 await page.click('#search-next');await expect(page.locator('#search-page')).toContainText('2 /',{timeout:15000});
 await page.locator('[data-search-preview]').first().click();await expect(page.locator('.product-dialog')).toBeVisible();await expect(page.locator('.preview-frame')).toHaveAttribute('max','32');
 await page.keyboard.press('Escape');await page.locator('[data-search-compare]').first().click();await expect(page.locator('#compare-count')).toHaveText('1');
 await page.waitForFunction(()=>window.latestMarketData?.delivery==='cloud'&&window.latestMarketData.batches.length>20,null,{timeout:60000});
 const batches=await page.evaluate(()=>window.latestMarketData.batches.length);await page.screenshot({path:'artifacts/vercel-live-search.png',fullPage:true});
 await page.click('#home-nav');await expect(page.locator('#home-view')).toBeVisible();await expect(page.locator('.portal-product')).toHaveCount(4);
 await page.click('#search-nav');await expect(page.locator('#search-view')).toBeVisible();await page.goBack();await expect(page.locator('#home-view')).toBeVisible();
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'artifacts/vercel-live-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({production:origin,batches,checks:['cloud SQL search','pagination','32 official preview frames','compare','history cursor loading','navigation and browser back','mobile layout'],pageErrors:errors}));
}finally{await browser.close()}
