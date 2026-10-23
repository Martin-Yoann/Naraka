import handler from './cloud-handler.mjs';
export async function cloudResponse(request,context){
 let status=200,body='';const headers=new Headers();
 const url=new URL(request.url),params=await context?.params;
 // Rewrites retain the original Request URL. Use the matched route parameters
 // so /catalog.json is served by the same live /api/catalog handler.
 if(params?.route)url.pathname='/api/'+params.route.join('/');
 async function readJSON(){
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw Object.assign(Error('需要JSON内容'),{status:400});
  const reader=request.body?.getReader();if(!reader)throw Object.assign(Error('缺少内容'),{status:400});let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();throw Object.assign(Error('内容过大'),{status:413})}chunks.push(value)}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Object.assign(Error('JSON格式无效'),{status:400})}
 }
 await handler({url:url.href,method:request.method,headers:request.headers,readJSON},{setHeader(key,value){if(key.toLowerCase()==='set-cookie'){headers.delete(key);for(const cookie of [].concat(value))headers.append(key,cookie)}else headers.set(key,value)},set statusCode(value){status=value},get statusCode(){return status},end(value){body=value??''}});
 return new Response(request.method==='HEAD'?null:body,{status,headers});
}
