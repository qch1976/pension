'use strict';
// run-verify-output.js — fresh one-shot cli auto per case: 9821..9804.
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const GUI = PROJECT + '\\autotest\\gui';
const OUT = PROJECT + '\\autotest\\output\\gui';
const CLI_DIR = 'C:\\Program Files (x86)\\Tencent';
const BASE_PORT = 9821;
const CASES = ['OREG2'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
const L = m => { log.push(m); console.log(m); };
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
    for (let i = 0; i < CASES.length; i++) {
      const c = CASES[i], port = BASE_PORT + i;
      const resFile = path.join(OUT, 'ui-output-' + c + '.json');
      try { fs.unlinkSync(resFile); } catch (e) {}
      L('CASE ' + c + ' port=' + port);
      const logFile = path.join(OUT, 'cli-auto-out2-' + c + '.log');
      const lf = fs.openSync(logFile, 'a');
      const child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + port,
        { shell: true, stdio: ['ignore', lf, lf], windowsHide: true });
      const up = await waitFor(port, 120000, true);
      if (!up) { summary.cases[c] = { ok: false, fatal: 'no port' }; try { child.kill(); } catch (e) {} continue; }
      await sleep(2000);
      const r = cp.spawnSync(process.execPath, ['verify-output.js', c],
        { cwd: GUI, env: Object.assign({}, process.env, { GUI_AUTO_PORT: String(port) }),
          encoding: 'utf8', timeout: 360000 });
      L(c + ' exit=' + r.status + ' ' + String((r.stdout || '') + (r.stderr || '')).trim()
        .split(/\r?\n/).slice(-2).join(' | '));
      try { child.kill(); } catch (e) {}
      await waitFor(port, 20000, false);
      let res = null;
      try { res = JSON.parse(fs.readFileSync(resFile, 'utf8')); } catch (e) {}
      summary.cases[c] = res;
    }
    summary.ok = CASES.every(c => summary.cases[c] && summary.cases[c].ok);
    summary.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(OUT, 'ui-output-m2.json'),
      JSON.stringify(summary, null, 2), 'utf8');
    L('ALL ok=' + summary.ok);
    process.exit(summary.ok ? 0 : 2);
  } catch (e) {
    summary.fatal = String(e && e.message || e);
    try { fs.writeFileSync(path.join(OUT, 'ui-output-m2.json'),
      JSON.stringify(summary, null, 2), 'utf8'); } catch (_) {}
    L('FATAL ' + (e && e.message || e));
    process.exit(1);
  }
})();
