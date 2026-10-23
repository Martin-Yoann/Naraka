// Isolated account fixtures live only in PGlite and intercepted browser requests.
// Production market endpoints remain read-only; no fake users or prices enter Neon.
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,mkdir} from 'node:fs/promises';
import {cloudAccounts} from '../lib/cloud-auth-store.mjs';
import {userPreferences} from '../lib/user-preferences.mjs';
import {createUserHandler} from '../lib/user-handler.mjs';
const origin=process.env.SITE_URL||'http://127.0.0.1:3201',pg=new PGlite();
const db={async query(sql,values){if(!values&&sql.split(';').length>2){await pg.exec(sql);return {rows:[],rowCount:0}}const r=await pg.query(sql,values);return {...r,rowCount:r.affectedRows??r.rows.length}},async connect(){return {...this,release(){}}}};
const accounts=cloudAccounts(db),id=await accounts.identity({appid:'qa-only',openid:'qa-only'}),token=await accounts.session(id),catalog=JSON.parse(await readFile('dist/catalog.json','utf8'));
await db.query(await readFile('lib/cloud-schema.sql','utf8'));
await db.query('INSERT INTO zx_inventory VALUES($1,$2,now(),now(),$3)',['qa-only-item',catalog.items[0].id,JSON.stringify({id:'qa-only-item',skin:catalog.items[0].name,equipType:catalog.items[0].id,holesCount:4,slots:[0,12,34,1],unlocks:[1,1,1,1],priceCents:9900,status:'listed',isLottery:true,lotteryConfirmed:true,lotteryEndsAt:new Date(Date.now()+3600000).toISOString(),url:'https://yjwujian.cbg.163.com/cgi/mweb/'})]);
const store=userPreferences(db),handler=createUserHandler({accounts:()=>accounts,preferences:()=>store,storage:()=>({settings:{get:async()=>catalog},lease:async()=>()=>{}}),config:()=>({})});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1050}});let logged=true;const errors=[];
 await context.route('**/api/auth/status',route=>route.fulfill({json:{loggedIn:logged,user:logged?{id,nickname:'隔离测试账号'}:null,oaReady:true,webReady:false}}));
 await context.route('**/api/user/**',async route=>{const req=route.request(),headers={};const res={statusCode:200,setHeader(k,v){headers[k]=v},end(value){this.body=value}};await handler({method:req.method(),headers:{host:new URL(origin).host,origin,cookie:logged?'zx_session='+token:''},readJSON:async()=>req.postDataJSON()},res,new URL(req.url()));await route.fulfill({status:res.statusCode,headers,body:res.body})});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/watch');await expect(page.locator('#pref-account')).toBeVisible({timeout:30000});
 const select=async(id,label)=>{await page.locator('#'+id).locator('..').locator('.ui-select-trigger').click();if(await page.locator('.ui-select-search input').isVisible())await page.locator('.ui-select-search input').fill(label);await page.getByRole('option',{name:new RegExp(label)}).first().click()};
 await select('pref-type','花重锦');await select('pref-holes','4 孔');await page.fill('#pref-name','四孔零值测试');await page.locator('[data-range="0"][data-side=min]').fill('0');await page.locator('[data-range="0"][data-side=max]').fill('0');await page.fill('#pref-price-max','100');await page.click('#pref-save');
 await expect(page.locator('#pref-list')).toContainText('四孔零值测试');await expect(page.locator('#pref-messages')).toContainText('¥99');await expect(page.locator('#portal-alert-count')).toHaveText('1');assert.equal((await store.list(id))[0].criteria.ranges[0].min,0);
 await page.click('[data-edit]');await expect(page.locator('#pref-name')).toHaveValue('四孔零值测试');await page.click('#pref-save');assert.equal((await store.messages(id)).messages.length,1);
 await page.click('[data-read]');await expect(page.locator('#portal-alert-count')).toBeHidden();await page.click('[data-toggle]');await expect(page.locator('#pref-list')).toContainText('已暂停');
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1050});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow '+width);await mkdir('artifacts',{recursive:true});if(width===390)await page.screenshot({path:'artifacts/preferences-mobile.png',fullPage:true})}
 page.once('dialog',d=>d.accept());await page.click('[data-delete]');await expect(page.locator('#pref-list')).toContainText('还没有抽签偏好');assert.ok((await store.messages(id)).messages.length>0);
 logged=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('#pref-guest')).toBeVisible();await expect(page.locator('#pref-account')).toBeHidden();await expect(page.locator('#pref-messages')).toBeEmpty();
 await page.reload();await expect(page.locator('#pref-guest')).toBeVisible();await expect(page.locator('#pref-check')).toBeDisabled();
 assert.deepEqual(errors,[]);console.log('PASS: real UI + isolated PGlite account CRUD, zero ranges, dedup, inbox, pause/delete, account clearing, initial guest and 4 responsive widths.');
}finally{await browser.close();await pg.close()}
