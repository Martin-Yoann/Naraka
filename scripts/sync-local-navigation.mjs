import {readFile,writeFile} from 'node:fs/promises';
import {primary,secondary,labels} from '../dist/navigation.js';
const button=name=>`<button type="button" id="${name}-nav" class="nav${name==='home'?' active':''}" data-route="${name}"${['market','watch','calculator'].includes(name)?` data-view="${name}"`:''} title="${labels[name]}"><span>${labels[name]}</span>${['compare','watch'].includes(name)?`<b id="${name}-count">0</b>`:''}</button>`;
const groups=primary.map(name=>`<div class="nav-group">${button(name)}</div>`).join('');
const path=new URL('../dist/index.html',import.meta.url),old=await readFile(path,'utf8');let html=old.replace(/<nav class="portal-nav"[^>]*>[\s\S]*?<\/nav>/,`<nav class="portal-nav" aria-label="主要导航">${groups}<div class="utility-navigation" hidden>${secondary.map(button).join('')}</div></nav>`);
if(!html.includes('href="navigation-update.css"'))html=html.replace('</head>','<link rel="stylesheet" href="navigation-update.css"></head>');
if(html!==old)await writeFile(path,html);
