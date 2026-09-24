'use strict';
/*
 * T3 CLI automation environment end-to-end verification (pension)
 * Flow: verify IDE service port -> spawn fresh `cli auto` -> wait log markers
 *       -> automator.connect -> checkVersion -> currentPage ready -> mp.screenshot
 * All evidence written to pension\autotest\output\t3\
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const cp = require('child_process');

const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const SDK_DIR = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const OUT = path.join(PROJECT, 'autotest', 'output', 't3');
const AUTO_PORT = 9583;
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const automator = require(SDK_DIR);
const sdkPkg = JSON.parse(fs.readFileSync(path.join(SDK_DIR, 'package.json'), 'utf8'));

const steps = [];
function rec(name, ok, detail) {
  steps.push({ name: name, ok: !!ok, detail: detail, at: new Date().toISOString() });
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name + ' - ' + JSON.stringify(detail));
}

function discoverCliBat() {
  const root = 'C:\\Program Files (x86)\\Tencent';
  for (const d of fs.readdirSync(root)) {
    const cand = path.join(root, d, 'cli.bat');
    if (fs.existsSync(cand)) return cand;
  }
  throw new Error('cli.bat not found under ' + root);
}

function portListening(port) {
  return new Promise(resolve => {
    const sock = net.createConnection({ port: port, host: '127.0.0.1' });
    const done = v => { try { sock.destroy(); } catch (e) {} resolve(v); };
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
    setTimeout(() => done(false), 1500);
  });
}

async function waitPort(port, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await portListening(port)) return true;
    await sleep(1000);
  }
  return false;
}

async function waitFor(logBuf, re, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (re.test(logBuf.buf)) return true;
    await sleep(1000);
  }
  return re.test(logBuf.buf);
}

function sessionId() {
  try {
    return parseInt(cp.execFileSync('powershell.exe',
      ['-NoProfile', '-Command', '(Get-Process -Id $PID).SessionId'], { encoding: 'utf8' }).trim(), 10);
  } catch (e) { return null; }
}

function validatePng(p) {
  const b = fs.readFileSync(p);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (b[i] !== sig[i]) throw new Error('bad png signature');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), bytes: b.length };
}

(async () => {
  const result = {
    task: 'T3 CLI automation env verification',
    startedAt: new Date().toISOString(),
    env: {
      host: os.hostname(), platform: os.platform(), release: os.release(),
      node: process.version, sdk: sdkPkg.version,
      cliBat: null, project: PROJECT, autoPort: AUTO_PORT, sessionId: sessionId()
    },
    steps: steps,
    ok: false
  };

  // ---- 1. cli.bat locate
  let cliBat;
  try { cliBat = discoverCliBat(); result.env.cliBat = cliBat; rec('locate cli.bat', true, cliBat); }
  catch (e) {
    rec('locate cli.bat', false, String(e.message || e));
    finish(result, OUT); process.exit(1);
  }

  // ---- 2. fresh cli auto
  const logBuf = { buf: '' };
  let cli;
  try {
    // 路径含空格：整体命令字符串 + 显式双引号，避免被拆成 'C:\Program'
    const cmdLine = '"' + cliBat + '" auto --project "' + PROJECT + '" --auto-port ' + AUTO_PORT;
    cli = cp.spawn(cmdLine, [], { shell: true });
    cli.stdout.on('data', d => { const s = d.toString(); logBuf.buf += s; });
    cli.stderr.on('data', d => { logBuf.buf += d.toString(); });
    cli.on('exit', c => { console.log('cli auto exited code=' + c); });
    rec('spawn cli auto', true, { port: AUTO_PORT, project: PROJECT });
  } catch (e) {
    rec('spawn cli auto', false, String(e.message || e));
    finish(result, OUT); process.exit(1);
  }

  // ---- 3. wait log markers: IDE server / AppID / auto
  const mIde = await waitFor(logBuf, /IDE server/i, 90000);
  rec('cli log: IDE server', mIde, '√ IDE server marker');
  const mApp = await waitFor(logBuf, /Using AppID[:\s]+\S+/i, 30000);
  let appid = null;
  const mm = logBuf.buf.match(/Using AppID[:\s]+(\S+)/i);
  if (mm) appid = mm[1];
  result.env.appid = appid;
  rec('cli log: Using AppID', mApp && !!appid, { appid: appid });
  const mAuto = await waitFor(logBuf, /\bauto\b/i, 30000);
  rec('cli log: auto', mAuto, '√ auto marker');

  // ---- 4. auto port listening（轮询等端口真正 Listen，消除标记与端口就绪竞态）
  const listenOk = await waitPort(AUTO_PORT, 30000);
  rec('auto port listening ' + AUTO_PORT, listenOk, {});
  if (!listenOk) {
    fs.writeFileSync(path.join(OUT, 'cli-auto.log'), logBuf.buf, 'utf8');
    try { cli.kill(); } catch (e) {}
    finish(result, OUT); process.exit(1);
  }

  // ---- 5. automator.connect with retries
  let mp = null; let lastErr = null;
  for (let i = 0; i < 8 && !mp; i++) {
    try { mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + AUTO_PORT }); }
    catch (e) { lastErr = e; await sleep(2000); }
  }
  rec('automator.connect', !!mp, lastErr ? String(lastErr.message || lastErr) : 'ws://127.0.0.1:' + AUTO_PORT);
  if (!mp) {
    fs.writeFileSync(path.join(OUT, 'cli-auto.log'), logBuf.buf, 'utf8');
    try { cli.kill(); } catch (e) {}
    finish(result, OUT); process.exit(1);
  }

  // ---- 6. checkVersion + 预热（playbook：connect 后预热约 10s）
  try {
    const v = await mp.checkVersion();
    rec('checkVersion', true, v);
  } catch (e) { rec('checkVersion', false, String(e.message || e)); }
  await sleep(10000);

  // ---- 7. ensure index page ready（currentPage/page.data 逐次容错，不被单次 flaky 打断）
  let page = null, pagePath = '', dataKeys = 0, relaunchTried = false;
  try {
    const t0 = Date.now();
    while (Date.now() - t0 < 70000) {
      try {
        page = await mp.currentPage();
        pagePath = page && page.path || '';
      } catch (e) {
        page = null; pagePath = '';
      }
      if (pagePath.indexOf('pages/index/index') >= 0) {
        try {
          const dd = await page.data();
          dataKeys = dd ? Object.keys(dd).length : 0;
        } catch (e) { dataKeys = 0; }
        if (dataKeys > 5) break;
      } else if (!relaunchTried && Date.now() - t0 > 6000) {
        relaunchTried = true;
        try { await mp.reLaunch('/pages/index/index'); } catch (e) {}
      }
      await sleep(1500);
    }
    rec('index page ready', pagePath.indexOf('pages/index/index') >= 0 && dataKeys > 5,
      { path: pagePath, dataKeys: dataKeys });
  } catch (e) { rec('index page ready', false, String(e.message || e)); }

  // ---- 8. native screenshot with retries (1.5s/3s/6s)；先删旧文件，保证被校验 PNG 必为本轮生成
  const shotPath = path.join(OUT, 't3-simulator.png');
  try { fs.unlinkSync(shotPath); } catch (e) {}
  let shotOk = false, shotInfo = null, shotErr = null;
  for (let i = 0; i < 3; i++) {
    try {
      await mp.screenshot({ path: shotPath });
      shotInfo = validatePng(shotPath);
      if (shotInfo.bytes > 100 * 1024) { shotOk = true; break; }
      shotErr = 'png only ' + shotInfo.bytes + ' bytes';
    } catch (e) { shotErr = String(e.message || e); }
    await sleep([1500, 3000, 6000][i] || 6000);
  }
  rec('mp.screenshot evidence', shotOk, Object.assign({ error: shotErr }, shotInfo || {}));

  // ---- cleanup
  try { await mp.disconnect(); } catch (e) {}
  await sleep(1000);
  try { cli.kill(); } catch (e) {}
  fs.writeFileSync(path.join(OUT, 'cli-auto.log'), logBuf.buf, 'utf8');

  result.finishedAt = new Date().toISOString();
  result.ok = steps.every(s => s.ok);
  fs.writeFileSync(path.join(OUT, 't3-env-verify-result.json'), JSON.stringify(result, null, 2), 'utf8');
  console.log('FINAL ok=' + result.ok);
  process.exit(result.ok ? 0 : 2);
})().catch(e => {
  const fatal = {
    task: 'T3 CLI automation env verification', fatal: String(e && e.stack || e),
    at: new Date().toISOString(), steps: steps
  };
  try { fs.writeFileSync(path.join(OUT, 't3-env-verify-result.json'), JSON.stringify(fatal, null, 2), 'utf8'); } catch (x) {}
  console.error('FATAL ' + (e && e.stack || e));
  process.exit(1);
});

function finish(result, out) {
  result.finishedAt = new Date().toISOString();
  result.ok = result.steps.every(s => s.ok);
  try { fs.writeFileSync(path.join(out, 't3-env-verify-result.json'), JSON.stringify(result, null, 2), 'utf8'); } catch (e) {}
  console.log('FINAL ok=' + result.ok);
}
