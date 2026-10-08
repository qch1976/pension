$env:NODE_PATH = 'C:\Users\Administrator\wechat-automation\node_modules'
$proj = 'C:\Users\Administrator\Desktop\Wechat projects\pension'
$gui  = Join-Path $proj 'autotest\gui'
$out  = Join-Path $proj 'autotest\output\t23-gui'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$probeLog = Join-Path $out 'probe-61041.log'
Set-Content -Path $probeLog -Value ('PROBE START ' + (Get-Date -Format o))
& node (Join-Path $gui 't23-gui-regression.js') 0 61041 *>> $probeLog
Add-Content -Path $probeLog -Value ('PROBE EXIT=' + $LASTEXITCODE + ' ' + (Get-Date -Format o))
