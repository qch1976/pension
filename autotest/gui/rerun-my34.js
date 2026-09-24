'use strict';
/*
 * rerun-my34.js — Bug22-24 fix verification: MyWife MY3 + MY4 real-device rerun.
 * Runs inside session 2 via scheduled task \PensionGuiRun.
 * Each case gets a FRESH one-shot `cli auto` (MY3=9647, MY4=9649).
 * Output: autotest/output/gui/rerun-my34.json (+ wife-MY3.json / wife-MY4.json + screenshots).
 */
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const path = require('path');

const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const GUI = PROJECT + '\\autotest\\gui';
const OUT = PROJECT + '\\autotest\\output\\gui';
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
async function waitFor(p, ms, want) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await listening(p) === want) return true; await sleep(1200); }
  return false;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const summary = { ok: false, kind: 'rerun-my34', basis: 'bug22-24 caliber-B',
    startedAt: new Date().toISOString(), cases: {}, logTail: [] };
  try {
    for (const [c, port] of [['MY3', 9647], ['MY4', 9649]]) {
      L('CASE ' + c + ' fresh cli auto port=' + port);
      const child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + port,
        { shell: true, stdio: 'ignore', windowsHide: true });
      const up = await waitFor(port, 120000, true);
      if (!up) {
        L(c + ' port never listened');
        summary.cases[c] = { ok: false, port, fatal: 'cli auto port not listening' };
        try { child.kill(); } catch (e) {}
        continue;
      }
      await sleep(1500);
      const r = cp.spawnSync(process.execPath, ['verify-wife.js', c],
        { cwd: GUI, env: Object.assign({}, process.env, { GUI_AUTO_PORT: String(port) }),
          encoding: 'utf8', timeout: 240000 });
      const tail = String((r.stdout || '') + (r.stderr || '')).trim().split(/\r?\n/).slice(-5).join(' | ');
      L(c + ' exit=' + r.status + ' ' + tail);
      try { child.kill(); } catch (e) {}
      await waitFor(port, 20000, false);
      let res = null;
      try { res = JSON.parse(fs.readFileSync(path.join(OUT, 'wife-' + c + '.json'), 'utf8')); } catch (e) {}
      summary.cases[c] = res ? {
        ok: !!res.ok, port, pass: res.totals && res.totals.pass, fail: res.totals && res.totals.fail,
        fatal: res.fatal || null,
        actuals: res.actuals, screenshots: res.screenshots,
        failedAssertions: (res.assertions || []).filter(a => !a.pass).map(a => a.id + ':' + a.title)
      } : { ok: false, port, fatal: 'no result file', tail: tail };
    }
    summary.ok = Object.values(summary.cases).every(x => x.ok);
    summary.finishedAt = new Date().toISOString();
    summary.logTail = log.slice(-40);
    fs.writeFileSync(path.join(OUT, 'rerun-my34.json'), JSON.stringify(summary, null, 2), 'utf8');
    L('ALL ok=' + summary.ok);
    process.exit(summary.ok ? 0 : 2);
  } catch (e) {
    summary.fatal = String(e && e.message || e);
    summary.finishedAt = new Date().toISOString();
    summary.logTail = log.slice(-40);
    try { fs.writeFileSync(path.join(OUT, 'rerun-my34.json'), JSON.stringify(summary, null, 2), 'utf8'); } catch (_) {}
    L('FATAL ' + (e && e.stack || e));
    process.exit(1);
  }
})();
