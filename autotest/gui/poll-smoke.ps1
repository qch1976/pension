# poll-smoke.ps1 — wait result-smoke.json, print one compact line
param([int]$TimeoutSec = 300,
      [string]$GuiDir = 'C:\Users\Administrator\Desktop\Wechat projects\pension\autotest\gui',
      [string]$OutDir = 'C:\Users\Administrator\Desktop\Wechat projects\pension\autotest\output\gui')
$deadline = (Get-Date).AddSeconds($TimeoutSec)
$f = Join-Path $OutDir 'result-smoke.json'
while ((Get-Date) -lt $deadline) {
  if (Test-Path $f) {
    try { $j = Get-Content -Raw -Encoding UTF8 $f | ConvertFrom-Json; if ($null -ne $j.ok) { break } } catch {}
  }
  Start-Sleep -Seconds 5
}
if (-not (Test-Path $f)) {
  Write-Output 'SMOKE_POLL_TIMEOUT no result-smoke.json'
  Get-Content (Join-Path $GuiDir 'job-stderr.log') -Tail 10 -ErrorAction SilentlyContinue
  exit 2
}
$j = Get-Content -Raw -Encoding UTF8 $f | ConvertFrom-Json
if ($j.fatal) {
  Write-Output ('SMOKE_FATAL ' + $j.fatal)
  $j.log | Select-Object -Last 12 | ForEach-Object { Write-Output $_ }
  exit 1
}
Write-Output ('SMOKE ok=' + $j.ok + ' port=' + $j.markers.portListen + '(' + $j.markers.port + ') checkAuto=' + $j.markers.checkAuto + ' appID=' + $j.markers.usingAppID + ' page=' + $j.page + ' dataKeys=' + $j.dataKeys.Count + ' shotBytes=' + $j.screenshotBytes + ' png=' + ($j.png | ConvertTo-Json -Compress) + ' sid=' + $j.runContext.sessionId)
if (-not $j.ok) { exit 1 }
