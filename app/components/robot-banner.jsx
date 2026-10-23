'use client';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';

// The static robot is visible before JavaScript and when WebGL is unavailable.
export default function RobotBanner(){
 const host=useRef(null),canvas=useRef(null),pathname=usePathname();
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  if(pathname!=='/')return;
  let cancelled=false,dispose,started=false;
  setReady(false);
  const observer=new IntersectionObserver(async([entry])=>{
   if(!entry.isIntersecting||started)return;started=true;observer.disconnect();
   try{const {createRobot}=await import('../../dist/robot-scene.js');if(cancelled)return;dispose=createRobot(canvas.current,host.current,()=>{if(!cancelled)setReady(true)},()=>{if(!cancelled)setReady(false)})}catch{if(!cancelled)setReady(false)}
  });observer.observe(host.current);
  return ()=>{cancelled=true;observer.disconnect();dispose?.()};
 },[pathname]);
 return <div ref={host} className={'portal-hero-art robot-banner'+(ready?' is-ready':'')} aria-hidden="true">
  <div className="robot-backdrop"/><div className="robot-ground"/>
  <svg className="robot-fallback" viewBox="0 0 420 360" fill="none">
   <defs><radialGradient id="robot-shell" cx=".3" cy=".2" r=".85"><stop stopColor="#657087"/><stop offset=".5" stopColor="#293149"/><stop offset="1" stopColor="#1c2338"/></radialGradient><linearGradient id="robot-glass" x2="0" y2="1"><stop stopColor="#111729"/><stop offset="1" stopColor="#252d43"/></linearGradient></defs>
   <g stroke="#303a51" strokeWidth="8" strokeLinecap="round"><path d="M154 100l-12-33M266 100l12-33"/></g>
   <circle cx="140" cy="62" r="11" fill="#e23b2e"/><circle cx="280" cy="62" r="11" fill="#e23b2e"/>
   <ellipse cx="106" cy="169" rx="18" ry="32" fill="#1c2338"/><ellipse cx="314" cy="169" rx="18" ry="32" fill="#1c2338"/>
   <ellipse cx="210" cy="169" rx="106" ry="96" fill="url(#robot-shell)"/><rect x="122" y="132" width="176" height="83" rx="38" fill="url(#robot-glass)" stroke="#4a5368" strokeWidth="2"/>
   <circle cx="171" cy="174" r="24" fill="#f2f3f5"/><circle cx="249" cy="174" r="24" fill="#f2f3f5"/><g fill="#1c2338"><circle cx="174" cy="174" r="11"/><circle cx="252" cy="174" r="11"/></g><g fill="white"><circle cx="178" cy="169" r="4"/><circle cx="256" cy="169" r="4"/></g>
   <path d="M163 100c24-15 57-16 83-5" stroke="white" strokeOpacity=".18" strokeWidth="4" strokeLinecap="round"/>
   <rect x="80" y="239" width="40" height="74" rx="20" transform="rotate(32 80 239)" fill="url(#robot-shell)"/><rect x="305" y="260" width="40" height="74" rx="20" transform="rotate(-32 305 260)" fill="url(#robot-shell)"/>
  </svg>
  <canvas key={pathname} ref={canvas} className="robot-canvas"/>
  <div className="robot-caption"><i/> ZHEXING COMPANION <span>与你一起，发现好谪星</span></div>
 </div>;
}
