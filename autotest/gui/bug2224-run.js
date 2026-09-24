'use strict';
/*
 * bug2224-run.js — Bug22/23/24 real-device E2E verification + MY1~MY4 regression.
 * Runs inside session 2 via scheduled task \PensionGuiRun.
 * Each case gets a FRESH one-shot `cli auto` (ports 9641..9644).
 * Output: autotest/output/gui/bug22-24-verify.json + screenshots.
 */
const fs = require('fs');
const path = require('path');
const net = require('net');
const cp = require('child_process');

const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const OUT = path.join(PROJECT, 'autotest', 'output', 'gui');
const SDK = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const automator = require(SDK);
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

function discoverCli() {
  const root = 'C:\\Program Files (x86)\\Tencent';
  for (const d of fs.readdirSync(root)) {
    const c = path.join(root, d, 'cli.bat');
    if (fs.existsSync(c)) return c;
  }
  throw new Error('cli.bat not found');
}
const CLI_BAT = discoverCli();

// ---------------------------------------------------------------- payloads
const hist = [
  [2000, 6142, 2], [2001, 41328], [2002, 47184], [2003, 58434], [2004, 69645],
  [2005, 81816], [2006, 95079], [2007, 105822], [2008, 116766], [2009, 130500],
  [2010, 142533], [2011, 149760], [2012, 163953], [2013, 183069], [2014, 198288],
  [2015, 220608], [2016, 243882], [2017, 266256], [2018, 291114], [2019, 293796],
  [2020, 300636], [2021, 328572], [2022, 360630], [2023, 394650], [2024, 415044],
  [2025, 426564], [2026, 287562, 8]
];
function buildDoc31Segments(z, futureType) {
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
  const fb = z === 0.6 ? 7270 : Math.round(z * 12116);
  segs.push({ type: futureType, startYM: '2026-09', endYM: '2033-06', baseMonthly: String(fb) });
  return segs;
}
const YEAR_ROWS = [
  ['2003', '9', '4', '10000'], ['2004', '1', '12', '39000'], ['2005', '1', '7', '27892'],
  ['2006', '1', '9', '38700'], ['2007', '1', '12', '59493'], ['2008', '1', '12', '71160'],
  ['2009', '1', '12', '89202'], ['2010', '1', '12', '101340'], ['2011', '1', '12', '121005'],
  ['2012', '1', '12', '137451'], ['2013', '1', '12', '160677'], ['2014', '1', '12', '170562'],
  ['2015', '1', '12', '190428'], ['2016', '1', '12', '212370'], ['2017', '1', '12', '210678'],
  ['2018', '1', '12', '215538'], ['2019', '1', '12', '224748'], ['2020', '1', '12', '222000'],
  ['2021', '1', '12', '236418'], ['2022', '1', '12', '345994'], ['2023', '1', '12', '394650'],
  ['2024', '1', '12', '415044'], ['2025', '1', '12', '426564']
];
const toYM = idx => {
  const y = Math.floor(idx / 12), m = idx % 12 + 1;
  return y + '-' + String(m).padStart(2, '0');
};
function buildWifeSegments(futureEnd) {
  const segs = YEAR_ROWS.map(r => {
    const year = +r[0], sm = +r[1], k = +r[2], annual = +r[3];
    const startIdx = year * 12 + (sm - 1);
    return { type: 'enterprise', startYM: toYM(startIdx), endYM: toYM(startIdx + k - 1),
      baseMonthly: String(Math.round((annual / k) * 100) / 100) };
  });
  segs.push({ type: 'enterprise', startYM: '2026-01', endYM: futureEnd, baseMonthly: '36348' });
  return segs;
}
function payloadMY(which) {
  if (which === 'MY1' || which === 'MY2') {
    const p = {
      gender: 'male', femaleType: 'worker',
      birthYM: '1973-07', workStartYM: '1995-07', retireYM: '2033-07',
      hasDeemed: true, deemedStartYM: '1995-07', deemedEndYM: '2000-10',
      entryMode: 'month',
      accountBalanceManual: '672920', manualBalanceYM: '2026-08', futureMonthlyRatePct: '1.5',
      doc31Eligible: true, doc31TransferYM: '2000-11', enterpriseInsuredYM: '2000-11',
      subsidyExcludedText: '', baseYearIndex: 0, cPingOverride: '', customCYearText: '',
      boundWarnings: [], errorMsg: '', yearRows: []
    };
    p.segments = which === 'MY1' ? buildDoc31Segments(0.6, 'flexible') : buildDoc31Segments(3, 'enterprise');
    return p;
  }
  const is3 = which === 'MY3';
  return {
    gender: 'female', femaleType: 'worker',
    birthYM: '1981-07', workStartYM: '2003-09',
    retireYM: is3 ? '2031-07' : '2036-07',
    hasDeemed: false, deemedStartYM: '', deemedEndYM: '',
    entryMode: 'month',
    segments: buildWifeSegments(is3 ? '2031-06' : '2036-06'),
    yearRows: [],
    accountBalanceManual: '481459', manualBalanceYM: '2025-12', futureMonthlyRatePct: '1.5',
    doc31Eligible: false, doc31TransferYM: '', enterpriseInsuredYM: '',
    subsidyExcludedText: '', baseYearIndex: 0, cPingOverride: '', customCYearText: '',
    boundWarnings: [], errorMsg: ''
  };
}

