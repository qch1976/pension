'use strict';
// run-my4-shot.js - fresh cli auto 9667, rerun MY4 to get correct result-page shot.
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
  throw new Error('no cli');
}
const CLI = discoverCli();
function listening(p) {
  return new Promise(res => {
    const s = net.createConnection({ port: p, host: '127.0.0.1' });
    const d = v => { try { s.destroy(); } catch (e) {} res(v); };
    s.once('connect', () => d(true));
    s.once('error', () => d(false));
    setTimeout(() => d(false), 1000);
  });
}
(async () => {
  const port = 9667;
  const child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + port,
    { shell: true, stdio: 'ignore', windowsHide: true });
  let up = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    if (await listening(port)) { up = true; break; }
    await sleep(1500);
  }
  if (!up) { console.log('PORT FAIL'); try { child.kill(); } catch (e) {} process.exit(1); }
  await sleep(2000);
  const r = cp.spawnSync(process.execPath, ['bug2526-case.js', 'MY4'],
    { cwd: GUI, env: Object.assign({}, process.env, { GUI_AUTO_PORT: String(port) }), encoding: 'utf8' });
  const tail = String((r.stdout || '') + (r.stderr || '')).trim().split(/\r?\n/).slice(-3).join(' | ');
  console.log('exit=' + r.status + ' ' + tail);
  try { child.kill(); } catch (e) {}
  process.exit(r.status === 0 ? 0 : 2);
})();
