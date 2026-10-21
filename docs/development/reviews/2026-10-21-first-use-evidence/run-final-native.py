import io,tarfile,subprocess,pathlib,base64,json,hashlib
scratch=pathlib.Path('/tmp/boxbox-first-use.lOogPD');repo=pathlib.Path.cwd();remote='/mnt/c/Users/woo/Downloads/BoxBox/first-use-final-20261021';native='C:\\Users\\woo\\Downloads\\BoxBox\\first-use-final-20261021'
subprocess.run(['ssh','-T','-o','BatchMode=yes','chacada','mkdir -p '+remote],check=True,timeout=20)
buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w') as t:
 for path in [scratch/'native-first-use.mjs',scratch/'native-typescript.mjs',repo/'dist/installer/boxbox-plugin-0.2.1.tgz']:t.add(path,arcname=path.name)
subprocess.run(['ssh','-T','-o','BatchMode=yes','chacada','tar -xf - -C '+remote],input=buf.getvalue(),check=True,timeout=40)
def run_ps(ps,timeout):
 cmd='powershell.exe -NoProfile -NonInteractive -EncodedCommand '+base64.b64encode(ps.encode('utf-16le')).decode()
 return subprocess.run(['ssh','-T','-o','BatchMode=yes','-o','ConnectTimeout=10','chacada',cmd],capture_output=True,timeout=timeout)
r=run_ps("& node '"+native+"\\native-first-use.mjs'; exit $LASTEXITCODE",300)
(scratch/'native-final.log').write_bytes(r.stdout+r.stderr);print(r.stdout.decode(errors='replace'));print(r.stderr.decode(errors='replace'));assert r.returncode==0
result=json.loads(r.stdout.decode().strip());root=result['root'];stage_name=root.rsplit('\\',1)[1]
r=run_ps("& node '"+native+"\\native-typescript.mjs' '"+root+"'; exit $LASTEXITCODE",100)
(scratch/'native-ts-final.log').write_bytes(r.stdout+r.stderr);print(r.stdout.decode(errors='replace'));print(r.stderr.decode(errors='replace'));assert r.returncode==0
for name in ['evidence.json','typescript-evidence.json']:
 r=subprocess.run(['ssh','-T','-o','BatchMode=yes','chacada','cat '+remote+'/'+stage_name+'/'+name],capture_output=True,timeout=20,check=True)
 (scratch/('native-final-'+name)).write_bytes(r.stdout)
r=subprocess.run(['ssh','-T','-o','BatchMode=yes','chacada','sha256sum '+remote+'/boxbox-plugin-0.2.1.tgz'],capture_output=True,timeout=20,check=True)
actual=r.stdout.decode().split()[0];expected=hashlib.sha256((repo/'dist/installer/boxbox-plugin-0.2.1.tgz').read_bytes()).hexdigest();assert actual==expected
(scratch/'native-final-artifact.json').write_text(json.dumps({'sha256':actual,'remote':remote+'/boxbox-plugin-0.2.1.tgz','root':root,'ok':True},indent=2)+'\n');print('Artifact SHA256:',actual)
