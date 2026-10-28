import {requireLogin,openLogin} from './auth.js';
import {icon} from './icons.js';
let favorites=new Map(),account=null,version=0,loading=null,notificationReady=false,alertsEnabled=true,changed=()=>{};
const pending=new Set(),$=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const favoriteFor=id=>favorites.get(id);
const say=text=>{const el=$('#lottery-favorite-status');if(el)el.textContent=text};
async function api(method='GET',body,itemId){const r=await fetch('/api/user/favorites'+(itemId?'?'+new URLSearchParams({itemId}):''),{method,credentials:'same-origin',headers:body?{'content-type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const data=await r.json();if(!r.ok)throw Error(data.error||'收藏暂不可用');return data}
export async function loadFavorites(){if(!account)return;const ticket=version;if(loading)return loading;loading=(async()=>{try{const data=await api();if(ticket!==version)return;favorites=new Map(data.favorites.map(f=>[f.item_id,f]));notificationReady=data.notificationReady;renderFavoriteList();changed()}catch(e){if(ticket===version)say(e.message)}finally{if(ticket===version)loading=null}})();return loading}
export function favoriteButtons(item){const f=favoriteFor(item.id);return '<button type="button" class="button secondary lottery-favorite-button '+(f?'is-favorited':'')+'" data-favorite-item="'+esc(item.id)+'" aria-pressed="'+!!f+'">'+icon('star')+(f?'已收藏':'收藏')+'</button><button type="button" class="button secondary" data-remind-item="'+esc(item.id)+'" aria-pressed="'+!!f?.remind+'">'+(f?.remind?'取消开抽提醒':'开抽提醒')+'</button>'}
export async function changeFavorite(item,reminder=false){
 if(pending.has(item.id)||!await requireLogin())return;pending.add(item.id);const ticket=version;
 try{await loadFavorites();if(ticket!==version)return;const old=favorites.get(item.id);
  if(old&&!reminder){await api('DELETE',null,item.id);if(ticket!==version)return;favorites.delete(item.id);say('已取消收藏及此商品的开抽提醒。')}
  else{const remind=reminder?!old?.remind:old?.remind??false,wechat=remind&&notificationReady&&($('#lottery-favorite-wechat')?.checked??old?.wechat??false),data=await api('PUT',{itemId:item.id,remind,wechat});if(ticket!==version)return;favorites.set(item.id,data.favorite);say(remind?'已收藏并开启开抽提醒；确认开抽后生成站内消息。同一订阅只提醒一次，后台约每5分钟核验，可能延迟。':'已收藏，开抽提醒未开启。')}
  if(reminder&&favorites.get(item.id)?.remind&&!alertsEnabled)say('已保存开抽提醒，但账号提醒总开关已暂停；请到头像 → 设置中恢复提醒。');renderFavoriteList();changed();window.dispatchEvent(new Event('lottery-favorites-updated'));
 }catch(e){if(ticket===version)say(e.message)}finally{pending.delete(item.id)}
}
function renderFavoriteList(){const panel=$('#lottery-favorites-panel');if(!panel)return;$('#lottery-favorites-count').textContent=favorites.size+' / 100';$('#lottery-favorite-wechat').disabled=!notificationReady;$('#lottery-favorite-channel').textContent=notificationReady?'勾选后，新开启的开抽提醒同时发送微信。':'微信模板提醒尚未配置，当前使用站内消息。';
 $('#lottery-saved-items').innerHTML=!account?'<p class="subtle-note">微信登录后，收藏和开抽提醒随账号保存。<button type="button" class="button secondary" id="lottery-favorite-login">登录 / 注册</button></p>':[...favorites.values()].map(f=>{const i=f.payload,end=Date.parse(i.lotteryEndsAt),start=Date.parse(i.lotteryStartsAt),fresh=Date.now()-Date.parse(i.observedAt)<=65*60000,stage=end<=Date.now()?'已截止':!fresh?'待重新核验':i.isLottery&&i.lotteryConfirmed?'最近核验已开抽':start>Date.now()?'预计 '+new Date(start).toLocaleString('zh-CN',{hour12:false})+' 开抽':'等待开抽状态核验';return '<article class="lottery-saved-row"><div><strong>'+esc(i.skin)+' · '+i.holesCount+'孔</strong><p>上次观察 ¥'+(i.priceCents/100).toLocaleString('zh-CN')+' · '+esc(stage)+' · '+(f.remind?'提醒已开启':'未开启提醒')+'</p></div><div class="lottery-card-actions">'+favoriteButtons(i)+'</div></article>'}).join('')||'<p class="subtle-note">还没有收藏商品，在商品卡片点击收藏即可。</p>';
 $('#lottery-favorite-login')?.addEventListener('click',()=>openLogin());
}
export function setupLotteryFavorites(getItems,onChange){changed=onChange;
 document.addEventListener('click',e=>{const button=e.target.closest('[data-favorite-item],[data-remind-item]');if(!button)return;const id=button.dataset.favoriteItem??button.dataset.remindItem,item=getItems().find(i=>i.id===id)??favorites.get(id)?.payload;if(item)changeFavorite(item,!!button.dataset.remindItem)});
 window.addEventListener('auth-changed',e=>{const id=e.detail.loggedIn?e.detail.user?.id:null;if(account===id)return;account=id;version++;loading=null;favorites.clear();pending.clear();renderFavoriteList();changed();if(id)loadFavorites()});
 window.addEventListener('account-settings-changed',e=>{alertsEnabled=e.detail.alerts_enabled!==false;if(e.detail.loggedIn&&!alertsEnabled)say('账号提醒已暂停；收藏会保留，可在头像 → 设置中恢复提醒。')});
 window.addEventListener('portal-route',e=>{if(e.detail==='lottery'&&account)loadFavorites()});setInterval(()=>{if(account&&!$('#lottery-view')?.hidden&&document.visibilityState==='visible')loadFavorites()},60000);renderFavoriteList();
}
