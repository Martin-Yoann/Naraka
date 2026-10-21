export function feeFor(price, rule) {
  return Math.min(rule.max ?? Infinity, Math.max(rule.min, Math.round(price * rule.rate / 100)));
}
export function calculate(amount, rule, reverse = false) {
  if (![amount, rule.rate, rule.min, rule.extra].every(Number.isFinite) || amount < 0 || rule.rate < 0 || rule.rate >= 100 || rule.min < 0 || rule.extra < 0 || (rule.max != null && (!Number.isFinite(rule.max) || rule.max < rule.min))) throw new Error('请检查金额、费率和封顶费用，封顶不能低于最低手续费。');
  const net = p => p - feeFor(p, rule) - rule.extra;
  let price = amount;
  if (reverse) {
    let lo = amount, hi = Math.max(100, amount + rule.min + rule.extra);
    while (net(hi) < amount) { hi *= 2; if (!Number.isSafeInteger(hi)) throw new Error('金额超出计算范围'); }
    while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (net(mid) >= amount) hi = mid; else lo = mid + 1; }
    price = lo;
  }
  if (!Number.isSafeInteger(price) || price > 1e12) throw new Error('金额超出计算范围');
  return { price, fee: feeFor(price, rule), net: net(price) };
}
export function matches(item, filter) {
  return (!filter.skin || item.skin === filter.skin) && (!filter.holes || (item.holesCount??item.slots.length) === +filter.holes) && (item.slots[0]??0) >= (+filter.minimum || 0) && (filter.publicity !== 'no' || !item.publicity) && (!filter.ranges || filter.ranges.every((range,index)=>{
    const hasMin=range.min!==''&&range.min!=null,hasMax=range.max!==''&&range.max!=null;
    if(!hasMin&&!hasMax)return true;
    return item.slots[index]!=null&&(!hasMin||item.slots[index]>=+range.min)&&(!hasMax||item.slots[index]<=+range.max);
  }));
}
export function aggregate(items, filter) {
  const sorted = items.filter(i => i.status === 'listed' && matches(i, filter)).sort((a,b) => a.priceCents - b.priceCents);
  const three = sorted.slice(0,3);
  return { count: sorted.length, min: sorted[0]?.priceCents ?? null, median: three.length === 3 ? three[1].priceCents : null, item: sorted[0]?.id ?? null };
}
