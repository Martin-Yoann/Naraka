const $=s=>document.querySelector(s);
let status={loggedIn:false,webReady:false,oaReady:false,subscriptions:[]},sdkPromise=null,widget=null,request=0,expiryTimer=null,pollTimer=null,readyTimer=null;
const icon='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 20v-2a7 7 0 0 1 14 0v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const account=$('#account-control');const menu=document.createElement('div');menu.className='account-menu';menu.hidden=true;menu.innerHTML='<span class="account-caption">微信账号</span><strong id="account-name"></strong><button type="button" id="account-watch">我的监控</button><button type="button" id="account-logout">退出登录</button>';account.parentElement.append(menu);
const modal=document.createElement('dialog');modal.id='login-dialog';modal.className='login-dialog';modal.innerHTML='<button type="button" class="login-close" aria-label="关闭登录">×</button><div class="login-mark" aria-hidden="true">✦</div><h2>欢迎来到谪星行情台</h2><p class="login-subtitle">微信快捷登录，关注你的谪星行情</p><div class="login-qr-area"><div id="wechat-login-container"></div><div class="login-placeholder" role="status"><span class="login-wechat-icon" aria-hidden="true">◉</span><strong id="login-placeholder-title">正在准备微信登录…</strong><p id="login-placeholder-detail">请稍候</p></div><div class="login-expired" hidden><strong>本次授权会话已过期</strong><button type="button" id="login-refresh">刷新登录</button></div></div><p class="login-status" role="status"></p><div class="login-actions"><button type="button" id="login-retry">重新加载</button><a id="login-full-page" href="/api/auth/wechat?mode=web" hidden>打开微信官方登录页 ↗</a><a id="login-oa" href="/api/auth/wechat?mode=oa" hidden>在微信中授权登录</a></div><div class="login-policy">首次微信授权后自动注册账号。<br>支持的电脑微信已登录且未锁定时，可在官方组件中确认快捷登录；也可使用手机扫码。</div>';
document.body.append(modal);
function closeMenu(){menu.hidden=true;account.setAttribute('aria-expanded','false')}
function showPlaceholder(title,detail){$('.login-placeholder').hidden=false;$('#login-placeholder-title').textContent=title;$('#login-placeholder-detail').textContent=detail}
function cleanup(){request++;clearInterval(expiryTimer);clearInterval(pollTimer);clearTimeout(readyTimer);widget?.onCleanup?.();widget=null;$('#wechat-login-container').replaceChildren()}
modal.querySelector('.login-close').onclick=()=>modal.close();modal.onclick=e=>{if(e.target===modal)modal.close()};modal.addEventListener('close',cleanup);
function sdk(){if(window.WxLogin)return Promise.resolve();if(sdkPromise)return sdkPromise;sdkPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js';script.async=true;const timeout=setTimeout(()=>{script.remove();sdkPromise=null;reject(Error('SDK timeout'))},12000);script.onload=()=>{clearTimeout(timeout);if(window.WxLogin)resolve();else{sdkPromise=null;reject(Error('SDK unavailable'))}};script.onerror=()=>{clearTimeout(timeout);script.remove();sdkPromise=null;reject(Error('SDK unavailable'))};document.head.append(script)});return sdkPromise}
export async function refreshAuth(){
 try{const r=await fetch('/api/auth/status',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();const data=await r.json();if(typeof data.loggedIn!=='boolean')throw Error();status=data}catch{status={loggedIn:false,webReady:false,oaReady:false,subscriptions:[],unavailable:true}}
 account.replaceChildren();const avatar=document.createElement('span');avatar.className='account-avatar';const imageURL=status.user?.avatar;let valid=false;try{const u=new URL(imageURL);valid=u.protocol==='https:'&&(u.hostname.endsWith('.qlogo.cn')||u.hostname.endsWith('.wxqlogo.cn'))}catch{}
 if(status.loggedIn&&valid){const image=new Image();image.src=imageURL;image.alt='';image.referrerPolicy='no-referrer';avatar.append(image)}else avatar.innerHTML=icon;
 const name=document.createElement('span');name.textContent=status.loggedIn?(status.user?.nickname||'微信用户'):'登录 / 注册';account.append(avatar,name);account.setAttribute('aria-label',status.loggedIn?'打开账号菜单':'登录或注册');$('#account-name').textContent=status.user?.nickname||'微信用户';
 window.dispatchEvent(new CustomEvent('auth-changed',{detail:status}));return status;
}
export async function openLogin(){
 closeMenu();cleanup();if(!modal.open)modal.showModal();const current=request;$('.login-expired').hidden=true;$('#login-full-page').hidden=true;$('#login-oa').hidden=true;$('#login-retry').hidden=true;$('.login-status').textContent='';showPlaceholder('正在准备微信登录…','请稍候');
 await refreshAuth();if(current!==request||!modal.open)return;if(status.loggedIn){modal.close();return}
 const inWeChat=/MicroMessenger/i.test(navigator.userAgent);
 $('.login-policy').textContent=status.sandbox?'测试号登录：请先关注测试号。手机授权后，需再次确认允许当前电脑登录。首次授权自动创建本站账号。':'首次微信授权后自动注册账号。支持的电脑微信可通过官方组件确认快捷登录，也可使用手机扫码。';
 if(inWeChat&&status.oaReady){showPlaceholder('使用当前微信账号登录','点击下方按钮，在微信中确认授权');$('#login-oa').hidden=false;return}
 if(!status.webReady&&!status.oaReady){showPlaceholder('微信登录暂未开通','暂时无法获取有效登录二维码，请稍后再试。');$('#login-retry').hidden=false;return}
 $('#login-full-page').hidden=!status.webReady;
 try{
  const r=await fetch('/api/auth/wechat/qr',{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const data=await r.json();if(current!==request||!modal.open)return;
  if(data.kind==='oa-bridge'){
   if(typeof data.image!=='string'||!data.image.startsWith('data:image/png;base64,'))throw Error();
   const image=new Image();image.src=data.image;image.alt='使用微信扫一扫登录谪星阁';image.className='login-bridge-qr';$('#wechat-login-container').append(image);$('.login-placeholder').hidden=true;
   $('.login-status').textContent='请使用已关注测试号的微信扫码，并在手机上确认登录电脑端。';
   const until=Date.now()+Math.min(600,Number(data.expiresIn)||600)*1000;let polling=false;
   const expire=message=>{clearInterval(expiryTimer);clearInterval(pollTimer);$('#wechat-login-container').replaceChildren();$('.login-expired').hidden=false;$('.login-status').textContent=message};
   expiryTimer=setInterval(()=>{if(Date.now()>=until)expire('二维码已过期，请刷新后重新扫码。')},1000);
   pollTimer=setInterval(async()=>{if(polling||document.hidden||current!==request||!modal.open)return;polling=true;try{const r=await fetch('/api/auth/wechat/poll',{method:'POST',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();const result=await r.json();if(current!==request||!modal.open)return;if(result.status==='approved'){clearInterval(pollTimer);await refreshAuth();modal.close()}else if(['expired','cancelled','consumed'].includes(result.status))expire(result.status==='cancelled'?'已在手机上取消授权，请刷新后重试。':'二维码已失效，请刷新重试。');else $('.login-status').textContent=result.status==='confirm'?'微信授权已完成，请在手机上点击“确认登录电脑端”。':result.status==='scanned'?'已扫码，请在微信中完成授权。':'请使用已关注测试号的微信扫码。'}catch{if(current===request&&modal.open)$('.login-status').textContent='登录状态读取较慢，正在重试…'}finally{polling=false}},3000);
   return;
  }
  if(!data.appId||!data.state||data.scope!=='snsapi_login'||new URL(data.redirectUri).origin!==location.origin)throw Error();
  await sdk();if(current!==request||!modal.open)return;
  widget={self_redirect:false,id:'wechat-login-container',appid:data.appId,scope:data.scope,redirect_uri:encodeURIComponent(data.redirectUri),state:data.state,stylelite:1,fast_login:1,color_scheme:'light',onReady:()=>{if(current!==request)return;clearTimeout(readyTimer);$('.login-placeholder').hidden=true;$('.login-status').textContent='请在微信中确认，或使用手机微信扫码。'},onQRcodeReady:()=>{if(current!==request)return;clearTimeout(readyTimer);$('.login-placeholder').hidden=true;$('.login-status').textContent='使用手机微信扫一扫，并在微信中确认登录。'}};
  new window.WxLogin(widget);const until=Date.now()+Math.min(600,Number(data.expiresIn)||600)*1000;
  readyTimer=setTimeout(()=>{if(current!==request||$('.login-placeholder').hidden)return;widget?.onCleanup?.();widget=null;$('#wechat-login-container').replaceChildren();showPlaceholder('微信组件加载较慢','可以重新加载，或打开微信官方登录页。');$('#login-retry').hidden=false},15000);
  expiryTimer=setInterval(()=>{if(Date.now()<until)return;clearInterval(expiryTimer);clearInterval(pollTimer);widget?.onCleanup?.();widget=null;$('#wechat-login-container').replaceChildren();$('.login-placeholder').hidden=true;$('.login-expired').hidden=false;$('.login-status').textContent='请刷新后重新授权。'},1000);
  pollTimer=setInterval(async()=>{const latest=await refreshAuth();if(latest.loggedIn&&modal.open)modal.close()},5000);
 }catch{if(current!==request||!modal.open)return;widget?.onCleanup?.();widget=null;$('#wechat-login-container').replaceChildren();showPlaceholder('微信登录暂时不可用','请重新加载，或打开微信官方登录页完成授权。');$('#login-retry').hidden=false}
}
export async function logout(){const r=await fetch('/api/auth/logout',{method:'POST'});if(!r.ok)throw Error('退出失败');closeMenu();await refreshAuth()}
account.onclick=()=>{if(!status.loggedIn)return openLogin();menu.hidden=!menu.hidden;account.setAttribute('aria-expanded',String(!menu.hidden))};
$('#account-watch').onclick=()=>{closeMenu();document.querySelector('[data-view="watch"]').click()};$('#account-logout').onclick=async()=>{const button=$('#account-logout');button.disabled=true;try{await logout()}catch{button.textContent='退出失败，请重试'}finally{button.disabled=false}};
document.addEventListener('click',e=>{if(!account.parentElement.contains(e.target))closeMenu()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
$('#login-retry').onclick=openLogin;$('#login-refresh').onclick=openLogin;window.addEventListener('open-login',openLogin);window.addEventListener('focus',()=>refreshAuth());refreshAuth();
const errorCode=new URLSearchParams(location.search).get('login_error');if(errorCode){const messages={expired:'授权已过期，请重新登录。',cancelled:'你已取消微信授权，可以重新选择登录方式。',unavailable:'微信授权暂未完成，请重试。'};const clean=new URL(location.href);clean.searchParams.delete('login_error');history.replaceState(null,'',clean.pathname+clean.search+clean.hash);openLogin().then(()=>{$('.login-status').textContent=messages[errorCode]||messages.unavailable})}
