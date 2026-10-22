import concurrent.futures, subprocess, time, os, signal, pathlib
root='/Users/jonghoPro/woo/00_project/98_BoxBox'
outdir=pathlib.Path('/tmp/boxbox-readiness/ts-timeout-repro/captures-p8'); outdir.mkdir(exist_ok=True)
cmd=['bun','test','test/typescript-matrix-boundaries.test.ts','--timeout','60000']
def capture(i,p,mark):
 snap=subprocess.run(['ps','-axo','pid,ppid,pgid,etime,state,command'],stdout=subprocess.PIPE,text=True).stdout
 members=[]
 for line in snap.splitlines():
  cols=line.strip().split(None,3)
  if len(cols)>=3 and cols[2].isdigit() and int(cols[2])==p.pid: members.append(line)
 (outdir/f'live-{i}-{mark}s-ps.log').write_text('\n'.join(members)+'\n')
 for line in members:
  pid=line.strip().split(None,1)[0]
  try: subprocess.run(['sample',pid,'1','1','-file',str(outdir/f'live-{i}-{mark}s-sample-{pid}.txt')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=5)
  except Exception: pass
 return len(members)
def run(i):
 log=outdir/f'run-{i}.log'; t=time.monotonic(); marks=[]
 with log.open('wb') as f:
  p=subprocess.Popen(cmd,cwd=root,stdout=f,stderr=subprocess.STDOUT,start_new_session=True)
  for mark in (15,30,65):
   remaining=mark-(time.monotonic()-t)
   try: rc=p.wait(timeout=max(0,remaining)); return i,(time.monotonic()-t)*1000,rc,marks
   except subprocess.TimeoutExpired:
    if mark<65: marks.append((mark,capture(i,p,mark)))
    else:
     capture(i,p,65); os.killpg(p.pid,signal.SIGKILL); p.wait(); return i,(time.monotonic()-t)*1000,'TIMEOUT',marks
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex: results=list(ex.map(run,range(80)))
print(results)
print('slow_or_bad',[x for x in results if x[2]!=0 or x[3]])
