'use strict';
// verify-output.js — pension OUTPUT page items 12a/12b/13 + two-case regression.
// Run: GUI_AUTO_PORT=<fresh> node verify-output.js O12A|O12B|O13|OREG|O2526
const fs = require('fs');
const path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const OUT = PROJECT + '\\autotest\\output\\gui';
const SDK_DIR = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const automator = require(SDK_DIR);
const PORT = parseInt(process.env.GUI_AUTO_PORT || '9801', 10);
const CASE = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

// 数据集统一为架构定稿（pension-ui-change-design-bug22-24.md §4）口径：
// 2026 历史段 2026-01~08（287562/8），未来段自 2026-09 起；分母 2026=12116。
const hist = [
  [2000, 6142, 2], [2001, 41328], [2002, 47184], [2003, 58434], [2004, 69645],
  [2005, 81816], [2006, 95079], [2007, 105822], [2008, 116766], [2009, 130500],
  [2010, 142533], [2011, 149760], [2012, 163953], [2013, 183069], [2014, 198288],
  [2015, 220608], [2016, 243882], [2017, 266256], [2018, 291114], [2019, 293796],
  [2020, 300636], [2021, 328572], [2022, 360630], [2023, 394650], [2024, 415044],
  [2025, 426564], [2026, 287562, 8]
];
// MY1: z=0.6 flexible, fb=7270 ; MY2: z=3 enterprise, fb=36348；两案窗口同为 2000-11~2033-06。
function buildSegments(z, futureType) {
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
  const SOCIAL_2026 = 12116;
  const fb = z === 0.6 ? 7270 : Math.round(z * SOCIAL_2026);
  segs.push({ type: futureType, startYM: '2026-09', endYM: '2033-06', baseMonthly: String(fb) });
  return segs;
}
function basePayload() {
  return {
    gender: 'male', femaleType: 'worker',
    birthYM: '1973-07', workStartYM: '1995-07', retireYM: '2033-07',
    // Bug22：doc31 两案 hasDeemed=true 且带视同起止
    hasDeemed: true,
    deemedStartYM: '1995-07', deemedEndYM: '2000-10',
    entryMode: 'month',
    accountBalanceManual: '672920', manualBalanceYM: '2026-08', futureMonthlyRatePct: '1.5',
    doc31Eligible: true, doc31TransferYM: '2000-11', enterpriseInsuredYM: '2000-11',
    subsidyExcludedText: '', baseYearIndex: 0, cPingOverride: '', customCYearText: '',
    boundWarnings: [], errorMsg: '', yearRows: []
  };
}
function payload(which) {
  const p = basePayload();
  if (which === 'MY1') p.segments = buildSegments(0.6, 'flexible');
  else p.segments = buildSegments(3, 'enterprise');
  return p;
}

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
  throw new Error('connect: ' + (last && last.message));
}
async function relaunchIndex(mp) {
  try { await mp.callWxMethod('clearStorageSync'); } catch (e) {}
  await mp.reLaunch('/pages/index/index').catch(() => {});
  const t0 = Date.now(); let page = null;
  while (Date.now() - t0 < 60000) {
    try {
      page = await rr(() => mp.currentPage());
      if (page.path && page.path.indexOf('pages/index/index') >= 0) {
        const dd = await rr(() => page.data());
        if (dd && Object.keys(dd).length > 5) break;
      }
    } catch (e) {}
    await sleep(800);
  }
  await sleep(400);
  return page;
}
async function runCase(mp, indexPage, which) {
  await rr(() => indexPage.setData(payload(which)));
  await sleep(300);
  // safe trigger with observation
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
  await sleep(1200);
  const d = await rr(() => page.data(), 4);
  if (!d.ready || !d.vm) throw new Error('result not ready');
  return { page, d };
}
async function screenshot(mp, name) {
  const p = path.join(OUT, name);
  for (let i = 1; i <= 3; i++) {
    try { await mp.screenshot({ path: p }); await sleep(400);
      const b = fs.statSync(p).size; if (b > 40000) return { path: p, bytes: b }; }
    catch (e) { await sleep(1000 * i); }
  }
  return null;
}
function makeRec() {
  const list = [];
  return { list,
    rec: (id, t, pass, actual, expected) => list.push({ id, title: t, pass: !!pass, actual, expected }),
    near: (id, t, actual, exp, tol) => { const a = Number(actual);
      list.push({ id, title: t, pass: isFinite(a) && Math.abs(a - exp) <= tol,
        actual: Math.round(a * 1e6) / 1e6, expected: exp + ' +/-' + tol }); }
  };
}
const num = s => s == null ? null : Number(String(s).replace(/[,¥\s]/g, ''));
const CASES = {};

