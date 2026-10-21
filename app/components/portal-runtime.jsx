'use client';
import {useEffect,useRef} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {routeLabels,routePath} from '../../lib/site-routes.mjs';
export default function PortalRuntime(){
 const pathname=usePathname(),router=useRouter(),routerRef=useRef(router);routerRef.current=router;
 useEffect(()=>{
  const route=location.pathname.split('/')[1]||'home';
  window.portalInitialRoute=routeLabels[route]?route:'home';
  // Next.js synchronizes native History API updates with usePathname. The layout
  // owns the persistent workbench, so navigation keeps previews and selections.
  window.portalNextNavigate=(name,replace=false)=>{const path=routePath(name);if(location.pathname!==path||location.hash)history[replace?'replaceState':'pushState'](null,'',path);document.title=name==='home'?'永劫无间 · 谪星阁 2.4｜谪星图鉴与行情观察':routeLabels[name]+' · 谪星阁'};
  const prefetch=event=>{if(routeLabels[event.detail])routerRef.current.prefetch(routePath(event.detail))};
  window.addEventListener('portal-prefetch',prefetch);
  window.portalBoot??=(async()=>{const {gsap}=await import('gsap');window.gsap=gsap;await import('../../dist/portal-v2.js')})();
  window.portalBoot.catch(error=>{console.error('Portal initialization failed',error);const status=document.querySelector('#portal-status');if(status)status.textContent='页面加载失败，请刷新重试'});
  return ()=>window.removeEventListener('portal-prefetch',prefetch);
 },[]);
 useEffect(()=>{const view=pathname.split('/')[1]||'home';if(routeLabels[view])window.portalBoot?.then(()=>{if(location.hash||location.pathname!==routePath(view))return;if(document.body.dataset.page!==view)window.dispatchEvent(new CustomEvent('navigate-view',{detail:view}))}).catch(()=>{})},[pathname]);
 return null;
}
