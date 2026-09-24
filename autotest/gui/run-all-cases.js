'use strict';
/* Driver v2: cli auto is ONE-SHOT (port dies when first WS closes). So give each case a fresh cli auto on an incrementing port. */
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const GUI = PROJECT + '\\autotest\\gui';
const OUT = PROJECT + '\\autotest\\output\\gui';
const CLI = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const BASE_PORT = 9571;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
const L = m => { const s = '[' + new Date().toISOString() + '] ' + m; log.push(s); console.log(s); };

function listening(p) {
  return new Promise(res => {
    const s = net.createConnection({ port: p, host: '127.0.0.1' });
    const d = v => { try { s.destroy(); } catch (e) {} res(v); };
    s.once('connect', () => d(true)); s.once('error', () => d(false));
    setTimeout(() => d(false), 1000);
  });
}
async function waitFor(p, ms, want) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await listening(p) === want) return true; await sleep(1200); } return false; }

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const summary = { ok: false, startedAt: new Date().toISOString(), cases: {}, logTail: [] };
  try {
    for (let i = 0; i < 5; i++) {
      const c = ['C1', 'C2', 'C3', 'C4', 'C5'][i];
      const port = BASE_PORT + i;
      L('CASE ' + c + ' fresh cli auto port=' + port);
      const child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + port,
        { shell: true, stdio: 'ignore', windowsHide: true });
      const up = await waitFor(port, 120000, true);
      if (!up) { L(c + ' port never listened'); summary.cases[c] = { ok: false, fatal: 'cli auto port not listening' }; try { child.kill(); } catch (e) {} continue; }
      await sleep(1500);
      const r = cp.spawnSync(process.execPath, ['cases.js', c],
        { cwd: GUI, env: Object.assign({}, process.env, { GUI_AUTO_PORT: String(port) }), encoding: 'utf8', timeout: 180000 });
      const tail = String((r.stdout || '') + (r.stderr || '')).trim().split(/\r?\n/).slice(-5).join(' | ');
      L(c + ' exit=' + r.status + ' ' + tail);
      try { child.kill(); } catch (e) {}
      // auto endpoint closes itself when WS disconnects; wait for release
      await waitFor(port, 20000, false);
      let res = null;
      try { res = JSON.parse(fs.readFileSync(path.join(OUT, 'result-' + c + '.json'), 'utf8')); } catch (e) {}
      summary.cases[c] = res ? {
        ok: !!res.ok, pass: res.totals && res.totals.pass, fail: res.totals && res.totals.fail,
        fatal: res.fatal || null, screenshot: res.screenshot || null,
        failedAssertions: (res.assertions || []).filter(a => !a.pass).map(a => a.id + ':' + a.title)
      } : { ok: false, fatal: 'no result file', tail: tail };
    }
    summary.ok = Object.values(summary.cases).every(x => x.ok);
    summary.finishedAt = new Date().toISOString();
    summary.logTail = log.slice(-40);
    fs.writeFileSync(OUT + '\\FINAL-cases-summary.json', JSON.stringify(summary, null, 2), 'utf8');
    L('ALL ok=' + summary.ok);
    process.exit(summary.ok ? 0 : 2);
  } catch (e) {
    summary.fatal = String(e && e.message || e);
    summary.finishedAt = new Date().toISOString();
    summary.logTail = log.slice(-40);
    try { fs.writeFileSync(OUT + '\\FINAL-cases-summary.json', JSON.stringify(summary, null, 2), 'utf8'); } catch (_) {}
    L('FATAL ' + (e && e.stack || e));
    process.exit(1);
  }
})();
