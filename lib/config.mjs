import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const path=fileURLToPath(new URL('../.env',import.meta.url));if(existsSync(path))process.loadEnvFile(path);
export function wechatConfig(){
 const origin=process.env.SITE_ORIGIN||'';
 const validOrigin=(()=>{try{const u=new URL(origin);return u.protocol==='https:'&&u.origin===origin}catch{return false}})();
 return {origin,sandbox:process.env.WECHAT_OA_SANDBOX==='true',oaId:process.env.WECHAT_OA_APP_ID,oaSecret:process.env.WECHAT_OA_APP_SECRET,webId:process.env.WECHAT_WEB_APP_ID,webSecret:process.env.WECHAT_WEB_APP_SECRET,oaReady:!!(validOrigin&&process.env.WECHAT_OA_APP_ID&&process.env.WECHAT_OA_APP_SECRET),webReady:!!(validOrigin&&process.env.WECHAT_WEB_APP_ID&&process.env.WECHAT_WEB_APP_SECRET),templateId:process.env.WECHAT_TEMPLATE_ID,templateFields:process.env.WECHAT_TEMPLATE_FIELDS,sendEnabled:process.env.WECHAT_SEND_ENABLED==='true'};
}
