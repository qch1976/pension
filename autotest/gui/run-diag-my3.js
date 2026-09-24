'use strict';
// run-diag-my3.js — fresh cli auto port 9651 -> diag-my3-shot.js
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const GUI = PROJECT + '\\autotest\\gui';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function discoverCli() {
  const root = 'C:\\Program Files (x86)\\Tencent';
  for (const d of fs.readdirSync(root)) {
    const c = path.join(root, d, 'cli.bat');
    if (fs.existsSync(c)) return c;
  }
  throw new Error('cli.bat not found');
}
const CLI = discoverCli();
function listening(p) {
  return new Promise(res => {
    const s = net.createConnection({ port: p, host: '127.0.0.1' });
    const d = v => { try { s.destroy(); } catch (e) {} res(v); };
    s.once('connect', () => d(true)); s.once('error', () => d(false));
    setTimeout(() => d(false), 1000);
  });
}
(async () => {
  const port = 9651;
  const child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + port,
    { shell: true, stdio: 'ignore', windowsHide: true });
  const t0 = Date.now();
  while (!(await listening(port)) && Date.now()-t0 < 120000) await sleep(1200);
  await sleep(1500);
  const r = cp.spawnSync(process.execPath, ['diag-my3-shot.js'],
    { cwd: GUI, encoding: 'utf8', timeout: 180000 });
  console.log(String(r.stdout||'') + String(r.stderr||''));
  try { child.kill(); } catch (e) {}
  process.exit(r.status||0);
})();
