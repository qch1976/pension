Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class WTS {
  [DllImport("wtsapi32.dll", SetLastError=true)]
  public static extern bool WTSQuerySessionInformation(IntPtr hServer, int sessionId, int wtsInfoClass, out IntPtr ppBuffer, out int pBytesReturned);
  [DllImport("wtsapi32.dll")]
  public static extern void WTSFreeMemory(IntPtr pMemory);
  [StructLayout(LayoutKind.Sequential)]
  public struct WTSINFO {
    public int State; public int SessionId; public int IncomingBytes; public int OutgoingBytes;
    public int IncomingFrames; public int OutgoingFrames; public int IncomingCompressedBytes;
    public int OutgoingCompressedBytes; public IntPtr WinStationName; public IntPtr Domain;
    public IntPtr UserName; public long ConnectTime; public long DisconnectTime;
    public long LastInputTime; public long LogonTime; public long CurrentTime;
  }
  public static int StateOf(int id) {
    IntPtr buf; int bytes;
    if (!WTSQuerySessionInformation(IntPtr.Zero, id, 24, out buf, out bytes)) return -1;
    WTSINFO info = (WTSINFO)Marshal.PtrToStructure(buf, typeof(WTSINFO));
    WTSFreeMemory(buf);
    return info.State; // WTS_SESSIONSTATE: Active=0, Connected=1, ConnectQuery=2, Shadow=3, Disconnected=4, Idle=5, Listen=6, Reset=7, Down=8, Init=9
  }
}
'@
$dir = 'C:\Users\Administrator\Desktop\Wechat projects\pension\autotest\output\gui'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$deadline = (Get-Date).AddSeconds(180)
$state = -99; $ide = $null; $listen35703 = $false; $listen37960 = $false
while ((Get-Date) -lt $deadline) {
  $state = [WTS]::StateOf(2)
  $listen35703 = [bool](Get-NetTCPConnection -State Listen -LocalPort 35703 -ErrorAction SilentlyContinue)
  $listen37960 = [bool](Get-NetTCPConnection -State Listen -LocalPort 37960 -ErrorAction SilentlyContinue)
  $owner = (Get-NetTCPConnection -State Listen -LocalPort 35703 -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
  if ($owner) { $ide = Get-Process -Id $owner -ErrorAction SilentlyContinue }
  if ($state -eq 0 -and $ide) { break }
  Start-Sleep -Seconds 5
}
$shot = Join-Path $dir 'env-desktop.png'
$shotOk = $false; $shotBytes = 0; $shotDim = ''; $shotErr = ''
try {
  $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
  $bmp.Save($shot, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  $shotBytes = (Get-Item $shot).Length
  $shotDim = "$($b.Width)x$($b.Height)"
  $chk = New-Object System.Drawing.Bitmap($shot)
  $set = New-Object 'System.Collections.Generic.HashSet[int]'; $nw = 0; $n = 0
  for ($y = 0; $y -lt $chk.Height; $y += 4) { for ($x = 0; $x -lt $chk.Width; $x += 4) { $c = $chk.GetPixel($x,$y); $n++; [void]$set.Add((($c.R -shr 4) -bor (($c.G -shr 4) -shl 4) -bor (($c.B -shr 4) -shl 8))); if (($c.R -lt 235) -or ($c.G -lt 235) -or ($c.B -lt 235)) { $nw++ } } }
  $chk.Dispose()
  $shotOk = ($shotBytes -gt 10240 -and $set.Count -gt 300 -and [math]::Round(100.0*$nw/$n,2) -gt 1)
} catch { $shotErr = $_.Exception.Message }
$ideProc = $null
if ($ide) { $ideProc = "$($ide.ProcessName)#$($ide.Id)" }
$ok = (($state -eq 0) -and [bool]$ide -and $shotOk)
$obj = [ordered]@{
  ok = $ok
  case = 'env'
  session2State = $state
  session2Active = ($state -eq 0)
  idePortOwner = $ideProc
  idePort35703Listen = $listen35703
  settingPanelPort37960Listen = $listen37960
  desktopScreenshot = $shot
  screenshotBytes = $shotBytes
  screenshotDim = $shotDim
  screenshotOk = $shotOk
  screenshotError = $shotErr
  checkedAt = (Get-Date).ToString('s')
}
$obj | ConvertTo-Json -Compress | Set-Content -Encoding UTF8 (Join-Path $dir 'result-env.json')
Write-Output ("ENV_SUMMARY ok=" + $ok + " state=" + $state + " ide=" + $ideProc + " p35703=" + $listen35703 + " p37960=" + $listen37960 + " shotBytes=" + $shotBytes + " shotOk=" + $shotOk)
