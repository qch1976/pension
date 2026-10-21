# poll-file.ps1 <path> <timeoutSec> [regex]
param([Parameter(Mandatory=$true)][string]$File, [Parameter(Mandatory=$true)][int]$TimeoutSec, [string]$Match = '')
$deadline = (Get-Date).AddSeconds($TimeoutSec)
$hit = $false
while ((Get-Date) -lt $deadline) {
  if (Test-Path $File) {
    try {
      $raw = Get-Content -Raw -Encoding UTF8 $File
      if ($Match -eq '' -or $raw -match $Match) { $hit = $true; break }
    } catch {}
  }
  Start-Sleep -Seconds 5
}
if (-not $hit) { Write-Output ('POLL_TIMEOUT file=' + $File); exit 2 }
$raw = Get-Content -Raw -Encoding UTF8 $File
try { ($raw | ConvertFrom-Json) | ConvertTo-Json -Compress -Depth 30 } catch { $raw }
