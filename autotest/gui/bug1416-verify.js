/* bug1416-verify.js - pension GUI real-device verification for Bug 14/15/16 + MY1/MY2 regression.
 * Delivered into session 2 via scheduled task PensionGuiRun.
 * Each stage gets a FRESH one-shot cli auto port. All polling is in-script.
 * Pure ASCII source. Output: autotest/output/gui/bug14-16-verify.json + 4 screenshots.
 */
'use strict';
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const path = require('path');

const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const GUI = path.join(PROJECT, 'autotest', 'gui');
const OUT = path.join(PROJECT, 'autotest', 'output', 'gui');
const CLI_ROOT = 'C:\\Program Files (x86)\\Tencent';
const SDK_DIR = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const IDE_PORT = 60964;
const STAGE_PORTS = { bug15: 9621, bug16err: 9623, my1: 9625, my2: 9627 };
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });
const automator = require(SDK_DIR);

function discoverCli() {
  for (const d of fs.readdirSync(CLI_ROOT)) {
    const c = path.join(CLI_ROOT, d, 'cli.bat');
    if (fs.existsSync(c)) return c;
  }
  throw new Error('cli.bat not found under ' + CLI_ROOT);
}
function listening(p) {
  return new Promise(res => {
    const s = net.createConnection({ port: p, host: '127.0.0.1' });
    const done = v => { try { s.destroy(); } catch (e) {} res(v); };
    s.once('connect', () => done(true));
    s.once('error', () => done(false));
    setTimeout(() => done(false), 1200);
  });
}
async function waitPort(p, ms, want) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await listening(p) === want) return true;
    await sleep(1000);
  }
  return false;
}
function sessionId() {
  try {
    return parseInt(cp.execFileSync('powershell.exe',
      ['-NoProfile', '-Command', '(Get-Process -Id $PID).SessionId'], { encoding: 'utf8' }).trim(), 10);
  } catch (e) { return null; }
}

// ---------- recorder ----------
const assertions = [];
function rec(id, title, pass, actual, expected) {
  assertions.push({ id, title, pass: !!pass, actual: actual, expected: expected });
}
function near(id, title, actual, expected, tol) {
  const a = Number(actual);
  rec(id, title, isFinite(a) && Math.abs(a - expected) <= tol,
    isFinite(a) ? Math.round(a * 1e6) / 1e6 : actual, expected + ' +/-' + tol);
}
function snapshot() {
  const t = assertions.reduce((a, x) => { x.pass ? a.pass++ : a.fail++; return a; }, { pass: 0, fail: 0 });
  return { totals: t, assertions: assertions.slice() };
}

// ---------- helpers ----------
async function relaunchIndex(mp) {
  try { await mp.callWxMethod('clearStorageSync'); } catch (e) {}
  await mp.reLaunch('/pages/index/index').catch(() => {});
  const t0 = Date.now(); let page = null;
  while (Date.now() - t0 < 60000) {
    try {
      page = await mp.currentPage();
      if (page && page.path && page.path.indexOf('pages/index/index') >= 0) {
        const dd = await page.data();
        if (dd && Object.keys(dd).length > 5) break;
      }
    } catch (e) {}
    await sleep(800);
  }
  await sleep(500);
  return page || mp.currentPage();
}
async function textsAll(page, cls) {
  const out = [];
  let els = [];
  try { els = await page.$$(cls); } catch (e) { return out; }
  for (const el of els) { try { out.push(String(await el.text() || '')); } catch (e) {} }
  return out;
}
async function shot(mp, name) {
  const p = path.join(OUT, name);
  let lastErr = null;
  for (let i = 1; i <= 3; i++) {
    try {
      await mp.screenshot({ path: p });
      await sleep(400);
      const b = fs.statSync(p).size;
      if (b > 50000) return { path: p, bytes: b };
      lastErr = 'too small: ' + b;
    } catch (e) { lastErr = e.message; await sleep(1500 * i); }
  }
  return { path: p, bytes: 0, error: lastErr };
}
async function scrollToAnnualLedger(mp, page) {
  try { await mp.callWxMethod('pageScrollTo', { scrollTop: 0, duration: 0 }); await sleep(400); } catch (e) {}
  let target = 1700;
  try {
    const el = await page.$('.annual-table');
    if (el) {
      const r = await el.getBoundingClientRect();
      if (r && isFinite(r.top)) target = Math.max(0, Math.round(r.top - 20));
    }
  } catch (e) {}
  try { await mp.callWxMethod('pageScrollTo', { scrollTop: target, duration: 0 }); await sleep(900); } catch (e) {}
  return target;
}

