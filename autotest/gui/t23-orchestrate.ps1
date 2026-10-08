# t23-orchestrate.ps1 : Tester robust independent Phase-1 GUI regression.
# Serialization gate: each case gets a non-overlapping port band; after each case we
# WAIT for its band to fully close (IDE automation-channel release lag) before next case.
$ErrorActionPreference = 'Continue'
$env:NODE_PATH = 'C:\Users\Administrator\wechat-automation\node_modules'
$proj = 'C:\Users\Administrator\Desktop\Wechat projects\pension'
$gui  = Join-Path $proj 'autotest\gui'
$out  = Join-Path $proj 'autotest\output\t23-gui'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$agg = Join-Path $out 'orchestrate.log'
Set-Content -Path $agg -Value ('START ' + (Get-Date -Format o))

function Test-BandQuiet($base) {
  foreach ($p in @($base, ($base + 100), ($base + 200))) {
    if (Get-NetTCPConnection -State Listen -LocalPort $p -EA SilentlyContinue) { return $false }
  }
  return $true
}
function Wait-BandQuiet($base, $timeoutSec) {
  $t0 = Get-Date
  while (-not (Test-BandQuiet $base)) {
    if (((Get-Date) - $t0).TotalSeconds -gt $timeoutSec) { return $false }
    Start-Sleep -Seconds 3
  }
  return $true
}

$total = 9
$results = @()
for ($i = 0; $i -lt $total; $i++) {
  $base = 61301 + ($i * 300)          # non-overlapping bands
  $caseLog = Join-Path $out ("case$i.log")
  Add-Content -Path $agg -Value ("--- CASE $i begin base=$base " + (Get-Date -Format o))
  & node (Join-Path $gui 't23-gui-regression.js') $i $base *> $caseLog
  $code = $LASTEXITCODE
  $results += $code
  Add-Content -Path $agg -Value ("CASE $i exit=$code " + (Get-Date -Format o))
  $quiet = Wait-BandQuiet $base 120
  Add-Content -Path $agg -Value ("CASE $i bandReleased=$quiet " + (Get-Date -Format o))
  Start-Sleep -Seconds 2
}
Add-Content -Path $agg -Value ('RESULTS ' + (($results | ForEach-Object { [string]$_ }) -join ','))
Add-Content -Path $agg -Value ('END ' + (Get-Date -Format o))

$shots = @('A1-shared-cutoff-toast.png','B1-too-few-plans-toast.png','C0-compare-input.png',
  'C1-result-table.png','C2-components-expanded.png','C3-css-bars.png','C5-drill-cashflow.png',
  'C6-policy-sheet.png','D1-grey-blocked-roi.png')
$manifest = @()
foreach ($s in $shots) {
  $p = Join-Path $out $s
  $bytes = 0
  if (Test-Path $p) { $bytes = (Get-Item $p).Length }
  $manifest += [pscustomobject]@{ file=$s; bytes=$bytes }
}
$manifest | ConvertTo-Json | Set-Content (Join-Path $out 'shots.json')
Write-Output 'T23_ORCHESTRATE_DONE'
