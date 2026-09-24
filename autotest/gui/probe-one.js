'use strict';
// probe-one.js — 单轮 fresh cli auto 探活（session 2）；脚本内轮询，输出一行结论。
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const OUT = PROJECT + '\\autotest\\output\\gui';
const PORT = parseInt(process.argv[2] || '9651', 10);
const CLI_DIR = 'C:\\Program Files (x86)\\Tencent';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function discoverCli() {
  for (const d of fs.readdirSync(CLI_DIR)) {
    const cand = path.join(CLI_DIR, d, 'cli.bat');
    if (fs.existsSync(cand)) return cand;
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
function killTree(pid) {
  try { cp.execSync('taskkill /PID ' + pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {}
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const CLI = discoverCli();
  const logFile = path.join(OUT, 'cli-auto-probe-' + PORT + '.log');
  const lf = fs.openSync(logFile, 'w');
  let child;
  try {
    child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + PORT,
      { shell: true, stdio: ['ignore', lf, lf], windowsHide: true });
  } finally { try { lf.close(); } catch (e) {} }

  const t0 = Date.now();
  let up = false, logTxt = '';
  while (Date.now() - t0 < 150000) {
    up = await listening(PORT);
    try { logTxt = fs.readFileSync(logFile, 'utf8'); } catch (e) {}
    if (up && /Using AppID/.test(logTxt)) break;
    await sleep(2000);
  }
  let connectInfo = 'not attempted';
  if (up) {
    await sleep(2000);
    const SDK = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
    const automator = require(SDK);
    let mp = null, err = null;
    for (let i = 0; i < 5 && !mp; i++) {
      try { mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT }); }
      catch (e) { err = e; await sleep(2000); }
    }
    if (mp) {
      try {
        await mp.checkVersion();
        await mp.reLaunch('/pages/index/index').catch(() => {});
        let pathSeen = '', keys = 0;
        const w0 = Date.now();
        while (Date.now() - w0 < 60000) {
          try {
            const pg = await mp.currentPage();
            pathSeen = pg.path;
            const dd = await pg.data();
            keys = Object.keys(dd || {}).length;
            if (pathSeen === 'pages/index/index' && keys > 5) break;
          } catch (e) {}
          await sleep(1500);
        }
        connectInfo = 'connected path=' + pathSeen + ' dataKeys=' + keys;
      } finally { try { await mp.disconnect(); } catch (e) {} }
    } else connectInfo = 'connect failed: ' + (err && err.message);
  }
  killTree(child.pid);
  await sleep(2000);
  console.log('PROBE port=' + PORT + ' listen=' + up + ' ' + connectInfo);
  process.exit(0);
})().catch(e => { console.log('PROBE FATAL ' + (e && e.message || e)); process.exit(1); });