// ---------- case data (My-Case.md) ----------
const hist = [
  [2000, 6142, 2], [2001, 41328], [2002, 47184], [2003, 58434], [2004, 69645],
  [2005, 81816], [2006, 95079], [2007, 105822], [2008, 116766], [2009, 130500],
  [2010, 142533], [2011, 149760], [2012, 163953], [2013, 183069], [2014, 198288],
  [2015, 220608], [2016, 243882], [2017, 266256], [2018, 291114], [2019, 293796],
  [2020, 300636], [2021, 328572], [2022, 360630], [2023, 394650], [2024, 415044],
  [2025, 426564], [2026, 287562, 8]
];
function buildSegments(z, type) {
  const segs = [];
  hist.forEach(([y, annual, mo]) => {
    const months = mo || 12;
    const base = Math.round((annual / months) * 100) / 100;
    let s, e;
    if (y === 2000) { s = '2000-11'; e = '2000-12'; }
    else if (y === 2026) { s = '2026-01'; e = '2026-08'; }
    else { s = y + '-01'; e = y + '-12'; }
    segs.push({ type: 'enterprise', startYM: s, endYM: e, baseMonthly: String(base) });
  });
  const fb = Math.round(z * 11937 * 100) / 100;
  segs.push({ type, startYM: '2026-09', endYM: '2033-06', baseMonthly: String(fb) });
  return segs;
}
function fillMyPayload(z, type) {
  return {
    gender: 'male', femaleType: 'worker',
    birthYM: '1973-07', workStartYM: '1995-07', retireYM: '2033-07',
    deemedStartYM: '1995-07', deemedEndYM: '2000-10',
    entryMode: 'month', segments: buildSegments(z, type),
    accountBalanceManual: '672920', manualBalanceYM: '2026-08', futureMonthlyRatePct: '1.5',
    doc31Eligible: true, doc31TransferYM: '2000-11', enterpriseInsuredYM: '2000-11',
    subsidyExcludedText: '', baseYearIndex: 0, cPingOverride: '', customCYearText: '',
    boundWarnings: [], errorMsg: ''
  };
}
const MY = {
  MY1: { z: 0.6, type: 'flexible', zReal: 2.4075, basic: 7800.79, account: 5797.79, trans: 870.23, total: 14468.81 },
  MY2: { z: 3.0, type: 'enterprise', zReal: 2.9095, basic: 8950.12, account: 7237.05, trans: 1051.71, total: 17238.88 }
};

