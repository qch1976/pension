# phase1-orchestrate.ps1 : run all 9 GUI cases serially in the interactive session.
# Each case = fresh cli auto (own port 61001+i) + own process/connection. Log + aggregate.
$ErrorActionPreference = 'Continue'
$env:NODE_PATH = 'C:\Users\Administrator\wechat-automation\node_modules'
$proj = 'C:\Users\Administrator\Desktop\Wechat projects\pension'
$gui  = Join-Path $proj 'autotest\gui'
$out  = Join-Path $proj 'autotest\output\phase1-gui'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$agg = Join-Path $out 'orchestrate.log'
Set-Content -Path $agg -Value ('START ' + (Get-Date -Format o))

$total = 9
$results = @()
for ($i = 0; $i -lt $total; $i++) {
  $caseLog = Join-Path $out ("case$i.log")
  Add-Content -Path $agg -Value ("--- CASE $i begin " + (Get-Date -Format o))
  & node (Join-Path $gui 'phase1-gui-regression.js') $i *> $caseLog
  $code = $LASTEXITCODE
  $results += $code
  Add-Content -Path $agg -Value ("CASE $i exit=$code")
  Start-Sleep -Seconds 4
}
Add-Content -Path $agg -Value ('RESULTS ' + (($results | ForEach-Object { [string]$_ }) -join ','))
Add-Content -Path $agg -Value ('END ' + (Get-Date -Format o))

# verify all expected screenshots non-empty
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
Write-Output 'ORCHESTRATE_DONE'
