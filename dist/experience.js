import {enter,reducedMotion} from './motion.js';
import {lightNetwork} from './frame-cache.js';
export function setupExperience(){
 const seen=new WeakSet(),observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);if(!reducedMotion())enter(entry.target,{y:10,duration:.32})}},{threshold:.08});
 const visit=root=>{if(!(root instanceof Element))return;for(const element of [root,...root.querySelectorAll('.card,.portal-product,.portal-feature')]){if(!element.matches('.card,.portal-product,.portal-feature')||seen.has(element))continue;seen.add(element);observer.observe(element)}};
 visit(document.body);new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)visit(node)}).observe(document.querySelector('main'),{childList:true,subtree:true});
 let timer;document.addEventListener('pointerover',event=>{const nav=event.target.closest('.nav,[data-go]');if(!nav||nav.contains(event.relatedTarget)||lightNetwork())return;clearTimeout(timer);timer=setTimeout(()=>window.dispatchEvent(new CustomEvent('portal-prefetch',{detail:nav.dataset.route??nav.dataset.go})),100)},{passive:true});document.addEventListener('pointerout',event=>{if(event.target.closest('.nav,[data-go]'))clearTimeout(timer)},{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer)});
}
