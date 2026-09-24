'use strict';
// run-wife-my4.js — minimal single-case runner for MY4 (fresh cli auto, port 9635).
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const GUI = PROJECT + '\\autotest\\gui';
const OUT = PROJECT + '\\autotest\\output\\gui';
const CLI_DIR = 'C:\\Program Files (x86)\\Tencent';
const PORT = 9635;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function discoverCli() {
  for (const d of fs.readdirSync(CLI_DIR)) {
    const c = path.join(CLI_DIR, d, 'cli.bat');
    if (fs.existsSync(c)) return c;
  }
  throw new Error('cli.bat not found');
}
function listening(p) {
  return new Promise(res => {
    const s = net.createConnection({ port: p, host: '127.0.0.1' });
    const d = v => { try { s.destroy(); } catch (e) {} res(v); };
    s.once('connect', () => d(true)); s.once('error', () => d(false));
    setTimeout(() => d(false), 1000);
  });
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const CLI = discoverCli();
  try { fs.unlinkSync(path.join(OUT, 'wife-MY4.json')); } catch (e) {}
  const logFile = path.join(OUT, 'cli-auto-wife-MY4.log');
  const lf = fs.openSync(logFile, 'a');
  const child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + PORT,
    { shell: true, stdio: ['ignore', lf, lf], windowsHide: true });
  const t0 = Date.now(); let up = false;
  while (Date.now() - t0 < 120000) { if (await listening(PORT)) { up = true; break; } await sleep(1200); }
  if (!up) { console.log('NO_PORT'); try { child.kill(); } catch (e) {} process.exit(3); }
  await sleep(2000);
  const r = cp.spawnSync(process.execPath, ['verify-wife.js', 'MY4'],
    { cwd: GUI, env: Object.assign({}, process.env, { GUI_AUTO_PORT: String(PORT) }),
      encoding: 'utf8', timeout: 360000 });
  console.log('exit=' + r.status);
  try { child.kill(); } catch (e) {}
  let res = null;
  try { res = JSON.parse(fs.readFileSync(path.join(OUT, 'wife-MY4.json'), 'utf8')); } catch (e) {}
  console.log('MY4 ok=' + (res && res.ok) + ' pass=' + (res && res.totals.pass) +
    ' fail=' + (res && res.totals.fail) + ' fatal=' + (res && res.fatal));
  process.exit(res && res.ok ? 0 : 2);
})();