// ---------------------------------------------------------------- expected
const EXP = {
  MY1: { port: 9641, window: ['2000-11', '2033-06'], K: 392, N: 32.6667, paid: 392,
    Nreal: 38.0, deemed: 64, M: 139, Z: 2.4032, sumZmonth: 942.0684,
    basic: 7791.06, account: 5803.0, trans: 868.7, total: 14462.76,
    Rstore: 795693.52, Rsub: 10923.92, sumZY: 78.5054,
    rows: 42, y0: 1992, y1: 2033, person: '中人',
    required: ['2000-11~2033-06', '企业批准参保月 2000-11', '78.5054', '32.6667', '2019年12个月'],
    forbidden: ['MY1', 'MY2', 'MY3', 'MY4', '2003-09', '本案无触发月层封顶'] },
  MY2: { port: 9642, window: ['2000-11', '2033-06'], K: 392, N: 32.6667, paid: 392,
    Nreal: 38.0, deemed: 64, M: 139, Z: 2.9053, sumZmonth: 1138.8657,
    basic: 8940.37, account: 7263.58, trans: 1050.17, total: 17254.12,
    Rstore: 996432.0, Rsub: 13205.91, sumZY: 94.9053,
    rows: 42, y0: 1992, y1: 2033, person: '中人',
    required: ['2000-11~2033-06', '企业批准参保月 2000-11', '94.9053', '2019年12个月'],
    forbidden: ['MY1', 'MY2', 'MY3', 'MY4', '2003-09', '本案无触发月层封顶'] },
  MY3: { port: 9643, window: ['2003-09', '2031-06'], K: 334, N: 27.8333, paid: 326,
    Nreal: 27.1667, deemed: 0, M: 195, Z: 2.3577, sumZmonth: 787.4583,
    basic: 5495.33, account: 3706.48, trans: 0, total: 9201.81,
    Rstore: 722763.05, Rprin: 191917.44, Rint: 49386.61, Rsub: 0, sumZY: 65.6215,
    rows: 40, y0: 1992, y1: 2031, person: '新人',
    required: ['2003-09~2031-06', '普通参保人员自参加工作月 2003-09', '65.6215',
      '本案无触发月层封顶的月份', '无视同缴费年限（N同=0）'],
    forbidden: ['MY1', 'MY2', 'MY3', 'MY4', '批准参保月', '32.6667', '78.5054',
      '94.9053', '3.1169', '2019年12个月'] },
  MY4: { port: 9646, window: ['2003-09', '2036-06'], K: 394, N: 32.8333, paid: 386,
    Nreal: 32.1667, deemed: 0, M: 170, Z: 2.4555, sumZmonth: 967.4583,
    basic: 6696.3, account: 5647.53, trans: 0, total: 12343.83,
    Rstore: 960080.64, Rprin: 366387.84, Rint: 112233.8, Rsub: 0, sumZY: 80.6215,
    rows: 45, y0: 1992, y1: 2036, person: '新人',
    required: ['2003-09~2036-06', '普通参保人员自参加工作月 2003-09', '80.6215',
      '本案无触发月层封顶的月份', '无视同缴费年限（N同=0）'],
    forbidden: ['MY1', 'MY2', 'MY3', 'MY4', '批准参保月', '32.6667', '78.5054',
      '94.9053', '3.1169', '2019年12个月'] }
};

