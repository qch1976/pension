'use strict';
// run-my4b.js — rerun MY4 with immutable evidence copies.
// One process: owns cli auto (port 9639) and requires verify-wife.js MY4 in-process.
// verify-wife writes wife-MY4-total.png / wife-MY4-annual.png; we watch and copy
// each to wife-MY4b-*.png immediately on creation so later navigation cannot
// overwrite the evidence. Copies are verified before exit.
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const GUI = PROJECT + '\\autotest\\gui';
const OUT = PROJECT + '\\autotest\\output\\gui';
const CLI_DIR = 'C:\\Program Files (x86)\\Tencent';
const PORT = 9639;
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
  for (const n of ['wife-MY4-total.png', 'wife-MY4-annual.png', 'wife-MY4b-total.png', 'wife-MY4b-annual.png']) {
    try { fs.unlinkSync(path.join(OUT, n)); } catch (e) {}
  }
  const logFile = path.join(OUT, 'cli-auto-my4b.log');
  const lf = fs.openSync(logFile, 'a');
  const child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + PORT,
    { shell: true, stdio: ['ignore', lf, lf], windowsHide: true });
  const t0 = Date.now(); let up = false;
  while (Date.now() - t0 < 120000) { if (await listening(PORT)) { up = true; break; } await sleep(1200); }
  if (!up) { console.log('NO_PORT'); try { child.kill(); } catch (e) {} process.exit(3); }
  await sleep(2500);
  process.on('exit', () => { try { child.kill(); } catch (e) {} });
  // background watcher: copy source -> immutable target on first appearance
  const copies = [['wife-MY4-total.png', 'wife-MY4b-total.png'], ['wife-MY4-annual.png', 'wife-MY4b-annual.png']];
  const watch = (async () => {
    const done = {};
    const wt = Date.now();
    while (Date.now() - wt < 300000) {
      for (const [src, dst] of copies) {
        if (done[dst]) continue;
        const sp = path.join(OUT, src), dp = path.join(OUT, dst);
        try {
          if (fs.statSync(sp).size > 40000) {
            // brief settle then byte-copy
            await sleep(300);
            fs.copyFileSync(sp, dp);
            if (fs.statSync(dp).size > 40000) { done[dst] = true; console.log('COPIED ' + dst); }
          }
        } catch (e) {}
      }
      if (copies.every(([, dst]) => done[dst])) break;
      await sleep(200);
    }
  })();
  process.env.GUI_AUTO_PORT = String(PORT);
  process.argv[2] = 'MY4';
  // verify-wife.js calls process.exit -> ensure watcher copies survive;
  // require in next microtask after watcher started
  require(path.join(GUI, 'verify-wife.js'));
})();
