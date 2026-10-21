$ErrorActionPreference = 'Stop'
$ExpectedSha = '2b43d24eabfdde00ae8019b204aabd2cc8d04f1604a8ffd540ec3170606649f0'
$CandidateDir = if ($PSScriptRoot) { $PSScriptRoot } elseif ($env:BOXBOX_REMOTE_DIR) { $env:BOXBOX_REMOTE_DIR } else { throw 'candidate directory unavailable' }
$Archive = Join-Path $CandidateDir 'boxbox-plugin-0.2.4.tgz'
$Evidence = Join-Path $CandidateDir 'windows-evidence'
$RunRoot = Join-Path ([IO.Path]::GetTempPath()) ('boxbox-python-2b43-' + [guid]::NewGuid().ToString('N'))
$Profile = Join-Path $RunRoot 'profile'
$Project = Join-Path $RunRoot 'project'
$NpmCache = Join-Path $RunRoot 'npm-cache'
New-Item -ItemType Directory -Force -Path $Evidence,$Profile,$Project,$NpmCache | Out-Null

function Run-Native([string]$Name,[string]$Exe,[string[]]$Arguments,[int[]]$Expected) {
  $stdout = Join-Path $Evidence ($Name + '.stdout.txt')
  $stderr = Join-Path $Evidence ($Name + '.stderr.txt')
  $p = Start-Process -FilePath $Exe -ArgumentList $Arguments -WorkingDirectory $Project -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  [IO.File]::WriteAllText((Join-Path $Evidence ($Name + '.status.txt')), [string]$p.ExitCode + "`r`n")
  if ($Expected -notcontains $p.ExitCode) { throw "$Name returned $($p.ExitCode), expected $($Expected -join ',')" }
  return $stdout
}
function Read-Json([string]$Path) { return (Get-Content -Raw $Path | ConvertFrom-Json) }
function Assert([bool]$Condition,[string]$Message) { if (-not $Condition) { throw $Message } }

$hash = (Get-FileHash -Algorithm SHA256 $Archive).Hash.ToLowerInvariant()
Assert ($hash -eq $ExpectedSha) 'archive SHA-256 mismatch before install'
[IO.File]::WriteAllText((Join-Path $Evidence 'archive-before.sha256.txt'), "$hash  $Archive`r`n")

$env:USERPROFILE = $Profile
$env:HOME = $Profile
$env:LOCALAPPDATA = Join-Path $Profile 'local'
$env:APPDATA = Join-Path $Profile 'roaming'
$env:CODEX_HOME = Join-Path $Profile 'codex'
$env:npm_config_cache = $NpmCache
$NodeExe = (Get-Command node.exe -ErrorAction Stop).Source
$NpmExe = (Get-Command npm.cmd -ErrorAction Stop).Source
$PythonExe = (Get-Command python.exe -ErrorAction Stop).Source
$CodexExe = (Get-Command codex.cmd -ErrorAction Stop).Source
New-Item -ItemType Directory -Force -Path $env:LOCALAPPDATA,$env:APPDATA,$env:CODEX_HOME | Out-Null

Run-Native 'node-version' $NodeExe @('--version') @(0) | Out-Null
Run-Native 'npm-version' $NpmExe @('--version') @(0) | Out-Null
Run-Native 'python-version' $PythonExe @('--version') @(0) | Out-Null
Run-Native 'codex-version' $CodexExe @('--version') @(0) | Out-Null
Run-Native 'install' $NpmExe @('exec','--yes','--package',$Archive,'--','boxbox','--codex') @(0) | Out-Null

$cliItem = Get-ChildItem -Path $env:LOCALAPPDATA -Filter 'boxbox.cmd' -Recurse -File | Where-Object { $_.FullName -match '\\0\.2\.4\\runtime\\node_modules\\\.bin\\boxbox\.cmd$' } | Select-Object -First 1
Assert ($null -ne $cliItem) 'installed 0.2.4 boxbox.cmd not found'
$Cli = $cliItem.FullName
[IO.File]::WriteAllText((Join-Path $Evidence 'run-paths.txt'), "runRoot=$RunRoot`r`ncli=$Cli`r`n")
Run-Native 'doctor' $Cli @('doctor','--json') @(0) | Out-Null
$doctor = Read-Json (Join-Path $Evidence 'doctor.stdout.txt')
Assert ($doctor.ok -and $doctor.runtimeUsable) 'doctor did not report usable runtime'

