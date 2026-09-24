'use strict';
/* Self-contained pure-automator smoke. No desktop screenshot, no .ide deletion, no RDP. */
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const AUTOMATOR = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const CLI = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const OUT = PROJECT + '\\autotest\\output\\gui';
const PORT = parseInt(process.env.GUI_AUTO_PORT || '9561', 10);
const automator = require(AUTOMATOR);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
const L = m => { const s = '[' + new Date().toISOString() + '] ' + m; log.push(s); console.log(s); };

function portListening(p) {
  return new Promise(res => {
    const s = net.createConnection({ port: p, host: '127.0.0.1' });
    const d = v => { try { s.destroy(); } catch (e) {} res(v); };
    s.once('connect', () => d(true));
    s.once('error', () => d(false));
    setTimeout(() => d(false), 1200);
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const result = { ok: false, case: 'final-smoke', port: PORT, startedAt: new Date().toISOString() };
  let child = null;
  try {
    if (!(await portListening(PORT))) {
      L('starting cli auto port=' + PORT);
      child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + PORT,
        { shell: true, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      let tail = '';
      const onData = d => { tail += d.toString('utf8'); if (tail.length > 8000) tail = tail.slice(-8000);
        const line = d.toString('utf8').replace(/\s+/g, ' ').trim(); if (line) L('cli: ' + line.slice(0, 160)); };
      child.stdout.on('data', onData); child.stderr.on('data', onData);
      child.on('exit', c => L('cli child exited code=' + c));
    } else {
      L('port ' + PORT + ' already listening; attach only');
    }

    const t0 = Date.now(); let listen = false;
    while (Date.now() - t0 < 120000) { if (await portListening(PORT)) { listen = true; break; } await sleep(1500); }
    L('portListen=' + listen);
    if (!listen) throw new Error('automation port ' + PORT + ' not listening in 120s');

    let mp = null;
    const t1 = Date.now();
    while (Date.now() - t1 < 40000) {
      try { mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT }); break; }
      catch (e) { L('connect retry: ' + e.message); await sleep(2000); }
    }
    if (!mp) throw new Error('automator connect failed on ' + PORT);
    L('connected');
    try { result.checkVersion = await mp.checkVersion(); } catch (e) { L('checkVersion warn ' + e.message); }

    await mp.reLaunch('/pages/index/index').catch(e => L('reLaunch warn ' + e.message));
    let pagePath = '', keyCount = 0, dataKeys = [];
    const t2 = Date.now();
    while (Date.now() - t2 < 90000) {
      try {
        const pg = await mp.currentPage();
        pagePath = pg.path || '';
        const data = await pg.data();
        dataKeys = Object.keys(data || {});
        keyCount = dataKeys.length;
        if (pagePath.indexOf('pages/index/index') >= 0 && keyCount > 5) break;
      } catch (e) { L('ready retry: ' + e.message); }
      await sleep(3000);
    }
    L('webview path=' + pagePath + ' dataKeys=' + keyCount);

    const shot = OUT + '\\FINAL-smoke.png';
    try { fs.unlinkSync(shot); } catch (e) {}
    let shotBytes = 0;
    if (pagePath) {
      await mp.screenshot({ path: shot });
      await sleep(500);
      try { shotBytes = fs.statSync(shot).size; } catch (e) {}
    }
    L('screenshot bytes=' + shotBytes);

    const ready = pagePath.indexOf('pages/index/index') >= 0 && keyCount > 5 && shotBytes > 10240;
    Object.assign(result, {
      ok: ready, page: pagePath, dataKeys: dataKeys, dataKeyCount: keyCount,
      screenshot: shot, screenshotBytes: shotBytes, finishedAt: new Date().toISOString(), logTail: log.slice(-25)
    });
    fs.writeFileSync(OUT + '\\FINAL-smoke.json', JSON.stringify(result, null, 2), 'utf8');
    try { await mp.close(); } catch (e) {}
    L('SUMMARY ok=' + ready + ' page=' + pagePath + ' keys=' + keyCount + ' png=' + shotBytes);
    process.exit(ready ? 0 : 2);
  } catch (e) {
    result.fatal = String(e && e.message || e);
    result.finishedAt = new Date().toISOString();
    result.logTail = log.slice(-25);
    try { fs.writeFileSync(OUT + '\\FINAL-smoke.json', JSON.stringify(result, null, 2), 'utf8'); } catch (_) {}
    L('FATAL ' + (e && e.stack || e));
    process.exit(1);
  }
})();
