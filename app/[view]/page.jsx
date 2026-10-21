import {notFound} from 'next/navigation';
import {routeLabels} from '../../lib/site-routes.mjs';
export const dynamicParams=false;
export function generateStaticParams(){return Object.keys(routeLabels).filter(view=>view!=='home').map(view=>({view}))}
export async function generateMetadata({params}){const {view}=await params;return {title:routeLabels[view]??'页面不存在'}}
export default async function ToolPage({params}){const {view}=await params;if(!routeLabels[view]||view==='home')notFound();return null}
