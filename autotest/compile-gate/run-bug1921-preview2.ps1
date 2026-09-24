$ErrorActionPreference = 'Continue'
$proj = 'C:\Users\Administrator\Desktop\Wechat projects\pension'
$cli = 'C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat'
$log = Join-Path $proj 'autotest\compile-gate\logs\dev-bug1921-preview2.log'
$exitf = Join-Path $proj 'autotest\compile-gate\logs\dev-bug1921-preview2.exit'
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'cmd.exe'
$psi.Arguments = '/s /c ""' + $cli + '" preview --project "' + $proj + '""'
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true
$proc = [System.Diagnostics.Process]::Start($psi)
$stdout = $proc.StandardOutput.ReadToEnd()
$stderr = $proc.StandardError.ReadToEnd()
$proc.WaitForExit()
$code = $proc.ExitCode
[IO.File]::WriteAllText($log, $stdout, (New-Object System.Text.UTF8Encoding($false)))
Set-Content -Path $exitf -Value $code -Encoding ascii
Write-Output ('exitCode=' + $code)
Write-Output ('hasQR=' + ($stdout -match '▄|█|▀'))
Write-Output ('hasCompileError=' + ($stdout -match '编译错误'))
Write-Output ('stderrLen=' + $stderr.Length)
Write-Output '----- tail -----'
$lines = $stdout -split "`r?`n"
$start = [Math]::Max(0, $lines.Length - 12)
$lines[$start..($lines.Length - 1)] | ForEach-Object { Write-Output $_ }
