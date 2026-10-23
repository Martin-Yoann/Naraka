import {reducedMotion} from './motion.js';
import {lightNetwork} from './frame-cache.js';
export function setupExperience(){
 const targets='.card,.portal-product,.portal-feature,.portal-tool,.portal-contact,.portal-section-heading';
 const seen=new WeakSet(),observer=new IntersectionObserver(entries=>{const visible=[];for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);visible.push(entry.target)}if(visible.length&&!reducedMotion())window.gsap.fromTo(visible,{autoAlpha:0,y:18},{autoAlpha:1,y:0,duration:.55,stagger:.055,ease:'power3.out',clearProps:'opacity,visibility,transform',overwrite:'auto'})},{threshold:.06});
 const visit=root=>{if(!(root instanceof Element))return;for(const element of [root,...root.querySelectorAll(targets)]){if(!element.matches(targets)||seen.has(element))continue;seen.add(element);observer.observe(element)}};
 visit(document.body);new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)visit(node)}).observe(document.querySelector('main'),{childList:true,subtree:true});
 let timer;document.addEventListener('pointerover',event=>{const nav=event.target.closest('.nav,[data-go]');if(!nav||nav.contains(event.relatedTarget)||lightNetwork())return;clearTimeout(timer);timer=setTimeout(()=>window.dispatchEvent(new CustomEvent('portal-prefetch',{detail:nav.dataset.route??nav.dataset.go})),100)},{passive:true});document.addEventListener('pointerout',event=>{if(event.target.closest('.nav,[data-go]'))clearTimeout(timer)},{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer)});
 const header=document.querySelector('.portal-header');
 // The observer updates only at the top boundary, without a continuous scroll handler.
 const sentinel=document.createElement('span');sentinel.setAttribute('aria-hidden','true');sentinel.style.cssText='position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none';document.body.prepend(sentinel);
 new IntersectionObserver(([entry])=>header?.classList.toggle('is-scrolled',!entry.isIntersecting)).observe(sentinel);
 const media=window.gsap.matchMedia();
 media.add('(prefers-reduced-motion: no-preference)',()=>{
  if((window.portalInitialRoute||'home')==='home'&&!location.hash)window.gsap.fromTo('.portal-hero-copy > *',{autoAlpha:0,y:22},{autoAlpha:1,y:0,duration:.7,stagger:.1,ease:'power3.out',clearProps:'opacity,visibility,transform'});
 });
}
