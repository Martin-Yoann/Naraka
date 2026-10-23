// Shared navigation contract for the Next.js header and local HTML shell.
export const primary=['trends','market','compare','simulator','calculator','search','gallery'];
export const secondary=['home','watch','lottery'];
export const menus={trends:[['条件价格趋势','trend-skin'],['导出采样点','trend-export']],market:[['行情列表','listings'],['收藏热榜','hot-list'],['添加监控','save-watch']],compare:[['比较工作台','compare-cards'],['导入商品链接','compare-links']],simulator:[['洗练样本演练','sim-skin'],['目标数值范围','sim-min-0']],calculator:[['填挂价试算','amount','quote'],['填卖家到手','amount','target']],search:[['自定数值搜索','search-query'],['筛选条件','search-form']]};
export const labels={home:'首页',compare:'商品对比',search:'自定搜索',gallery:'图鉴',trends:'走势分析',simulator:'洗练模拟',calculator:'费用试算',market:'行情观察',watch:'我的监控',lottery:'抽签提醒'};
export function navigationButton(name){const button=document.getElementById(name+'-nav');if(!button)throw Error('Navigation button missing: '+name);return button}