// ================= Stage 1: Bug 15 =================
async function stageBug15(mp) {
  const page = await relaunchIndex(mp);
  let d = await page.data();
  rec('15-01', 'cold start entryMode = year', d.entryMode === 'year', d.entryMode, 'year');
  rec('15-02', 'cold start yearRows visible (>=1)', Array.isArray(d.yearRows) && d.yearRows.length >= 1,
    Array.isArray(d.yearRows) ? d.yearRows.length : 'n/a', '>=1');
  const segCount = (await page.$$('.seg')).length;
  rec('15-03', 'DOM year rows rendered (seg count = yearRows length)', segCount === d.yearRows.length,
    segCount, d.yearRows.length);
  const btnCount = (await page.$$('.mini-btn')).length;
  rec('15-04', 'DOM month-only buttons hidden (year mode has 1 mini-btn)', btnCount === 1, btnCount, 1);
  const yearRowsBackup = JSON.stringify(d.yearRows);

  // switch to month
  let monthOpt = await page.$('text.opt[data-v="month"]');
  await monthOpt.tap();
  await sleep(500);
  d = await page.data();
  rec('15-05', 'switch to month mode works', d.entryMode === 'month', d.entryMode, 'month');
  const monthSegs = (await page.$$('.seg')).length;
  rec('15-06', 'DOM month segments rendered', monthSegs === d.segments.length, monthSegs, d.segments.length);
  // switch back to year
  const yearOpt = await page.$('text.opt[data-v="year"]');
  await yearOpt.tap();
  await sleep(500);
  d = await page.data();
  rec('15-07', 'switch back to year mode works', d.entryMode === 'year', d.entryMode, 'year');
  rec('15-08', 'yearRows preserved across switching', JSON.stringify(d.yearRows) === yearRowsBackup,
    JSON.stringify(d.yearRows) === yearRowsBackup, true);

  // draft compatibility: old month-mode draft
  const draft = {
    entryMode: 'month',
    segments: [{ type: 'flexible', startYM: '2010-01', endYM: '2010-06', baseMonthly: '9999' }],
    yearRows: [{ year: '1999', startMonth: '3', type: 'enterprise', annualBase: '1234', months: '5' }]
  };
  await mp.callWxMethod('setStorageSync', 'pension_input_v1', draft);
  await mp.reLaunch('/pages/index/index');
  let p2 = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    try { p2 = await mp.currentPage(); if (p2.path && p2.path.indexOf('pages/index/index') >= 0 && Object.keys(await p2.data()).length > 5) break; } catch (e) {}
    await sleep(700);
  }
  d = await p2.data();
  rec('15-09', 'existing month draft entryMode restored', d.entryMode === 'month', d.entryMode, 'month');
  rec('15-10', 'draft segments data intact', !!(d.segments && d.segments[0] && d.segments[0].baseMonthly === '9999'),
    d.segments && d.segments[0] && d.segments[0].baseMonthly, '9999');
  rec('15-11', 'draft yearRows intact (not destroyed)', !!(d.yearRows && d.yearRows[0] && d.yearRows[0].annualBase === '1234' && d.yearRows[0].months === '5'),
    d.yearRows && d.yearRows[0], 'annualBase 1234 / months 5');

  // reset -> default year again
  await p2.callMethod('onReset');
  await sleep(600);
  d = await p2.data();
  rec('15-12', 'after reset entryMode defaults to year', d.entryMode === 'year', d.entryMode, 'year');

  // Bug15 is evidenced by DOM counts and switching assertions above; screenshot budget reserved
  // for the two result cases (4 total). No input-page screenshot taken.
  return { screenshot: null, note: 'no shot by budget; DOM assertions authoritative' };
}

// ================= Stage 2: Bug16 error path =================
async function stageBug16Err(mp) {
  const page = await relaunchIndex(mp); // default year mode, default row annualBase empty
  await page.callMethod('onCalculate');
  const t0 = Date.now();
  let d = await page.data();
  while (Date.now() - t0 < 3000) {
    await sleep(200);
    d = await page.data();
    if (d.calculating === false && d.errorMsg) break;
  }
  rec('16E-01', 'validation error: mask closed (calculating=false)', d.calculating === false,
    d.calculating, false);
  rec('16E-02', 'validation error: errorMsg shown', !!d.errorMsg, d.errorMsg, 'non-empty');
  const maskCount = (await page.$$('.calc-mask')).length;
  rec('16E-03', 'validation error: no mask element stuck in DOM', maskCount === 0, maskCount, 0);
  // prove page still interactive (not frozen)
  const monthOpt = await page.$('text.opt[data-v="month"]');
  await monthOpt.tap();
  await sleep(400);
  d = await page.data();
  rec('16E-04', 'after error page still interactive (tap switch works)', d.entryMode === 'month',
    d.entryMode, 'month');
  return {};
}

