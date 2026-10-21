$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding
$destination = 'C:\Users\woo\Downloads\BoxBox\0.2.2\gha-20261021T043246Z'
$checks = '{"boxbox-plugin-0.2.2.tgz": {"sha256": "611858a6b7f72e1a27aaddf9593d5a1404a0baf7c705bb2ec21ea2f2bbec7137", "bytes": 126691}, "candidate.json": {"sha256": "0ff004b7eea55b276fd93110b40c79b83ad2074e677ca00b189755ff868e02e4", "bytes": 849}, "SHA256SUMS": {"sha256": "391baf9b676a79a5d04542a0c8a428237eab0adb2f985f02603209c913e8237b", "bytes": 90}, "README.md": {"sha256": "65bebc9ecaca6f7920ef272507c3c53fec75bb87f9c9d4d705cb6130e39825d9", "bytes": 993}}' | ConvertFrom-Json
$verified = @()
foreach ($entry in $checks.PSObject.Properties) {
  $file = Join-Path $destination $entry.Name
  $item = Get-Item -LiteralPath $file
  $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($item.Length -ne $entry.Value.bytes -or $hash -ne $entry.Value.sha256) { throw ('File verification failed: ' + $entry.Name) }
  $verified += [ordered]@{ filename = $entry.Name; bytes = $item.Length; sha256 = $hash }
}
$metadata = Get-Content -LiteralPath (Join-Path $destination 'candidate.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($metadata.sha256 -ne '611858a6b7f72e1a27aaddf9593d5a1404a0baf7c705bb2ec21ea2f2bbec7137' -or $metadata.bytes -ne 126691 -or $metadata.source.commit -ne '6e74c9327c44b4121a7ec4803d3acad66ee0f071' -or $metadata.source.dirty) { throw 'Native candidate metadata verification failed' }
$expectedReceipt = '611858a6b7f72e1a27aaddf9593d5a1404a0baf7c705bb2ec21ea2f2bbec7137  boxbox-plugin-0.2.2.tgz' + "`n"
$actualReceipt = Get-Content -LiteralPath (Join-Path $destination 'SHA256SUMS') -Raw -Encoding UTF8
if ($actualReceipt -cne $expectedReceipt) { throw 'Native checksum receipt verification failed' }
$actualNames = @(Get-ChildItem -LiteralPath $destination -File | Select-Object -ExpandProperty Name | Sort-Object)
$expectedNames = @($checks.PSObject.Properties.Name | Sort-Object)
if (Compare-Object $actualNames $expectedNames) { throw 'Unexpected delivery contents' }
$receipt = [ordered]@{ schemaVersion = 1; ok = $true; verifiedAt = (Get-Date).ToUniversalTime().ToString('o'); verifier = 'Native Windows PowerShell Get-FileHash'; destination = $destination; files = $verified; candidateRun = '39543872402'; sourceCommit = $metadata.source.commit; candidateExecuted = $false; installed = $false; hookTrustChanged = $false }
Write-Output ('BOXBOX_REMOTE_VERIFIED ' + ($receipt | ConvertTo-Json -Depth 8 -Compress))
