'use strict';
// shot-one.js — 一次 fresh cli auto：重新测算，定位，立即截一张。参数: <MY1|MY2> <total|ledgerhead|ledgertail> <outfile> <port>
const fs = require('fs'), net = require('net'), cp = require('child_process'), path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const OUT = PROJECT + '\\autotest\\output\\gui';
const CLI_DIR = 'C:\\Program Files (x86)\\Tencent';
const SDK = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const CASE = process.argv[2], WHERE = process.argv[3], OUTFILE = process.argv[4], PORT = parseInt(process.argv[5], 10);
const CARD_SCROLL = parseInt(process.argv[6] || '1300', 10); // 年表卡所在 scrollTop（固定值，稳定不崩）
const sleep = ms => new Promise(r => setTimeout(r, ms));
function cli() { for (const d of fs.readdirSync(CLI_DIR)) { const c = path.join(CLI_DIR, d, 'cli.bat'); if (fs.existsSync(c)) return c; } }
function listening(p) { return new Promise(res => { const s = net.createConnection({ port: p, host: '127.0.0.1' }); const d = v => { try { s.destroy(); } catch (e) {} res(v); }; s.once('connect', () => d(true)); s.once('error', () => d(false)); setTimeout(() => d(false), 1000); }); }
const hist = [[2000,6142,2],[2001,41328],[2002,47184],[2003,58434],[2004,69645],[2005,81816],[2006,95079],[2007,105822],[2008,116766],[2009,130500],[2010,142533],[2011,149760],[2012,163953],[2013,183069],[2014,198288],[2015,220608],[2016,243882],[2017,266256],[2018,291114],[2019,293796],[2020,300636],[2021,328572],[2022,360630],[2023,394650],[2024,415044],[2025,426564],[2026,287562,8]];
function segs(z, type) {
  const s = [];
  hist.forEach(([y, a, m]) => { const mo = m || 12, b = Math.round(a / mo * 100) / 100; let st, en;
    if (y === 2000) { st = '2000-11'; en = '2000-12'; } else if (y === 2026) { st = '2026-01'; en = '2026-08'; } else { st = y + '-01'; en = y + '-12'; }
    s.push({ type: 'enterprise', startYM: st, endYM: en, baseMonthly: String(b) }); });
  s.push({ type, startYM: '2026-09', endYM: '2033-06', baseMonthly: z === 0.6 ? '7270' : '36348' });
  return s;
}
function payload(z, type) {
  return { gender: 'male', femaleType: 'worker', birthYM: '1973-07', workStartYM: '1995-07', retireYM: '2033-07',
    deemedStartYM: '1995-07', deemedEndYM: '2000-10', entryMode: 'month', segments: segs(z, type),
    accountBalanceManual: '672920', manualBalanceYM: '2026-08', futureMonthlyRatePct: '1.5',
    doc31Eligible: true, doc31TransferYM: '2000-11', enterpriseInsuredYM: '2000-11', subsidyExcludedText: '',
    baseYearIndex: 0, cPingOverride: '', customCYearText: '', boundWarnings: [], errorMsg: '' };
}
(async () => {
  const z = CASE === 'MY1' ? 0.6 : 3.0, type = CASE === 'MY1' ? 'flexible' : 'enterprise';
  const CLI = cli();
  const lf = fs.openSync(path.join(OUT, 'cli-auto-shotone-' + PORT + '.log'), 'w');
  const child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + PORT,
    { shell: true, stdio: ['ignore', lf, lf], windowsHide: true });
  try {
    const t0 = Date.now();
    while (!(await listening(PORT)) && Date.now() - t0 < 120000) await sleep(1000);
    fs.closeSync(lf);
    await sleep(3000);
    const automator = require(SDK);
    const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT });
    await mp.checkVersion().catch(e => {});
    await mp.reLaunch('/pages/index/index').catch(e => {});
    let page = await mp.currentPage();
    const rt = Date.now();
    while (Date.now() - rt < 60000) { try { page = await mp.currentPage(); if (page.path.indexOf('pages/index/index') >= 0) { const dd = await page.data(); if (dd && Object.keys(dd).length > 5) break; } } catch (e) {} await sleep(800); }
    await page.setData(payload(z, type));
    await sleep(300);
    await page.callMethod('onCalculate');
    let rp = null;
    const t2 = Date.now();
    while (Date.now() - t2 < 8000) { rp = await mp.currentPage(); if (rp.path.indexOf('pages/result/result') >= 0) break; await sleep(500); }
    await sleep(1600);
    if (!rp.path || rp.path.indexOf('pages/result/result') < 0) throw new Error('no result page');
    // 定位年表卡真实位置；返回 {top,height}
    async function annualCard() {
      try { await mp.callWxMethod('pageScrollTo', { scrollTop: 0, duration: 0 }); } catch (e) {}
      await sleep(800);
      const p = await mp.currentPage();
      const sv = await p.$('.annual-scroll');
      if (!sv) return null;
      const box = await sv.boundingBox();
      if (!box) return null;
      return { top: Math.max(0, Math.round((box.top || box.y || 0) - 6)), height: box.height || 300 };
    }
    // 逻辑层实测坐标（不触发 automator meta 查询，稳定）
    async function measure() {
      return await mp.evaluate(function () {
        return new Promise(function (resolve) {
          var q = wx.createSelectorQuery();
          q.select('.annual-scroll').boundingClientRect();
          q.selectAll('.an-row').boundingClientRect();
          q.selectAll('.warn').boundingClientRect();
          q.selectViewport().scrollOffset();
          q.exec(function (res) {
            var info = wx.getSystemInfoSync();
            resolve({ sv: res[0], rows: res[1] || [], warns: res[2] || [],
              scroll: res[3], winH: info.windowHeight });
          });
        });
      });
    }
    // 定位（实测坐标）
    if (WHERE === 'total') {
      try { await mp.callWxMethod('pageScrollTo', { scrollTop: 0, duration: 0 }); } catch (e) {}
      await sleep(800);
    } else {
      const m0 = await measure();
      const docTop = m0.scroll.scrollTop;
      const svDocTop = docTop + m0.sv.top;      // 年表容器文档绝对 top
      const svH = m0.sv.height;
      if (WHERE === 'ledgerhead') {
        // 内部滚回顶部；页面滚到年表卡顶，使表头~2000行可见
        let p = await mp.currentPage(); let sv = await p.$('.annual-scroll');
        if (sv) await sv.scrollTo(0, 0);
        try { await mp.callWxMethod('pageScrollTo', { scrollTop: svDocTop - 6, duration: 0 }); } catch (e) {}
        await sleep(900);
      } else {
        // ① 先把年表卡滚入视口（对离屏 scroll-view 的滚动会被丢弃）
        try { await mp.callWxMethod('pageScrollTo', { scrollTop: svDocTop - 6, duration: 0 }); } catch (e) {}
        await sleep(800);
        // ② 年表卡可见：读真实 scrollHeight，inner=scrollHeight-svH（使末行2033贴容器底）
        let p = await mp.currentPage(); let sv = await p.$('.annual-scroll');
        if (sv) {
          const sh = await sv.scrollHeight();
          const inner = Math.round(sh - svH);
          await sv.scrollTo(0, inner);
          await sleep(900);
        }
      }
    }
    const pNow = await mp.currentPage();
    if (!pNow.path || pNow.path.indexOf('pages/result/result') < 0) throw new Error('left result after positioning');
    // 立即截图（3 次重试）
    const shotPath = path.join(OUT, OUTFILE);
    let bytes = null, err = null;
    for (let i = 1; i <= 3; i++) {
      try { await mp.screenshot({ path: shotPath }); await sleep(400); const s = fs.statSync(shotPath).size; if (s > 50000) { bytes = s; break; } err = 'small ' + s; }
      catch (e) { err = e.message; await sleep(1500 * i); }
    }
    try { await mp.disconnect(); } catch (e) {}
    console.log((bytes ? 'OK ' + bytes : 'FAIL ' + err));
    process.exit(bytes ? 0 : 2);
  } finally {
    try { cp.execSync('taskkill /PID ' + child.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {}
  }
})().catch(e => { console.log('FATAL ' + (e && e.message || e)); process.exit(1); });
