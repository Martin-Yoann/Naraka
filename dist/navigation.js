// Shared navigation contract for the Next.js header and local HTML shell.
export const primary=['home','compare','search','gallery','trends'];
export const secondary=['simulator','calculator','market','watch','lottery'];
export const labels={home:'首页',compare:'商品对比',search:'自定搜索',gallery:'图鉴',trends:'走势分析',simulator:'洗练模拟',calculator:'费用试算',market:'行情观察',watch:'我的监控',lottery:'抽签提醒'};
export function navigationButton(name){const button=document.getElementById(name+'-nav');if(!button)throw Error('Navigation button missing: '+name);return button}
