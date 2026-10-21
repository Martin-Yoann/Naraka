import handler from './cloud-handler.mjs';
export async function cloudResponse(request){
 let status=200,body='';const headers=new Headers();
 await handler({url:request.url,method:request.method},{setHeader(key,value){headers.set(key,value)},set statusCode(value){status=value},get statusCode(){return status},end(value){body=value??''}});
 return new Response(request.method==='HEAD'?null:body,{status,headers});
}
