# poll-job.ps1 — wait for job-result.json state in terminal set; single-line summary
param([int]$TimeoutSec = 300, [string]$GuiDir = 'C:\Users\Administrator\Desktop\Wechat projects\pension\autotest\gui')
$deadline = (Get-Date).AddSeconds($TimeoutSec)
$last = ''
while ((Get-Date) -lt $deadline) {
  $jf = Join-Path $GuiDir 'job-result.json'
  if (Test-Path $jf) {
    try {
      $j = Get-Content -Raw -Encoding UTF8 $jf | ConvertFrom-Json
      if ($j.state -in @('done','error','detached')) {
        Write-Output ('JOB_STATE=' + $j.state + ' code=' + $j.code + ' pid=' + $j.pid + ' err=' + $j.error)
        exit 0
      }
      $last = $j.state
    } catch { $last = 'unparsed' }
  }
  Start-Sleep -Seconds 5
}
Write-Output ('POLL_TIMEOUT lastState=' + $last)
exit 2
