import os,json,subprocess,tempfile,hashlib
from pathlib import Path
root=Path(tempfile.mkdtemp(prefix='boxbox-matrix-installed-'))
project=root/'project'; project.mkdir()
for name in ['codex','claude','data','config']:(root/name).mkdir()
env={**os.environ,'CODEX_HOME':str(root/'codex'),'CLAUDE_CONFIG_DIR':str(root/'claude'),'XDG_DATA_HOME':str(root/'data'),'XDG_CONFIG_HOME':str(root/'config'),'npm_config_offline':'true','CLAUDE_PLUGIN_ROOT':'','CLAUDE_PLUGIN_DATA':'','PLUGIN_ROOT':'','PLUGIN_DATA':''}
archive=Path('dist/installer/boxbox-plugin-0.2.4.tgz').resolve()
results=[]
def run(args,cwd=project):
 p=subprocess.run(args,cwd=cwd,env=env,text=True,capture_output=True,timeout=120)
 row={'args':args,'cwd':str(cwd),'exitCode':p.returncode,'stdout':p.stdout,'stderr':p.stderr};results.append(row)
 (root/'transcript.json').write_text(json.dumps(results,indent=2)+'\n')
 if p.returncode:raise RuntimeError(str(row))
 return p.stdout
run(['npm','exec','--offline','--yes','--package',str(archive),'--','boxbox','--codex','--claude'])
run(['codex','plugin','list']);run(['claude','plugin','details','boxbox'])
for host in ['codex','claude']:
 plugin=root/'data'/'boxbox'/host/'0.2.4'/'plugin'
 launcher=['node',str(plugin/'scripts/boxbox.mjs')]
 assert run(launcher+['--version']).strip()=='0.2.4'
 advice=json.loads(run(launcher+['guide','--file','new/settings.py','--authoring','--json']))
 assert advice['writeAuthorized'] is False and len(advice['rules'])==1
 assert not (project/'new').exists()
 target=project/'settings.py';source='retry=3\ntimeout_seconds=30\nbatch_size=100\n';target.write_text(source)
 preview=json.loads(run(launcher+['align','--file','settings.py','--dry-run','--json']))
 assert preview['formatterExecuted'] is False and preview['written'] is False
 assert len(preview['alignmentEdits'])>0 and target.read_text()==source
 applied=json.loads(run(launcher+['align','--file','settings.py','--json']))
 assert applied['written'] is True
 checked=json.loads(run(launcher+['check','--file','settings.py','--json']))
 assert checked['results'][0]['summary']['misaligned']==0
for host in ['codex','claude']:
 launcher=['node',str(root/'data'/'boxbox'/host/'0.2.4'/'plugin'/'scripts/boxbox.mjs')]
 target=project/'matrix.ts'
 source='const a = registry.get(one)!;\nconst longer = resolve(two, three);\nfunction guard(x: number) {\n if (x < 0) return 0;\n const y = x + 1;\n if (y === 10) return 1;\n while (false) {}\n if (x > 100) return 2;\n return x;\n}\n'
 target.write_text(source)
 checked=subprocess.run(launcher+['check','--file','matrix.ts','--json'],cwd=project,env=env,text=True,capture_output=True,timeout=120)
 results.append({'host':host,'operation':'matrix-check','exitCode':checked.returncode,'stdout':checked.stdout,'stderr':checked.stderr})
 report=json.loads(checked.stdout)
 assert checked.returncode==1,report
 groups=report['results'][0]['groups']
 assert next(g for g in groups if g['kind']=='return-guards')['rowLines']==[4,6,8]
 assert {'return-guards','declaration-call-envelope'} <= {g['kind'] for g in groups},report
 aligned=subprocess.run(launcher+['align','--file','matrix.ts','--json'],cwd=project,env=env,text=True,capture_output=True,timeout=120)
 results.append({'host':host,'operation':'matrix-align-unapproved','exitCode':aligned.returncode,'stdout':aligned.stdout,'stderr':aligned.stderr})
 assert aligned.returncode!=0 and target.read_text()==source
 (root/'transcript.json').write_text(json.dumps(results,indent=2)+'\n')
 target.write_text('const rows = Array.from(items);\nconst over = rows.filter(isVisible);\n')
 dotted=subprocess.run(launcher+['check','--file','matrix.ts','--json'],cwd=project,env=env,text=True,capture_output=True,timeout=120)
 dot_report=json.loads(dotted.stdout)
 assert dotted.returncode==1 and 'call-member-dot=18' in dot_report['results'][0]['groups'][0]['axes'],dot_report
 results.append({'host':host,'operation':'member-dot-check','exitCode':dotted.returncode,'stdout':dotted.stdout})
 target.write_text('const short = make(1);\nconst muchLonger = make(22);\nconst middle = make(333);\n')
 approved=json.loads(run(launcher+['align','--file','matrix.ts','--json']))
 assert approved['written'] is True
 assert target.read_text()=='const short      = make(1  ) ;\nconst muchLonger = make(22 ) ;\nconst middle     = make(333) ;\n'
 (root/'transcript.json').write_text(json.dumps(results,indent=2)+'\n')
summary={'memberDotAndExactGuardRowsBothHosts':True,'legacyApprovedTypeScriptWriteBothHosts':True,'matrixKindsDetectedBothHosts' :True,'unapprovedAlignRefusedUnchangedBothHosts':True,'root' :str(root),'archive':str(archive),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'bothNativeRegistrations':True,'bothInstalledLaunchersGuidePreviewApplyCheck':True,'liveProfilesModified':False,'nativeModelExecution':False}
Path('/tmp/boxbox-matrix-main/installed.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary))
