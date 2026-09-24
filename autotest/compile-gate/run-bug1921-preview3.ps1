$ErrorActionPreference = 'Continue'
$proj = 'C:\Users\Administrator\Desktop\Wechat projects\pension'
$cli = 'C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat'
$d = Join-Path $proj 'autotest\compile-gate\logs'
New-Item -ItemType Directory -Force $d | Out-Null

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $cli
$psi.Arguments = 'preview --project "' + $proj + '"'
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true
$proc = [System.Diagnostics.Process]::Start($psi)
$sb = { if ($proc.StandardOutput.EndOfStream) { return $null } ; return $proc.StandardOutput.ReadLine() }
$outLines = New-Object System.Collections.Generic.List[string]
while (-not $proc.HasExited -or -not $proc.StandardOutput.EndOfStream) {
  $line = $proc.StandardOutput.ReadLine()
  if ($null -ne $line) { $outLines.Add($line) }
}
$stderr = $proc.StandardError.ReadToEnd()
$proc.WaitForExit()
$code = $proc.ExitCode
$stdout = [string]::Join("`n", $outLines)
[IO.File]::WriteAllText((Join-Path $d 'dev-bug1921-preview3.log'), $stdout, (New-Object System.Text.UTF8Encoding($false)))
[IO.File]::WriteAllText((Join-Path $d 'dev-bug1921-preview3.err'), $stderr, (New-Object System.Text.UTF8Encoding($false)))
Set-Content -Path (Join-Path $d 'dev-bug1921-preview3.exit') -Value $code -Encoding ascii
Write-Output ('exitCode=' + $code)
Write-Output ('stdoutLen=' + $stdout.Length)
Write-Output ('hasQR=' + ($stdout -match '▄|█|▀'))
Write-Output ('hasCompileError=' + ($stdout -match '编译错误|编译失败'))
Write-Output '----- stderr -----'
Write-Output $stderr
Write-Output '----- tail -----'
$start = [Math]::Max(0, $outLines.Count - 12)
for ($i = $start; $i -lt $outLines.Count; $i++) { Write-Output $outLines[$i] }