// ---------- O12A ----------
CASES.O12A = async (mp, indexPage, rec) => {
  const r = await runCase(mp, indexPage, 'MY1');
  const rs = r.d.vm.rStore;
  rec.rec('O12A-kind', 'kind=future-roll', rs.kind === 'future-roll', rs.kind, 'future-roll');
  rec.rec('O12A-from', '本金起算时点 fromYM=2026-09', rs.fromYM === '2026-09', rs.fromYM, '2026-09');
  rec.rec('O12A-anchorYM', '锚定月 anchorYM=2026-08', rs.anchorYM === '2026-08', rs.anchorYM, '2026-08');
  rec.near('O12A-anchor', '锚定余额=672920(历史不重复)', num(rs.anchor), 672920, 0.01);
  rec.rec('O12A-to', 'toYM=2033-06 months=82', rs.toYM === '2033-06' && rs.months === 82,
    { toYM: rs.toYM, months: rs.months }, '2033-06/82');
  rec.near('O12A-principal', '本金=47691.20(定稿)', num(rs.principalText), 47691.20, 0.01);
  rec.near('O12A-interest', '利息=75082.32(定稿)', num(rs.interestText), 75082.32, 0.01);
  rec.near('O12A-total', 'R储=795693.52', num(rs.total), 795693.52, 0.01);
  rec.rec('O12A-explain1', '说明含起算口径"2026-09"', rs.explain.indexOf('2026-09') >= 0, 'explain has fromYM', 'yes');
  rec.rec('O12A-explain2', '说明含恒等式 672920+本金+利息',
    rs.explain.indexOf('672920') >= 0 && rs.explain.indexOf('=') >= 0, 'identity present', 'yes');
  // engine intermediates consistency (no duplicated history)
  const it = r.d.r.intermediates;
  rec.near('O12A-eng-principal', 'intermediates.R储本金 与说明一致', it.R储本金, 47691.20, 0.01);
  rec.near('O12A-eng-interest', 'intermediates.R储利息 与说明一致', it.R储利息, 75082.32, 0.01);
  rec.near('O12A-identity', '恒等式 anchor+本金+利息=R储',
    672920 + it.R储本金 + it.R储利息, 795693.52, 0.01);

  // MY2 cross check
  await mp.reLaunch('/pages/index/index'); await sleep(1500);
  const idx2 = await rr(() => mp.currentPage());
  const r2 = await runCase(mp, idx2, 'MY2');
  const rs2 = r2.d.vm.rStore;
  // 定稿数据集 MY2：R储 996432.00 / 本金 238442.88 / 利息 85069.12
  rec.near('O12A-MY2-total', 'MY2 R储=996432.00', num(rs2.total), 996432.00, 0.01);
  rec.near('O12A-MY2-principal', 'MY2 本金=238442.88', num(rs2.principalText), 238442.88, 0.01);
  rec.near('O12A-MY2-interest', 'MY2 利息=85069.12', num(rs2.interestText), 85069.12, 0.01);
  const shot = await screenshot(mp, 'ui-output-4-my2result.png');
  rec.rec('O12A-shot', 'MY2结果页真实渲染截图', !!shot, shot && shot.bytes, 'PNG>40KB');

  // ---- Bug24：两案注释均不得含案号或他案专属串 ----
  async function scanNotes(page) {
    const els = await rr(() => page.$$('.muted, .warn, .note'));
    let all = '';
    for (const el of els) {
      try { all += String(await rr(() => el.text()) || '') + '\n'; } catch (e) {}
    }
    return all;
  }
  const FORBIDDEN = ['MY1', 'MY2', '本案 MY', '34行'];
  const txt1 = await scanNotes(r.page);
  rec.rec('O12A-NOTES-MY1', 'MY1 注释无案号/“34行”残留',
    !FORBIDDEN.some(f => txt1.indexOf(f) >= 0),
    FORBIDDEN.filter(f => txt1.indexOf(f) >= 0).join(',') || 'clean', 'clean');
  // MY1 案 N应缴注释动态绑定窗口 2000-11~2033-06（写死的旧串“自批准参保月2000-11起，”不再出现）
  rec.rec('O12A-N1', 'MY1 N应缴注释含动态窗口 2000-11~2033-06',
    txt1.indexOf('2000-11~2033-06') >= 0, 'window bound', '2000-11~2033-06');
  const txt2 = await scanNotes(r2.page);
  rec.rec('O12A-NOTES-MY2', 'MY2 注释无案号残留',
    !FORBIDDEN.some(f => txt2.indexOf(f) >= 0),
    FORBIDDEN.filter(f => txt2.indexOf(f) >= 0).join(',') || 'clean', 'clean');
  // 勾稽脚注必须带本案新值 MY2：94.9053÷32.6667=2.9053
  rec.rec('O12A-N2', 'MY2 勾稽脚注含 94.9053÷32.6667=2.9053',
    txt2.indexOf('94.9053÷32.6667=2.9053') >= 0, 'reconcile', 'dynamic value');
};

