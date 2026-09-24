'use strict';
// run-bug1921.js — 每"案/尝试"一轮 FRESH 一次性 cli auto（全新端口）；脚本内轮询，模型不轮询。
// 每案最多 2 轮尝试（覆盖 automator 瞬态超时）；投递：PensionGuiRun 进 session 2。
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const GUI = PROJECT + '\\autotest\\gui';
const OUT = PROJECT + '\\autotest\\output\\gui';
const CLI_DIR = 'C:\\Program Files (x86)\\Tencent';
const BASE_PORT = 9741;
const MAX_ATTEMPTS = 2;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const L = m => { console.log(m); };

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
function killTree(pid) {
  try { cp.execSync('taskkill /PID ' + pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {}
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const CLI = discoverCli();
  const summary = { ok: false, startedAt: new Date().toISOString(), cli: CLI, ideServicePort: 60964, cases: {} };
  let portCursor = BASE_PORT;
  try {
    const cases = ['MY1', 'MY2'];
    for (const c of cases) {
      let res = null;
      const attemptsInfo = [];
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const port = portCursor++;
        try { fs.unlinkSync(path.join(OUT, 'result-bug1921-' + c + '.json')); } catch (e) {}
        L('CASE ' + c + ' attempt ' + attempt + ' fresh cli auto port=' + port);
        const logFile = path.join(OUT, 'cli-auto-bug1921-' + c + '-' + port + '.log');
        const lf = fs.openSync(logFile, 'w');
        let child = null;
        try {
          child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + port,
            { shell: true, stdio: ['ignore', lf, lf], windowsHide: true });
        } finally { try { lf.close(); } catch (e) {} }
        const up = await waitFor(port, 120000, true);
        let logOk = false;
        try { const t = fs.readFileSync(logFile, 'utf8'); logOk = /auto/.test(t) && /AppID/.test(t); } catch (e) {}
        if (!up || !logOk) {
          attemptsInfo.push({ attempt, port, fatal: up ? 'cli auto log missing auto/AppID' : 'port not listening' });
          killTree(child.pid);
          await sleep(6000);
          continue;
        }
        await sleep(2000);
        let r;
        try {
          r = cp.spawnSync(process.execPath, ['bug1921-case.js', c],
            { cwd: GUI, env: Object.assign({}, process.env, { GUI_AUTO_PORT: String(port) }),
              encoding: 'utf8', timeout: 300000 });
        } catch (e) {
          attemptsInfo.push({ attempt, port, fatal: 'spawnSync threw: ' + e.message });
          killTree(child.pid);
          await sleep(6000);
          continue;
        }
        L(c + ' attempt ' + attempt + ' exit=' + r.status + ' ' +
          String((r.stdout || '') + (r.stderr || '')).trim().split(/\r?\n/).slice(-3).join(' | '));
        killTree(child.pid);
        await waitFor(port, 20000, false);
        await sleep(6000);
        try { res = JSON.parse(fs.readFileSync(path.join(OUT, 'result-bug1921-' + c + '.json'), 'utf8')); } catch (e) {}
        attemptsInfo.push({ attempt, port, exit: r.status, ok: !!(res && res.ok),
          businessOk: res && res.businessOk, fatal: res && res.fatal });
        if (res && (res.ok || res.businessOk)) break;
      }
      summary.cases[c] = res || { ok: false, fatal: 'all attempts failed', attempts: attemptsInfo };
      summary.cases[c].attempts = attemptsInfo;
    }
    const bizGreen = c => !!(c && (c.businessOk || (c.ok && c.businessOk !== false)));
    summary.businessAllGreen = bizGreen(summary.cases.MY1) && bizGreen(summary.cases.MY2);
    summary.screenshotsAllOk = !!(summary.cases.MY1 && summary.cases.MY1.ok && summary.cases.MY2 && summary.cases.MY2.ok);
    summary.ok = summary.businessAllGreen;
    summary.finishedAt = new Date().toISOString();
    fs.writeFileSync(OUT + '\\bug19-21-verify.json', JSON.stringify(summary, null, 2), 'utf8');
    L('ALL ok=' + summary.ok);
    process.exit(summary.ok ? 0 : 2);
  } catch (e) {
    summary.fatal = String(e && e.message || e);
    try { fs.writeFileSync(OUT + '\\bug19-21-verify.json', JSON.stringify(summary, null, 2), 'utf8'); } catch (_) {}
    L('FATAL ' + (e && e.message || e));
    process.exit(1);
  }
})();
