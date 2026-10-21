// Compatibility entry for previous deployment commands.
import './prepare-next.mjs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const result=spawnSync(process.execPath,[fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url)),'build'],{stdio:'inherit'});
process.exitCode=result.status??1;
