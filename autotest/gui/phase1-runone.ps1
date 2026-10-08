# Run ONE GUI case in interactive session; index read from C:\Users\Administrator\d9case.txt
$ErrorActionPreference = 'Continue'
$env:NODE_PATH = 'C:\Users\Administrator\wechat-automation\node_modules'
$proj = 'C:\Users\Administrator\Desktop\Wechat projects\pension'
$gui  = Join-Path $proj 'autotest\gui'
$out  = Join-Path $proj 'autotest\output\phase1-gui'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$idx  = (Get-Content 'C:\Users\Administrator\d9case.txt' -Raw).Trim()
$caseLog = Join-Path $out ("one$idx.log")
$doneFile = Join-Path $out ("one$idx.done")
Remove-Item $doneFile -Force -ErrorAction SilentlyContinue
& node (Join-Path $gui 'phase1-gui-regression.js') $idx *> $caseLog
$code = $LASTEXITCODE
[IO.File]::WriteAllText($doneFile, "exit=$code")
Write-Output ("ONE_DONE idx=$idx exit=$code")
