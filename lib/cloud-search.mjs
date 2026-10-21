export function inventoryQuery({filter={},sort='price',page=1,limit=20,type=''}={}){
 if(!Number.isInteger(page)||page<1||page>100000||!Number.isInteger(limit)||limit<1||limit>100000||!filter||typeof filter!=='object'||Array.isArray(filter))throw Error('Invalid search');
 const values=[],clauses=[],add=(sql,value)=>{values.push(value);clauses.push(sql.replace('?',`$${values.length}`))};
 if(type)add('type=?',type);
 if(filter.listedOnly!==false)clauses.push("payload->>'status'='listed'");
 if(filter.skin)add("payload->>'skin'=?",String(filter.skin).slice(0,100));
 if(filter.query){const q=String(filter.query).slice(0,200).replace(/[\\%_]/g,'\\$&');add("(payload->>'skin' ILIKE ? ESCAPE '\\' OR id ILIKE ? ESCAPE '\\')",'%'+q+'%');clauses[clauses.length-1]=clauses.at(-1).replace('?',`$${values.length}`)}
 if(filter.category){if(!['character','weapon'].includes(filter.category))throw Error('Invalid category');clauses.push(filter.category==='character'?"type LIKE '34%'":"type LIKE '23%'")}
 if(filter.holes!==''&&filter.holes!=null){const holes=Number(filter.holes);if(!Number.isInteger(holes)||holes<0||holes>4)throw Error('Invalid holes');add("(payload->>'holesCount')::int=?",holes)}
 for(const [key,op,field]of [['priceMin','>=','priceCents'],['priceMax','<=','priceCents'],['favoritesMin','>=','favorites']])if(filter[key]!=null){if(!Number.isSafeInteger(filter[key])||filter[key]<0)throw Error('Invalid number');add(`(payload->>'${field}')::bigint${op}?`,filter[key])}
 if(filter.priceMin!=null&&filter.priceMax!=null&&filter.priceMin>filter.priceMax)throw Error('Invalid range');
 if(filter.publicity==='no')clauses.push("payload->>'publicity'='false'");
 if(filter.recentOnly)clauses.push("last_seen>=now()-interval '65 minutes' AND last_seen<=now()");
 if(filter.lotteryOnly)clauses.push("payload->>'isLottery'='true' AND payload->>'lotteryConfirmed'='true' AND (payload->>'lotteryEndsAt')::timestamptz>now()");
 if(filter.ranges!=null&&(!Array.isArray(filter.ranges)||filter.ranges.length>4))throw Error('Invalid slots');
 for(let i=0;i<4;i++){const range=filter.ranges?.[i];for(const [key,op]of [['min','>='],['max','<=']])if(range?.[key]!=null&&range[key]!==''){if(!Number.isSafeInteger(Number(range[key]))||Number(range[key])<0)throw Error('Invalid slot');add(`(payload->'slots'->>${i})::int${op}?`,Number(range[key]));clauses.push(`COALESCE((payload->'unlocks'->>${i})::int,1)<>0`)}if(range?.min!=null&&range?.max!=null&&range.min!==''&&range.max!==''&&Number(range.min)>Number(range.max))throw Error('Invalid range');if(filter.requireUnlocked?.[i])clauses.push(`(payload->'unlocks'->>${i})::int=1`)}
 const orders={price:"(payload->>'priceCents')::bigint ASC",favorites:"(payload->>'favorites')::bigint DESC",holes:"(payload->>'holesCount')::int DESC",recent:'last_seen DESC'};if(!orders[sort])throw Error('Invalid sort');
 return {where:clauses.length?' WHERE '+clauses.join(' AND '):'',values,order:orders[sort]+',id',page,limit};
}
