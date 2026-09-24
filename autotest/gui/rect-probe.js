'use strict';
// rect-probe.js — 用逻辑层 createSelectorQuery 取 .annual-scroll 容器与年表脚注 .warn 的真实 rect。
const fs = require('fs'), net = require('net'), cp = require('child_process'), path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const OUT = PROJECT + '\\autotest\\output\\gui';
const CLI_DIR = 'C:\\Program Files (x86)\\Tencent';
const PORT = 9794;
const SDK = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function cli() { for (const d of fs.readdirSync(CLI_DIR)) { const c = path.join(CLI_DIR, d, 'cli.bat'); if (fs.existsSync(c)) return c; } }
function listening(p) { return new Promise(res => { const s = net.createConnection({ port: p, host: '127.0.0.1' }); const d = v => { try { s.destroy(); } catch (e) {} res(v); }; s.once('connect', () => d(true)); s.once('error', () => d(false)); setTimeout(() => d(false), 1000); }); }
const hist = [[2000,6142,2],[2001,41328],[2002,47184],[2003,58434],[2004,69645],[2005,81816],[2006,95079],[2007,105822],[2008,116766],[2009,130500],[2010,142533],[2011,149760],[2012,163953],[2013,183069],[2014,198288],[2015,220608],[2016,243882],[2017,266256],[2018,291114],[2019,293796],[2020,300636],[2021,328572],[2022,360630],[2023,394650],[2024,415044],[2025,426564],[2026,287562,8]];
function segs() { const s = []; hist.forEach(([y, a, m]) => { const mo = m || 12, b = Math.round(a / mo * 100) / 100; let st, en;
  if (y === 2000) { st = '2000-11'; en = '2000-12'; } else if (y === 2026) { st = '2026-01'; en = '2026-08'; } else { st = y + '-01'; en = y + '-12'; }
  s.push({ type: 'enterprise', startYM: st, endYM: en, baseMonthly: String(b) }); });
  s.push({ type: 'flexible', startYM: '2026-09', endYM: '2033-06', baseMonthly: '7270' }); return s; }
(async () => {
  const CLI = cli();
  const lf = fs.openSync(path.join(OUT, 'cli-auto-rectprobe.log'), 'w');
  const child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + PORT,
    { shell: true, stdio: ['ignore', lf, lf], windowsHide: true });
  try {
    const t0 = Date.now();
    while (!(await listening(PORT)) && Date.now() - t0 < 120000) await sleep(1000);
    fs.closeSync(lf); await sleep(3000);
    const automator = require(SDK);
    const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT });
    await mp.checkVersion().catch(e => {});
    await mp.reLaunch('/pages/index/index').catch(e => {});
    let page = await mp.currentPage();
    const rt = Date.now();
    while (Date.now() - rt < 60000) { try { page = await mp.currentPage(); if (page.path.indexOf('pages/index/index') >= 0) { const dd = await page.data(); if (dd && Object.keys(dd).length > 5) break; } } catch (e) {} await sleep(800); }
    await page.setData({ gender: 'male', femaleType: 'worker', birthYM: '1973-07', workStartYM: '1995-07', retireYM: '2033-07',
      deemedStartYM: '1995-07', deemedEndYM: '2000-10', entryMode: 'month', segments: segs(),
      accountBalanceManual: '672920', manualBalanceYM: '2026-08', futureMonthlyRatePct: '1.5',
      doc31Eligible: true, doc31TransferYM: '2000-11', enterpriseInsuredYM: '2000-11', subsidyExcludedText: '',
      baseYearIndex: 0, cPingOverride: '', customCYearText: '', boundWarnings: [], errorMsg: '' });
    await sleep(300);
    await page.callMethod('onCalculate');
    const t2 = Date.now();
    while (Date.now() - t2 < 8000) { const rp = await mp.currentPage(); if (rp.path.indexOf('pages/result/result') >= 0) break; await sleep(500); }
    await sleep(1600);
    // 逻辑层 selectorQuery：取年表容器、年表卡(含其 .warn 脚注)
    const info = await mp.evaluate(function () {
      return new Promise(function (resolve) {
        var q = wx.createSelectorQuery();
        q.select('.annual-scroll').boundingClientRect();
        q.selectAll('.an-row').boundingClientRect();
        q.selectAll('.card').boundingClientRect();
        q.selectAll('.warn').boundingClientRect();
        q.selectViewport().scrollOffset();
        q.exec(function (res) {
          var pick = function (r) { return r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) } : null; };
          var rows = (res[1] || []).map(pick);
          var cards = (res[2] || []).map(pick);
          var warns = (res[3] || []).map(pick);
          resolve({ scroll: res[4], sv: pick(res[0]), rows: rows, cards: cards, warns: warns });
        });
      });
    });
    // 找含 annual-scroll 的卡（卡内）；其脚注 warn：top 在 sv 下方
    const svTop = info.sv && info.sv.top;
    const ledgerWarns = info.warns.filter(w => w && svTop != null && w.top > info.sv.bottom - 5).slice(0, 3);
    console.log(JSON.stringify({ sv: info.sv, scrollTop: info.scroll && info.scroll.scrollTop,
      row0: info.rows[0], row8: info.rows[8], row41: info.rows[41], rowCount: info.rows.length,
      ledgerWarns: ledgerWarns }));
    try { await mp.disconnect(); } catch (e) {}
    process.exit(0);
  } finally {
    try { cp.execSync('taskkill /PID ' + child.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {}
  }
})().catch(e => { console.log('RECT-FATAL ' + (e && e.message || e)); process.exit(1); });
