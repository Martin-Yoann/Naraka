import {readFile,writeFile} from 'node:fs/promises';
import {primary,secondary,labels} from '../dist/navigation.js';
const button=(name,secondary=false)=>`<button type="button" id="${name}-nav" class="nav${name==='home'?' active':''}" data-route="${name}"${['market','watch','calculator'].includes(name)?` data-view="${name}"`:''} title="${labels[name]}"${secondary?' role="menuitem"':''}><span>${labels[name]}</span>${['compare','watch'].includes(name)?`<b id="${name}-count">0</b>`:''}</button>`;
const more=`<div class="more-wrapper"><button id="more-toggle" type="button" aria-expanded="false" aria-controls="more-menu" aria-haspopup="menu"><span>更多</span><i aria-hidden="true">▾</i></button><div id="more-menu" role="menu" hidden>${secondary.map(name=>button(name,true)).join('')}</div></div>`;
const path=new URL('../dist/index.html',import.meta.url),old=await readFile(path,'utf8');
// Support cleaning the former header and updating the new local shell repeatedly.
let html=old.replace(/<div class="more-wrapper">[\s\S]*?<\/div><\/div>/,'');
html=html.replace(/<nav class="portal-nav"[^>]*>[\s\S]*?<\/nav>/,`<nav class="portal-nav" aria-label="主要导航">${primary.map(name=>button(name)).join('')}${more}</nav>`);
if(html!==old)await writeFile(path,html);
