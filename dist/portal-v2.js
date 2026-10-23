import {setupIcons} from './icons.js';
import {closeHeaderMenus as closeMore,setupHeaderMenus as setupMore} from './header-menus.js';
import './settings-ui.js';
import {setupExperience} from './experience.js';
import {warmItem} from './item-media.js';
import './app.js';
import {setupMotion,switchPage,reveal} from './motion.js';
import {setupControls} from './controls.js';
import './lottery-ui.js';
import './preferences-ui.js';
import './fee-ui.js';
import './compare-ui.js';
import './search-gallery.js';
import './sim-trends.js';
import './atlas-ui.js';
import {$,esc,money,time,state,onData} from './workbench.js';
import {safeImageURL} from './media.js';
import {lotterySummary} from './lottery.js';
window.portalRouterReady=true;
const routes=new Map([...document.querySelectorAll('.nav')].map(nav=>[nav.dataset.route,nav]));
let navigating=false,currentRoute='home',highlight='favorites',highlightItems=[],menuTimer,keyboardMenu=false,requestedRoute=null;
function syncRoute(name){const panel=$('#'+name+'-view');if(!panel)return;currentRoute=name;document.body.dataset.page=name;document.querySelectorAll('.content>section[id$="-view"]').forEach(view=>view.hidden=view!==panel);for(const [route,nav]of routes){nav.classList.toggle('active',route===name);nav.setAttribute('aria-current',route===name?'page':'false')}$('.page-heading').hidden=name==='home';$('#data-notice').hidden=['home','calculator'].includes(name);$('#export').hidden=name==='calculator';closeMore();document.querySelectorAll('[data-section-tabs]').forEach(tab=>tab.hidden=!['gallery','simulator'].includes(name));window.dispatchEvent(new CustomEvent('portal-route',{detail:name}));}
function commitNavigate(name,{replace=false}={}){name=({simulation:'gallery',trend:'trends'})[name]??name;if(!routes.has(name))name='home';if(navigating)return;navigating=true;try{if(name!=='home')routes.get(name).click();syncRoute(name);if(window.portalNextNavigate)writeRoute(name,true);window.scrollTo({top:0,behavior:'instant'});if(name==='market')window.dispatchEvent(new Event('resize'));}finally{navigating=false}}
document.addEventListener('click',event=>{const nav=event.target.closest('.nav');if(nav){const name=nav.dataset.route;if(navigating)return;syncRoute(name);writeRoute(name,true);window.scrollTo({top:0,behavior:'instant'});return}const link=event.target.closest('[data-go]');if(link){event.preventDefault();navigate(link.dataset.go)}if(!event.target.closest('.nav-group')){closeMore()}});
$('#home-nav').onclick=()=>navigate('home');
document.addEventListener('click',event=>{const nav=event.target.closest('.nav');if(nav&&!navigating){event.preventDefault();event.stopImmediatePropagation();navigate(nav.dataset.route)}},true);
window.addEventListener('hashchange',()=>navigate(location.hash.slice(1),{replace:true}));
window.addEventListener('navigate-view',event=>navigate(event.detail));
window.addEventListener('view-opened',event=>{if(!navigating){syncRoute(event.detail);writeRoute(event.detail,true)}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeMore()}});
const explanation=document.createElement('dialog');explanation.className='detail-dialog portal-about';explanation.innerHTML='<div class="dialog-head"><h2>关于谪星阁 2.3</h2><button class="button secondary" type="button" aria-label="关闭关于谪星阁">×</button></div><p>以藏宝阁公开商品和官方原图为依据，提供数值筛选、外观比较、图鉴与价格观察。</p><p>公开商品持续采样，按页面标注的数据来源与观察时间读取。采样不是同时点全市场快照，商品缺失不等于成交。</p><p>单孔图鉴使用整件代表商品截图，其他孔位也会影响外观。洗练为样本演练，样本占比不等于游戏成功率；费用参数可自行调整。</p><p>交易请前往藏宝阁核实当前状态。本工具与网易官方无隶属关系。</p>';document.body.append(explanation);explanation.querySelector('button').onclick=()=>explanation.close();explanation.onclick=event=>{if(event.target===explanation)explanation.close()};document.querySelectorAll('[data-about]').forEach(button=>button.onclick=()=>explanation.showModal());
$('#portal-refresh').onclick=()=>$('#source-switch').click();
function renderHighlights(){const catalog=new Map(state.catalog.map(item=>[item.name,item]));let pool=state.pool.filter(item=>item.status==='listed');if(highlight==='four')pool=pool.filter(item=>item.holesCount===4);pool.sort((a,b)=>highlight==='price'?a.priceCents-b.priceCents:b.favorites-a.favorites);const chosen=[],seen=new Set();for(const item of pool){if(!seen.has(item.skin)){seen.add(item.skin);chosen.push(item)}if(chosen.length===4)break}highlightItems=chosen;
 $('#portal-products').innerHTML=chosen.map((item,index)=>{const definition=catalog.get(item.skin),src=safeImageURL(item.thumbnail),names=definition?.slotNames??[];let url=null;try{const u=new URL(item.url);if(u.protocol==='https:'&&u.hostname==='yjwujian.cbg.163.com')url=u.href}catch{}
 return `<article class="portal-product"><div class="portal-product-image"><button type="button" data-home-preview="${index}" aria-label="预览${esc(item.skin)}">${src?`<img src="${esc(src)}" alt="${esc(item.skin)}真实外观" loading="lazy" referrerpolicy="no-referrer">`:'<span>暂无官方原图</span>'}</button><span class="portal-product-badge">${item.holesCount??item.slots.length}孔 · ☆ ${item.favorites}</span><small>${esc(definition?.owner??'谪星外观')}</small></div><div class="portal-product-body"><h3>${esc(item.skin)}</h3><div class="portal-attributes">${item.slots.slice(0,2).map((value,i)=>`<div><span>${esc(names[i]??`第${i+1}星格`)}</span><b>${value}${item.unlocks?.[i]===0?' 🔒':''}</b></div>`).join('')||'<div><span>星格</span><b>无星格</b></div>'}</div><div class="portal-product-price"><div><small>观察挂牌价</small><strong>${money(item.priceCents)}</strong></div>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="前往藏宝阁查看${esc(item.skin)}">↗</a>`:''}</div><div class="portal-product-actions"><button type="button" data-home-preview="${index}">旋转预览</button><button type="button" data-home-compare="${index}">＋ 比较</button></div></div></article>`}).join('')||'<div class="portal-empty">此条件暂无真实商品样本，等待采集或切换条件。</div>';
 document.querySelectorAll('[data-home-preview]').forEach(button=>button.onclick=()=>window.dispatchEvent(new CustomEvent('preview-sample',{detail:highlightItems[Number(button.dataset.homePreview)]})));document.querySelectorAll('[data-home-compare]').forEach(button=>button.onclick=()=>{window.dispatchEvent(new CustomEvent('add-compare',{detail:highlightItems[Number(button.dataset.homeCompare)]}));button.textContent='已加入'});document.querySelectorAll('[data-home-preview]').forEach(button=>{button.onpointerenter=button.onfocus=()=>warmItem(highlightItems[Number(button.dataset.homePreview)])});$('#portal-products').querySelectorAll('img').forEach(image=>image.onerror=()=>{image.hidden=true;const fallback=document.createElement('span');fallback.textContent='官方原图暂不可用';image.parentElement.append(fallback)})}
document.querySelectorAll('[data-highlight]').forEach(button=>button.onclick=()=>{highlight=button.dataset.highlight;document.querySelectorAll('[data-highlight]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button))});renderHighlights()});
onData(()=>{const latest=state.latest,last=state.data.batches.at(-1),stale=latest&&Date.now()-Date.parse(latest.at)>65*60000;$('#portal-status').textContent=last?.coverage==='failed'?'最近采集失败':stale?'采样待更新':latest?'真实采样已就绪':'等待首次采集';$('#portal-status-dot').classList.toggle('warning',!latest||stale||last?.coverage==='failed');$('#portal-observed').textContent=latest?'观察 '+time(latest.at):'暂无观察记录';$('#portal-delivery').textContent=state.data.delivery==='snapshot'?'发布时快照':state.data.delivery==='cloud'?'云端30分钟采样':'本机30分钟采样';$('#portal-source-note').textContent=state.data.delivery==='snapshot'?'本页展示发布时的真实行情快照，价格及库存以藏宝阁当前页面为准。':'仅展示本轮已采集商品，非全市场；价格与收藏以页面标注的观察时间为准。';renderHighlights()});
setupMotion();setupControls();setupIcons();setupExperience();setupMore();navigate(location.hash.slice(1)||window.portalInitialRoute||'home',{replace:true,animate:false});
try{const response=await fetch('./atlas/index.json');if(!response.ok)throw Error();const data=await response.json();const count=data.items.reduce((sum,item)=>sum+(item.count??0),0),values=data.items.reduce((sum,item)=>sum+(item.slotCounts??[]).reduce((a,b)=>a+b,0),0);$('#portal-atlas-count').textContent=count.toLocaleString();$('#portal-atlas-detail').textContent=`${values.toLocaleString()}个单孔数值索引，先看外观，再设洗练目标。`}catch{$('#portal-atlas-count').textContent='暂不可用';$('#portal-atlas-detail').textContent='按单孔数值查看已收录外观，未收录数据留空。'}



function navigate(name,options={}){name=({simulation:'gallery',trend:'trends'})[name]??name;if(!routes.has(name))name='home';if(navigating)return;if(window.portalRouteInitialized&&requestedRoute===name&&currentRoute===name&&document.body.dataset.page===name){return}requestedRoute=name;writeRoute(name,options.replace===true);switchPage(()=>{if(requestedRoute!==name)return;commitNavigate(name,options);window.portalRouteInitialized=true},{animate:options.animate!==false&&currentRoute!==name})}



function writeRoute(name,replace=false){if(window.portalNextNavigate)window.portalNextNavigate(name,replace);else if(location.hash.slice(1)!==name)history[replace?'replaceState':'pushState'](null,'','#'+name)}
