import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:3100/#market');await page.locator('.row-preview').first().waitFor();await page.locator('.row-preview').first().click();
 await expect(page.locator('.preview-image')).toBeVisible();await page.waitForFunction(()=>{const img=document.querySelector('.preview-image');return img.complete&&img.naturalWidth>0});assert.equal(await page.locator('.preview-frame').getAttribute('max'),'32');
 await page.click('[data-action="next"]');assert.equal(await page.locator('.preview-frame').inputValue(),'2');
 const box=await page.locator('.preview-stage').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+80,box.y+box.height/2);await page.mouse.up();assert.notEqual(await page.locator('.preview-frame').inputValue(),'2');
 await page.mouse.wheel(0,-300);assert.ok(Number(await page.locator('.preview-zoom').inputValue())>1);assert.equal(await page.locator('.preview-mode').inputValue(),'pan');
 await page.click('[data-action="reset"]');assert.equal(await page.locator('.preview-frame').inputValue(),'1');assert.equal(await page.locator('.preview-zoom').inputValue(),'1');
 await page.click('[data-action="background"]');await expect(page.locator('.preview-stage')).toHaveClass(/light/);
 await page.locator('.preview-tabs button').nth(1).click();await expect(page.locator('.preview-history')).toBeVisible();await page.locator('.preview-tabs button').first().click();
 await page.screenshot({path:'artifacts/preview-desktop.png'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/preview-mobile.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.keyboard.press('Escape');await expect(page.locator('.product-dialog')).not.toBeVisible();
 assert.deepEqual(errors,[]);console.log('Preview QA passed: real 32-frame media, rotation, zoom, reset, background, history tabs, desktop/mobile, close, no JS errors.');
}finally{await browser.close()}
