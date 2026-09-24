'use strict';
// run-mycases.js — per-case FRESH one-shot cli auto (independent ports). 2026-09-21 rerun.
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const GUI = PROJECT + '\\autotest\\gui';
const OUT = PROJECT + '\\autotest\\output\\gui';
const CLI_DIR = 'C:\\Program Files (x86)\\Tencent';
const BASE_PORT = 9611;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
const L = m => { log.push(m); console.log(m); };

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
async function waitFor(p, ms, want) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await listening(p) === want) return true; await sleep(1200); }
  return false;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const CLI = discoverCli();
  const summary = { ok: false, startedAt: new Date().toISOString(), cli: CLI, cases: {} };
  try {
    const cases = ['MY1', 'MY2'];
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i], port = BASE_PORT + i;
      // clean stale artifacts
      for (const f of ['result-' + c + '.json', c + '-result.png', c + '-result-mid.png']) {
        try { fs.unlinkSync(path.join(OUT, f)); } catch (e) {}
      }
      L('CASE ' + c + ' fresh cli auto port=' + port);
      const logFile = path.join(OUT, 'cli-auto-' + c + '.log');
      const lf = fs.openSync(logFile, 'a');
      const child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + port,
        { shell: true, stdio: ['ignore', lf, lf], windowsHide: true });
      const up = await waitFor(port, 120000, true);
      if (!up) { summary.cases[c] = { ok: false, fatal: 'port not listening' }; try { child.kill(); } catch (e) {} continue; }
      await sleep(2000);
      const r = cp.spawnSync(process.execPath, ['mycases.js', c],
        { cwd: GUI, env: Object.assign({}, process.env, { GUI_AUTO_PORT: String(port) }),
          encoding: 'utf8', timeout: 240000 });
      L(c + ' exit=' + r.status + ' ' + String((r.stdout || '') + (r.stderr || '')).trim().split(/\r?\n/).slice(-3).join(' | '));
      try { child.kill(); } catch (e) {}
      await waitFor(port, 20000, false);
      let res = null;
      try { res = JSON.parse(fs.readFileSync(path.join(OUT, 'result-' + c + '.json'), 'utf8')); } catch (e) {}
      summary.cases[c] = res;
    }
    summary.ok = summary.cases.MY1 && summary.cases.MY1.ok && summary.cases.MY2 && summary.cases.MY2.ok;
    summary.finishedAt = new Date().toISOString();
    fs.writeFileSync(OUT + '\\MY-cases-summary.json', JSON.stringify(summary, null, 2), 'utf8');
    L('ALL ok=' + summary.ok);
    process.exit(summary.ok ? 0 : 2);
  } catch (e) {
    summary.fatal = String(e && e.message || e);
    try { fs.writeFileSync(OUT + '\\MY-cases-summary.json', JSON.stringify(summary, null, 2), 'utf8'); } catch (_) {}
    L('FATAL ' + (e && e.message || e));
    process.exit(1);
  }
})();
