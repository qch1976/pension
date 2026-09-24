// bug2526-case.js - MY1/MY2/MY3/MY4 real-device regression + Bug26 difference case MY3D.
// Run: GUI_AUTO_PORT=<fresh one-shot cli auto port> node bug2526-case.js <MY1|MY2|MY3|MY4|MY3D>
// Expected values: pension-ui-change-design-bug25-26.md V1.8 §3.2 / AC-B26-04.
'use strict';
const fs = require('fs');
const path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const OUT = PROJECT + '\\autotest\\output\\gui';
const SDK_DIR = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const automator = require(SDK_DIR);
const PORT = parseInt(process.env.GUI_AUTO_PORT || '9651', 10);
const CASE = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

// ---------------- MY1/MY2 fixtures (My-Case.md annual table) ----------------
const hist = [
  [2000, 6142, 2], [2001, 41328], [2002, 47184], [2003, 58434], [2004, 69645],
  [2005, 81816], [2006, 95079], [2007, 105822], [2008, 116766], [2009, 130500],
  [2010, 142533], [2011, 149760], [2012, 163953], [2013, 183069], [2014, 198288],
  [2015, 220608], [2016, 243882], [2017, 266256], [2018, 291114], [2019, 293796],
  [2020, 300636], [2021, 328572], [2022, 360630], [2023, 394650], [2024, 415044],
  [2025, 426564], [2026, 287562, 8]
];
function buildMy12Segments(z, type) {
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
  // V1.8 权威口径：2026 分母 12116；灵活 7270=round(12116×0.6)，企业 Z=3 为 36348（非旧 11937）
  const denom = 12116;
  const fb = type === 'flexible' ? Math.round(denom * 0.6) : denom * 3;
  segs.push({ type, startYM: '2026-09', endYM: '2033-06', baseMonthly: String(fb) });
  return segs;
}

// ---------------- MY3/MY4 fixtures (MyWife annual rows) ----------------
const YEAR_ROWS = [
  ['2003', '9', '4', '10000'],
  ['2004', '1', '12', '39000'],
  ['2005', '1', '7', '27892'],
  ['2006', '1', '9', '38700'],
  ['2007', '1', '12', '59493'],
  ['2008', '1', '12', '71160'],
  ['2009', '1', '12', '89202'],
  ['2010', '1', '12', '101340'],
  ['2011', '1', '12', '121005'],
  ['2012', '1', '12', '137451'],
  ['2013', '1', '12', '160677'],
  ['2014', '1', '12', '170562'],
  ['2015', '1', '12', '190428'],
  ['2016', '1', '12', '212370'],
  ['2017', '1', '12', '210678'],
  ['2018', '1', '12', '215538'],
  ['2019', '1', '12', '224748'],
  ['2020', '1', '12', '222000'],
  ['2021', '1', '12', '236418'],
  ['2022', '1', '12', '345994'],
  ['2023', '1', '12', '394650'],
  ['2024', '1', '12', '415044'],
  ['2025', '1', '12', '426564']
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
      baseMonthly: String(annual / k) };
  });
  segs.push({ type: 'enterprise', startYM: '2026-01', endYM: futureEnd, baseMonthly: '36348' });
  return segs;
}

