// verify-wife.js — MyWife Case3/Case4 (MY3/MY4) real-device E2E via live simulator.
// Independent of MY1/MY2 scripts: do not modify verify-input.js / verify-output.js.
// Run: GUI_AUTO_PORT=<fresh one-shot cli auto port> node verify-wife.js MY3|MY4
'use strict';
const fs = require('fs');
const path = require('path');

const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const OUT = PROJECT + '\\autotest\\output\\gui';
const SDK_DIR = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const automator = require(SDK_DIR);
const PORT = parseInt(process.env.GUI_AUTO_PORT || '9631', 10);
const CASE = process.argv[2]; // MY3 | MY4
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

// ---- expected values ----
// Bug23 口径B（定稿 pension-ui-change-design-bug22-24.md §4）：非31号文人员窗口起点=max(1992-10, 参工月)，
// 本案参工 2003-09，故 MY3 K=334/N=27.8333（旧 K=465/N=38.75 作废），MY4 K=394/N=32.8333（旧 525/43.75 作废）。
// Z实指数/J账户/R储 等窗口内数据不变（仅删 1992-10~2003-08 零分子虚分母）；J基础分母随 N应缴变化。
const EXPECT = {
  MY3: {
    retireYM: '2031-07',
    K: 334, Nshould: 27.8333, paidMonths: 326, NrealDeemed: 27.1667, M: 195,
    zReal: 2.3577,
    basic: 5495.33, account: 3706.48, transitional: 0, total: 9201.81,
    rStore: 722763.05, rPrincipal: 191917.44, rInterest: 49386.61, rSubsidy: 0,
    annualRows: 40, firstYear: 1992, lastYear: 2031, retireYearZ: 1.5,
    futureEnd: '2031-06', sumZY: 65.6215
  },
  MY4: {
    retireYM: '2036-07',
    K: 394, Nshould: 32.8333, paidMonths: 386, NrealDeemed: 32.1667, M: 170,
    zReal: 2.4555,
    basic: 6696.30, account: 5647.53, transitional: 0, total: 12343.83,
    rStore: 960080.64, rPrincipal: 366387.84, rInterest: 112233.80, rSubsidy: 0,
    annualRows: 45, firstYear: 1992, lastYear: 2036, retireYearZ: 1.5,
    futureEnd: '2036-06', sumZY: 80.6215
  }
};
// shared 23-row annual contribution table (2003~2025), three partial years
const YEAR_ROWS = [
  ['2003', '9', '4', '10000'],   // work starts 2003-09 -> startMonth MUST be 9
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

// flaky-call retry (single WS timeouts are transient)
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
  while (Date.now() - t0 < 60000) {
    try {
      page = await rr(() => mp.currentPage());
      if (page && page.path && page.path.indexOf('pages/index/index') >= 0) {
        const dd = await rr(() => page.data());
        if (dd && Object.keys(dd).length > 5) break;
      }
    } catch (e) {}
    await sleep(800);
  }
  await sleep(400);
  if (!page) throw new Error('index page not ready (check session 2 active desktop)');
  return page;
}

// expand the 23 annual rows to month segments exactly like index.expandYearRows
const toYM = idx => {
  const y = Math.floor(idx / 12), m = idx % 12 + 1;
  return y + '-' + String(m).padStart(2, '0');
};
function buildHistoricalSegments() {
  return YEAR_ROWS.map(r => {
    const year = +r[0], sm = +r[1], k = +r[2], annual = +r[3];
    const startIdx = year * 12 + (sm - 1);
    return {
      type: 'enterprise',
      startYM: toYM(startIdx), endYM: toYM(startIdx + k - 1),
      baseMonthly: String(annual / k)
    };
  });
}

