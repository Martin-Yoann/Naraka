import {navigationButton} from './navigation.js';
import {uniqueSamples} from './tools-core.js';
export const $=selector=>document.querySelector(selector);
export const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=value=>value==null?'—':'¥'+(value/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
export const time=value=>value?new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'暂无记录';
export const state={data:window.latestMarketData??{batches:[]},catalog:[],pool:[],samples:[],latest:null};
const listeners=new Set(),views=new Map();
export function onData(fn){listeners.add(fn);fn(state)}
function update(){state.latest=state.data.batches.filter(b=>b.coverage!=='failed').at(-1);const catalog=new Map(state.catalog.map(c=>[c.name,c]));state.pool=(state.latest?.items??[]).map(item=>({...item,category:catalog.get(item.skin)?.category??'',observedAt:state.latest.at}));state.samples=uniqueSamples(state.data.batches);for(const fn of listeners)fn(state)}
export function showTool(name){const view=views.get(name);if(!view)return;document.querySelectorAll('.content>section[id$="-view"]').forEach(el=>el.hidden=el!==view.panel);document.querySelectorAll('.nav').forEach(el=>el.classList.toggle('active',el===view.nav));$('#crumb').textContent=view.title;$('#page-title').textContent=view.heading;$('#page-description').textContent=view.description;if(!window.portalNextNavigate)location.hash=name;window.scrollTo({top:0,behavior:'instant'});view.onOpen?.()}
export function createTool(name,title,heading,description,html,icon){
 const nav=navigationButton(name);const panel=document.createElement('section');panel.id=name+'-view';panel.hidden=true;panel.innerHTML=html;document.querySelector('footer').before(panel);const view={nav,panel,title,heading,description};views.set(name,view);nav.onclick=()=>showTool(name);return view;
}
document.querySelectorAll('.nav').forEach(nav=>nav.addEventListener('click',()=>{for(const view of views.values()){view.panel.hidden=true;view.nav.classList.remove('active')}if(!window.portalRouterReady&&views.has(location.hash.slice(1)))history.replaceState(null,'',location.pathname)}));
window.addEventListener('hashchange',()=>{if(window.portalRouterReady)return;const name=location.hash.slice(1);if(views.has(name))showTool(name);else{const nav=document.querySelector(name==='compare'?'#compare-nav':name==='lottery'?'#lottery-nav':`[data-view="${['market','watch','calculator'].includes(name)?name:'market'}"]`);if(nav&&!nav.classList.contains('active'))nav.click()}});
export function activateInitial(){const name=location.hash.slice(1);if(views.has(name))showTool(name)}
export function options(select,items,emptyLabel){const selected=select.value;select.replaceChildren();if(emptyLabel){const option=document.createElement('option');option.value='';option.textContent=emptyLabel;select.append(option)}for(const item of items){const option=document.createElement('option');option.value=item.value??item.name;option.textContent=item.label??item.name;select.append(option)}if([...select.options].some(o=>o.value===selected))select.value=selected}
export function integer(value,label){if(value===''||value==null)return null;if(!/^\d+$/.test(String(value)))throw Error(`${label}需为非负整数`);const number=Number(value);if(!Number.isSafeInteger(number)||number>1e12)throw Error(`${label}超出范围`);return number}
export function ranges(prefix,count=4){return Array.from({length:count},(_,i)=>{const min=integer($('#'+prefix+'-min-'+i)?.value??'',`第${i+1}格下限`),max=integer($('#'+prefix+'-max-'+i)?.value??'',`第${i+1}格上限`);if(min!=null&&max!=null&&min>max)throw Error(`第${i+1}格下限不能高于上限`);return {min,max}})}
export function rangeFields(prefix,names=[]){return Array.from({length:4},(_,i)=>`<div class="tool-slot"><strong>${esc(names[i]??`第${i+1}星格`)}</strong><div><label>下限<input id="${prefix}-min-${i}" type="number" min="0" placeholder="不限"></label><label>上限<input id="${prefix}-max-${i}" type="number" min="0" placeholder="不限"></label></div></div>`).join('')}
export function preview(item){if(item.archive&&!item.previewFrames?.length&&item.thumbnail?.endsWith('/1.png'))item={...item,previewFrames:Array.from({length:32},(_,i)=>item.thumbnail.slice(0,-5)+(i+1)+'.png')};window.dispatchEvent(new CustomEvent('preview-sample',{detail:item}))}
export function compare(item){window.dispatchEvent(new CustomEvent('add-compare',{detail:item}))}
export function exportCSV(name,rows){const csv='\ufeff'+rows.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
window.addEventListener('market-data',event=>{state.data=event.detail;update()});
try{const response=await fetch('./catalog.json',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();if(!Array.isArray(data.items))throw Error();state.catalog=data.items}catch{state.catalog=state.latest?.metadata?.catalog??state.data.batches.at(-1)?.metadata?.catalog??[]}
update();