// ---------- O12B ----------
CASES.O12B = async (mp, indexPage, rec) => {
  const r = await runCase(mp, indexPage, 'MY1');
  // WXML structural check on the middle-variables card (Element.wxml, not Page.wxml)
  const cards = await rr(() => r.page.$$('.card'));
  let midCard = null;
  for (const c of cards) {
    const t = await rr(() => c.$('.card-title'));
    if (t && String(await rr(() => t.text()) || '').indexOf('中间变量') >= 0) { midCard = c; break; }
  }
  rec.rec('O12B-card', '找到中间变量卡', !!midCard, !!midCard, 'card');
  const wxml = midCard ? await rr(() => midCard.wxml()) : '';
  const hasOldPrincipalRow = /R补[\s\S]{0,400}?(本金|利息)/.test(wxml);
  rec.rec('O12B-no-repeat', 'R补下方无重复本金/利息段', !hasOldPrincipalRow,
    hasOldPrincipalRow ? 'PRESENT' : 'absent', 'absent');
  rec.rec('O12B-oldbind', '无 rPrincipalText/rInterestText 旧绑定',
    wxml.indexOf('rPrincipalText') < 0 && wxml.indexOf('rInterestText') < 0, 'old bindings removed', 'removed');
  // 31号文 body explanation retained
  const sub = r.d.vm.subsidy;
  rec.rec('O12B-status', 'R补状态说明保留', !!sub.statusText && sub.statusText.length > 0, sub.statusText.slice(0, 40), 'retained');
  rec.rec('O12B-notinc', '31号文notIncludedNote保留(虚拟计发额度)',
    sub.notIncludedNote.indexOf('虚拟计发额度') >= 0, sub.notIncludedNote.slice(0, 30), 'retained');
  rec.rec('O12B-formula', '31号文分档公式保留 showFormula=true', sub.showFormula === true, sub.showFormula, true);
  // 定稿 MY1 R补=10923.92
  rec.near('O12B-amount', 'R补金额=10923.92 保留', num(sub.amount), 10923.92, 0.01);
};

