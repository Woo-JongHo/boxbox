import base64,datetime,hashlib,io,json,pathlib,shlex,stat,subprocess,tarfile
local=pathlib.Path('/tmp/boxbox-delivery-022-20261021')
source=pathlib.Path('/Users/jonghoPro/woo/00_project/98_BoxBox/dist/candidates/gha-39543872402')
expected='611858a6b7f72e1a27aaddf9593d5a1404a0baf7c705bb2ec21ea2f2bbec7137'
expected_bytes=126691
archive=source/'boxbox-plugin-0.2.2.tgz'
assert stat.S_ISREG(archive.lstat().st_mode) and not archive.is_symlink()
assert archive.stat().st_size==expected_bytes and hashlib.sha256(archive.read_bytes()).hexdigest()==expected
metadata=json.loads((source/'candidate.json').read_text())
assert metadata['filename']==archive.name and metadata['sha256']==expected and metadata['bytes']==expected_bytes
assert metadata['source']['commit']=='6e74c9327c44b4121a7ec4803d3acad66ee0f071' and metadata['source']['dirty'] is False
assert metadata['build']['runId']=='39543872402'
assert (source/'SHA256SUMS').read_text()==f'{expected}  {archive.name}\n'
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
remote=f'/mnt/c/Users/woo/Downloads/BoxBox/0.2.2/gha-{stamp}'
windows=r'C:\Users\woo\Downloads\BoxBox\0.2.2\gha-'+stamp
readme=f"""# BoxBox 0.2.2 GitHub Actions candidate

This exact archive was downloaded from [GitHub Actions run 39543872402](https://github.com/Woo-JongHo/rowgrid/actions/runs/39543872402).

- Source: main, clean commit 6e74c9327c44b4121a7ec4803d3acad66ee0f071.
- Archive: boxbox-plugin-0.2.2.tgz (126691 bytes).
- SHA-256: {expected}.
- candidate.json and SHA256SUMS are the original CI receipts.

The archive was transferred without rebuilding. Delivery performs no installation, host registration or hook-trust changes. Existing versions remain in their own folders.

To install into Codex later, open PowerShell with a supported Node.js runtime (22.22.3 or newer), Python 3 and an installed Codex CLI, then run:

~~~powershell
npx --yes 'file:{windows}\\boxbox-plugin-0.2.2.tgz' --codex
~~~

This is an unpublished candidate. CI engine-only smoke does not establish native host hook-event acceptance.
"""
(local/'README.md').write_text(readme)
files=[archive,source/'candidate.json',source/'SHA256SUMS',local/'README.md']
inputs={p.name:{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in files}
(local/'local-verification.json').write_text(json.dumps({'verifiedAt':stamp,'source':str(source),'files':inputs,'candidate':metadata},indent=2)+'\n')
for name in ['candidate.json','SHA256SUMS']:(local/name).write_bytes((source/name).read_bytes())
ssh=['ssh','-T','-o','BatchMode=yes','-o','ConnectTimeout=10','chacada']
setup=f"""import json,pathlib
base=pathlib.Path('/mnt/c/Users/woo/Downloads/BoxBox')
version=base/'0.2.2'
planned=pathlib.Path({remote!r})
existing=sorted(p.name for p in base.iterdir())
version.mkdir(exist_ok=True)
planned.mkdir(exist_ok=False)
print(json.dumps({{'existingFolders':existing,'newDestination':str(planned),'createdExclusively':True}}))
"""
with (local/'transfer.log').open('w') as log:
 result=subprocess.run([*ssh,'python3 -'],input=setup,capture_output=True,text=True,timeout=20,check=True)
 log.write(result.stdout+result.stderr)
 before=json.loads(result.stdout)
 stream=io.BytesIO()
 with tarfile.open(fileobj=stream,mode='w') as bundle:
  for path in files:bundle.add(path,arcname=path.name)
 result=subprocess.run([*ssh,'tar -xf - -C '+shlex.quote(remote)],input=stream.getvalue(),capture_output=True,timeout=30,check=True)
 log.write(result.stdout.decode('utf-8',errors='replace')+result.stderr.decode('utf-8',errors='replace'))
 log.write('Tar stream transfer completed. No candidate execution.\n')
def psquote(value):return "'"+value.replace("'","''")+"'"
ps="\n".join([
 "$ErrorActionPreference = 'Stop'",
 "$ProgressPreference = 'SilentlyContinue'",
 "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)",
 "$OutputEncoding = [Console]::OutputEncoding",
 "$destination = "+psquote(windows),
 "$checks = "+psquote(json.dumps(inputs))+" | ConvertFrom-Json",
 "$verified = @()",
 "foreach ($entry in $checks.PSObject.Properties) {",
 "  $file = Join-Path $destination $entry.Name",
 "  $item = Get-Item -LiteralPath $file",
 "  $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()",
 "  if ($item.Length -ne $entry.Value.bytes -or $hash -ne $entry.Value.sha256) { throw ('File verification failed: ' + $entry.Name) }",
 "  $verified += [ordered]@{ filename = $entry.Name; bytes = $item.Length; sha256 = $hash }",
 "}",
 "$metadata = Get-Content -LiteralPath (Join-Path $destination 'candidate.json') -Raw -Encoding UTF8 | ConvertFrom-Json",
 "if ($metadata.sha256 -ne "+psquote(expected)+" -or $metadata.bytes -ne 126691 -or $metadata.source.commit -ne '6e74c9327c44b4121a7ec4803d3acad66ee0f071' -or $metadata.source.dirty) { throw 'Native candidate metadata verification failed' }",
 "$expectedReceipt = "+psquote(expected+"  boxbox-plugin-0.2.2.tgz")+' + "`n"',
 "$actualReceipt = Get-Content -LiteralPath (Join-Path $destination 'SHA256SUMS') -Raw -Encoding UTF8",
 "if ($actualReceipt -cne $expectedReceipt) { throw 'Native checksum receipt verification failed' }",
 "$actualNames = @(Get-ChildItem -LiteralPath $destination -File | Select-Object -ExpandProperty Name | Sort-Object)",
 "$expectedNames = @($checks.PSObject.Properties.Name | Sort-Object)",
 "if (Compare-Object $actualNames $expectedNames) { throw 'Unexpected delivery contents' }",
 "$receipt = [ordered]@{ schemaVersion = 1; ok = $true; verifiedAt = (Get-Date).ToUniversalTime().ToString('o'); verifier = 'Native Windows PowerShell Get-FileHash'; destination = $destination; files = $verified; candidateRun = '39543872402'; sourceCommit = $metadata.source.commit; candidateExecuted = $false; installed = $false; hookTrustChanged = $false }",
 "Write-Output ('BOXBOX_REMOTE_VERIFIED ' + ($receipt | ConvertTo-Json -Depth 8 -Compress))",
])
(local/'native-verify.ps1').write_text(ps+'\n')
encoded=base64.b64encode(ps.encode('utf-16le')).decode('ascii')
result=subprocess.run([*ssh,'powershell.exe -NoProfile -NonInteractive -EncodedCommand '+encoded],capture_output=True,timeout=30)
(local/'native-verification.log').write_bytes(result.stdout+result.stderr)
assert result.returncode==0,(result.returncode,result.stdout.decode('utf-8',errors='replace'),result.stderr.decode('utf-8',errors='replace'))
text=result.stdout.decode('utf-8',errors='strict')
lines=[line for line in text.splitlines() if line.startswith('BOXBOX_REMOTE_VERIFIED ')]
assert len(lines)==1,text
verified=json.loads(lines[0].removeprefix('BOXBOX_REMOTE_VERIFIED '))
(local/'remote-verification.json').write_text(json.dumps(verified,indent=2)+'\n')
receipt={'schemaVersion':1,'ok':verified['ok'],'failure':None,'archiveSha256':expected,'archiveBytes':expected_bytes,'destinationWindows':windows,'destinationWSL':remote,'source':str(source),'ghaRun':'https://github.com/Woo-JongHo/rowgrid/actions/runs/39543872402','sourceCommit':metadata['source']['commit'],'sourceDirty':False,'remoteVerifiedBy':verified['verifier'],'inputFiles':inputs,'remoteFiles':verified['files'],'createdExclusively':before['createdExclusively'],'existingFoldersBefore':before['existingFolders'],'candidateExecuted':False,'installed':False,'hookTrustChanged':False,'preparationIssue':'An initial local helper-generation quoting error was corrected before any SSH command or transfer; see preparation-first-attempt.log.'}
(local/'delivery-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
summary=f"""# BoxBox 0.2.2 delivery

Status: VERIFIED. No transfer or remote verification failures occurred. An initial local helper-generation quoting error was corrected before any SSH command or transfer; the preparation note is preserved.

The exact GitHub Actions candidate from [run 39543872402](https://github.com/Woo-JongHo/rowgrid/actions/runs/39543872402) was copied without rebuilding from {source} to the new folder {windows}. Its original candidate.json and SHA256SUMS were preserved, alongside a concise English README.md.

- Archive: boxbox-plugin-0.2.2.tgz.
- Bytes: 126691.
- SHA-256: {expected}.
- Source: clean main commit 6e74c9327c44b4121a7ec4803d3acad66ee0f071.
- Native Windows PowerShell Get-FileHash and file length verified all four transferred files, the archive identity, the CI metadata and exact checksum receipt. Native directory enumeration confirmed the four expected filenames.

The destination was created exclusively (exist_ok=False) beneath the separate 0.2.2 version directory. Existing 0.2.1 and all previous folders were preserved. The earlier readiness proposal was replaced by this fresh timestamped delivery folder; the unused proposed folder was never created.

No candidate code was executed. No installation, host registration, PATH change or hook-trust change occurred. The actual GitHub Actions smoke had already passed; an additional remote smoke was not requested.

Full receipts, input hashes, transfer log, exact native verification script and native output are in /tmp/boxbox-delivery-022-20261021/:

- local-verification.json, candidate.json, SHA256SUMS, README.md.
- transfer.log, native-verify.ps1, native-verification.log.
- remote-verification.json, delivery-receipt.json, preparation-first-attempt.log.

No repository source files were changed by this delivery worker.
"""
pathlib.Path('/tmp/boxbox-delivery-022-20261021.md').write_text(summary)
print(json.dumps(receipt,indent=2))
