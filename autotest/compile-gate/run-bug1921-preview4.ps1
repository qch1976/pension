$ErrorActionPreference = 'Stop'
$proj = 'C:\Users\Administrator\Desktop\Wechat projects\pension'
$cli = (Get-ChildItem 'C:\Program Files (x86)\Tencent\*\cli.bat' | Select-Object -First 1).FullName
if (-not $cli) { Write-Output 'CLI_NOT_FOUND'; exit 9009 }
$d = Join-Path $proj 'autotest\compile-gate\logs'
New-Item -ItemType Directory -Force $d | Out-Null
$log = Join-Path $d 'dev-bug1921-preview4.log'
$errf = Join-Path $d 'dev-bug1921-preview4.err'
$exitf = Join-Path $d 'dev-bug1921-preview4.exit'

$proc = Start-Process -FilePath $cli -ArgumentList @('preview', '--project', $proj) -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $errf
$code = $proc.ExitCode
Set-Content -Path $exitf -Value $code -Encoding ascii
$txt = [IO.File]::ReadAllText($log)
$err = ''
if (Test-Path $errf) { $err = [IO.File]::ReadAllText($errf) }
Write-Output ('exitCode=' + $code)
Write-Output ('stdoutLen=' + $txt.Length)
Write-Output ('hasQR=' + ($txt -match [char]0x2584))
Write-Output ('hasCompileError=' + (($txt + $err) -match 'compile error|编译错误|编译失败'))
Write-Output '----- stderr -----'; Write-Output $err
Write-Output '----- tail -----'
$lines = $txt -split "`r?`n"
$start = [Math]::Max(0, $lines.Length - 12)
for ($i = $start; $i -lt $lines.Length; $i++) { Write-Output $lines[$i] }