// ---------- O13 ----------
CASES.O13 = async (mp, indexPage, rec) => {
  const r = await runCase(mp, indexPage, 'MY1');
  const ann = r.d.vmAnnual;
  rec.rec('O13-len', '年度账行数=42(1992~2033)', ann.length === 42, ann.length, 42);
  rec.rec('O13-first', '首年=1992 末年=2033', ann[0].year === 1992 && ann[41].year === 2033,
    { first: ann[0].year, last: ann[41].year }, '1992/2033');

  const byY = {}; ann.forEach(a => byY[a.year] = a);
  // missing-payment years
  rec.rec('O13-noPay92-99', '1992~1999 缴费月=0(缺缴)',
    [1992,1993,1994,1995,1996,1997,1998,1999].every(y => +byY[y].paidMonths === 0),
    [1992,1993,1994,1995,1996,1997,1998,1999].map(y=>byY[y].paidMonths).join(','), 'all 0');
  rec.rec('O13-missingDenom', '1992~1995 缺分母显示—(source=missing)',
    [1992,1993,1994,1995].every(y => byY[y].source === 'missing' && byY[y].cText === '—'),
    [1992,1993,1994,1995].map(y=>byY[y].source).join(','), 'missing');
  // 2000: 2 months Xn=6142 zYear=0.4458
  rec.rec('O13-2000m', '2000 缴费月=2', +byY[2000].paidMonths === 2, byY[2000].paidMonths, 2);
  rec.near('O13-2000x', '2000 Xn=6142', num(byY[2000].xText), 6142, 0.5);
  rec.near('O13-2000z', '2000 Z年=0.4458', num(byY[2000].zYearText), 0.4458, 0.001);
  // 2001 z=2.6280
  rec.near('O13-2001z', '2001 Z年=2.6280', num(byY[2001].zYearText), 2.6280, 0.001);
  // 2025 z=2.9779 official
  rec.near('O13-2025z', '2025 Z年=2.9779', num(byY[2025].zYearText), 2.9779, 0.001);
  rec.rec('O13-2025src', '2025 source=official', byY[2025].source === 'official', byY[2025].source, 'official');
  // 2026 MY1（定稿数据集）：Xn=316642（8×35945.25+4×7270）z=2.1779，source=official（12116 在 policyData）
  rec.near('O13-2026x', 'MY1 2026 Xn=316642', num(byY[2026].xText), 316642, 0.5);
  rec.near('O13-2026z', 'MY1 2026 Z年=2.1779', num(byY[2026].zYearText), 2.1779, 0.001);
  rec.rec('O13-2026src', '2026 source=official(C=12116 官方全口径)',
    byY[2026].source === 'official', byY[2026].source, 'official');
  // future years 2027..2032 z=0.6 assumed; 2033 6 months
  rec.rec('O13-futurez', '2027~2032 Z年=0.6 且source=assumed',
    [2027,2028,2029,2030,2031,2032].every(y => Math.abs(num(byY[y].zYearText) - 0.6) < 0.001 && byY[y].source === 'assumed'),
    '0.6/assumed all', 'yes');
  rec.rec('O13-2033', '2033 缴费月=6 Z年=0.3', +byY[2033].paidMonths === 6 &&
    Math.abs(num(byY[2033].zYearText) - 0.3) < 0.001,
    { m: byY[2033].paidMonths, z: byY[2033].zYearText }, '6/0.3');

  // reconciliation: Σ月z/K应缴 == Z实（定稿 MY1=2.4032）
  const it = r.d.r.intermediates;
  rec.near('O13-zreal', '逐年勾稽 Z实=2.4032', it.Z实指数, 2.4032, 0.0005);
  // 勾稽分子取逐月明细（vmAnnual 无 zMonthText 字段，旧断言恒假）
  const months = r.d.r.monthlyDetails;
  const sumMonthZ = months.reduce((a, m) => a + m.z, 0);
  rec.near('O13-recon', 'Σ月z/K应缴 与Z实一致', sumMonthZ / months.length, 2.4032, 0.0005);

  // Ledger table itself is fully proven by the 19 data/DOM assertions above.
  // (Precise positioning calls (offset) repeatedly exhaust the automation WS,
  // so a separate minimal OSHOT case owns the ledger screenshot.)
};

// ---------- OREG two-case three components ----------
CASES.OREG = async (mp, indexPage, rec) => {
  const r1 = await runCase(mp, indexPage, 'MY1');
  const p1 = r1.d.vm.pension;
  // 定稿 MY1：J基础 7791.06 / J账户 5803.00 / J过渡 868.70 / 合计 14462.76
  rec.near('OREG-MY1-basic', 'MY1 J基础=7791.06', num(p1.basic), 7791.06, 0.02);
  rec.near('OREG-MY1-account', 'MY1 J账户=5803.00', num(p1.account), 5803.00, 0.02);
  rec.near('OREG-MY1-trans', 'MY1 J过渡=868.70', num(p1.transitional), 868.70, 0.02);
  rec.near('OREG-MY1-total', 'MY1 合计=14462.76', num(r1.d.totalDisplay), 14462.76, 0.02);
  let s1 = null;
  try { s1 = await screenshot(mp, 'ui-output-1-my1result.png'); } catch (e) {}
  rec.rec('OREG-shot1', 'MY1结果页渲染(无白屏)',
    r1.d.ready === true && !!s1, s1 && s1.bytes, 'ready+PNG');
};