$unknown = Join-Path $Project 'python_unknown.py'
$pythonApproved = Join-Path $Project 'python_approved.py'
$tsApproved = Join-Path $Project 'typescript_approved.ts'
[IO.File]::WriteAllText($unknown, "def quote(unit_price, quantity, discount, shipping):`n    subtotal = unit_price * quantity`n    discounted = max(0, subtotal - discount)`n    total = discounted + shipping`n    return total`n", [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText($pythonApproved, "if enabled:`n  alpha = 1`n  much_longer = 22`n  mid = 333`n", [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText($tsApproved, "const short = make(1);`nconst muchLonger = make(22);`nconst middle = make(333);`n", [Text.UTF8Encoding]::new($false))

$unknownHash = (Get-FileHash -Algorithm SHA256 $unknown).Hash
Run-Native 'unknown-check' $Cli @('check','--file',$unknown,'--json') @(1) | Out-Null
Run-Native 'unknown-guide' $Cli @('guide','--file',$unknown,'--json') @(1) | Out-Null
Run-Native 'unknown-preview' $Cli @('align','--file',$unknown,'--dry-run','--json') @(2) | Out-Null
Assert (((Get-FileHash -Algorithm SHA256 $unknown).Hash) -eq $unknownHash) 'unknown fixture changed after preview'
Run-Native 'unknown-apply' $Cli @('align','--file',$unknown,'--json') @(2) | Out-Null
Assert (((Get-FileHash -Algorithm SHA256 $unknown).Hash) -eq $unknownHash) 'unknown fixture changed after apply refusal'
$unknownJson = Read-Json (Join-Path $Evidence 'unknown-check.stdout.txt')
Assert ((($unknownJson.results[0].groups[0].axes -join '>') -eq 'name>equal>assignment-value')) 'unknown axes mismatch'
Assert (-not $unknownJson.formatReadiness.approvalEligible) 'unknown fixture unexpectedly approval-eligible'
Assert ($unknownJson.formatReadiness.approvalFacts[0].status -eq 'unknown') 'unknown approval status mismatch'
$guideJson = Read-Json (Join-Path $Evidence 'unknown-guide.stdout.txt')
Assert ((-not $guideJson.ok) -and $guideJson.conventions.Count -eq 0) 'Guide did not safely refuse unknown key'

foreach ($case in @(@('python-approved',$pythonApproved,'v1|python|-|table|name>equal>value'), @('typescript-approved',$tsApproved,'v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-close-paren>semicolon'))) {
  $name=$case[0]; $file=$case[1]; $key=$case[2]
  Run-Native ($name+'-check-before') $Cli @('check','--file',$file,'--json') @(1) | Out-Null
  Run-Native ($name+'-preview') $Cli @('align','--file',$file,'--dry-run','--json') @(0) | Out-Null
  Run-Native ($name+'-apply') $Cli @('align','--file',$file,'--json') @(0) | Out-Null
  $afterApply=(Get-FileHash -Algorithm SHA256 $file).Hash
  Run-Native ($name+'-check-after') $Cli @('check','--file',$file,'--json') @(0) | Out-Null
  Run-Native ($name+'-second') $Cli @('align','--file',$file,'--json') @(0) | Out-Null
  Assert (((Get-FileHash -Algorithm SHA256 $file).Hash) -eq $afterApply) "$name second align changed bytes"
  $check=Read-Json (Join-Path $Evidence ($name+'-check-after.stdout.txt'))
  Assert ($check.results[0].summary.misaligned -eq 0) "$name final misaligned nonzero"
  Assert ($check.formatReadiness.approvalFacts[0].key -eq $key) "$name approval key mismatch"
  Assert ($check.formatReadiness.approvalFacts[0].proofComplete) "$name proof incomplete"
}

$verify = Join-Path $Project 'verify_quote.py'
[IO.File]::WriteAllText($verify, @'
import importlib.util
spec=importlib.util.spec_from_file_location("q", "python_unknown.py")
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
n=0
for unit in range(5):
  for qty in range(4):
    for discount in (0,1,3):
      for shipping in (0,2,7):
        assert m.quote(unit,qty,discount,shipping)==max(0,unit*qty-discount)+shipping
        n+=1
assert n==180
print("PASS 180/180")
'@, [Text.UTF8Encoding]::new($false))
Run-Native 'quote-behavior' $PythonExe @('-B',$verify) @(0) | Out-Null
Assert ((Get-Content -Raw (Join-Path $Evidence 'quote-behavior.stdout.txt')).Trim() -eq 'PASS 180/180') 'quote behavior assertion missing'

$finalHash = (Get-FileHash -Algorithm SHA256 $Archive).Hash.ToLowerInvariant()
Assert ($finalHash -eq $ExpectedSha) 'archive SHA-256 mismatch after verification'
[IO.File]::WriteAllText((Join-Path $Evidence 'archive-after.sha256.txt'), "$finalHash  $Archive`r`n")
[IO.File]::WriteAllText((Join-Path $Evidence 'RESULT.txt'), "PASS exact 2b43 archive; doctor; unknown refusal/invariance; approved TS/Python; behavior 180/180`r`n")
Get-Content (Join-Path $Evidence 'RESULT.txt')
