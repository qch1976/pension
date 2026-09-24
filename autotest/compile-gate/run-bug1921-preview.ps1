$ErrorActionPreference = 'Continue'
$proj = 'C:\Users\Administrator\Desktop\Wechat projects\pension'
$cli = 'C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat'
$log = Join-Path $proj 'autotest\compile-gate\logs\dev-bug1921-preview.log'
$exitf = Join-Path $proj 'autotest\compile-gate\logs\dev-bug1921-preview.exit'
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null
$p = Start-Process -FilePath $cli -ArgumentList @('preview','--project',$proj) -NoNewWindow -Wait -PassThru -RedirectStandardOutput $log -RedirectStandardError ($log + '.err')
$code = $p.ExitCode
Set-Content -Path $exitf -Value $code -Encoding ascii
$txt = [IO.File]::ReadAllText($log)
$err = ''
if (Test-Path ($log + '.err')) { $err = [IO.File]::ReadAllText($log + '.err') }
Write-Output ('exitCode=' + $code)
Write-Output ('hasQR=' + ($txt -match '二维码|QRCODE|qrCode|qr_code'))
Write-Output ('hasError=' + (($txt + $err) -match '编译错误|error|Error'))
Write-Output '----- tail -----'
$lines = $txt -split "`r?`n"
$start = [Math]::Max(0, $lines.Length - 25)
$lines[$start..($lines.Length - 1)] | ForEach-Object { Write-Output $_ }
