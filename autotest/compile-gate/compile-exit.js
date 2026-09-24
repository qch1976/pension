// Tester compile gate: run cli.bat preview via shell:true (runbook §5 verified pattern),
// capture real exit code and key progress marks. Output redirected to log file.
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const cliBat = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const projectPath = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const logPath = path.join(__dirname, 'logs', 'tester-compile-gate8.log');
fs.mkdirSync(path.dirname(logPath), { recursive: true });
const out = fs.createWriteStream(logPath);
const cmd = `"${cliBat}" preview --project "${projectPath}"`;
const child = cp.spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
let marks = { preview: false, appid: null, errorLines: [] };
child.stdout.on('data', d => {
  out.write(d);
  const t = d.toString();
  if (/√\s*preview/.test(t)) marks.preview = true;
  const m = t.match(/Using AppID:\s*(\S+)/); if (m) marks.appid = m[1];
  t.split(/\r?\n/).forEach(l => { if (/error|错误|fail/i.test(l) && !/DeprecationWarning|trace-deprecation/i.test(l)) marks.errorLines.push(l.trim().slice(0, 200)); });
});
child.stderr.on('data', d => {
  out.write(d);
  d.toString().split(/\r?\n/).forEach(l => { if (/error|错误|fail/i.test(l) && !/DeprecationWarning|trace-deprecation/i.test(l)) marks.errorLines.push(l.trim().slice(0, 200)); });
});
const timer = setTimeout(() => { console.log('TIMEOUT'); try { child.kill(); } catch (e) {} process.exit(2); }, 180000);
child.on('close', code => {
  clearTimeout(timer);
  out.end();
  const marker = { exitCode: code, previewMark: marks.preview, appid: marks.appid, errorLines: marks.errorLines.slice(0, 10) };
  fs.writeFileSync(path.join(__dirname, 'logs', 'tester-compile-gate8.exit'), JSON.stringify(marker, null, 2), 'utf8');
  console.log(JSON.stringify(marker));
  process.exit(0);
});
