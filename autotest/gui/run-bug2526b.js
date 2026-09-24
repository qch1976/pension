'use strict';
/*
 * run-bug2526b.js - partial rerun: MY1/MY2/MY4 only (STRUCT/MY3/MY3D already green).
 * Fresh one-shot ports: MY1=9661 MY2=9662 MY4=9664.
 * Merges results with existing bug25-26-verify.json and rewrites it.
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
  ['MY1', 9661], ['MY2', 9662], ['MY4', 9664]
];

(async () => {
  let merged = {};
  try { merged = JSON.parse(fs.readFileSync(path.join(OUT, 'bug25-26-verify.json'), 'utf8')); } catch (e) {}
  merged.steps = merged.steps || {};
  try {
    for (const [name, port] of STEPS) {
      L('STEP ' + name + ' fresh cli auto port=' + port);
      const child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + port,
        { shell: true, stdio: 'ignore', windowsHide: true });
      const up = await waitFor(port, 120000, true);
      if (!up) {
        L(name + ' port never listened');
        merged.steps[name] = { ok: false, port, fatal: 'cli auto port not listening' };
        try { child.kill(); } catch (e) {}
        continue;
      }
      await sleep(2000);
      const r = cp.spawnSync(process.execPath, ['bug2526-case.js', name],
        { cwd: GUI, env: Object.assign({}, process.env, { GUI_AUTO_PORT: String(port) }),
          encoding: 'utf8', timeout: 300000 });
      const tail = String((r.stdout || '') + (r.stderr || '')).trim().split(/\r?\n/).slice(-5).join(' | ');
      L(name + ' exit=' + r.status + ' ' + tail);
      try { child.kill(); } catch (e) {}
      await waitFor(port, 20000, false);
      let res = null;
      try { res = JSON.parse(fs.readFileSync(path.join(OUT, 'bug2526-' + name + '.json'), 'utf8')); } catch (e) {}
      merged.steps[name] = res ? {
        ok: !!res.ok, port, pass: res.totals && res.totals.pass, fail: res.totals && res.totals.fail,
        fatal: res.fatal || null, actuals: res.actuals || null,
        screenshot: res.screenshot || null,
        failedAssertions: (res.assertions || []).filter(a => !a.pass).map(a => a.id + ':' + a.title)
      } : { ok: false, port, fatal: 'no result file', tail };
    }
    const st = merged.steps;
    merged.bug25 = {
      cardsMerge: !!st.STRUCT && st.STRUCT.ok &&
        (st.STRUCT.failedAssertions || []).every(f => f.indexOf('B25') !== 0)
    };
    merged.bug26 = {
      fieldInBasic: !!st.STRUCT && (st.STRUCT.failedAssertions || []).every(f => f.indexOf('B26') !== 0),
      nByEnterpriseStart: !!(st.MY3D && st.MY3D.ok),
      doc31Unchanged: !!(st.MY1 && st.MY1.ok && st.MY2 && st.MY2.ok)
    };
    merged.ok = Object.values(merged.steps).every(x => x && x.ok);
    merged.finishedAt = new Date().toISOString();
    merged.logTail = log.slice(-40);
    fs.writeFileSync(path.join(OUT, 'bug25-26-verify.json'), JSON.stringify(merged, null, 2), 'utf8');
    L('ALL ok=' + merged.ok);
    process.exit(merged.ok ? 0 : 2);
  } catch (e) {
    L('FATAL ' + (e && e.stack || e));
    process.exit(1);
  }
})();
