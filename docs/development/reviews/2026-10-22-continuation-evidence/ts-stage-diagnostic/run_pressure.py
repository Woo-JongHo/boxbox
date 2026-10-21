import concurrent.futures, subprocess, time, os, signal, pathlib, threading, json
root='/tmp/boxbox-readiness/ts-stage-checkout'
base=pathlib.Path('/tmp/boxbox-readiness/ts-stage-diagnostic/pressure'); base.mkdir(parents=True,exist_ok=True)
cmd=['bun','test','test/typescript-matrix-boundaries.test.ts','--timeout','60000']
next_index=0; lock=threading.Lock(); stop=threading.Event(); results=[]
def snapshot(run,p,mark):
 snap=subprocess.run(['ps','-axo','pid,ppid,pgid,etime,state,command'],stdout=subprocess.PIPE,text=True).stdout
 members=[]
 for line in snap.splitlines():
  cols=line.strip().split(None,3)
  if len(cols)>=3 and cols[2].isdigit() and int(cols[2])==p.pid: members.append(line)
 (run/f'{mark}s-ps.log').write_text('\n'.join(members)+'\n')
 for line in members:
  pid=line.strip().split(None,1)[0]
  try: subprocess.run(['sample',pid,'1','1','-file',str(run/f'{mark}s-sample-{pid}.txt')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=5)
  except Exception: pass
 return members
def one(i):
 run=base/f'run-{i:03d}'; run.mkdir(); traces=run/'traces'; traces.mkdir(); log=run/'test.log'
 env=os.environ.copy(); env['BOXBOX_DIAG_TRACE_DIR']=str(traces)
 start=time.monotonic(); marks=[]
 with log.open('wb') as f:
  p=subprocess.Popen(cmd,cwd=root,env=env,stdout=f,stderr=subprocess.STDOUT,start_new_session=True)
  for mark in (15,30,60,65):
   try:
    rc=p.wait(timeout=max(0,mark-(time.monotonic()-start)))
    return {'run':i,'ms':round((time.monotonic()-start)*1000),'rc':rc,'marks':marks}
   except subprocess.TimeoutExpired:
    if mark<65:
     members=snapshot(run,p,mark); marks.append({'second':mark,'members':len(members)})
    else:
     snapshot(run,p,65); os.killpg(p.pid,signal.SIGKILL); p.wait(); stop.set()
     return {'run':i,'ms':round((time.monotonic()-start)*1000),'rc':'TIMEOUT','marks':marks}
def worker():
 global next_index
 while not stop.is_set():
  with lock:
   if next_index>=160: return
   i=next_index; next_index+=1
  result=one(i)
  with lock:
   results.append(result)
   pathlib.Path(base/'results-live.json').write_text(json.dumps(sorted(results,key=lambda x:x['run']),indent=2)+'\n')
   if result['rc']!=0: stop.set()
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
 futures=[ex.submit(worker) for _ in range(12)]
 for f in futures: f.result()
results.sort(key=lambda x:x['run']); (base/'results.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps({'completed':len(results),'bad':[x for x in results if x['rc']!=0],'over15':sum(bool(x['marks']) for x in results),'over30':sum(any(m['second']==30 for m in x['marks']) for x in results),'max_ms':max(x['ms'] for x in results)},indent=2))
