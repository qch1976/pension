'use strict';
// run-direct-my4.js — ONE process: owns cli auto (port 9637) AND runs the
// verify-wife.js MY4 logic in-process via require. No child node / spawnSync,
// avoiding the Node v24 0xC0000405 fail-fast seen in parent drivers.
// (MY3 already green 38/38 via verify-wife.js on 9631.)
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const GUI = PROJECT + '\\autotest\\gui';
const OUT = PROJECT + '\\autotest\\output\\gui';
const CLI_DIR = 'C:\\Program Files (x86)\\Tencent';
const PORT = 9637;
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
  const logFile = path.join(OUT, 'cli-auto-wife-MY4-direct.log');
  const lf = fs.openSync(logFile, 'a');
  const child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + PORT,
    { shell: true, stdio: ['ignore', lf, lf], windowsHide: true });
  const t0 = Date.now(); let up = false;
  while (Date.now() - t0 < 120000) { if (await listening(PORT)) { up = true; break; } await sleep(1200); }
  if (!up) { console.log('NO_PORT'); try { child.kill(); } catch (e) {} process.exit(3); }
  await sleep(2500);
  console.log('CLI_AUTO_READY');
  // make sure the cli auto process is reaped even though verify-wife.js calls process.exit
  process.on('exit', () => { try { child.kill(); } catch (e) {} });
  // hand off in-process to verify-wife.js (it reads argv[2] + GUI_AUTO_PORT and process.exits)
  process.env.GUI_AUTO_PORT = String(PORT);
  process.argv[2] = 'MY4';
  require(path.join(GUI, 'verify-wife.js'));
})();