// ---------------- expected (V1.8) ----------------
const EXPECT = {
  MY1: { K: 392, N: 32.6667, sumZ: 942.0684, Z: 2.4032, paid: 392, Nrd: 38.0, N98: 3.0, M: 139,
    Rstore: 795693.52, Rsub: 10923.92, Jb: 7791.06, Ja: 5803.00, Jt: 868.70, total: 14462.76 },
  MY2: { K: 392, N: 32.6667, sumZ: 1138.8657, Z: 2.9053, paid: 392, Nrd: 38.0, N98: 3.0, M: 139,
    Rstore: 996432.00, Rsub: 13205.91, Jb: 8940.37, Ja: 7263.58, Jt: 1050.17, total: 17254.12 },
  MY3: { K: 334, N: 27.8333, sumZ: 787.4583, Z: 2.3577, paid: 326, Nrd: 27.1667, N98: 0, M: 195,
    Rstore: 722763.05, Rsub: 0, Jb: 5495.33, Ja: 3706.48, Jt: 0, total: 9201.81 },
  MY4: { K: 394, N: 32.8333, sumZ: 967.4583, Z: 2.4555, paid: 386, Nrd: 32.1667, N98: 0, M: 170,
    Rstore: 960080.64, Rsub: 0, Jb: 6696.30, Ja: 5647.53, Jt: 0, total: 12343.83 },
  // Bug26 difference case: MY3 data + enterpriseInsuredYM=2004-09 (AC-B26-04)
  MY3D: { K: 322, N: 26.8333, sumZ: 768.6934, Z: 2.3872, paid: 314, Nrd: 26.1667, N98: 0, M: 195,
    Rstore: 722763.05, Rsub: 0, Jb: 5339.69, Ja: 3706.48, Jt: 0, total: 9046.17 }
};

async function rr(fn, n) {
  let e = null;
  for (let i = 0; i < (n || 3); i++) {
    try { return await fn(); } catch (x) { e = x; await sleep(600 * (i + 1)); }
  }
  throw e;
}
async function connect() {
  let last = null;
  for (let i = 0; i < 25; i++) {
    try { return await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT }); }
    catch (e) { last = e; await sleep(1500); }
  }
  throw new Error('connect failed: ' + (last && last.message));
}
async function relaunchIndex(mp) {
  try { await mp.callWxMethod('clearStorageSync'); } catch (e) {}
  await mp.reLaunch('/pages/index/index').catch(() => {});
  const t0 = Date.now(); let page = null;
  while (Date.now() - t0 < 90000) {
    try {
      page = await rr(() => mp.currentPage());
      if (page && page.path && page.path.indexOf('pages/index/index') >= 0) {
        const dd = await rr(() => page.data());
        if (dd && Object.keys(dd).length > 5) break;
      }
    } catch (e) {}
    await sleep(800);
  }
  if (!page) throw new Error('index page not ready (active interactive session required)');
  return page;
}
function makeRec() {
  const list = [];
  return {
    list,
    rec: (id, t, pass, actual, expected) => list.push({ id, title: t, pass: !!pass, actual, expected }),
    near: (id, t, actual, exp, tol) => {
      const a = Number(actual);
      list.push({ id, title: t, pass: isFinite(a) && Math.abs(a - exp) <= tol,
        actual: Math.round(a * 1e6) / 1e6, expected: exp + ' +/-' + tol });
    }
  };
}
async function screenshot(mp, name) {
  const p = path.join(OUT, name);
  try { fs.unlinkSync(p); } catch (e) {}
  for (let i = 1; i <= 3; i++) {
    try {
      await mp.screenshot({ path: p });
      await sleep(400);
      const bytes = fs.statSync(p).size;
      if (bytes > 40000) return { path: p, bytes };
    } catch (e) { await sleep(1200 * i); }
  }
  return null;
}