async function fillAndRun(mp, indexPage) {
  const E = EXPECT[CASE];
  // month mode: 23 historical segments (expanded from the annual rows) + ONE
  // future enterprise segment 2026-01..retire-minus-1 month, base 36348 (Z=3)
  const segments = buildHistoricalSegments();
  segments.push({
    type: 'enterprise', startYM: '2026-01', endYM: E.futureEnd, baseMonthly: '36348'
  });
  // merge over current page data so all static fields survive
  const d = await rr(() => indexPage.data());
  d.gender = 'female';
  d.femaleType = 'worker';
  d.birthYM = '1981-07';
  d.workStartYM = '2003-09';
  d.retireYM = E.retireYM;
  // Bug22：MY3/4 无视同，开关必须 false；旧案残留起止一律不允许。
  d.hasDeemed = false;
  d.deemedStartYM = '';
  d.deemedEndYM = '';
  d.entryMode = 'month';
  d.segments = segments;
  d.yearRows = []; // unused in month mode
  d.accountBalanceManual = '481459';
  d.manualBalanceYM = '2025-12';
  d.futureMonthlyRatePct = '1.5';
  d.doc31Eligible = false;
  d.doc31TransferYM = '';
  // Bug26/V1.8：非 doc31 人员企业实际参保起始留空 → 窗口回退参工月（本案 2003-09），
  // 下列 K/N/Z实/合计 即“留空回退”断言值。
  d.enterpriseInsuredYM = '';
  d.subsidyExcludedText = '';
  d.cPingOverride = '';
  d.customCYearText = '';
  d.boundWarnings = [];
  d.errorMsg = '';
  await rr(() => indexPage.setData(d));
  await sleep(400);

  // trigger with observation (onCalculate has a re-entry guard)
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

  const t0 = Date.now(); let page = null;
  while (Date.now() - t0 < 30000) {
    page = await rr(() => mp.currentPage());
    if (page.path && page.path.indexOf('pages/result/result') >= 0) break;
    await sleep(350);
  }
  if (!page.path || page.path.indexOf('pages/result/result') < 0) {
    const dd = await rr(() => page.data());
    throw new Error('blocked: ' + (dd.errorMsg || 'validation error'));
  }
  // wait until ready + vm populated
  const t1 = Date.now(); let data = null;
  while (Date.now() - t1 < 20000) {
    data = await rr(() => page.data());
    if (data.ready && data.vm && data.r) break;
    await sleep(400);
  }
  if (!data.ready || !data.vm) throw new Error('result page not ready');
  await sleep(600);
  return { page, data };
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

function makeRec() {
  const list = [];
  return {
    list,
    rec: (id, t, pass, actual, expected) => list.push({ id, title: t, pass: !!pass, actual, expected }),
    near: (id, t, actual, exp, tol) => {
      const a = Number(actual);
      list.push({
        id, title: t, pass: isFinite(a) && Math.abs(a - exp) <= tol,
        actual: Math.round(a * 1e6) / 1e6, expected: exp + ' +/-' + tol
      });
    }
  };
}
const num = s => s == null ? null : Number(String(s).replace(/[,¥\s]/g, ''));

(async () => {
  if (!EXPECT[CASE]) throw new Error('unknown case ' + CASE);
  const E = EXPECT[CASE];
  const mp = await connect();
  const rec = makeRec();
  let fatal = null;
  let shots = { total: null, annual: null };
  try {
    const indexPage = await relaunchIndex(mp);
    const r = await fillAndRun(mp, indexPage);
    const page = r.page, data = r.data;
    // Bug22-24 rerun finding (see §9): ordering of page interactions matters.
    const it = data.r.intermediates;
    const pn = data.r.pension;
    const ann = data.vmAnnual;
    const byY = {}; ann.forEach(a => { byY[a.year] = a; });

    // ---- 1. window / K / N / months ----
    rec.rec('K', 'K应缴月', it.K应缴月 === E.K, it.K应缴月, E.K);
    rec.near('Nshould', 'N应缴', it.N应缴, E.Nshould, 0.0001);
    rec.rec('paidMonths', '实缴月数', it.actualPaidMonths === E.paidMonths, it.actualPaidMonths, E.paidMonths);
    rec.near('NrealDeemed', 'N实同', it.N实同, E.NrealDeemed, 0.0001);
    rec.rec('M', '计发月数 M', it.M === E.M, it.M, E.M);
    rec.rec('N98zero', 'N实98=0（2003后参工）', it.N实98 === 0, it.N实98, 0);

    // ---- 2. Z实 ----
    rec.near('Zreal', 'Z实指数（封顶后；Bug23 窗口自参工月2003-09起）', it.Z实指数, E.zReal, 0.0002);

    // ---- 3. annual ledger (data authoritative) ----
    rec.rec('AnnLen', '年表行数 ' + E.annualRows, ann.length === E.annualRows, ann.length, E.annualRows);
    rec.rec('AnnRange', '年表 ' + E.firstYear + '~' + E.lastYear,
      ann[0].year === E.firstYear && ann[ann.length - 1].year === E.lastYear,
      ann[0].year + '~' + ann[ann.length - 1].year, E.firstYear + '~' + E.lastYear);
    rec.near('Ann2003', '2003 Z年（4月 起始月9）', num(byY[2003].zYearText), 0.4824, 0.0002);
    rec.near('Ann2005', '2005 Z年（7月）', num(byY[2005].zYearText), 0.9839, 0.0002);
    rec.near('Ann2006', '2006 Z年（9月）', num(byY[2006].zYearText), 1.1796, 0.0002);
    rec.near('Ann2019', '2019 Z年=2.3843（未触发封顶）', num(byY[2019].zYearText), 2.3843, 0.0002);
    rec.rec('Ann2019cap', '2019 无月封顶标记', byY[2019].capped === false, byY[2019].capped, false);
    rec.near('Ann2025', '2025 Z年', num(byY[2025].zYearText), 2.9779, 0.0002);
    rec.near('Ann2026', '2026 Z年=3.0000（月z=3，未超限）', num(byY[2026].zYearText), 3.0, 0.0002);
    rec.near('AnnRetireYear', '退休年 ' + E.lastYear + ' Z年=1.5（仅1~6月在窗口）',
      num(byY[E.lastYear].zYearText), E.retireYearZ, 0.0002);
    rec.rec('AnnMissing', '1992~1995 缺分母显示—',
      [1992, 1993, 1994, 1995].every(y => byY[y].zYearText === '—'),
      [1992, 1993, 1994, 1995].map(y => byY[y].zYearText).join(','), '—,—,—,—');
    // reconciliation (raw identity): Σ逐月 z ÷ K = Z实（round4 行值相加会累积舍入，故用 monthlyDetails 原始值）
    const rawMonthZ = data.r.monthlyDetails.reduce((a, m) => a + m.z, 0);
    rec.near('AnnRecon', '年表勾稽 Σ月z/K应缴 = Z实（原始月值）',
      rawMonthZ / it.K应缴月, E.zReal, 0.0001);
    // 另断言窗口 Z年之和（round4）与设计定稿一致（Bug23 新值）
    const sumRoundedZY = ann.reduce((a, x) => a + (x.windowMonths > 0 ? num(x.zYearText) : 0), 0);
    rec.near('SumZY', '窗口各年 Z年之和 = ' + E.sumZY, sumRoundedZY, E.sumZY, 0.001);

    // ---- 4. amounts ----
    rec.near('Jbasic', 'J基础', pn.J基础, E.basic, 0.01);
    rec.near('Jaccount', 'J账户', pn.J账户, E.account, 0.01);
    rec.near('Jtrans', 'J过渡=0（新人）', pn.J过渡, 0, 0.01);
    rec.near('Total', '月合计', pn.total, E.total, 0.01);
    rec.near('TotalDisp', '结果页 totalDisplay = 月合计', data.totalDisplay, E.total, 0.01);

    // ---- 5. R储 / R补 ----
    rec.near('Rstore', 'R储（退休时）', it.R储, E.rStore, 0.01);
    rec.near('Rprincipal', 'R储 本金（未来段）', it.R储本金, E.rPrincipal, 0.01);
    rec.near('Rinterest', 'R储 利息（未来段）', it.R储利息, E.rInterest, 0.01);
    rec.rec('Rsubsidy', 'R补=0（非31号文人员）', it.R补 === 0, it.R补, 0);
    rec.rec('SubsidyStatus', 'R补状态=不适用',
      data.vm.subsidy.applicable === false && data.vm.subsidy.statusText.indexOf('不适用') >= 0,
      data.vm.subsidy.statusText, '不适用（…）');

    // ---- 6. eligibility / person type ----
    rec.rec('Eligible', 'eligible=true（' + E.paidMonths + '月≥最低年限）',
      data.r.meta.eligible === true, data.r.meta.eligible, true);
    rec.rec('PersonType', '人员类型=新人',
      String(data.r.meta.personType).indexOf('新人') >= 0, data.r.meta.personType, '含「新人」');

    // ---- 7. warnings existence ----
    const wj = (data.r.meta.warnings || []).join('\n');
    rec.rec('WCPing', 'warning: C平暂按2025年度12049计发', wj.indexOf('12049') >= 0,
      wj.indexOf('12049') >= 0 ? 'found' : 'missing', 'contains 12049');
    rec.rec('WRate', 'warning: 未来段月滚利率1.5%', wj.indexOf('1.5') >= 0,
      wj.indexOf('1.5') >= 0 ? 'found' : 'missing', 'contains 1.5');

    // ---- 8. real DOM assertions ----
    const domTotal = String(await rr(async () => {
      const el = await page.$('.total-card .total'); return el ? el.text() : null;
    }) || '');
    rec.rec('DOMTotal', 'DOM .total 展示月合计',
      domTotal.replace(/[\s¥,]/g, '') === String(E.total.toFixed(2)),
      domTotal.trim(), '¥ ' + E.total);
    const partEls = await rr(() => page.$$('.total-card .parts .strong'));
    const partVals = [];
    for (const el of partEls) partVals.push(num(await rr(() => el.text())));
    rec.rec('DOMParts', 'DOM 三分项 = J基础/J账户/J过渡',
      partVals.length === 3 &&
      Math.abs(partVals[0] - E.basic) <= 0.01 &&
      Math.abs(partVals[1] - E.account) <= 0.01 &&
      Math.abs(partVals[2] - 0) <= 0.01,
      JSON.stringify(partVals), JSON.stringify([E.basic, E.account, 0]));
    const okCard = await rr(() => page.$('.card.ok'));
    rec.rec('DOMOkCard', 'DOM 资格卡 .card.ok 存在', !!okCard, !!okCard, 'card.ok');

    // ---- 8b. Bug24：注释无案号/他案旧串；N应缴注释绑当前案窗口 ----
    const noteEls = await rr(() => page.$$('.muted, .warn, .note'));
    let noteAll = '';
    for (const el of noteEls) {
      try { noteAll += String(await rr(() => el.text()) || '') + '\n'; } catch (e) {}
    }
    rec.rec('NotesNoCase', '注释无 MY1/MY2 案号',
      noteAll.indexOf('MY1') < 0 && noteAll.indexOf('MY2') < 0,
      noteAll.indexOf('MY') >= 0 ? 'found MY' : 'clean', 'clean');
    // 旧写死串（“本案自批准参保月2000-11起”）不得出现
    rec.rec('NotesNoOld0011', '注释不含旧串“自批准参保月2000-11起”',
      noteAll.indexOf('自批准参保月2000-11起') < 0 && noteAll.indexOf('批准参保月2000-11') < 0,
      'scanned', 'clean');
    // 当前案窗口动态绑定：MY3=2003-09~2031-06，MY4=2003-09~2036-06
    rec.rec('NotesWindow', 'N应缴注释含当前案窗口 2003-09~' + E.futureEnd,
      noteAll.indexOf('2003-09~' + E.futureEnd) >= 0,
      noteAll.indexOf('2003-09') >= 0 ? 'bound' : 'missing', '2003-09~' + E.futureEnd);
    // G同注释分支：无视同 → “无视同缴费年限”
    rec.rec('NotesGtong', 'G同注释为“无视同缴费年限（N同=0）”',
      noteAll.indexOf('无视同缴费年限（N同=0）') >= 0,
      'scanned', 'contains');

    // ---- 9. screenshot evidence — MUST be the LAST page interaction ----
    // Root cause found this round: mp.screenshot() returns the correct result-page
    // pixels, but ~1-2s later the page stack falls back to the input page. App code
    // contains no back navigation (whole-project grep); pure data polling and pure
    // DOM-query polling both stay on the result page 40s+. Retrying any page call
    // after that fallback hits a destroyed webview and crashes node (0xC0000409).
    // Hence: all DOM assertions finish first, THEN take the one total-area shot
    // here (its pixels are the real result page, pixel-verified by the caller),
    // and perform NO further page.* calls afterwards. Byte-size alone cannot
    // prove content (both pages exceed 90KB), so pixels are separately verified.
    shots.total = await screenshot(mp, 'wife-' + CASE + '-total.png');
    rec.rec('ShotTotal', '结果页合计区真实截图（最后一个页面交互；像素另行核验为结果页）', !!shots.total,
      shots.total && shots.total.bytes, 'PNG >40KB + 像素核验为结果页');
    // Annual-ledger direction shot intentionally removed: a second screenshot
    // lands after the fallback; annual values are asserted from page.data().
  } catch (e) {
    fatal = String(e && e.message || e);
  } finally {
    try { await mp.disconnect(); } catch (e) {}
  }
  const totals = rec.list.reduce((a, x) => { x.pass ? a.pass++ : a.fail++; return a; },
    { pass: 0, fail: 0 });
  const summary = {
    case: CASE, ok: !fatal && totals.fail === 0, fatal: fatal,
    totals: totals, assertions: rec.list,
    actuals: fatal ? null : {
      zReal: (() => { try { return rec.list.find(x => x.id === 'Zreal').actual; } catch (e) { return null; } })(),
      total: (() => { try { return rec.list.find(x => x.id === 'Total').actual; } catch (e) { return null; } })(),
      rStore: (() => { try { return rec.list.find(x => x.id === 'Rstore').actual; } catch (e) { return null; } })()
    },
    screenshots: shots,
    finishedAt: new Date().toISOString(),
    runContext: { automationPort: PORT, project: PROJECT }
  };
  fs.writeFileSync(path.join(OUT, 'wife-' + CASE + '.json'),
    JSON.stringify(summary, null, 2), 'utf8');
  console.log('DONE ' + CASE + ' pass=' + totals.pass + ' fail=' + totals.fail +
    (fatal ? ' fatal=' + fatal : ''));
  process.exit(summary.ok ? 0 : 2);
})();
