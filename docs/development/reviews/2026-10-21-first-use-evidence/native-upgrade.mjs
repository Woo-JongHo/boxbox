import {strict as assert} from 'node:assert';
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const stage=dirname(fileURLToPath(import.meta.url));
import {readFileSync} from "node:fs"; const previous=JSON.parse(readFileSync(process.argv[2],"utf8"));
const platform=await import(pathToFileURL(join(previous.root,'app data','BoxBox','Codex','0.2.1','platform.mjs')).href);
const codex=platform.findCommand('codex');assert.ok(codex);
const root=join(stage,'native-upgrade-'+Date.now());mkdirSync(root);mkdirSync(join(root,'old'));
const env={...process.env,CODEX_HOME:join(root,'codex home'),LOCALAPPDATA:join(root,'app data'),XDG_CONFIG_HOME:join(root,'config')};mkdirSync(env.CODEX_HOME);
const evidence={platform:process.platform,node:process.versions.node,root,commands:[]};
const run=(exe,args)=>{const r=spawnSync(exe,args,{cwd:root,env,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});evidence.commands.push({exe,args,status:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error?.message});assert.equal(r.status,0,`${r.stdout}\n${r.stderr}\n${r.error??''}`);return r.stdout;};
try {
 const old='C:\\Users\\woo\\Downloads\\BoxBox\\0.2.0\\20261020T181927-KST\\boxbox-plugin-0.2.0.tgz';
 run(join(process.env.SystemRoot,'System32','tar.exe'),['-xzf',old,'-C',join(root,'old')]);
 const payload=join(root,'old','package','payload','codex');
 run(codex.executable,[...codex.args,'plugin','marketplace','add',payload]);
 run(codex.executable,[...codex.args,'plugin','add','boxbox@boxbox-plugins']);
 const before=run(codex.executable,[...codex.args,'plugin','list']);assert.match(before,/boxbox@boxbox-plugins.*installed, enabled\s+0\.2\.0/);
 // Explicit documented one-time migration for versioned local marketplace roots.
 run(codex.executable,[...codex.args,'plugin','marketplace','remove','boxbox-plugins']);
 const npm=join(dirname(process.execPath),'node_modules','npm','bin','npm-cli.js');
 run(process.execPath,[npm,'exec','--yes','--package',pathToFileURL(join(stage,'boxbox-plugin-0.2.1.tgz')).href,'--','boxbox','--codex']);
 const after=run(codex.executable,[...codex.args,'plugin','list']);assert.match(after,/boxbox@boxbox-plugins.*installed, enabled\s+0\.2\.1/);
 evidence.ok=true;console.log(JSON.stringify({ok:true,root,before,after}));
} catch(error){evidence.failure=error.stack;console.error(error);process.exitCode=1;}
finally{writeFileSync(join(root,'evidence.json'),JSON.stringify(evidence,null,2));}