(async () => {
  if (!EXPECT[CASE]) throw new Error('unknown case ' + CASE);
  const E = EXPECT[CASE];
  const mp = await connect();
  const rec = makeRec();
  let fatal = null;
  let shot = null;
  try {
    const indexPage = await relaunchIndex(mp);
    await sleep(600);
    const d = await rr(() => indexPage.data());

    if (CASE === 'MY1' || CASE === 'MY2') {
      const z = CASE === 'MY1' ? 0.6 : 3.0;
      const type = CASE === 'MY1' ? 'flexible' : 'enterprise';
      Object.assign(d, {
        gender: 'male', femaleType: 'worker',
        birthYM: '1973-07', workStartYM: '1995-07', retireYM: '2033-07',
        hasDeemed: true, deemedStartYM: '1995-07', deemedEndYM: '2000-10',
        entryMode: 'month', segments: buildMy12Segments(z, type),
        accountBalanceManual: '672920', manualBalanceYM: '2026-08', futureMonthlyRatePct: '1.5',
        doc31Eligible: true, doc31TransferYM: '2000-11', enterpriseInsuredYM: '2000-11',
        subsidyExcludedText: '', cPingOverride: '', customCYearText: '',
        boundWarnings: [], errorMsg: ''
      });
    } else {
      const is4 = CASE === 'MY4';
      const retireYM = is4 ? '2036-07' : '2031-07';
      const futureEnd = is4 ? '2036-06' : '2031-06';
      Object.assign(d, {
        gender: 'female', femaleType: 'worker',
        birthYM: '1981-07', workStartYM: '2003-09', retireYM,
        hasDeemed: false, deemedStartYM: '', deemedEndYM: '',
        entryMode: 'month', segments: buildWifeSegments(futureEnd), yearRows: [],
        accountBalanceManual: '481459', manualBalanceYM: '2025-12', futureMonthlyRatePct: '1.5',
        doc31Eligible: false, doc31TransferYM: '',
        // V1.8: authoritative MY3/MY4 leave field empty -> fallback workStart; MY3D fills 2004-09
        enterpriseInsuredYM: CASE === 'MY3D' ? '2004-09' : '',
        subsidyExcludedText: '', cPingOverride: '', customCYearText: '',
        boundWarnings: [], errorMsg: ''
      });
    }
    await rr(() => indexPage.setData(d));
    await sleep(400);

    // trigger + wait for result page
    let running = false;
    for (let a = 0; a < 4 && !running; a++) {
      try { await indexPage.callMethod('onCalculate'); } catch (e) {}
      const ot = Date.now();
      while (Date.now() - ot < 3000) {
        const cur = await rr(() => mp.currentPage());
        if (cur.path && cur.path.indexOf('pages/result/result') >= 0) { running = true; break; }
        if (cur.path && cur.path.indexOf('pages/index/index') >= 0) {
          const dd = await rr(() => cur.data());
          if (dd.calculating) { running = true; break; }
          if (dd.errorMsg) throw new Error('blocked by validation: ' + dd.errorMsg);
        }
        await sleep(200);
      }
    }
    if (!running) throw new Error('calculation did not start');
    const t0 = Date.now(); let rpage = null;
    while (Date.now() - t0 < 30000) {
      rpage = await rr(() => mp.currentPage());
      if (rpage.path && rpage.path.indexOf('pages/result/result') >= 0) break;
      await sleep(350);
    }
    if (!rpage.path || rpage.path.indexOf('pages/result/result') < 0) {
      const dd = await rr(() => rpage.data());
      throw new Error('blocked: ' + (dd.errorMsg || 'validation error'));
    }
    const t1 = Date.now(); let data = null;
    while (Date.now() - t1 < 20000) {
      data = await rr(() => rpage.data());
      if (data.ready && data.vm && data.r) break;
      await sleep(400);
    }
    if (!data.ready || !data.vm) throw new Error('result page not ready');
    await sleep(600);

    const it = data.r.intermediates, pn = data.r.pension;

    // ---- K / N / Z实 ----
    rec.rec('K', 'K应缴月', it.K应缴月 === E.K, it.K应缴月, E.K);
    rec.near('N', 'N应缴', it.N应缴, E.N, 0.0001);
    rec.near('sumZ', 'Σ月z（未舍入）', data.r.monthlyDetails.reduce((a, m) => a + m.z, 0), E.sumZ, 0.005);
    rec.near('Z', 'Z实指数', it.Z实指数, E.Z, 0.0002);
    rec.rec('paid', '实缴月', it.actualPaidMonths === E.paid, it.actualPaidMonths, E.paid);
    rec.near('Nrd', 'N实同', it.N实同, E.Nrd, 0.0001);
    rec.near('N98', 'N实98', it.N实98, E.N98, 0.0001);
    rec.rec('M', 'M 计发月数', it.M === E.M, it.M, E.M);

    // ---- R储 / R补 ----
    rec.near('Rstore', 'R储', it.R储, E.Rstore, 0.02);
    rec.near('Rsub', 'R补', it.R补, E.Rsub, 0.02);

    // ---- J 三项 + 月合计 ----
    rec.near('Jb', 'J基础', pn.J基础, E.Jb, 0.02);
    rec.near('Ja', 'J账户', pn.J账户, E.Ja, 0.02);
    rec.near('Jt', 'J过渡', pn.J过渡, E.Jt, 0.02);
    rec.near('total', '月合计', pn.total, E.total, 0.02);

    // ---- 勾稽：Z实 = Σ月z / K ----
    const rawZ = data.r.monthlyDetails.reduce((a, m) => a + m.z, 0);
    rec.near('recon', '勾稽 Σ月z÷K应缴 = Z实', rawZ / it.K应缴月, E.Z, 0.0001);
    // ---- 勾稽：月合计 = Jb+Ja+Jt ----
    rec.near('recon2', '勾稽 J基础+J账户+J过渡 = 月合计', pn.J基础 + pn.J账户 + pn.J过渡, E.total, 0.02);

    // ---- real DOM: total visible ----
    const domTotal = String(await rr(async () => {
      const el = await rpage.$('.total-card .total'); return el ? el.text() : null;
    }) || '');
    rec.rec('DOMTotal', 'DOM .total 展示月合计',
      domTotal.replace(/[\s¥,]/g, '') === Number(E.total).toFixed(2),
      domTotal.trim(), '¥ ' + E.total);

    // ---- person type / eligible ----
    rec.rec('eligible', 'eligible=true', data.r.meta.eligible === true, data.r.meta.eligible, true);
    rec.rec('ptype', CASE === 'MY3D' ? '类型不漂移：仍为新人（以参工月为准）' : '人员类型',
      data.r.meta.personType && data.r.meta.personType.indexOf(CASE === 'MY1' || CASE === 'MY2' ? '中人' : '新人') >= 0,
      data.r.meta.personType, CASE === 'MY1' || CASE === 'MY2' ? '含「中人」' : '含「新人」');

    // ---- screenshot LAST interaction (budget ≤6: only MY3/MY4/MY3D; MY1/MY2 verified via page.data+DOM) ----
    if (CASE === 'MY3' || CASE === 'MY4' || CASE === 'MY3D') {
      const tag = CASE === 'MY3D' ? 'bug2526-MY3D-2004.png' : 'bug2526-' + CASE + '-result.png';
      shot = await screenshot(mp, tag);
      rec.rec('shot', '结果页真实截图（页面交互序列末尾）', !!shot, shot && shot.bytes, 'PNG >40KB');
    }
  } catch (e) {
    fatal = String(e && e.message || e);
  } finally {
    try { await mp.disconnect(); } catch (e) {}
  }
  const totals = rec.list.reduce((a, x) => { x.pass ? a.pass++ : a.fail++; return a; },
    { pass: 0, fail: 0 });
  const keyVals = {};
  ['K','N','Z','Rstore','Rsub','Jb','Ja','Jt','total'].forEach(k => {
    const f = rec.list.find(x => x.id === k);
    if (f) keyVals[k === 'N' ? 'N应缴' : k === 'Z' ? 'Z实' : k] = f.actual;
  });
  const summary = {
    case: CASE, ok: !fatal && totals.fail === 0, fatal,
    totals, assertions: rec.list, actuals: keyVals, screenshot: shot,
    finishedAt: new Date().toISOString(),
    runContext: { automationPort: PORT, project: PROJECT }
  };
  fs.writeFileSync(path.join(OUT, 'bug2526-' + CASE + '.json'),
    JSON.stringify(summary, null, 2), 'utf8');
  console.log('DONE ' + CASE + ' pass=' + totals.pass + ' fail=' + totals.fail +
    (fatal ? ' fatal=' + fatal : '') + ' total=' + (keyVals.total != null ? keyVals.total : 'n/a'));
  process.exit(summary.ok ? 0 : 2);
})();
