import {spawn} from 'node:child_process';
import {setTimeout} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
let stopping=false,child;const controller=new AbortController();
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopping=true;controller.abort();child?.kill('SIGTERM')});
while(!stopping){const started=Date.now();await new Promise(resolve=>{child=spawn(process.execPath,[fileURLToPath(new URL('./collect.mjs',import.meta.url))],{stdio:'inherit'});child.on('error',error=>{console.error(error.message);resolve()});child.on('exit',resolve)});if(!stopping)await setTimeout(Math.max(1000,30*60000-(Date.now()-started)),undefined,{signal:controller.signal}).catch(()=>{})}
