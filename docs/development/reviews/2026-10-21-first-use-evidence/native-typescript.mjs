import {strict as assert} from 'node:assert';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.argv[2];
const project=join(root,'project with spaces');
const install=join(root,'app data','BoxBox','Codex','0.2.1');
const launcher=join(install,'plugin','scripts','boxbox.mjs');
const evidence={platform:process.platform,node:process.versions.node,commands:[]};
const cli=(args,status=0)=>{
 const r=spawnSync(process.execPath,[launcher,...args,'--json'],{cwd:project,env:{...process.env,XDG_CONFIG_HOME:join(root,'config')},encoding:'utf8',timeout:30000});
 evidence.commands.push({args,status:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error?.message});
 assert.equal(r.status,status,`${r.stdout}\n${r.stderr}\n${r.error??''}`);return JSON.parse(r.stdout);
};
try {
 const source='const short = make(1);\nconst muchLonger = make(22);\nconst middle = make(333);\n';
 const file=join(project,'table.ts');writeFileSync(file,source);
 assert.equal(cli(['check','--file','table.ts'],1).formatReadiness.approvalEligible,true);
 assert.equal(cli(['format','--file','table.ts','--dry-run']).written,false);
 assert.equal(readFileSync(file,'utf8'),source);
 assert.equal(cli(['format','--file','table.ts']).written,true);
 const after=readFileSync(file,'utf8');assert.notEqual(after,source);
 const {SyntaxKind}=await import(pathToFileURL(join(install,'runtime','node_modules','typescript','dist','ast','index.js')).href);
 const {createScanner}=await import(pathToFileURL(join(install,'runtime','node_modules','typescript','dist','ast','scanner.js')).href);
 const tokens=s=>{const scanner=createScanner(false,undefined,s);const out=[];for(let k=scanner.scan();k!==SyntaxKind.EndOfFile;k=scanner.scan())if(k!==SyntaxKind.WhitespaceTrivia)out.push([k,scanner.getTokenText()]);return out;};
 assert.deepEqual(tokens(source),tokens(after));
 assert.equal(cli(['format','--file','table.ts']).written,false);assert.equal(readFileSync(file,'utf8'),after);cli(['check','--file','table.ts']);
 const crlfFile=join(project,'crlf.ts');writeFileSync(crlfFile,source.replaceAll('\n','\r\n'));
 assert.equal(cli(['format','--file','crlf.ts']).written,true);assert.equal(readFileSync(crlfFile,'utf8'),after.replaceAll('\n','\r\n'));assert.equal(cli(['format','--file','crlf.ts']).written,false);
 const excluded='using short = make(1);\nusing muchLonger = make(22);\n';writeFileSync(join(project,'using.ts'),excluded);
 assert.equal(cli(['format','--file','using.ts'],2).error.code,'FORMAT_NOT_ELIGIBLE');assert.equal(readFileSync(join(project,'using.ts'),'utf8'),excluded);
 evidence.ok=true;evidence.nativeHookVerified=false;
 console.log(JSON.stringify({ok:true,platform:process.platform,node:process.versions.node,typescript:'7.0.2',commands:evidence.commands.length,nativeHookVerified:false}));
} catch(error){evidence.failure=error.stack;console.error(error);process.exitCode=1;}
finally{writeFileSync(join(root,'typescript-evidence.json'),JSON.stringify(evidence,null,2));}
