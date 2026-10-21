import {execFileSync} from 'node:child_process';
import {mkdir,cp,readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const target=resolve('.codex-publish/naraka');await mkdir(target,{recursive:true});
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
for(const file of files){if(file.startsWith('.openai/')||file.startsWith('.codex-publish/')||file.startsWith('dist/inventory/')||['dist/market.json','dist/collection.json'].includes(file))continue;if(file.startsWith('.env')&&file!=='.env.example')continue;const destination=resolve(target,file);await mkdir(dirname(destination),{recursive:true});await cp(file,destination)}
// Keep generated live market files out of this deployment repository.
await writeFile(resolve(target,'.gitignore'),(await readFile(resolve(target,'.gitignore'),'utf8'))+'\ndist/inventory/\ndist/market.json\ndist/collection.json\n');
console.log('GitHub deployment source prepared at .codex-publish/naraka; local databases, secrets and Sites metadata excluded.');
// The Next.js Route Handler replaces the previously deployed standalone function.
await unlink(resolve(target,'api/index.js')).catch(error=>{if(error.code!=='ENOENT')throw error});
