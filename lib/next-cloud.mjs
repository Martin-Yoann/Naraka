import handler from './cloud-handler.mjs';
export async function cloudResponse(request,context){
 let status=200,body='';const headers=new Headers();
 const url=new URL(request.url),params=await context?.params;
 // Rewrites retain the original Request URL. Use the matched route parameters
 // so /catalog.json is served by the same live /api/catalog handler.
 if(params?.route)url.pathname='/api/'+params.route.join('/');
 await handler({url:url.href,method:request.method},{setHeader(key,value){headers.set(key,value)},set statusCode(value){status=value},get statusCode(){return status},end(value){body=value??''}});
 return new Response(request.method==='HEAD'?null:body,{status,headers});
}
