'use strict';
// session-2 evidence capture only: desktop screenshot + window titles + ports + settings.
// Does NOT click/activate/foreground any window.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const G = require('./lib-gui.js');

const OUT = G.OUT_DIR;
const shot = path.join(OUT, 'defect-desktop-s2.png');
try { fs.unlinkSync(shot); } catch (e) {}
const ps = [
  "Add-Type -AssemblyName System.Windows.Forms,System.Drawing",
  "$b=[System.Windows.Forms.SystemInformation]::VirtualScreen",
  "$bmp=New-Object System.Drawing.Bitmap($b.Width,$b.Height)",
  "$g=[System.Drawing.Graphics]::FromImage($bmp)",
  "$g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size)",
  "$bmp.Save('" + shot + "')",
  "$g.Dispose();$bmp.Dispose()",
  "$ch=New-Object System.Drawing.Bitmap('" + shot + "')",
  "$set=New-Object 'System.Collections.Generic.HashSet[int]';$nw=0;$n=0",
  "for($y=0;$y -lt $ch.Height;$y+=4){for($x=0;$x -lt $ch.Width;$x+=4){$c=$ch.GetPixel($x,$y);$n++;[void]$set.Add((($c.R -shr 4)-bor(($c.G -shr 4)-shl 4)-bor(($c.B -shr 4)-shl 8)));if(($c.R -lt 235)-or($c.G -lt 235)-or($c.B -lt 235)){$nw++}}}",
  "$ch.Dispose()",
  "Write-Output ($b.Width.ToString()+','+$b.Height.ToString()+','+$set.Count+','+[math]::Round(100.0*$nw/$n,2))"
].join('; ');
let dim = '', shotBytes = 0, png = null;
try {
  dim = cp.execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], { encoding: 'utf8' }).trim();
  shotBytes = fs.statSync(shot).size;
  const a = dim.split(',');
  png = { width: +a[0], height: +a[1], distinctColors: +a[2], nonWhitePct: +a[3] };
} catch (e) { png = { error: e.message }; }

const ps2 = [
  "$ide=Get-Process | Where-Object { $_.ProcessName -like '*微信*' }",
  "$ports=(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -in $ide.Id } | ForEach-Object { $_.LocalPort.ToString()+':'+$_.OwningProcess }) -join ';'",
  "$wins=Get-Process | Where-Object { $_.MainWindowTitle -ne '' -and $_.SessionId -eq 2 } | ForEach-Object { $_.Id.ToString()+'|'+$_.ProcessName+'|'+$_.MainWindowTitle }",
  "Write-Output ('PORTS '+$ports)",
  "foreach($w in $wins){ Write-Output ('WIN '+$w) }"
].join('; ');
let psOut = '';
try { psOut = cp.execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps2], { encoding: 'utf8' }); } catch (e) { psOut = 'ps2err ' + e.message; }

// .ide/.cli + security setting
const base = path.join(process.env.LOCALAPPDATA, '微信开发者工具', 'User Data', '2ca4252ffa87560ea1fd48b913e45179', 'Default');
const files = {};
for (const n of ['.ide', '.cli']) {
  const fp = path.join(base, n);
  try { files[n] = fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8').trim() : null; } catch (e) { files[n] = 'err'; }
}
// hunt settings for security/service port switch
let settingHits = [];
try {
  const cand = [
    path.join(base, 'settings.json'),
    path.join(process.env.APPDATA, '微信开发者工具', 'User Data', '2ca4252ffa87560ea1fd48b913e45179', 'Default', 'settings.json')
  ];
  for (const c of cand) {
    if (fs.existsSync(c)) {
      const t = fs.readFileSync(c, 'utf8');
      for (const m of t.matchAll(/"[^"]*(?:security|cli|port|auto)[^"]*"\s*:\s*[^,}]+/gi)) settingHits.push(c.split(path.sep).pop() + ': ' + m[0].slice(0, 120));
    }
  }
} catch (e) {}

const result = {
  ok: true, case: 'evidence', at: new Date().toISOString(), sessionId: G.sessionId(),
  screenshot: { path: shot, bytes: shotBytes, png },
  ideCliFiles: files, settingHits, psOut
};
fs.writeFileSync(path.join(OUT, 'result-evidence.json'), JSON.stringify(result, null, 2), 'utf8');
process.exit(0);