// ================= Bug14 assertions =================
function assertBug14(annualRows, zRealActual, tag) {
  rec(tag + '-len', 'annual ledger 42 rows (1992..2033)', annualRows.length === 42,
    annualRows.length, 42);
  const byY = {};
  annualRows.forEach(r => { byY[r.year] = r; });
  function row(y) { return byY[y]; }
  // partial-year rows
  const r2000 = row(2000);
  near(tag + '-2000z', '2000 (2mo) Z year = 2.6747 (month-avg basis)', r2000.zYear, 2.6747, 0.0001);
  rec(tag + '-2000wm', '2000 windowMonths = 2', r2000.windowMonths === 2, r2000.windowMonths, 2);
  rec(tag + '-2000p', '2000 marked partialYear', !!r2000.partialYear, !!r2000.partialYear, true);
  // full years unchanged
  near(tag + '-2001z', '2001 Z year unchanged 2.6280', row(2001).zYear, 2.628, 0.0001);
  near(tag + '-2025z', '2025 Z year unchanged 2.9779', row(2025).zYear, 2.9779, 0.0001);
  near(tag + '-2026z', '2026 Z year', row(2026).zYear, MY[tag === 'MY1' ? 'MY1' : 'MY2'].z === 0.6 ? 2.2 : 3.0, 0.0001);
  const zFuture = MY[tag === 'MY1' ? 'MY1' : 'MY2'].z;
  near(tag + '-2027z', '2027 Z year = future z', row(2027).zYear, zFuture, 0.0001);
  near(tag + '-2032z', '2032 Z year = future z', row(2032).zYear, zFuture, 0.0001);
  // 2033 partial
  near(tag + '-2033z', '2033 (6mo) Z year by actual month index (' + zFuture + ')',
    row(2033).zYear, zFuture, 0.0001);
  rec(tag + '-2033wm', '2033 windowMonths = 6', row(2033).windowMonths === 6, row(2033).windowMonths, 6);
  rec(tag + '-2033p', '2033 marked partialYear', !!row(2033).partialYear, !!row(2033).partialYear, true);
  // boundary rows
  rec(tag + '-earlynull', '1992..1995 zYear null (missing denom)',
    [1992, 1993, 1994, 1995].every(y => row(y).zYear == null),
    [1992, 1993, 1994, 1995].map(y => row(y).zYear).join(','), 'null,null,null,null');
  rec(tag + '-prezero', '1996..1999 zYear = 0',
    [1996, 1997, 1998, 1999].every(y => row(y).zYear === 0),
    [1996, 1997, 1998, 1999].map(y => row(y).zYear).join(','), '0,0,0,0');
  // reconciliation: sum(zYear*windowMonths)/392 = zReal
  let s = 0;
  annualRows.forEach(r => { if (r.zYear != null) s += r.zYear * r.windowMonths; });
  near(tag + '-recon', 'reconcile sum(Z year * windowMonths)/392 = Z real', s / 392, zRealActual, 0.0002);
  return byY;
}