// ---------- O2526 (Bug25/26)：输入页结构 + 非doc31参保起始参与N应缴（结果页金额） ----------
CASES.O2526 = async (mp, indexPage, rec) => {
  // 1) 输入页结构：5 cards / 标题连续 / 两个分项 / 无④-2
  const cards = await rr(() => indexPage.$$('.card'));
  const titles = [];
  for (const c of cards) {
    const t = await rr(() => c.$('.card-title'));
    if (t) titles.push(String(await rr(() => t.text()) || '').replace(/\s+/g, ' ').trim());
  }
  rec.rec('O2526-cards', '输入页5个card且编号连续', titles.length === 5 &&
    JSON.stringify(titles.map(t => t.slice(0, 1))) === JSON.stringify(['①','②','③','④','⑤']),
    JSON.stringify(titles), '5 cards ①-⑤');
  rec.rec('O2526-c4', '④=个人账户养老金', titles[3].indexOf('个人账户养老金') >= 0,
    titles[3], '④ 个人账户养老金');
  rec.rec('O2526-no42', '无④-2标题', titles.every(t => t.indexOf('④-2') < 0),
    JSON.stringify(titles), 'no ④-2');
  const subs = await rr(() => cards[3].$$('.subhead'));
  const subTexts = [];
  for (const el of subs) subTexts.push(String(await rr(() => el.text()) || ''));
  rec.rec('O2526-subs', '④内两个分项小标题', subs.length === 2 &&
    subTexts.some(t => t.indexOf('个人账户储蓄额') >= 0) &&
    subTexts.some(t => t.indexOf('人员身份与 R补') >= 0),
    JSON.stringify(subTexts), 'two subheads');
  // 2) 字段在基本信息且非doc31可填
  const basic = cards[0];
  const bLabels = await rr(() => basic.$$('.label'));
  const bTexts = [];
  for (const el of bLabels) bTexts.push(String(await rr(() => el.text()) || ''));
  rec.rec('O2526-field', '企业实际参保缴费起始在①基本信息',
    bTexts.some(t => t.indexOf('企业实际参保缴费起始') >= 0), JSON.stringify(bTexts), 'in section ①');
  const c4Labels = await rr(() => cards[3].$$('.label'));
  const c4Texts = [];
  for (const el of c4Labels) c4Texts.push(String(await rr(() => el.text()) || ''));
  rec.rec('O2526-c4absent', '④内无该字段',
    c4Texts.every(t => t.indexOf('企业实际参保缴费起始') < 0), JSON.stringify(c4Texts), 'absent in ④');
  // 3) 非 doc31 填 2004-09 后跑结果页：设计 §3.4 差异案值
  await rr(() => indexPage.setData(wifeDiffPayloadOutput()));
  await sleep(300);
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
  await sleep(1200);
  const d = await rr(() => page.data(), 4);
  if (!d.ready || !d.vm) throw new Error('result not ready');
  const it = d.r.intermediates, pn = d.r.pension;
  rec.rec('O2526-K', '差异案 K=322（窗口2004-09起）', it.K应缴月 === 322, it.K应缴月, 322);
  rec.near('O2526-N', '差异案 N应缴=26.8333', it.N应缴, 26.8333, 0.0001);
  rec.near('O2526-Z', '差异案 Z实=2.3872', it.Z实指数, 2.3872, 0.0002);
  rec.near('O2526-Jb', '差异案 J基础=5339.69', pn.J基础, 5339.69, 0.02);
  rec.near('O2526-Ja', '差异案 J账户=3706.48', pn.J账户, 3706.48, 0.02);
  rec.near('O2526-T', '差异案 月合计=9046.17', d.totalDisplay, 9046.17, 0.02);
};
// 差异案造数（MY3 同数据，enterpriseInsuredYM=2004-09）
function wifeDiffPayloadOutput() {
  const yearRows = [
    [2003, 10000, 4, 9], [2004, 39000], [2005, 27892, 7], [2006, 38700, 9],
    [2007, 59493], [2008, 71160], [2009, 89202], [2010, 101340], [2011, 121005],
    [2012, 137451], [2013, 160677], [2014, 170562], [2015, 190428], [2016, 212370],
    [2017, 210678], [2018, 215538], [2019, 224748], [2020, 222000], [2021, 236418],
    [2022, 345994], [2023, 394650], [2024, 415044], [2025, 426564]
  ];
  const segs = yearRows.map(([y, annual, mo0, sm0]) => {
    const months = mo0 || 12, sm = sm0 || 1;
    const toYMn = idx => Math.floor(idx / 12) + '-' + String(idx % 12 + 1).padStart(2, '0');
    const sIdx = y * 12 + (sm - 1);
    return { type: 'enterprise', startYM: toYMn(sIdx), endYM: toYMn(sIdx + months - 1),
      baseMonthly: String(annual / months) };
  });
  segs.push({ type: 'enterprise', startYM: '2026-01', endYM: '2031-06', baseMonthly: '36348' });
  return {
    gender: 'female', femaleType: 'worker', birthYM: '1981-07',
    workStartYM: '2003-09', retireYM: '2031-07',
    hasDeemed: false, deemedStartYM: '', deemedEndYM: '',
    entryMode: 'month', segments: segs,
    accountBalanceManual: '481459', manualBalanceYM: '2025-12', futureMonthlyRatePct: '1.5',
    doc31Eligible: false, doc31TransferYM: '', enterpriseInsuredYM: '2004-09',
    subsidyExcludedText: '', baseYearIndex: 0, cPingOverride: '', customCYearText: '',
    boundWarnings: [], errorMsg: '', yearRows: []
  };
}

