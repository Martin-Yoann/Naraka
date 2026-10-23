import {icon} from '../../dist/icons.js';
import {primary,secondary,labels} from '../../dist/navigation.js';
function NavItem({name}){return <button type="button" id={name+'-nav'} className={'nav'+(name==='home'?' active':'')} data-route={name} data-view={['market','watch','calculator'].includes(name)?name:undefined} title={labels[name]}><span>{labels[name]}</span>{['compare','watch'].includes(name)&&<b id={name+'-count'}>0</b>}</button>}
function Icon({children}){return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>}
export default function PortalHeader(){return <header className="portal-header"><div className="portal-header-inner">
 <a className="brand" href="/" data-go="home"><span className="brand-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C13.4 8.6 15.4 10.6 22 12C15.4 13.4 13.4 15.4 12 22C10.6 15.4 8.6 13.4 2 12C8.6 10.6 10.6 8.6 12 2Z"/></svg></span><span className="brand-full">永劫无间 · 谪星阁</span><span className="brand-short">谪星阁</span></a>
 <nav className="portal-nav" aria-label="主要导航">{primary.map(name=><div className="nav-group" key={name}><NavItem name={name}/></div>)}</nav>
 <div className="header-right"><a aria-label="前往藏宝阁（新窗口）" className="portal-cbg" href="https://yjwujian.cbg.163.com/cgi/mweb/" target="_blank" rel="noopener noreferrer"><span className="icon-slot" dangerouslySetInnerHTML={{__html:icon('external')}}/><span className="cbg-label">前往藏宝阁</span></a>
 <button className="portal-icon" type="button" data-go="lottery" aria-label="抽签低价提醒"><Icon><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></Icon><b id="portal-alert-count" hidden/></button>
 <button className="portal-icon" type="button" data-about="" aria-label="关于与数据说明"><Icon><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></Icon></button>
 <div className="account-wrapper"><button type="button" id="account-control" className="account-control" aria-expanded="false" aria-haspopup="true"><span className="account-avatar" dangerouslySetInnerHTML={{__html:icon('user')}}/><span>登录 / 注册</span></button></div></div>
 <div className="utility-navigation" hidden>{secondary.map(name=><NavItem key={name} name={name}/>)}</div>
 </div></header>}
