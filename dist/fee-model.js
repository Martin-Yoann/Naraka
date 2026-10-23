// Reference calculator semantics: 8% fee, 80% minimum offer, precision retained
// through the full calculation. Integers below represent cents over a denominator.
export function moneyCents(value){if(typeof value!=='string'||!/^\d+(?:\.\d{1,2})?$/.test(value.trim()))throw Error('金额最多保留两位小数');const [whole,fraction='']=value.trim().split('.');const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(!Number.isSafeInteger(cents)||cents>10000000000)throw Error('金额超出试算范围');return BigInt(cents)}
function basis(mode,amount){if(!['quote','target'].includes(mode))throw Error('请选择输入方式');const cents=moneyCents(amount);if(cents<=0)throw Error(mode==='target'?'请输入有效的卖家到手金额':'请输入有效的挂价');return mode==='target'?{n:cents*100n,d:92n}:{n:cents,d:1n}}
export function minimumOffer(mode,amount){const {n,d}=basis(mode,amount),den=d*100n;return Number((n*80n+den-1n)/den)}
export function feeEstimate({mode='quote',amount,offer,share='buyer'}){
 const {n,d}=basis(mode,amount),off=moneyCents(offer),shares={buyer:100n,split:50n,seller:0n};if(!Object.hasOwn(shares,share))throw Error('请选择手续费分配方式');
 if(off<=0)throw Error('请输入有效的还价金额');const minimum=minimumOffer(mode,amount);if(off*d*100n<n*80n)throw Error('还价不能低于八折，最低 '+(minimum/100).toFixed(2)+' 元');if(off*d>n)throw Error('还价不能高于挂价');
 const den=d*10000n,quote=n*10000n,rebate=off*den,fee=rebate*8n/100n,saving=(quote-rebate)*8n/100n,buyerSaving=saving*shares[share]/100n,sellerGain=saving-buyerSaving,baseNet=quote*92n/100n,buyerTotal=quote-buyerSaving;
 const round=value=>Number((value+den/2n)/den);
 return {mode,share,quote:round(quote),offer:Number(off),minimum,fee:round(fee),saving:round(saving),supplement:round(buyerTotal-rebate),buyerTotal:round(buyerTotal),sellerNet:round(baseNet+sellerGain),originalNet:round(baseNet),buyerSaving:round(buyerSaving),sellerGain:round(sellerGain),discount:(Number(off*d)/Number(n)).toFixed(10)};
}
