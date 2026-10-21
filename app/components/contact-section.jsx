'use client';
import {useEffect,useRef,useState} from 'react';
const email='pickyan@163.com',qr='/assets/author-wechat.jpg';
export default function ContactSection(){
 const dialog=useRef(null),trigger=useRef(null),timer=useRef(),[open,setOpen]=useState(false),[copyStatus,setCopyStatus]=useState('');
 useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current.showModal();return ()=>{document.body.style.overflow=previous}},[open]);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 async function copyEmail(){try{await navigator.clipboard.writeText(email);setCopyStatus('邮箱已复制')}catch{setCopyStatus('可长按邮箱地址复制')}clearTimeout(timer.current);timer.current=setTimeout(()=>setCopyStatus(''),3000)}
 return <>
  <section className="portal-community portal-contact" aria-labelledby="contact-heading">
   <div className="contact-copy">
    <div className="portal-kicker">✧ 谪星同好 · 联系作者</div>
    <h2 id="contact-heading">一起聊谪星，也聊新的想法。</h2>
    <p>交流谪星外观、反馈使用问题，或告诉我你想要的新功能。<br className="contact-desktop-break"/>欢迎添加我的个人微信，也可以通过邮箱联系。</p>
    <div className="contact-email"><span className="contact-mail-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg></span><div><small>邮件联系</small><a href={'mailto:'+email}>{email}</a></div><button type="button" className="contact-copy-email" onClick={copyEmail}>复制邮箱</button></div>
    <span className="contact-copy-status" role="status" aria-live="polite">{copyStatus}</span>
    <div className="contact-route-links"><a href="#watch" data-go="watch">我的监控 <span aria-hidden="true">↗</span></a><a href="#lottery" data-go="lottery">抽签低价提醒 <span aria-hidden="true">↗</span></a></div>
   </div>
   <div className="contact-wechat"><button ref={trigger} type="button" className="contact-qr-button" onClick={()=>setOpen(true)} aria-label="放大查看作者个人微信二维码"><span className="contact-qr-image"><img src={qr} width="888" height="1131" alt="作者个人微信二维码，点击放大查看" loading="lazy" decoding="async"/></span><span className="contact-qr-label">添加作者微信 <span aria-hidden="true">⌕</span></span></button><p>个人微信 · 点击放大，手机可保存图片</p></div>
  </section>
  <dialog ref={dialog} className="contact-dialog" aria-labelledby="contact-dialog-title" onCancel={()=>setOpen(false)} onClose={()=>{setOpen(false);trigger.current?.focus({preventScroll:true})}} onClick={event=>{if(event.target===event.currentTarget)dialog.current.close()}}>
   <div className="contact-dialog-heading"><div><h2 id="contact-dialog-title">添加作者微信</h2><p>个人微信 · 言</p></div><button type="button" className="contact-close" onClick={()=>dialog.current.close()} aria-label="关闭微信二维码">×</button></div>
   {open&&<img className="contact-qr-original" src={qr} width="888" height="1131" alt="言的个人微信二维码原图"/>}
   <p className="contact-save-hint">手机可长按图片保存，再打开微信扫一扫，从相册中选择。</p>
   <a className="button contact-download" href={qr} download="谪星阁-作者微信.jpg">保存二维码原图 <span aria-hidden="true">↓</span></a>
  </dialog>
 </>;
}
