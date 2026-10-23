import {requireLogin} from './auth.js';
import {hydrateMedia,warmItem} from './item-media.js';
import {mountPreview} from './preview.js';
import {matches, aggregate} from './core.js';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => n == null ? '—' : '¥'+(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const time = at => new Date(at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'});
function readStored(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
let watches=readStored('zx-watches',[]);if(!Array.isArray(watches))watches=[];
let data={batches:[]}, days=7, rank='favorites', mode='live', active='market';
let latest,items=[],history=[];
function toast(msg){$('#toast').textContent=msg;$('#toast').style.display='block';clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').style.display='none',3500)}
function filter(){return {skin:$('#skin').value,holes:$('#holes').value,minimum:$('#minimum').value,publicity:$('#publicity').value,ranges:Array.from({length:4},(_,i)=>({min:$('#slot-min-'+i)?.value??'',max:$('#slot-max-'+i)?.value??''}))}}
function prepare(){
  const valid=data.batches.filter(b=>b.coverage!=='failed'); latest=valid.at(-1); items=latest?.items||[];
  const selected=$('#skin').value;const skins=[...new Set(items.map(i=>i.skin))];$('#skin').innerHTML=skins.map(s=>`<option>${esc(s)}</option>`).join('');if(skins.includes(selected))$('#skin').value=selected;
  const prior=data.batches.filter(b=>b.coverage!=='failed' && new Date(b.at)<=new Date(latest?.at||0)-86400000).at(-1);
  items=items.map(i=>{const old=prior?.items.find(x=>x.id===i.id);return {...i,growth:old?i.favorites-old.favorites:null}});
  $('#source-badge').textContent='真实采集';
  const last=data.batches.at(-1),stale=latest&&Date.now()-Date.parse(latest.at)>65*60000;
  $('#data-notice div').textContent=(data.delivery==='snapshot'?'已发布采集快照；此线上静态版本不会随本机任务自动更新。':''+(data.delivery==='cloud'?'云端计划每30分钟采集，页面每分钟检查更新。':'本机每30分钟采集，页面每分钟读取数据库。')+'')+' '+(last?.metadata?.scope||'等待首次有效采集。')+(last?.metadata?.error?' 最近采集异常：'+last.metadata.error:'')+(stale?' 数据已超过65分钟未更新。':'');
  $('#health-status').textContent=last?.coverage==='failed'?'最近采集失败':last?.metadata?.error?'部分成功，有采集异常':latest?'已采集 · 部分覆盖':'等待采集';
  $('#last-seen').textContent=latest?time(latest.at):'暂无记录';
  document.querySelector('.hot-card .subtle-note').textContent='24h变化仅在有至少24小时前的同件记录时计算。';
  render();window.latestMarketData=data;window.dispatchEvent(new CustomEvent('market-data',{detail:data}));
}
function itemImage(item){return item.thumbnail?`<img src="${esc(item.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'✦'}
function render(){
  const f=filter(),list=items.filter(i=>i.status==='listed'&&matches(i,f));
  const cutoff=new Date(latest?.at||Date.now()).getTime()-days*86400000;
  history=data.batches.filter(b=>new Date(b.at)>=cutoff).map(b=>({at:b.at,coverage:b.coverage,...(b.coverage==='failed'?{count:null,min:null,median:null,item:null}:aggregate(b.items,f))}));
  const result=aggregate(items,f), totalFav=list.reduce((n,i)=>n+i.favorites,0);
  $('#stats').innerHTML=[['匹配在售商品',result.count,'件','已观察到的在售样本','◈'],['当前条件最低价',money(result.min),'','按所选条件计算','↘'],['样本收藏总量',totalFav.toLocaleString(),'次','收藏次数，不代表独立人数','☆'],['有效采样',history.filter(h=>h.coverage!=='failed').length,'次',`${days}天内 · ${history.filter(h=>h.coverage==='failed').length}次缺采`,'◷']].map(([label,value,unit,foot,icon])=>`<div class="stat"><div class="stat-label">${label}<span class="stat-icon">${icon}</span></div><div class="stat-value">${value}<small>${unit}</small></div><div class="stat-foot">${foot}</div></div>`).join('');
  $('#chart-price').textContent=money(result.min);
  const first=history.find(h=>h.min!=null)?.min;
  $('#chart-change').textContent=first&&result.min!=null?`${result.min>=first?'↑':'↓'} ${Math.abs((result.min-first)/first*100).toFixed(1)}% · 较区间首个样本`:'';
  $('#sample-info').textContent=`真实采样 · ${latest?time(latest.at):'暂无数据'}（北京时间）`;
  drawChart();
  const order=$('#sort').value;list.sort((a,b)=>order==='price'?a.priceCents-b.priceCents:order==='growth'?(b.growth??-Infinity)-(a.growth??-Infinity):b.favorites-a.favorites);
  $('#listing-count').textContent=`共 ${list.length} 件样本 · 最低价随筛选条件变化`;
  $('#listings').innerHTML=list.map((i,index)=>`<tr><td><div class="item-cell"><span class="item-art s${index%3}" aria-hidden="true">${itemImage(i)}</span><div><strong>${esc(i.skin)}</strong><small>${esc(i.id)} · ${i.holesCount??i.slots.length}孔</small></div></div></td><td><div class="slots">${i.slots.map(s=>`<span>${s}</span>`).join('')}</div></td><td><span class="favorites">☆ ${i.favorites}</span><span class="growth">${i.growth==null?'—':(i.growth>=0?'+':'')+i.growth}</span></td><td><span class="price">${money(i.priceCents)}</span></td><td><span class="status ${i.publicity?'':'available'}">${i.publicity?'公示期':'在售'}</span><button class="row-preview" type="button">预览</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">暂无匹配的在售样本，请调整数值或孔数。</td></tr>';
  renderHot();renderWatches();
}
function drawChart(){
  const W=Math.max(340,$('#chart').clientWidth),H=250,L=63,R=18,T=25,B=36;
  const vals=history.flatMap(h=>[h.min,h.median]).filter(v=>v!=null);
  if(!vals.length){$('#chart').innerHTML='<div class="empty">该条件下暂无有效价格样本。</div>';return}
  const low=Math.min(...vals),high=Math.max(...vals),pad=Math.max(1000,(high-low)*.25),min=low-pad,max=high+pad;
  const x=i=>L+i/Math.max(1,history.length-1)*(W-L-R),y=v=>T+(max-v)/(max-min)*(H-T-B);
  function paths(key){let paths=[],p='';history.forEach((h,i)=>{if(h[key]==null){if(p)paths.push(p);p='';return}p+=p?` H${x(i)} V${y(h[key])}`:`M${x(i)},${y(h[key])}`});if(p)paths.push(p);return paths}
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="条件最低挂牌价阶梯趋势图，缺采区间留空"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#6684ec" stop-opacity=".13"/><stop offset="1" stop-color="#6684ec" stop-opacity="0"/></linearGradient></defs>`;
  for(let i=0;i<5;i++){const v=min+(max-min)*i/4;svg+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-12}" y="${y(v)+3}" text-anchor="end">${Math.round(v/100).toLocaleString()}</text>`}
  for(let i=0;i<history.length;i++){if(i===0||i===history.length-1||i%Math.max(1,Math.floor(history.length/5))===0)svg+=`<text x="${x(i)}" y="${H-10}" text-anchor="middle">${esc(time(history[i].at).split(' ')[0])}${days===1?' '+esc(time(history[i].at).split(' ')[1]):''}</text>`}
  for(const p of paths('median'))svg+=`<path d="${p}" fill="none" stroke="#bdc8db" stroke-width="1.6" stroke-dasharray="5 4"/>`;
  for(const p of paths('min'))svg+=`<path d="${p}" fill="none" stroke="#5e7dec" stroke-width="2.4" stroke-linejoin="round"/>`;
  history.forEach((h,i)=>{if(h.min!=null)svg+=`<circle cx="${x(i)}" cy="${y(h.min)}" r="${history.length<8?3:1.8}" fill="#5e7dec"><title>${esc(time(h.at))} 最低价 ${money(h.min)} · ${esc(h.item)} · 在售${h.count}件 · ${esc(h.coverage)}</title></circle>`});
  svg+='</svg><div class="chart-tip"></div>';$('#chart').innerHTML=svg;
  $('#chart').onpointermove=e=>{const rect=$('#chart').getBoundingClientRect();const n=Math.round(((e.clientX-rect.left)/rect.width*W-L)/(W-L-R)*(history.length-1));const h=history[Math.max(0,Math.min(history.length-1,n))];if(h)$('#chart .chart-tip').textContent=`${time(h.at)} · ${h.coverage==='failed'?'采样失败':h.min==null?'暂无匹配':`${money(h.min)} · ${h.item} · ${h.count}件`}`};
  $('#chart').onpointerleave=()=>$('#chart .chart-tip').textContent='';
}
function renderHot(){const list=[...items].filter(i=>i.status==='listed'&&(rank!=='growth'||i.growth!=null)).sort((a,b)=>rank==='growth'?b.growth-a.growth:b.favorites-a.favorites).slice(0,5);$('#hot-list').innerHTML=list.map((i,n)=>`<div class="hot-item" tabindex="0" role="button" data-id="${esc(i.id)}"><span class="rank">${String(n+1).padStart(2,'0')}</span><div class="hot-copy"><strong>${esc(i.skin)}</strong><small>${i.holesCount??i.slots.length}孔 · 第一星格 ${i.slots[0]}</small></div><div class="hot-price"><b>${money(i.priceCents)}</b><small>☆ ${i.favorites} ${rank==='growth'?' / '+(i.growth>=0?'+':'')+i.growth:''}</small></div></div>`).join('')||'<div class="empty">暂无可比较的历史收藏数据。</div>';
  document.querySelectorAll('.hot-item').forEach(el=>{const select=()=>{const item=items.find(i=>i.id===el.dataset.id);$('#skin').value=item.skin;$('#holes').value=item.holesCount??item.slots.length;$('#minimum').value=item.slots[0];render();toast('已应用此商品的外观、孔数和第一星格下限')};el.onclick=select;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}}})}
function renderWatches(){$('#watch-count').textContent=watches.length;$('#watch-list').innerHTML=watches.map((w,i)=>`<div class="watch-row"><button data-watch="${i}">${esc(w.skin)} · ${esc(w.holes||'全部')}孔 · 第一星格 ≥ ${esc(w.minimum)} · ${w.publicity==='no'?'不含公示期':'全部商品'}</button><button class="delete" data-delete="${i}">删除</button></div>`).join('')||'<div class="empty">还没有监控条件。在市场观察中筛选后，点击“保存监控”。</div>';document.querySelectorAll('#watch-list [data-watch]').forEach(el=>el.onclick=()=>{const w=watches[el.dataset.watch];for(const [key,value]of Object.entries(w))if($('#'+key))$('#'+key).value=value;view('market');render()});document.querySelectorAll('#watch-list [data-delete]').forEach(el=>el.onclick=()=>{watches.splice(+el.dataset.delete,1);persist();renderWatches()})}
function persist(){try{localStorage.setItem('zx-watches',JSON.stringify(watches))}catch{toast('浏览器存储不可用，条件仅在本次会话保存')}}
function view(name){active=name;for(const n of ['market','watch','calculator'])$('#'+n+'-view').hidden=n!==name;document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===name));$('#crumb').textContent=({market:'市场观察',watch:'我的监控',calculator:'费用计算器'})[name];$('#page-title').textContent=({market:'捕捉每一颗星的价格。',watch:'把心仪的数值，放进视线。',calculator:'交易再小，也算得清楚；账目再细，也不能含糊。买家买得安心，卖家才不烧心。'})[name];if(name==='calculator')$('#page-title').innerHTML='<span class="fee-title-line">交易再小，也算得清楚；</span><span class="fee-title-line">账目再细，也不能含糊。</span><span class="fee-title-caption"><span>买家买得<em>安心</em>，</span><span>卖家才<em>不烧心</em>。</span></span>';$('#page-description').textContent=({market:'从收藏热度到数值底价，让每一次选择都有依据。',watch:'设置账号抽签偏好，查看符合条件的新商品与降价消息。',calculator:'按实际费用规则，试算到手、挂价与盈亏。'})[name];window.dispatchEvent(new CustomEvent('view-opened',{detail:name}));if(name==='market')requestAnimationFrame(()=>render())}
for(const id of ['skin','holes','minimum','publicity','sort'])$('#'+id).onchange=render;
document.querySelectorAll('[data-days]').forEach(b=>b.onclick=()=>{days=+b.dataset.days;document.querySelectorAll('[data-days]').forEach(x=>x.classList.toggle('selected',x===b));render()});
document.querySelectorAll('[data-rank]').forEach(b=>b.onclick=()=>{rank=b.dataset.rank;document.querySelectorAll('[data-rank]').forEach(x=>x.classList.toggle('selected',x===b));renderHot()});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
$('#save-watch').onclick=async()=>{if(!await requireLogin())return;const w=filter();if(!w.skin)return toast('请先加载商品数据');if(watches.some(x=>JSON.stringify(x)===JSON.stringify(w)))return toast('该监控条件已保存');watches.push(w);persist();renderWatches();toast('已保存监控条件')};
let dataLoading=false,historyPromise=null,historyCursor=null,historyLoaded=false;
function mergeBatches(first,second){return [...new Map([...first,...second].filter(b=>Date.parse(b.at)>=Date.now()-30*86400000).map(b=>[b.at,b])).values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))}
async function ensureHistory(){if(data.delivery!=='cloud'||historyLoaded||!historyCursor)return;if(historyPromise)return historyPromise;
 historyPromise=(async()=>{let cursor=historyCursor,older=[];document.body.dataset.historyLoading='true';try{while(cursor){const response=await fetch('/api/data?'+new URLSearchParams({before:cursor}),{cache:'no-store'});if(!response.ok)throw Error();const page=await response.json();if(!Array.isArray(page.batches)||page.nextBefore===cursor)throw Error();older.push(...page.batches);cursor=page.nextBefore}data={...data,batches:mergeBatches(older,data.batches)};historyCursor=null;historyLoaded=true;prepare();window.dispatchEvent(new Event('market-history-ready'))}catch{toast('历史行情暂未载入，可稍后重试；最新采样仍可查看。')}finally{delete document.body.dataset.historyLoading;historyPromise=null}})();return historyPromise;
}
async function loadData(quiet=false){if(dataLoading)return;dataLoading=true;let body;try{
 try{const after=data.delivery==='cloud'?data.batches.at(-1)?.at:null;const response=await fetch('/api/data?'+new URLSearchParams(after?{after,mode:'updates'}:{mode:'latest'}),{cache:'no-store'});if(!response.ok)throw Error();body=await response.json();if(!Array.isArray(body.batches))throw Error();if(body.delivery==='cloud'){if(after){let cursor=body.nextBefore;while(cursor){const r=await fetch('/api/data?'+new URLSearchParams({before:cursor,after,mode:'updates'}),{cache:'no-store'});if(!r.ok)throw Error();const older=await r.json();if(!Array.isArray(older.batches)||older.nextBefore===cursor)throw Error();body.batches.unshift(...older.batches);cursor=older.nextBefore}body.batches=mergeBatches(data.batches,body.batches)}else{historyCursor=body.nextBefore;historyLoaded=!historyCursor}}else body.delivery='local'}catch{
  try{const response=await fetch('./market.json',{cache:'no-store'});if(!response.ok)throw Error();body=await response.json();if(!Array.isArray(body.batches))throw Error()}catch{if(!quiet)toast('暂无真实数据或数据服务不可用，不使用模拟行情');return}
 }
 data=body;prepare();if(!quiet)toast('已读取最新真实采样');if(['trends','market'].includes(document.body.dataset.page))ensureHistory();
 }finally{dataLoading=false}}
