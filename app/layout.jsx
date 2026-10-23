import '../dist/style.css';
import '../dist/tools.css';
import '../dist/portal-v2.css';
import '../dist/interaction.css';
import '../dist/experience.css';
import '../dist/mobile-contact.css';
import '../dist/aurora.css';
import '../dist/preferences.css';
import PortalShell from './components/portal-shell';
import PortalRuntime from './components/portal-runtime';
export const metadata={title:{default:'永劫无间 · 谪星阁 2.4｜谪星图鉴与行情观察',template:'%s · 谪星阁'},description:'按星格数值搜索谪星，比较真实外观，查看单孔图鉴与已采样价格趋势。'};
export const viewport={width:'device-width',initialScale:1,themeColor:'#ffffff'};
export default function RootLayout({children}){return <html lang="zh-CN"><head><link rel="preconnect" href="https://cbg-capture.res.netease.com" crossOrigin="anonymous"/><link rel="preconnect" href="https://cbg-yjwujian.res.netease.com" crossOrigin="anonymous"/></head><body data-page="home"><PortalShell/><PortalRuntime/>{children}</body></html>}
