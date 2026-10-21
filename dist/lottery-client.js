export const subscriptionKey=(skin,holes)=>JSON.stringify([skin,Number(holes)]);
export function eligibleLocalAlerts(events,subscriptions,seen,now=Date.now()){
 const keys=new Set(seen);return events.filter(event=>{const sub=subscriptions.find(s=>s.key===event.key);return sub&&!keys.has(event.id)&&Date.parse(event.at)>Date.parse(sub.createdAt)&&now-Date.parse(event.at)<=40*60000&&now>=Date.parse(event.at)&&Date.parse(event.endsAt)>now});
}
export function validSubscriptions(value){return Array.isArray(value)?value.filter(s=>typeof s?.skin==='string'&&Number.isInteger(s.holes)&&s.holes>=0&&s.holes<=4&&s.key===subscriptionKey(s.skin,s.holes)&&Number.isFinite(Date.parse(s.createdAt))).slice(0,200):[]}