window.addEventListener('portal-route',e=>{if(['trends','market'].includes(e.detail))ensureHistory()});
window.addEventListener('portal-prefetch',e=>{if(e.detail==='trends')ensureHistory()});
$('#source-switch').onclick=()=>loadData();
$('#export').onclick=()=>{const rows=[['采样时间','覆盖状态','最低挂牌价_元','最低三件中位数_元','在售数量','最低价商品ID'],...history.map(h=>[h.at,h.coverage,h.min==null?'':h.min/100,h.median==null?'':h.median/100,h.count??'',h.item??''])];const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='谪星条件行情.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出当前条件的行情快照')};
const advanced=document.createElement('details');advanced.className='advanced';advanced.innerHTML='<summary>更多星格条件 · 精确值可将下限与上限设为相同</summary><div class="slot-filters">'+Array.from({length:4},(_,i)=>`<div><span>第${i+1}星格</span><label>下限<input id="slot-min-${i}" type="number" min="0" placeholder="不限"></label><label>上限<input id="slot-max-${i}" type="number" min="0" placeholder="不限"></label></div>`).join('')+'</div>';document.querySelector('.filters').after(advanced);advanced.querySelectorAll('input').forEach(el=>el.onchange=render);
const originalRenderWatches=renderWatches;
renderWatches=function(){originalRenderWatches();document.querySelectorAll('#watch-list [data-watch]').forEach(el=>el.onclick=()=>{const w=watches[el.dataset.watch];for(const key of ['skin','holes','minimum','publicity'])$('#'+key).value=w[key]??'';for(let i=0;i<4;i++){const range=w.ranges?.[i];$('#slot-min-'+i).value=range?.min??'';$('#slot-max-'+i).value=range?.max??''}view('market');render()});document.querySelectorAll('#watch-list [data-watch]').forEach(el=>{const w=watches[el.dataset.watch];const ranges=(w.ranges||[]).map((r,i)=>(r.min!==''||r.max!=='')?`第${i+1}格 ${r.min||'不限'}~${r.max||'不限'}`:'').filter(Boolean);if(ranges.length)el.textContent+=' · '+ranges.join(' / ')})};
const dialog=document.createElement('dialog');dialog.className='detail-dialog product-dialog';dialog.innerHTML='<div class="dialog-head"><h2>商品预览与观察记录</h2><button class="button secondary" id="close-detail" aria-label="关闭商品预览">×</button></div><div id="detail-content"></div>';document.body.append(dialog);dialog.addEventListener('close',()=>{previewRequest++});$('#close-detail').onclick=()=>dialog.close();dialog.onclick=e=>{if(e.target===dialog)dialog.close()};
let previewRequest=0;async function openItem(item){const request=++previewRequest;$('#detail-content').disposePreview?.();const observations=data.batches.filter(b=>b.coverage!=='failed').map(b=>({at:b.at,item:b.items.find(i=>i.id===item.id)})).filter(b=>b.item);$('#detail-content').innerHTML=`<p>${esc(item.skin)} · ${esc(item.id)} · ${item.slots.map(esc).join(' / ')}</p><p class="detail-hint">以下为已观察记录。缺失不代表售出；仅为采样商品，非全市场。</p><div class="table-scroll"><table><thead><tr><th>观察时间（北京时间）</th><th>挂牌价</th><th>收藏</th><th>状态</th></tr></thead><tbody>${observations.slice(-40).reverse().map(o=>`<tr><td>${time(o.at)}</td><td>${money(o.item.priceCents)}</td><td>${o.item.favorites}</td><td>${esc(o.item.status)}</td></tr>`).join('')}</tbody></table></div>`;if(!dialog.open)dialog.showModal();if(!item.previewFrames?.length&&!item.archive){const placeholder=document.createElement('div');placeholder.className='preview-skeleton';placeholder.textContent='正在读取官方高清原图…';$('#detail-content').prepend(placeholder);try{item=await hydrateMedia(item)}catch{placeholder.textContent='原图暂未加载，请重试或前往藏宝阁查看。';return}if(request!==previewRequest||!dialog.open)return;placeholder.remove()}mountPreview($('#detail-content'),item)};
$('#listings').onclick=e=>{const row=e.target.closest('tr');const item=items.find(i=>i.id===row?.dataset.id);if(item)openItem(item)};
window.addEventListener('preview-product',e=>{const item=items.find(i=>i.id===e.detail);if(item)openItem(item)});
window.addEventListener('preview-sample',e=>{if(e.detail?.id&&Array.isArray(e.detail.slots))openItem(e.detail)});
const originalRender=render;render=function(){originalRender();document.querySelectorAll('#listings tr').forEach(row=>{const id=row.querySelector('td small')?.textContent.split(' · ')[0];if(id){row.dataset.id=id;row.tabIndex=0;row.setAttribute('aria-label','查看 '+id+' 的观察记录');row.onkeydown=e=>{if(e.key==='Enter')row.click()}}});window.dispatchEvent(new Event('market-rendered'))};
for(const id of ['skin','holes','minimum','publicity','sort'])$('#'+id).onchange=()=>render();advanced.querySelectorAll('input').forEach(el=>el.onchange=()=>render());
prepare();loadData(true);setInterval(()=>loadData(true),60000);