// ---------------------------------------------------------------- helpers
async function rr(fn, n) {
  let e = null;
  for (let i = 0; i < (n || 3); i++) {
    try { return await fn(); } catch (x) { e = x; await sleep(600 * (i + 1)); }
  }
  throw e;
}
function listening(p) {
  return new Promise(res => {
    const s = net.createConnection({ port: p, host: '127.0.0.1' });
    const d = v => { try { s.destroy(); } catch (e) {} res(v); };
    s.once('connect', () => d(true));
    s.once('error', () => d(false));
    setTimeout(() => d(false), 1200);
  });
}
function startAuto(port) {
  const logFile = path.join(OUT, 'cli-auto-bug2224-' + port + '.log');
  try { fs.unlinkSync(logFile); } catch (e) {}
  // Robust approach: all-ASCII wrapper .bat; cli.bat is discovered at runtime
  // via for /d (its path contains spaces AND CJK, so it must never be embedded).
  const wrapper = 'C:\\Users\\Administrator\\run-auto-bug2224-' + port + '.bat';
  fs.writeFileSync(wrapper,
    '@echo off\r\nchcp 65001 >nul\r\nfor /d %%D in ("C:\\Program Files (x86)\\Tencent\\*") do @if exist "%%~fD\\cli.bat" "%%~fD\\cli.bat" auto --project "' + PROJECT + '" --auto-port ' + port + '\r\n',
    'ascii');
  const child = cp.spawn(wrapper, [], { shell: true, windowsHide: false });
  let buf = '';
  const append = d => { const s = d.toString(); buf += s; try { fs.appendFileSync(logFile, s); } catch (e) {} };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  return { child, isUp: () => /√\s*auto/.test(buf) && /Using AppID/.test(buf) };
}
async function withFreshAuto(port, fn) {
  const auto = startAuto(port);
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    if (auto.isUp() && await listening(port)) break;
    await sleep(1000);
  }
  if (!(auto.isUp() && await listening(port))) throw new Error('cli auto not ready on ' + port);
  let mp = null, err = null;
  try {
    for (let i = 0; i < 25 && !mp; i++) {
      try { mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + port }); }
      catch (e) { await sleep(1500); }
    }
    if (!mp) throw new Error('automator connect failed on ' + port);
    await mp.checkVersion().catch(() => {});
    await sleep(8000); // warmup
    await fn(mp);
  } catch (e) { err = e; }
  finally {
    try { if (mp) await mp.disconnect(); } catch (e) {}
    // cli auto exits on WS close; wait briefly then reap only our own spawned process
    const t1 = Date.now();
    while (Date.now() - t1 < 8000) { if (auto.child.killed || auto.child.exitCode != null) break; await sleep(500); }
    if (auto.child.exitCode == null) {
      try { cp.execFileSync('taskkill', ['/PID', String(auto.child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
    }
    // wait until this one-shot port is fully released so the next fresh auto can start
    const t2 = Date.now();
    while (Date.now() - t2 < 30000) {
      if (!(await listening(port))) break;
      await sleep(800);
    }
    await sleep(2000); // settle: let IDE finish closing the automation session
  }
  if (err) throw err;
}
async function relaunchIndex(mp) {
  // The simulator may resume on ANY page (result/index) from the previous auto.
  // reLaunch is idempotent; retry until the returned page is provably the live
  // index page on top of the stack (can perform an element query).
  for (let round = 0; round < 4; round++) {
    try { await mp.callWxMethod('clearStorageSync'); } catch (e) {}
    await mp.reLaunch('/pages/index/index').catch(() => {});
    const t0 = Date.now(); let page = null;
    while (Date.now() - t0 < 45000) {
      try {
        const cur = await rr(() => mp.currentPage());
        if (cur && cur.path && cur.path.indexOf('pages/index/index') >= 0) {
          const dd = await rr(() => cur.data());
          if (dd && Object.keys(dd).length > 5) {
            // prove the reference is the live top-of-stack page
            const probe = await rr(() => cur.$$('.card'));
            if (probe && probe.length) { page = cur; break; }
          }
        }
      } catch (e) {}
      await sleep(800);
    }
    if (page) { await sleep(400); return page; }
  }
  throw new Error('index page not ready / live reference unconfirmed');
}
async function calc(mp, indexPage, pl) {
  // Always re-resolve the live top-of-stack index page before mutating/calling;
  // a stale reference (resumed webview) makes onCalculate a no-op.
  let page0 = indexPage;
  try {
    const cur = await rr(() => mp.currentPage());
    if (cur && cur.path && cur.path.indexOf('pages/index/index') >= 0) page0 = cur;
  } catch (e) {}
  await rr(() => page0.setData(pl));
  await sleep(300);
  let running = false;
  for (let a = 0; a < 6 && !running; a++) {
    try {
      const cur = await rr(() => mp.currentPage());
      if (cur && cur.path && cur.path.indexOf('pages/index/index') >= 0) page0 = cur;
      await page0.callMethod('onCalculate');
    } catch (e) {}
    const ot = Date.now();
    while (Date.now() - ot < 4000) {
      const cur = await rr(() => mp.currentPage());
      if (cur.path && cur.path.indexOf('pages/result/result') >= 0) { running = true; break; }
      if (cur.path && cur.path.indexOf('pages/index/index') >= 0) {
        const dd = await rr(() => cur.data());
        if (dd.calculating) { running = true; break; }
        if (dd.errorMsg) throw new Error('blocked: ' + dd.errorMsg);
      }
      await sleep(200);
    }
  }
  if (!running) throw new Error('calc did not start');
  const t0 = Date.now(); let page = null;
  while (Date.now() - t0 < 30000) {
    page = await rr(() => mp.currentPage());
    if (page.path && page.path.indexOf('pages/result/result') >= 0) break;
    await sleep(350);
  }
  const t1 = Date.now(); let data = null;
  while (Date.now() - t1 < 20000) {
    data = await rr(() => page.data());
    if (data.ready && data.vm && data.r) break;
    await sleep(400);
  }
  if (!data.ready || !data.vm) throw new Error('result not ready');
  await sleep(700);
  return { page, data };
}
async function shot(mp, name) {
  const p = path.join(OUT, name);
  try { fs.unlinkSync(p); } catch (e) {}
  for (let i = 1; i <= 3; i++) {
    try {
      await mp.screenshot({ path: p });
      await sleep(400);
      const b = fs.statSync(p).size;
      if (b > 40000) return { path: p, name, bytes: b };
    } catch (e) { await sleep(1200 * i); }
  }
  return null;
}
async function findDeemedCard(page) {
  const cards = await rr(() => page.$$('.card'));
  for (const c of cards) {
    try { if (String(await rr(() => c.text()) || '').indexOf('视同缴费年限') >= 0) return c; } catch (e) {}
  }
  return null;
}
const num = s => s == null ? null : Number(String(s).replace(/[,¥\s]/g, ''));

function makeRec() {
  const list = [];
  return { list,
    rec: (id, t, pass, actual, expected) => list.push({ id, title: t, pass: !!pass, actual, expected }),
    near: (id, t, actual, exp, tol) => { const a = Number(actual);
      list.push({ id, title: t, pass: isFinite(a) && Math.abs(a - exp) <= tol,
        actual: Math.round(a * 1e6) / 1e6, expected: exp + ' +/-' + tol }); },
    noteChecks: [], addNoteChecks: a => { makeRec.noteArr = (makeRec.noteArr || []).concat(a); }
  };
}

// ---------------------------------------------------------------- run cases
const caseResults = {};
const bug22Checks = []; // populated in MY3 session

async function assertCase(which, rec, page, data) {
  const E = EXP[which];
  const it = data.r.intermediates, pn = data.r.pension;
  const ann = data.vmAnnual;
  const byY = {}; ann.forEach(a => { byY[a.year] = a; });

  // 1. window / K / N
  rec.rec(which + '-K', 'K应缴月', it.K应缴月 === E.K, it.K应缴月, E.K);
  rec.near(which + '-N', 'N应缴', it.N应缴, E.N, 0.0001);
  rec.rec(which + '-paid', '实缴月数', it.actualPaidMonths === E.paid, it.actualPaidMonths, E.paid);
  rec.near(which + '-Nreal', 'N实同', it.N实同, E.Nreal, 0.0001);
  rec.rec(which + '-M', '计发月数M', it.M === E.M, it.M, E.M);
  rec.rec(which + '-deemed', 'deemedMonths=' + E.deemed, it.deemedMonths === E.deemed, it.deemedMonths, E.deemed);

  // 2. Z实 / Σ月z
  const rawMonthZ = data.r.monthlyDetails.reduce((a, m) => a + m.z, 0);
  rec.near(which + '-sumZm', 'Σ月z（分子）', rawMonthZ, E.sumZmonth, 0.02);
  rec.near(which + '-Z', 'Z实指数', it.Z实指数, E.Z, 0.0002);

  // 3. annual ledger
  rec.rec(which + '-annLen', '年表行数 ' + E.rows, ann.length === E.rows, ann.length, E.rows);
  rec.rec(which + '-annRange', '年表 ' + E.y0 + '~' + E.y1,
    ann[0].year === E.y0 && ann[ann.length - 1].year === E.y1,
    ann[0].year + '~' + ann[ann.length - 1].year, E.y0 + '~' + E.y1);
  const sumRoundedZY = ann.reduce((a, x) => a + (x.windowMonths > 0 ? num(x.zYearText) : 0), 0);
  rec.near(which + '-sumZY', '窗口Z年之和=' + E.sumZY, sumRoundedZY, E.sumZY, 0.002);
  rec.near(which + '-recon', '勾稽 Σ月z/K = Z实', rawMonthZ / it.K应缴月, E.Z, 0.0001);
  rec.rec(which + '-person', '人员类型含「' + E.person + '」',
    String(data.r.meta.personType).indexOf(E.person) >= 0, data.r.meta.personType, E.person);
  rec.rec(which + '-eligible', 'eligible=true', data.r.meta.eligible === true, data.r.meta.eligible, true);

  // case-specific annual rows
  if (which === 'MY1') {
    rec.near(which + '-r2000', '2000 Z年(2月)', num(byY[2000].zYearText), 0.4458, 0.0002);
    rec.near(which + '-r2019', '2019 Z年=3.0(封顶)', num(byY[2019].zYearText), 3.0, 0.0002);
    rec.rec(which + '-r2019cap', '2019 capped=true', byY[2019].capped === true, byY[2019].capped, true);
    rec.near(which + '-r2026', '2026 Z年=2.1779', num(byY[2026].zYearText), 2.1779, 0.001);
    rec.near(which + '-r2033', '退休年2033 Z年=0.3000(z=0.6×6/12)', num(byY[2033].zYearText), 0.3, 0.0002);
  } else if (which === 'MY2') {
    rec.near(which + '-r2000', '2000 Z年(2月)', num(byY[2000].zYearText), 0.4458, 0.0002);
    rec.near(which + '-r2019', '2019 Z年=3.0(封顶)', num(byY[2019].zYearText), 3.0, 0.0002);
    rec.rec(which + '-r2019cap', '2019 capped=true', byY[2019].capped === true, byY[2019].capped, true);
    rec.near(which + '-r2026', '2026 Z年=2.9778', num(byY[2026].zYearText), 2.9778, 0.001);
    rec.near(which + '-r2033', '退休年2033 Z年=1.5', num(byY[2033].zYearText), 1.5, 0.0002);
  } else {
    rec.near(which + '-r2003', '2003 Z年(4月,起9月)', num(byY[2003].zYearText), 0.4824, 0.0002);
    rec.rec(which + '-r2003wm', '2003 windowMonths=4', byY[2003].windowMonths === 4, byY[2003].windowMonths, 4);
    rec.near(which + '-r2005', '2005 Z年(7月)', num(byY[2005].zYearText), 0.9839, 0.0002);
    rec.near(which + '-r2006', '2006 Z年(9月)', num(byY[2006].zYearText), 1.1796, 0.0002);
    rec.near(which + '-r2019', '2019 Z年=2.3843(不封顶)', num(byY[2019].zYearText), 2.3843, 0.0002);
    rec.rec(which + '-r2019cap', '2019 capped=false', byY[2019].capped === false, byY[2019].capped, false);
    rec.near(which + '-r2026', '2026 Z年=3.0', num(byY[2026].zYearText), 3.0, 0.0002);
    rec.near(which + '-rRet', '退休年 ' + E.y1 + ' Z年=1.5', num(byY[E.y1].zYearText), 1.5, 0.0002);
    rec.rec(which + '-missing', '1992~1995 显示—',
      [1992, 1993, 1994, 1995].every(y => byY[y].zYearText === '—'),
      [1992, 1993, 1994, 1995].map(y => byY[y].zYearText).join(','), '—×4');
  }

  // 4. amounts
  rec.near(which + '-basic', 'J基础', pn.J基础, E.basic, 0.02);
  rec.near(which + '-account', 'J账户', pn.J账户, E.account, 0.02);
  rec.near(which + '-trans', 'J过渡', pn.J过渡, E.trans, 0.02);
  rec.near(which + '-total', '月合计', pn.total, E.total, 0.02);
  rec.near(which + '-totalDisp', 'totalDisplay', data.totalDisplay, E.total, 0.02);

  // 5. R储 / R补
  rec.near(which + '-Rstore', 'R储', it.R储, E.Rstore, 0.02);
  rec.near(which + '-Rsub', 'R补', it.R补, E.Rsub, 0.02);
  if (which === 'MY3' || which === 'MY4') {
    rec.near(which + '-Rprin', 'R储本金', it.R储本金, E.Rprin, 0.02);
    rec.near(which + '-Rint', 'R储利息', it.R储利息, E.Rint, 0.02);
  }

  // 6. DOM
  const domTotal = String(await rr(async () => {
    const el = await page.$('.total-card .total'); return el ? el.text() : null;
  }) || '');
  rec.rec(which + '-domTotal', 'DOM .total 月合计',
    domTotal.replace(/[\s¥,]/g, '') === E.total.toFixed(2),
    domTotal.trim(), '¥' + E.total);
  const partEls = await rr(() => page.$$('.total-card .parts .strong'));
  const partVals = [];
  for (const el of partEls) partVals.push(num(await rr(() => el.text())));
  rec.rec(which + '-domParts', 'DOM 三分项',
    partVals.length === 3 && Math.abs(partVals[0] - E.basic) <= 0.02 &&
    Math.abs(partVals[1] - E.account) <= 0.02 && Math.abs(partVals[2] - E.trans) <= 0.02,
    JSON.stringify(partVals), JSON.stringify([E.basic, E.account, E.trans]));

  // 7. Bug23/24 note audit (real DOM text)
  const noteEls = await rr(() => page.$$('.muted, .warn'));
  let noteAll = '';
  for (const el of noteEls) {
    try { noteAll += String(await rr(() => el.text()) || '') + '\n'; } catch (e) {}
  }
  E.required.forEach((s, i) => rec.rec(which + '-noteReq' + i, '注释含「' + s + '」',
    noteAll.indexOf(s) >= 0, noteAll.indexOf(s) >= 0 ? 'found' : 'missing', s));
  E.forbidden.forEach((s, i) => rec.rec(which + '-noteFor' + i, '注释不含「' + s + '」',
    noteAll.indexOf(s) < 0, noteAll.indexOf(s) < 0 ? 'clean' : 'FOUND:' + s, 'absent'));
}

(async () => {
  const overall = { suite: 'bug22-24-verify', startedAt: new Date().toISOString(),
    ideServicePort: 60964, cases: {}, bugs: {}, screenshots: [] };
  let fatal = null;
  try {
    for (const which of ['MY1', 'MY2', 'MY3', 'MY4']) {
      const E = EXP[which];
      const rec = makeRec();
      let caseFatal = null;
      let shots = [];
      await withFreshAuto(E.port, async mp => {
        let indexPage = await relaunchIndex(mp);

        // ---- Bug22 real interaction, done once inside MY3 session ----
        if (which === 'MY3') {
          // (a) cold default
          let d0 = await rr(() => indexPage.data());
          bug22Checks.push({ id: 'B22-default', t: '默认 hasDeemed=false',
            pass: d0.hasDeemed === false, actual: d0.hasDeemed, expected: false });
          bug22Checks.push({ id: 'B22-empty', t: '默认视同起止空',
            pass: d0.deemedStartYM === '' && d0.deemedEndYM === '',
            actual: { s: d0.deemedStartYM, e: d0.deemedEndYM }, expected: 'empty' });
          let card = await findDeemedCard(indexPage);
          let pk = card ? await rr(() => card.$$('picker')) : [];
          bug22Checks.push({ id: 'B22-pickerHidden', t: '无视同 picker 隐藏(0)',
            pass: pk.length === 0, actual: pk.length, expected: 0 });
          const mutedEls = await rr(() => indexPage.$$('.muted'));
          let hint = false, mutedText = '';
          for (const el of mutedEls) {
            const t = String(await rr(() => el.text()) || ''); mutedText += t + '\n';
            if (t.indexOf('无视同缴费年限（N同=0）') >= 0) hint = true;
          }
          bug22Checks.push({ id: 'B22-hint', t: '显示「无视同缴费年限（N同=0）」',
            pass: hint, actual: hint ? 'found' : 'missing', expected: 'found' });
          // Bug24 input-page placeholders: no hardcoded old case data
          const phKeys = Object.keys(d0).filter(k => /Ph$/.test(k));
          const phAll = phKeys.map(k => String(d0[k] || '')).join('\n');
          ['1995-07', '2000-10', '672920', '本案 2026-08', '本案2026-08'].forEach(s => {
            bug22Checks.push({ id: 'B22-ph-' + s, t: '输入页占位不含「' + s + '」',
              pass: phAll.indexOf(s) < 0, actual: phAll.indexOf(s) < 0 ? 'clean' : 'FOUND', expected: 'clean' });
          });
          // (b) legacy draft without hasDeemed but carrying MY1/2 deemed values
          await mp.callWxMethod('setStorageSync', 'pension_input_v1', {
            gender: 'male', workStartYM: '1995-07', retireYM: '2033-07',
            deemedStartYM: '1995-07', deemedEndYM: '2000-10'
          });
          await mp.reLaunch('/pages/index/index');
          await sleep(1800);
          let p1 = await rr(() => mp.currentPage());
          let d1 = await rr(() => p1.data());
          bug22Checks.push({ id: 'B22-migrate', t: '旧草稿迁移派生 hasDeemed=true 且旧值保留',
            pass: d1.hasDeemed === true && d1.deemedStartYM === '1995-07' && d1.deemedEndYM === '2000-10',
            actual: { has: d1.hasDeemed, s: d1.deemedStartYM, e: d1.deemedEndYM },
            expected: { has: true, s: '1995-07', e: '2000-10' } });
          card = await findDeemedCard(p1);
          pk = card ? await rr(() => card.$$('picker')) : [];
          bug22Checks.push({ id: 'B22-pickerShown', t: '有视同时 picker 显示(2)',
            pass: pk.length === 2, actual: pk.length, expected: 2 });
          // (c) tap 无视同 → cleared (poll/retry; real tap is authoritative)
          const opts = card ? await rr(() => card.$$('text.opt')) : [];
          let tapped = false;
          for (let attempt = 0; attempt < 3 && !tapped; attempt++) {
            for (const el of opts) {
              const t = String(await rr(() => el.text()) || '');
              if (t.indexOf('无视同缴费年限') >= 0) { await rr(() => el.tap()); break; }
            }
            const tt = Date.now();
            while (Date.now() - tt < 2500) {
              const dd = await rr(() => p1.data());
              if (dd.hasDeemed === false) { tapped = true; break; }
              await sleep(300);
            }
          }
          bug22Checks.push({ id: 'B22-tap', t: '点「无视同缴费年限」后状态生效（真实 tap，最多重试3次）', pass: tapped, actual: tapped, expected: true });
          let d2 = await rr(() => p1.data());
          bug22Checks.push({ id: 'B22-cleared', t: '切无视同后 hasDeemed=false 且起止清空',
            pass: d2.hasDeemed === false && d2.deemedStartYM === '' && d2.deemedEndYM === '',
            actual: { has: d2.hasDeemed, s: d2.deemedStartYM, e: d2.deemedEndYM },
            expected: { has: false, s: '', e: '' } });
          const sClear = await shot(mp, 'bug22-cleared.png');
          if (sClear) shots.push(sClear);
          // refresh the index page reference: reLaunch created a new webview.
          // Safest is a full relaunch (payload is injected wholesale below).
          indexPage = await relaunchIndex(mp);
        }

        // ---- fill & calculate ----
        const r = await calc(mp, indexPage, payloadMY(which));
        await assertCase(which, rec, r.page, r.data);

        // ---- per-case screenshots ----
        if (which === 'MY1') {
          const s = await shot(mp, 'bug2224-my1-total.png'); if (s) shots.push(s);
        } else if (which === 'MY3') {
          const s = await shot(mp, 'bug2224-my3-total.png'); if (s) shots.push(s);
        } else if (which === 'MY4') {
          const s = await shot(mp, 'bug2224-my4-total.png'); if (s) shots.push(s);
          // annotation evidence: scroll toward intermediates card
          for (const st of [500, 750]) {
            try { await rr(() => mp.callWxMethod('pageScrollTo', { scrollTop: st, duration: 0 })); await sleep(500); } catch (e) {}
          }
          const s2 = await shot(mp, 'bug2224-note-evidence.png'); if (s2) shots.push(s2);
        }
        r_data_holder: { overall._lastData = r.data; }
      }).catch(e => { caseFatal = String(e && e.message || e); });

      const totals = rec.list.reduce((a, x) => { x.pass ? a.pass++ : a.fail++; return a; }, { pass: 0, fail: 0 });
      const data = overall._lastData;
      caseResults[which] = {
        ok: !caseFatal && totals.fail === 0, fatal: caseFatal,
        port: E.port, totals,
        actuals: (caseFatal || !data) ? null : {
          K: data.r.intermediates.K应缴月, N: data.r.intermediates.N应缴,
          Z: data.r.intermediates.Z实指数, sumZmonth: +data.r.monthlyDetails.reduce((a, m) => a + m.z, 0).toFixed(4),
          basic: data.r.pension.J基础, account: data.r.pension.J账户,
          trans: data.r.pension.J过渡, total: data.r.pension.total,
          Rstore: data.r.intermediates.R储, Rsub: data.r.intermediates.R补
        },
        assertions: rec.list, screenshots: shots
      };
      delete overall._lastData;
    }

    // ---- assemble summaries ----
    overall.cases = {};
    Object.keys(caseResults).forEach(w => {
      const c = caseResults[w];
      overall.cases[w] = { ok: c.ok, fatal: c.fatal, port: c.port, totals: c.totals, actuals: c.actuals };
    });
    Object.keys(caseResults).forEach(w => (caseResults[w].screenshots || [])
      .forEach(s => overall.screenshots.push({ case: w, file: s.name, bytes: s.bytes })));

    // ---- bug verdicts ----
    // Bug22: all interaction checks + N同=0 for MY3/4 in-engine
    const b22 = bug22Checks.every(x => x.pass) &&
      caseResults.MY3.actuals && caseResults.MY3.actuals.N != null;
    // stronger: engine N同 via assertions MY3-deemed / MY4-deemed passed
    const deemedAsserts = ['MY3', 'MY4'].map(w => caseResults[w].assertions.find(a => a.id === w + '-deemed'));
    overall.bugs.bug22 = { pass: b22 && deemedAsserts.every(a => a && a.pass), checks: bug22Checks };

    // Bug23: core window numbers across 4 cases
    const b23Ids = [['MY1', ['MY1-K', 'MY1-N', 'MY1-Z']], ['MY2', ['MY2-K', 'MY2-N', 'MY2-Z']],
      ['MY3', ['MY3-K', 'MY3-N', 'MY3-Z']], ['MY4', ['MY4-K', 'MY4-N', 'MY4-Z']]];
    const b23checks = [];
    b23Ids.forEach(([w, ids]) => ids.forEach(id => {
      const a = caseResults[w].assertions.find(x => x.id === id);
      b23checks.push({ id, pass: !!(a && a.pass), actual: a && a.actual, expected: a && a.expected });
    }));
    overall.bugs.bug23 = { pass: b23checks.every(x => x.pass), checks: b23checks };

    // Bug24: every noteReq/noteFor assertion across four cases
    const b24 = [];
    Object.keys(caseResults).forEach(w => caseResults[w].assertions
      .filter(a => a.id.indexOf('-noteReq') >= 0 || a.id.indexOf('-noteFor') >= 0)
      .forEach(a => b24.push({ id: a.id, pass: a.pass, actual: a.actual, expected: a.expected })));
    overall.bugs.bug24 = { pass: b24.every(x => x.pass), total: b24.length, checks: b24 };
  } catch (e) { fatal = String(e && e.stack || e); }

  overall.fatal = fatal;
  overall.finishedAt = new Date().toISOString();
  overall.ok = !fatal && Object.keys(caseResults).length === 4 &&
    Object.values(caseResults).every(c => c.ok) &&
    Object.values(overall.bugs).every(b => b.pass);
  fs.writeFileSync(path.join(OUT, 'bug22-24-verify.json'), JSON.stringify(overall, null, 2), 'utf8');
  console.log('FINAL ok=' + overall.ok + ' cases=' +
    Object.keys(caseResults).map(w => w + ':' + caseResults[w].totals.pass + '/' +
      (caseResults[w].totals.pass + caseResults[w].totals.fail)).join(' ') +
    ' bugs 22=' + overall.bugs.bug22.pass + ' 23=' + overall.bugs.bug23.pass + ' 24=' + overall.bugs.bug24.pass +
    (fatal ? ' fatal=' + fatal : ''));
  process.exit(overall.ok ? 0 : 2);
})();
