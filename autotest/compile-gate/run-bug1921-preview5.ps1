$ErrorActionPreference = 'Continue'
$cli = (Get-ChildItem 'C:\Program Files (x86)\Tencent\*\cli.bat' | Select-Object -First 1).FullName
$proj = 'C:\Users\Administrator\Desktop\Wechat projects\pension'
$d = Join-Path $proj 'autotest\compile-gate\logs'
New-Item -ItemType Directory -Force $d | Out-Null
$log = Join-Path $d 'dev-bug1921-preview5.log'

& $cli preview --project $proj *>&1 | Tee-Object -FilePath $log | Out-Null
$code = $LASTEXITCODE
Set-Content -Path (Join-Path $d 'dev-bug1921-preview5.exit') -Value $code -Encoding ascii
$txt = [IO.File]::ReadAllText($log)
Write-Output ('exitCode=' + $code)
Write-Output ('logLen=' + $txt.Length)
Write-Output ('hasQR=' + ($txt.Contains([char]0x2584)))
Write-Output ('hasCompileError=' + ($txt -match 'compile error'))
