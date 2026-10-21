'use strict';
/* shot-fix.js — re-shoot Bug22 cleared state after the render layer settles.
 * Fresh one-shot auto port 9647, session 2 via \PensionGuiRun. */
const fs = require('fs');
const path = require('path');
const net = require('net');
const cp = require('child_process');

const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const OUT = path.join(PROJECT, 'autotest', 'output', 'gui');
const automator = require('C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = 9651;

function listening(p) {
  return new Promise(res => {
    const s = net.createConnection({ port: p, host: '127.0.0.1' });
    const d = v => { try { s.destroy(); } catch (e) {} res(v); };
    s.once('connect', () => d(true));
    s.once('error', () => d(false));
    setTimeout(() => d(false), 1200);
  });
}
async function shot(mp, name) {
  const p = path.join(OUT, name);
  try { fs.unlinkSync(p); } catch (e) {}
  for (let i = 1; i <= 3; i++) {
    try { await mp.screenshot({ path: p }); await sleep(400);
      if (fs.statSync(p).size > 40000) return { path: p, bytes: fs.statSync(p).size };
    } catch (e) { await sleep(1000 * i); }
  }
  return null;
}
async function findDeemedCard(page) {
  const cards = await page.$$('.card');
  for (const c of cards) {
    if (String(await c.text() || '').indexOf('视同缴费年限') >= 0) return c;
  }
  return null;
}

(async () => {
  const out = { dataCleared: false, hintVisible: false, shot: null, error: null };
  const wrapper = 'C:\\Users\\Administrator\\run-auto-shotfixB.bat';
  fs.writeFileSync(wrapper,
    '@echo off\r\nchcp 65001 >nul\r\nfor /d %%D in ("C:\\Program Files (x86)\\Tencent\\*") do @if exist "%%~fD\\cli.bat" "%%~fD\\cli.bat" auto --project "' + PROJECT + '" --auto-port ' + PORT + '\r\n',
    'ascii');
  const auto = cp.spawn(wrapper, [], { shell: true });
  let buf = '';
  const logF = path.join(OUT, 'cli-auto-shotfixB.log');
  const append = d => { const s = d.toString(); buf += s; fs.appendFileSync(logF, s); };
  auto.stdout.on('data', append); auto.stderr.on('data', append);
  try {
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      if (/√\s*auto/.test(buf) && /Using AppID/.test(buf) && await listening(PORT)) break;
      await sleep(1000);
    }
    const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT });
    const rr = (fn, n) => (async () => { let e; for (let i = 0; i < (n || 4); i++) { try { return await fn(); } catch (x) { e = x; await sleep(1000 * (i + 1)); } } throw e; })();
    await mp.checkVersion().catch(() => {});
    await sleep(10000); // full warmup like the main runner

    // seed legacy draft carrying MY1/2 deemed values, then launch
    await rr(() => mp.callWxMethod('clearStorageSync'));
    await rr(() => mp.reLaunch('/pages/index/index'));
    await sleep(2500);
    await rr(() => mp.callWxMethod('setStorageSync', 'pension_input_v1', {
      gender: 'male', workStartYM: '1995-07', retireYM: '2033-07',
      deemedStartYM: '1995-07', deemedEndYM: '2000-10'
    }));
    await rr(() => mp.reLaunch('/pages/index/index'));
    await sleep(6000);
    let p1 = await rr(() => mp.currentPage());
    let card = await findDeemedCard(p1);
    const opts = await rr(() => card.$$('text.opt'));
    for (const el of opts) {
      const t = String(await rr(() => el.text()) || '');
      if (t.indexOf('无视同缴费年限') >= 0) { await rr(() => el.tap()); break; }
    }
    // wait for logic layer
    const tt = Date.now();
    while (Date.now() - tt < 5000) {
      const d = await p1.data();
      if (d.hasDeemed === false && d.deemedStartYM === '' && d.deemedEndYM === '') { out.dataCleared = true; break; }
      await sleep(300);
    }
    // Persist the cleared draft, then reLaunch: the fresh page RENDERS the
    // cleared (no-deemed) state from storage, eliminating same-page frame lag.
    await rr(() => p1.callMethod('saveDraft'));
    await rr(() => mp.reLaunch('/pages/index/index'));
    await sleep(4000);
    p1 = await rr(() => mp.currentPage());
    const card2 = await findDeemedCard(p1);
    const txt = String(await card2.text() || '');
    out.hintVisible = txt.indexOf('无视同缴费年限（N同=0）') >= 0 &&
      txt.indexOf('视同起始年月') < 0 && txt.indexOf('视同终止年月') < 0;
    out.cardText = txt.replace(/\s+/g, ' ').slice(0, 200);
    out.shot = await shot(mp, 'bug22-cleared.png');

    await mp.disconnect();
    const t1 = Date.now();
    while (Date.now() - t1 < 8000) { if (auto.killed || auto.exitCode != null) break; await sleep(500); }
    if (auto.exitCode == null) cp.execFileSync('taskkill', ['/PID', String(auto.pid), '/T', '/F'], { stdio: 'ignore' });
  } catch (e) { out.error = String(e && e.stack || e); }

  fs.writeFileSync(path.join(OUT, 'shotfix-result.json'), JSON.stringify(out, null, 2));
  console.log('SHOTFIX dataCleared=' + out.dataCleared + ' hintVisible=' + out.hintVisible +
    ' shot=' + (out.shot && out.shot.bytes) + ' err=' + out.error);
  process.exit(0);
})();
