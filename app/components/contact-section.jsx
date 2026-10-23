'use client';
import {useEffect,useRef,useState} from 'react';
const email='pickyan@163.com',qr='/assets/qq-group.jpg',groupLink='https://qm.qq.com/q/z0VQOrf2OA';
export default function ContactSection(){
 const dialog=useRef(null),trigger=useRef(null),timer=useRef(),[open,setOpen]=useState(false),[copyStatus,setCopyStatus]=useState('');
 useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current.showModal();return ()=>{document.body.style.overflow=previous}},[open]);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 async function copyEmail(){try{await navigator.clipboard.writeText(email);setCopyStatus('邮箱已复制')}catch{setCopyStatus('可长按邮箱地址复制')}clearTimeout(timer.current);timer.current=setTimeout(()=>setCopyStatus(''),3000)}
 return <>
  <section className="portal-community portal-contact" aria-labelledby="contact-heading">
   <div className="contact-copy">
    <div className="portal-kicker">✧ 谪星同好 · QQ 交流群</div>
    <h2 id="contact-heading">聚窟洲·谪星互助小站</h2>
    <p>交流谪星外观、反馈使用问题，或告诉我你想要的新功能。<br className="contact-desktop-break"/>欢迎加入 QQ 交流群，一起分享配置与行情，也可以通过邮箱联系。</p>
    <a className="button contact-join" href={groupLink} target="_blank" rel="noopener noreferrer">加入 QQ 交流群 <span aria-hidden="true">↗</span></a>
    <p className="contact-group-number">群号：313120228</p>
    <div className="contact-email"><span className="contact-mail-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg></span><div><small>邮件联系</small><a href={'mailto:'+email}>{email}</a></div><button type="button" className="contact-copy-email" onClick={copyEmail}>复制邮箱</button></div>
    <span className="contact-copy-status" role="status" aria-live="polite">{copyStatus}</span>
    <div className="contact-route-links"><a href="#watch" data-go="watch">我的监控 <span aria-hidden="true">↗</span></a><a href="#lottery" data-go="lottery">抽签低价提醒 <span aria-hidden="true">↗</span></a></div>
   </div>
   <div className="contact-group"><button ref={trigger} type="button" className="contact-qr-button" onClick={()=>setOpen(true)} aria-label="放大查看QQ交流群二维码"><span className="contact-qr-image"><img src={qr} width="1284" height="2283" alt="聚窟洲·谪星互助小站QQ群二维码，点击放大查看" loading="lazy" decoding="async"/></span><span className="contact-qr-label">QQ 交流群二维码 <span aria-hidden="true">⌕</span></span></button><p>群号：313120228 · 点击放大二维码</p></div>
  </section>
  <dialog ref={dialog} className="contact-dialog" aria-labelledby="contact-dialog-title" onCancel={()=>setOpen(false)} onClose={()=>{setOpen(false);trigger.current?.focus({preventScroll:true})}} onClick={event=>{if(event.target===event.currentTarget)dialog.current.close()}}>
   <div className="contact-dialog-heading"><div><h2 id="contact-dialog-title">QQ 交流群二维码</h2><p>聚窟洲·谪星互助小站 · 群号 313120228</p></div><button type="button" className="contact-close" onClick={()=>dialog.current.close()} aria-label="关闭QQ群二维码">×</button></div>
   {open&&<img className="contact-qr-original" src={qr} width="1284" height="2283" alt="聚窟洲·谪星互助小站QQ群二维码原图"/>}
   <p className="contact-save-hint">手机可长按图片保存，再打开 QQ 扫一扫，从相册中选择；也可直接点击下方链接加入群聊。</p>
   <a className="button contact-join contact-dialog-join" href={groupLink} target="_blank" rel="noopener noreferrer">加入「聚窟洲·谪星互助小站」 ↗</a>
   <a className="button secondary contact-download" href={qr} download="聚窟洲-谪星互助小站-QQ群二维码.jpg">保存二维码原图 <span aria-hidden="true">↓</span></a>
  </dialog>
 </>;
}