// ================= Stage 3/4: MY1 / MY2 (Bug14 + Bug16 transition + regression) =================
async function stageMy(mp, tag) {
  const E = MY[tag];
  const page = await relaunchIndex(mp);
  await page.setData(fillMyPayload(E.z, E.type));
  await sleep(300);

  // ---- Bug16 transition sampling: rapid in-script polling ----
  await page.callMethod('onCalculate');
  const idxMask = [], resLoading = [];
  let switchMs = null;
  const t0 = Date.now();
  let resultPage = null;
  while (Date.now() - t0 < 9000) {
    let pg = null;
    try { pg = await mp.currentPage(); } catch (e) {}
    if (pg && pg.path) {
      let dd = null;
      try { dd = await pg.data(); } catch (e) {}
      if (pg.path.indexOf('pages/index/index') >= 0) {
        idxMask.push(dd ? !!dd.calculating : null);
      } else if (pg.path.indexOf('pages/result/result') >= 0) {
        resLoading.push(dd ? dd.pageLoading : null);
        if (switchMs == null) switchMs = Date.now() - t0;
        if (dd && dd.ready) { resultPage = pg; break; }
      }
    }
    await sleep(70);
  }
  rec(tag + '-16-01', 'mask samples captured on index before switch (>=2)', idxMask.length >= 2,
    idxMask.length, '>=2');
  rec(tag + '-16-02', 'index mask HELD until result page switch (no early dismiss)',
    idxMask.length >= 2 && idxMask.every(v => v === true), idxMask.join(','), 'all true');
  rec(tag + '-16-03', 'navigated to result page', !!resultPage, !!resultPage, true);
  rec(tag + '-16-04ms', 'time to result switch ms (info)', isFinite(switchMs), switchMs, 'info');
  const loadingSeen = resLoading.some(v => v === true);
  // The true frame is one render frame (onLoad is synchronous); 40ms polling may freeze it or honestly miss it.
  // Per playbook: when the transient cannot be frozen, rely on data assertions and report honestly.
  const idxHeld = idxMask.length >= 2 && idxMask.every(v => v === true);
  rec(tag + '-16-04', 'result loading relay: true frame observed, or honestly missed with no gap (mask held till switch)',
    loadingSeen || idxHeld,
    loadingSeen ? 'pageLoading=true frame frozen; samples=' + resLoading.join(',')
      : 'pageLoading=true frame NOT frozen (single-frame transient <40ms); index mask held till switch, ready reached without white gap; samples=' + resLoading.join(','),
    'true frozen, or missed-but-no-gap (data assertions authoritative)');

  await sleep(800);
  resultPage = resultPage || await mp.currentPage();
  let d = await resultPage.data();
  if (!d.vm) { const t1 = Date.now(); while (Date.now() - t1 < 6000) { await sleep(300); d = await resultPage.data(); if (d.vm) break; } }
  const finalMaskCount = (await resultPage.$$('.calc-mask')).length;
  rec(tag + '-16-05', 'after result first frame: pageLoading=false', d.pageLoading === false,
    d.pageLoading, false);
  rec(tag + '-16-06', 'after result first frame: mask element gone', finalMaskCount === 0,
    finalMaskCount, 0);

  // ---- regression (via ASCII vm view, page data as authority) ----
  const vp = d.vm.pension, vi = d.vm.it;
  near(tag + '-R-basic', 'J basic', vp.basic, E.basic, 0.01);
  near(tag + '-R-acct', 'J account', vp.account, E.account, 0.01);
  near(tag + '-R-trans', 'J transitional', vp.transitional, E.trans, 0.01);
  near(tag + '-R-total', 'total', d.totalDisplay, E.total, 0.01);
  near(tag + '-R-zreal', 'Z real index', vi.zReal, E.zReal, 0.0001);

  // ---- Bug14 ----
  const byY = assertBug14(d.r.annualIndex, vi.zReal, tag);

  // ---- DOM assertions on annual ledger ----
  const rowTexts = await textsAll(resultPage, '.an-row');
  const joined = rowTexts.join('\n');
  rec(tag + '-D-01', 'DOM total shows ' + E.total,
    (await textsAll(resultPage, '.total')).some(t => t.indexOf(String(E.total)) >= 0),
    'see .total', String(E.total));
  rec(tag + '-D-02', 'DOM ledger contains 2.6747 (2000 row)', joined.indexOf('2.6747') >= 0,
    joined.indexOf('2.6747') >= 0, true);
  rec(tag + '-D-03', 'DOM ledger no longer contains diluted 0.4458', joined.indexOf('0.4458') < 0,
    joined.indexOf('0.4458') < 0, true);
  // partial-year marker lives in the column (text contains the partial marker); source column also uses
  // an assume tag for assumed-denominator years, so count by marker text, not by class.
  const partialTextCount = (joined.match(/\u975e\u6574\u5e74/g) || []).length;
  rec(tag + '-D-04', 'DOM partial-year markers rendered for 2000 & 2033 (count=2)', partialTextCount === 2,
    partialTextCount, 2);

  // ---- screenshots (top + annual ledger) ----
  try { await mp.callWxMethod('pageScrollTo', { scrollTop: 0, duration: 0 }); await sleep(500); } catch (e) {}
  const sTop = await shot(mp, 'bug1416-' + tag + '-top.png');
  rec(tag + '-S-01', tag + ' result top screenshot (PNG>50KB)', sTop.bytes > 50000,
    sTop.bytes > 50000 ? sTop.bytes : (sTop.error || 'small'), 'valid PNG >50000 bytes');
  const scrollTarget = await scrollToAnnualLedger(mp, resultPage);
  const sLedger = await shot(mp, 'bug1416-' + tag + '-ledger.png');
  rec(tag + '-S-02', tag + ' annual ledger screenshot incl partial rows (scrollTop=' + scrollTarget + ')',
    sLedger.bytes > 50000, sLedger.bytes > 50000 ? sLedger.bytes : (sLedger.error || 'small'),
    'valid PNG >50000 bytes');

  return {
    screenshots: { top: sTop, ledger: sLedger },
    values: { basic: vp.basic, account: vp.account, trans: vp.transitional, total: d.totalDisplay, zReal: vi.zReal },
    annual: { '2000': byY[2000].zYear, '2001': byY[2001].zYear, '2025': byY[2025].zYear, '2027': byY[2027].zYear, '2033': byY[2033].zYear }
  };
}

