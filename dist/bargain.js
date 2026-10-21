import {calculate} from './core.js';
export function bargain(quote,offer,rule,buyerShare=.5,minRatio=.8){
 if(!Number.isSafeInteger(quote)||!Number.isSafeInteger(offer)||quote<0||offer<0||offer>quote||!Number.isFinite(buyerShare)||buyerShare<0||buyerShare>1||!Number.isFinite(minRatio)||minRatio<0||minRatio>1)throw Error('请检查挂价、还价和费用分摊比例');
 const minOffer=Number((BigInt(quote)*BigInt(Math.round(minRatio*10000))+9999n)/10000n);
 if(offer<minOffer)throw Error(`还价低于当前设定下限（${(minRatio*100).toFixed(2)}%）`);
 const original=calculate(quote,rule),reduced=calculate(offer,rule);const saving=original.fee-reduced.fee;
 const buyerSaving=Math.round(saving*buyerShare),sellerGain=saving-buyerSaving;
 const supplement=quote-offer-buyerSaving;
 if(supplement<0)throw Error('规则计算得出负补差，请检查费用规则');
 return {quote,offer,fee:reduced.fee,originalFee:original.fee,saving,buyerSaving,sellerGain,supplement,buyerTotal:offer+supplement,sellerNet:reduced.net+supplement,originalNet:original.net};
}
