from pathlib import Path
import subprocess,os,json,threading,queue
trial=Path(__file__).parent;env=dict(os.environ,CODEX_HOME=str(trial/'codex-home'))
p=subprocess.Popen(['codex','app-server','--stdio'],env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=(trial/'hooks-after.stderr.log').open('w'),text=True,bufsize=1)
q=queue.Queue();transcript=[]
def read():
 for line in p.stdout:
  transcript.append(line)
  try:q.put(json.loads(line))
  except json.JSONDecodeError:pass
threading.Thread(target=read,daemon=True).start()
def call(i,method,params):
 p.stdin.write(json.dumps({'id':i,'method':method,'params':params})+'\n');p.stdin.flush()
 while True:
  message=q.get(timeout=90)
  if message.get('id')==i:
   assert 'error' not in message,message
   return message['result']
try:
 call(0,'initialize',{'clientInfo':{'name':'boxbox-native-validation','version':'1'}})
 p.stdin.write(json.dumps({'method':'initialized'})+'\n');p.stdin.flush()
 result=call(1,'hooks/list',{'cwds':[str((trial/'project').resolve())]})
 (trial/'hooks-after-trust.json').write_text(json.dumps(result,indent=2)+'\n')
 before=json.loads((trial/'hooks-before-trust.json').read_text())['data'][0]['hooks']
 assert {x['key']:x['currentHash'] for x in before}=={x['key']:x['currentHash'] for x in result['data'][0]['hooks']}
 assert len(result['data'][0]['hooks'])==3 and all(x['trustStatus']=='untrusted' and x['pluginId']=='boxbox@boxbox-plugins' for x in result['data'][0]['hooks'])
 print('Same three hooks remain untrusted after one-invocation tests')
finally:
 p.stdin.close()
 try:p.wait(timeout=10)
 except subprocess.TimeoutExpired:p.terminate();p.wait(timeout=10)
 (trial/'hooks-after.rpc.jsonl').write_text(''.join(transcript))
