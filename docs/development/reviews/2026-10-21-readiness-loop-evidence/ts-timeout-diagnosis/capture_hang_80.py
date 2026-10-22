import concurrent.futures, subprocess, time, os, signal, pathlib
root='/Users/jonghoPro/woo/00_project/98_BoxBox'
outdir=pathlib.Path('/tmp/boxbox-readiness/ts-timeout-repro/captures2'); outdir.mkdir(exist_ok=True)
cmd=['bun','test','test/typescript-matrix-boundaries.test.ts','--timeout','60000']
def run(i):
 log=outdir/f'run-{i}.log'
 with log.open('wb') as f:
  p=subprocess.Popen(cmd,cwd=root,stdout=f,stderr=subprocess.STDOUT,start_new_session=True)
  t=time.monotonic()
  try:
   rc=p.wait(timeout=15); return i,(time.monotonic()-t)*1000,rc
  except subprocess.TimeoutExpired:
   snap=subprocess.run(['ps','-axo','pid,ppid,pgid,etime,state,command'],stdout=subprocess.PIPE,text=True).stdout
   members=[]
   for line in snap.splitlines():
    cols=line.strip().split(None,3)
    if len(cols)>=3 and cols[2].isdigit() and int(cols[2])==p.pid: members.append(line)
   (outdir/f'hang-{i}-ps.log').write_text('\n'.join(members)+'\n')
   for line in members:
    pid=line.strip().split(None,1)[0]
    subprocess.run(['sample',pid,'1','1','-file',str(outdir/f'hang-{i}-sample-{pid}.txt')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=5)
   os.killpg(p.pid,signal.SIGKILL); p.wait()
   return i,(time.monotonic()-t)*1000,'TIMEOUT'
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
 results=list(ex.map(run,range(80)))
print(results)
print('bad', [x for x in results if x[2]!=0])
