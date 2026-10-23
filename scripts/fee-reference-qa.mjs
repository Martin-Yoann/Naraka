// Read-only numeric comparison with the user-requested reference calculator.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {feeEstimate,minimumOffer} from '../dist/fee-model.js';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage();await page.route(/googlesyndication|doubleclick/,r=>r.abort());await page.goto('https://zhexing.emoyilab.com/fee-calc',{waitUntil:'domcontentloaded'});await expect(page.locator('.feecalc-input__box')).toHaveCount(2,{timeout:30000});
 const cases=[...['buyer','split','seller'].map(share=>({mode:'quote',amount:'3000',offer:'2400',share})),...['buyer','split','seller'].map(share=>({mode:'target',amount:'3000',offer:'2608.70',share})),{mode:'quote',amount:'100.01',offer:'80.01',share:'buyer'},{mode:'quote',amount:'1234.56',offer:'1000',share:'split'},{mode:'quote',amount:'0.07',offer:'0.06',share:'buyer'}],results=[];
 for(const c of cases){await page.getByRole('button',{name:c.mode==='target'?'填卖家到手':'填挂价',exact:true}).click();await page.locator('.feecalc-input__box').nth(0).fill(c.amount);await page.locator('.feecalc-input__box').nth(1).fill(c.offer);await page.getByRole('button',{name:({buyer:'归买家',split:'各半',seller:'归卖家'})[c.share],exact:true}).click();await expect(page.locator('.feecalc-error')).toHaveCount(0);
  const rows=await page.locator('.feecalc-result .feecalc-row').evaluateAll(nodes=>nodes.map(n=>({label:n.querySelector('.feecalc-row__label')?.textContent,value:n.querySelector('.feecalc-row__value')?.textContent}))),ours=feeEstimate(c);
  for(const [label,key]of [['平台成交价','offer'],['平台手续费','fee'],['买家补差额','supplement'],['买家实际付款','buyerTotal'],['卖家实际到手','sellerNet']]){const row=rows.find(r=>r.label.includes(label));assert.ok(row,label);const cents=Math.round(Number(row.value.match(/[\d,]+(?:\.\d+)?/)[0].replaceAll(',',''))*100);assert.equal(ours[key],cents,JSON.stringify({case:c,label,ours:ours[key],reference:cents}))}
  results.push({input:c,ourResult:ours,referenceRows:rows});
 }
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/fee-reference-check.json',JSON.stringify(results,null,2));console.log('PASS: 9 reference cases, both input modes, all 3 shares, fractional amounts and 5 monetary outputs per case.');
}finally{await browser.close()}
