'use strict';
/*
 * run-bug2526.js - Bug25/26 real-device verification driver.
 * Runs inside the active interactive session via scheduled task \PensionGuiRun.
 * Each step gets a FRESH one-shot `cli auto` (ports not reused):
 *   STRUCT=9650 MY1=9651 MY2=9652 MY3=9653 MY4=9654 MY3D=9655
 * Aggregates autotest/output/gui/bug25-26-verify.json.
 * All polling is in-script; model never polls.
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
  while (Date.now() - t0 < ms) { if (await listening(p) === want) return true; await sleep(1500); }
  return false;
}

const STEPS = [
  ['STRUCT', 9650, 'bug2526-struct.js', []],
  ['MY1', 9651, 'bug2526-case.js', ['MY1']],
  ['MY2', 9652, 'bug2526-case.js', ['MY2']],
  ['MY3', 9653, 'bug2526-case.js', ['MY3']],
  ['MY4', 9654, 'bug2526-case.js', ['MY4']],
  ['MY3D', 9655, 'bug2526-case.js', ['MY3D']]
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const summary = { ok: false, kind: 'bug25-26-verify', basis: 'pension-ui-change-design-bug25-26.md V1.8',
    startedAt: new Date().toISOString(), steps: {}, logTail: [] };
  try {
    for (const [name, port, script, args] of STEPS) {
      L('STEP ' + name + ' fresh cli auto port=' + port);
      const child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + port,
        { shell: true, stdio: 'ignore', windowsHide: true });
      // cold IDE start on first step: allow up to 200s
      const up = await waitFor(port, 200000, true);
      if (!up) {
        L(name + ' port never listened');
        summary.steps[name] = { ok: false, port, fatal: 'cli auto port not listening (IDE/active desktop?)' };
        try { child.kill(); } catch (e) {}
        if (name === 'STRUCT') break; // no point running cases if environment dead
        continue;
      }
      await sleep(2000);
      const r = cp.spawnSync(process.execPath, [script].concat(args),
        { cwd: GUI, env: Object.assign({}, process.env, { GUI_AUTO_PORT: String(port) }),
          encoding: 'utf8', timeout: 300000 });
      const tail = String((r.stdout || '') + (r.stderr || '')).trim().split(/\r?\n/).slice(-5).join(' | ');
      L(name + ' exit=' + r.status + ' ' + tail);
      try { child.kill(); } catch (e) {}
      await waitFor(port, 20000, false);
      const resFile = name === 'STRUCT' ? 'bug2526-struct.json' : 'bug2526-' + name + '.json';
      let res = null;
      try { res = JSON.parse(fs.readFileSync(path.join(OUT, resFile), 'utf8')); } catch (e) {}
      summary.steps[name] = res ? {
        ok: !!res.ok, port, pass: res.totals && res.totals.pass, fail: res.totals && res.totals.fail,
        fatal: res.fatal || null, actuals: res.actuals || null,
        screenshots: res.screenshots || res.screenshot || null,
        failedAssertions: (res.assertions || []).filter(a => !a.pass).map(a => a.id + ':' + a.title)
      } : { ok: false, port, fatal: 'no result file', tail };
    }
    const st = summary.steps;
    summary.bug25 = {
      cardsMerge: st.STRUCT && st.STRUCT.ok ?
        ['B25-cards','B25-no4-2','B25-subheads'].every(id => {
          // STRUCT details embedded only in full file; summary-level treated by ok + failed list
          return !(st.STRUCT.failedAssertions || []).some(f => f.indexOf(id) === 0);
        }) : false
    };
    summary.bug26 = {
      fieldInBasic: st.STRUCT && (st.STRUCT.failedAssertions || []).every(f => f.indexOf('B26') !== 0),
      nByEnterpriseStart: st.MY3D && st.MY3D.ok,
      doc31Unchanged: st.MY1 && st.MY1.ok && st.MY2 && st.MY2.ok
    };
    summary.ok = Object.values(summary.steps).every(x => x && x.ok);
    summary.finishedAt = new Date().toISOString();
    summary.logTail = log.slice(-40);
    fs.writeFileSync(path.join(OUT, 'bug25-26-verify.json'), JSON.stringify(summary, null, 2), 'utf8');
    L('ALL ok=' + summary.ok);
    process.exit(summary.ok ? 0 : 2);
  } catch (e) {
    summary.fatal = String(e && e.message || e);
    summary.finishedAt = new Date().toISOString();
    summary.logTail = log.slice(-40);
    try { fs.writeFileSync(path.join(OUT, 'bug25-26-verify.json'), JSON.stringify(summary, null, 2), 'utf8'); } catch (_) {}
    L('FATAL ' + (e && e.stack || e));
    process.exit(1);
  }
})();
