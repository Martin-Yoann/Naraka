import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeImageURL,extractMedia} from '../dist/media.js';
import {openStore} from '../lib/store.mjs';
const url='https://cbg-capture.res.netease.com/yjwujian/capture/test/1.png';
test('仅保留官方HTTPS图片资源，不接受脚本、伪装域名或任意外链',()=>{
 assert.equal(safeImageURL(url),url);for(const bad of ['javascript:alert(1)','https://cbg-capture.res.netease.com.evil.test/1.png','http://cbg-capture.res.netease.com/1.png','https://evil.test/1.png','https://cbg-capture.res.netease.com/index.html'])assert.equal(safeImageURL(bad),null);
 const media=extractMedia({other_info:{capture_url:[url,url,'javascript:bad'],equip_type_inspection_view_url:url},support_3d_preview:true});assert.deepEqual(media.previewFrames,[url]);assert.equal(media.thumbnail,url);
});
test('媒体资源单独持久化，历史批次不重复附带预览，最新有效批次恢复媒体',()=>{
 const db=openStore(':memory:');const item={id:'a',skin:'谪星',slots:[1],priceCents:100,favorites:1,publicity:false,status:'listed',previewFrames:[url],thumbnail:url};
 db.import({at:'2026-10-20T00:00:00Z',coverage:'partial',items:[item]});db.import({at:'2026-10-20T01:00:00Z',coverage:'partial',items:[item]});db.import({at:'2026-10-20T02:00:00Z',coverage:'failed',items:[]});const batches=db.read().batches;assert.equal(batches[0].items[0].previewFrames,undefined);assert.deepEqual(batches[1].items[0].previewFrames,[url]);db.close();
});