// Dedicated minimal ledger screenshot (fresh port, fresh WS).
CASES.OSHOT = async (mp, indexPage, rec) => {
  const r = await runCase(mp, indexPage, 'MY1');
  // Test-only: hide cards rendered BELOW the ledger so a blind scroll-to-bottom
  // lands on the ledger. The ledger card/data itself is untouched.
  await rr(() => r.page.setData({ monthlyGroups: [], expandedYear: null }));
  // hide warnings card (bound to r.meta.warnings) without mutating product
  await rr(() => r.page.setData({ 'r.meta.warnings': [] }));
  await sleep(300);
  // scroll to bottom in steps
  for (const st of [1500, 2600, 3800, 4600]) {
    await rr(() => mp.callWxMethod('pageScrollTo', { scrollTop: st, duration: 0 }));
    await sleep(350);
  }
  const after = await rr(() => mp.currentPage());
  const onResult = !!(after.path && after.path.indexOf('pages/result/result') >= 0);
  rec.rec('OSHOT-page', '截图时仍在结果页', onResult, after.path, 'pages/result/result');
  const lp = path.join(OUT, 'ui-output-3-ledger.png');
  try { fs.unlinkSync(lp); } catch (e) {}
  await mp.screenshot({ path: lp });
  await sleep(400);
  const b = fs.statSync(lp).size;
  rec.rec('OSHOT-png', '明细账截图已保存(真实渲染)', b > 40000, b, 'PNG>40KB');
};

// MY2 regression in a fully independent case/port (no connection reuse after MY1 screenshot)
CASES.OREG2 = async (mp, indexPage, rec) => {
  const r2 = await runCase(mp, indexPage, 'MY2');
  const p2 = r2.d.vm.pension;
  // 定稿 MY2：J基础 8940.37 / J账户 7263.58 / J过渡 1050.17 / 合计 17254.12
  rec.near('OREG-MY2-basic', 'MY2 J基础=8940.37', num(p2.basic), 8940.37, 0.02);
  rec.near('OREG-MY2-account', 'MY2 J账户=7263.58', num(p2.account), 7263.58, 0.02);
  rec.near('OREG-MY2-trans', 'MY2 J过渡=1050.17', num(p2.transitional), 1050.17, 0.02);
  rec.near('OREG-MY2-total', 'MY2 合计=17254.12', num(r2.d.totalDisplay), 17254.12, 0.02);
  let s2 = null;
  try { s2 = await screenshot(mp, 'ui-output-4-my2result.png'); } catch (e) {}
  rec.rec('OREG-shot2', 'MY2结果页渲染(无白屏)',
    r2.d.ready === true && !!s2, s2 && s2.bytes, 'ready+PNG');
};

(async () => {
  if (!CASES[CASE]) throw new Error('unknown ' + CASE);
  const mp = await connect();
  const rec = makeRec();
  let fatal = null;
  try {
    const page = await relaunchIndex(mp);
    await CASES[CASE](mp, page, rec);
  } catch (e) { fatal = String(e && e.message || e);
  } finally { try { await mp.disconnect(); } catch (e) {} }
  const totals = rec.list.reduce((a, x) => { x.pass ? a.pass++ : a.fail++; return a; },
    { pass: 0, fail: 0 });
  const summary = { case: CASE, ok: !fatal && totals.fail === 0, fatal, totals,
    assertions: rec.list, finishedAt: new Date().toISOString(),
    runContext: { automationPort: PORT, project: PROJECT } };
  fs.writeFileSync(path.join(OUT, 'ui-output-' + CASE + '.json'),
    JSON.stringify(summary, null, 2), 'utf8');
  console.log('DONE ' + CASE + ' pass=' + totals.pass + ' fail=' + totals.fail +
    (fatal ? ' fatal=' + fatal : ''));
  process.exit(summary.ok ? 0 : 2);
})();
