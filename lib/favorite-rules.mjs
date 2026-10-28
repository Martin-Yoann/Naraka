export function matchesFavorite(item,favorite,now=Date.now()){
 const age=now-Date.parse(item?.observedAt);
 return favorite.remind===true&&item?.id===favorite.item_id&&item.status==='listed'&&item.isLottery===true&&item.lotteryConfirmed===true&&Number.isFinite(age)&&age>=-60000&&age<=65*60000&&Date.parse(item.lotteryEndsAt)>now;
}