// ================= runner =================
async function withAttempt(name, port, fn) {
  const CLI = discoverCli();
  const logFile = path.join(OUT, 'cli-auto-bug1416-' + name + '-' + port + '.log');
  const lf = fs.openSync(logFile, 'a');
  const child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + port,
    { shell: true, stdio: ['ignore', lf, lf], windowsHide: true });
  const up = await waitPort(port, 120000, true);
  if (!up) throw new Error('stage ' + name + ': cli auto port ' + port + ' not listening');
  await sleep(2000);
  let mp = null, out1 = null, err1 = null;
  try {
    mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + port });
    out1 = await fn(mp);
    try { await mp.close(); } catch (e) {}
  } catch (e) {
    err1 = e;
  }
  try { child.kill(); } catch (e) {}
  await waitPort(port, 20000, false);
  if (err1) throw err1;
  return out1;
}
async function withStage(name, basePort, fn) {
  // whole-stage retry: each attempt uses a FRESH one-shot cli auto port
  let lastErr = null;
  for (let a = 0; a < 2; a++) {
    try {
      const r = await withAttempt(name, basePort + a, fn);
      if (a > 0) r.retried = a;
      return r;
    } catch (e) {
      lastErr = e;
      console.log('STAGE ' + name + ' attempt ' + (a + 1) + ' failed: ' + (e && e.message));
      await sleep(3000);
    }
  }
  throw lastErr;
}

(async () => {
  const startedAt = new Date().toISOString();
  const results = { stages: {} };
  const stageErrors = {};
  function write(extra) {
    const s = snapshot();
    const data = Object.assign({
      ok: s.totals.fail === 0 && Object.keys(stageErrors).length === 0,
      suite: 'pension-bug14-16-verify',
      startedAt, finishedAt: new Date().toISOString(),
      environment: {
        host: '39.106.208.34 Windows 11', sessionId: sessionId(),
        ideServicePort: IDE_PORT, stageBaseAutoPorts: STAGE_PORTS,
        project: PROJECT
      },
      totals: s.totals, results: results.stages, stageErrors: stageErrors,
      failedAssertions: s.assertions.filter(a => !a.pass),
      assertions: s.assertions
    }, extra || {});
    fs.writeFileSync(path.join(OUT, 'bug14-16-verify.json'), JSON.stringify(data, null, 2), 'utf8');
  }
  const stages = [
    ['bug15', STAGE_PORTS.bug15, stageBug15],
    ['bug16err', STAGE_PORTS.bug16err, stageBug16Err],
    ['MY1', STAGE_PORTS.my1, mp => stageMy(mp, 'MY1')],
    ['MY2', STAGE_PORTS.my2, mp => stageMy(mp, 'MY2')]
  ];
  for (const [nm, pp, fn] of stages) {
    try {
      results.stages[nm] = await withStage(nm, pp, fn);
    } catch (e) {
      stageErrors[nm] = String(e && e.message || e);
      results.stages[nm] = { error: stageErrors[nm] };
    }
    write();
  }
  const fail = snapshot().totals.fail;
  console.log('BUG1416 VERIFY DONE fail=' + fail + ' stageErrors=' + Object.keys(stageErrors).join(','));
  process.exit(fail === 0 && Object.keys(stageErrors).length === 0 ? 0 : 2);
})();
