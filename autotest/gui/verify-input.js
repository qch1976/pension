// verify-input.js — pension input page items 5~11 + Bug25/26 structure, real-device E2E via live simulator.
// Run: GUI_AUTO_PORT=<fresh cli auto port> node verify-input.js S5|S6|S7|S8|S9|S10|S11|S22|S25|S26
// Each case gets its OWN one-shot cli auto port (see run-verify-input.js).
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const OUT = PROJECT + '\\autotest\\output\\gui';
const SDK_DIR = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const automator = require(SDK_DIR);
const PORT = parseInt(process.env.GUI_AUTO_PORT || '9701', 10);
const CASE = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });

// My-Case.md annual table (annual contribution total; monthly = annual / months paid)
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
  // 定稿口径：未来段基数 = z × 12116（MY1 0.6 档按元取整=7270）
  const SOCIAL_2026 = 12116;
  const fb = z === 0.6 ? 7270 : Math.round(z * SOCIAL_2026);
  segs.push({ type: type, startYM: '2026-09', endYM: '2033-06', baseMonthly: String(fb) });
  return segs;
}
function myCasePayload() {
  return {
    gender: 'male', femaleType: 'worker',
    birthYM: '1973-07', workStartYM: '1995-07', retireYM: '2033-07',
    // Bug22：doc31 案 hasDeemed=true 带视同起止
    hasDeemed: true,
    deemedStartYM: '1995-07', deemedEndYM: '2000-10',
    entryMode: 'month', segments: buildSegments(0.6, 'flexible'),
    accountBalanceManual: '672920', manualBalanceYM: '2026-08', futureMonthlyRatePct: '1.5',
    doc31Eligible: true, doc31TransferYM: '2000-11', enterpriseInsuredYM: '2000-11',
    subsidyExcludedText: '', baseYearIndex: 0, cPingOverride: '', customCYearText: '',
    boundWarnings: [], errorMsg: ''
  };
}

// ---- Bug26 差异案造数（与 verify-wife MY3 同数据，企业实际参保起始=2004-09） ----
const wifeYearRows = [
  ['2003', '9', '4', '10000'], ['2004', '1', '12', '39000'], ['2005', '1', '7', '27892'],
  ['2006', '1', '9', '38700'], ['2007', '1', '12', '59493'], ['2008', '1', '12', '71160'],
  ['2009', '1', '12', '89202'], ['2010', '1', '12', '101340'], ['2011', '1', '12', '121005'],
  ['2012', '1', '12', '137451'], ['2013', '1', '12', '160677'], ['2014', '1', '12', '170562'],
  ['2015', '1', '12', '190428'], ['2016', '1', '12', '212370'], ['2017', '1', '12', '210678'],
  ['2018', '1', '12', '215538'], ['2019', '1', '12', '224748'], ['2020', '1', '12', '222000'],
  ['2021', '1', '12', '236418'], ['2022', '1', '12', '345994'], ['2023', '1', '12', '394650'],
  ['2024', '1', '12', '415044'], ['2025', '1', '12', '426564']
];
function wifeExpandRows() {
  return wifeYearRows.map(r => {
    const year = +r[0], sm = +r[1], k = +r[2], annual = +r[3];
    const toYM = idx => Math.floor(idx / 12) + '-' + String(idx % 12 + 1).padStart(2, '0');
    const startIdx = year * 12 + (sm - 1);
    return { type: 'enterprise', startYM: toYM(startIdx), endYM: toYM(startIdx + k - 1),
      baseMonthly: String(annual / k) };
  });
}
function wifeDiffPayload() {
  const segments = wifeExpandRows();
  segments.push({ type: 'enterprise', startYM: '2026-01', endYM: '2031-06', baseMonthly: '36348' });
  return {
    gender: 'female', femaleType: 'worker',
    birthYM: '1981-07', workStartYM: '2003-09', retireYM: '2031-07',
    hasDeemed: false, deemedStartYM: '', deemedEndYM: '',
    entryMode: 'month', segments: segments,
    accountBalanceManual: '481459', manualBalanceYM: '2025-12', futureMonthlyRatePct: '1.5',
    doc31Eligible: false, doc31TransferYM: '', enterpriseInsuredYM: '2004-09',
    subsidyExcludedText: '', baseYearIndex: 0, cPingOverride: '', customCYearText: '',
    boundWarnings: [], errorMsg: '', yearRows: []
  };
}

// retry wrapper for flaky automator WebSocket calls (single response timeouts are transient)
async function rr(fn, n) {
  let e = null;
  for (let i = 0; i < (n || 3); i++) {
    try { return await fn(); }
    catch (x) { e = x; await sleep(700 * (i + 1)); }
  }
  throw e;
}
async function connect() {
  let lastErr = null;
  for (let i = 0; i < 25; i++) {
    try { return await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT }); }
    catch (e) { lastErr = e; await sleep(1500); }
  }
  throw new Error('connect failed: ' + (lastErr && lastErr.message));
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
  await sleep(500);
  return page || rr(() => mp.currentPage());
}
async function calcAndReadIntermediates(mp, indexPage) {
  // Trigger safely: a response timeout is ambiguous. After each trigger attempt,
  // observe the page. onCalculate has a re-entry guard, so re-calling is harmless.
  let running = false;
  for (let attempt = 0; attempt < 4 && !running; attempt++) {
    try { await indexPage.callMethod('onCalculate'); } catch (e) {}
    const ot = Date.now();
    while (Date.now() - ot < 3000) {
      let cur = null;
      try { cur = await rr(() => mp.currentPage()); } catch (e) {}
      if (cur && cur.path && cur.path.indexOf('pages/result/result') >= 0) { running = true; break; }
      if (cur && cur.path && cur.path.indexOf('pages/index/index') >= 0) {
        let dd = null;
        try { dd = await rr(() => cur.data()); } catch (e) {}
        if (dd && dd.calculating) { running = true; break; }
        if (dd && dd.errorMsg) throw new Error('blocked: ' + dd.errorMsg);
      }
      await sleep(200);
    }
  }
  if (!running) throw new Error('calculation did not start after retries');

  const t0 = Date.now(); let page = null;
  while (Date.now() - t0 < 25000) {
    try { page = await rr(() => mp.currentPage()); } catch (e) {}
    if (page && page.path && page.path.indexOf('pages/result/result') >= 0) break;
    await sleep(400);
  }
  if (!page || !page.path || page.path.indexOf('pages/result/result') < 0) {
    const cur = await rr(() => mp.currentPage());
    const d = await rr(() => cur.data());
    throw new Error('blocked: ' + (d.errorMsg || 'validation error'));
  }
  await sleep(800);
  const d = await rr(() => page.data(), 4);
  if (!d.r || !d.r.intermediates) throw new Error('no intermediates');
  return { page: page, it: d.r.intermediates };
}
async function texts(page, cls) {
  const els = await rr(() => page.$$(cls));
  const out = [];
  for (const el of els) {
    try { out.push(String(await rr(() => el.text()) || '')); } catch (e) {}
  }
  return out;
}
async function findCard(page, titlePart) {
  const cards = await rr(() => page.$$('.card'));
  for (const c of cards) {
    try {
      const t = await rr(() => c.$('.card-title'));
      if (t && String(await rr(() => t.text()) || '').indexOf(titlePart) >= 0) return c;
    } catch (e) {}
  }
  return null;
}
function makeRec() {
  const list = [];
  return {
    list: list,
    rec: (id, title, pass, actual, expected) => list.push({ id, title, pass: !!pass, actual, expected }),
    near: (id, title, actual, expected, tol) => {
      const a = Number(actual);
      list.push({ id, title, pass: isFinite(a) && Math.abs(a - expected) <= tol,
        actual: Math.round(a * 1e6) / 1e6, expected: expected + ' +/-' + tol });
    }
  };
}
async function screenshot(mp, name) {
  const p = path.join(OUT, name);
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

const CASES = {};

// ---- S5 (#5): deemed contribution = start/end month pickers; 1995-07~2000-10 => 64 months
CASES.S5 = async (mp, page, rec) => {
  const card = await findCard(page, '视同缴费年限');
  rec.rec('S5-1', '②视同卡片存在', !!card, !!card, 'card found');
  const pickers = card ? await rr(() => card.$$('picker')) : [];
  rec.rec('S5-2', '②卡片内有2个年月选择器', pickers.length === 2, pickers.length, 2);
  const inputs = card ? await rr(() => card.$$('input')) : [];
  rec.rec('S5-3', '②卡片内无直接月数输入框', inputs.length === 0, inputs.length, 0);
  const d0 = await rr(() => page.data());
  rec.rec('S5-4', '页面data无deemedMode/deemedMonths',
    !('deemedMode' in d0) && !('deemedMonths' in d0),
    { deemedMode: 'deemedMode' in d0, deemedMonths: 'deemedMonths' in d0 }, 'both absent');

  await rr(() => page.setData(myCasePayload()));
  await sleep(300);

  // Calc FIRST (a pre-calc screenshot tends to exhaust the WS for the next call)
  const r = await calcAndReadIntermediates(mp, page);
  rec.rec('S5-6', '引擎得出视同64月', r.it.deemedMonths === 64, r.it.deemedMonths, 64);

  const shotR = await screenshot(mp, 'ui-input-3-result.png'); // evidence shot 3: result page
  rec.rec('S5-7', '结果页端到端截图', !!shotR, shotR && shotR.bytes, 'PNG >40KB');

  // then the filled input page (reLaunch restores draft from storage)
  let shot = null;
  try {
    await mp.reLaunch('/pages/index/index');
    await sleep(1800);
    shot = await screenshot(mp, 'ui-input-1-filled.png'); // evidence shot 1
  } catch (e) {}
  rec.rec('S5-5', '输入页真实渲染截图', !!shot, shot && shot.bytes, 'PNG >40KB');
};

// ---- S22 (Bug22): deemed-years explicit yes/no, clearable, no residue ----
CASES.S22 = async (mp, page, rec) => {
  // 1) 冷启动（清 storage）：默认无、起止空、有“无视同缴费年限”明确提示
  try { await mp.callWxMethod('clearStorageSync'); } catch (e) {}
  await mp.reLaunch('/pages/index/index').catch(() => {});
  await sleep(1500);
  let p0 = await rr(() => mp.currentPage());
  const d0 = await rr(() => p0.data());
  rec.rec('S22-1', '默认 hasDeemed=false', d0.hasDeemed === false, d0.hasDeemed, false);
  rec.rec('S22-2', '默认视同起止为空', d0.deemedStartYM === '' && d0.deemedEndYM === '',
    { s: d0.deemedStartYM, e: d0.deemedEndYM }, 'both empty');
  const muted = await texts(p0, '.muted');
  rec.rec('S22-3', '无视同时明确提示“无视同缴费年限”',
    muted.some(t => t.indexOf('无视同缴费年限') >= 0),
    JSON.stringify(muted.filter(t => t.indexOf('视同') >= 0)), 'contains hint');
  // 默认状态下卡片内无 picker（起止隐藏）
  const card0 = await findCard(p0, '视同缴费年限');
  const pk0 = card0 ? await rr(() => card0.$$('picker')) : [];
  rec.rec('S22-4', '无视同时起止 picker 隐藏(0个)', pk0.length === 0, pk0.length, 0);

  // 2) 先录 MY1/2 式数据（有视同），测算
  await rr(() => p0.setData(myCasePayload()));
  await sleep(300);
  const r1 = await calcAndReadIntermediates(mp, p0);
  rec.rec('S22-5', '有视同案 deemedMonths=64', r1.it.deemedMonths === 64, r1.it.deemedMonths, 64);

  // 3) 模拟“切到 MY3/4”：直接置无视同案数据且不拨开关（旧 bug 场景）→ onLoad/setHasDeemed 路径必须清残留。
  //    这里走真实开关交互：点“无视同缴费年限”
  await mp.reLaunch('/pages/index/index');
  await sleep(1600);
  p0 = await rr(() => mp.currentPage());
  // 从 storage 恢复后 hasDeemed=true（旧案），点开关
  const card = await findCard(p0, '视同缴费年限');
  const noOpt = card ? await rr(() => card.$$('text.opt')) : [];
  let tapped = false;
  for (const el of noOpt) {
    const t = String(await rr(() => el.text()) || '');
    if (t.indexOf('无视同缴费年限') >= 0) { await rr(() => el.tap()); tapped = true; break; }
  }
  rec.rec('S22-6', '点到“无视同缴费年限”按钮', tapped, tapped, 'tapped');
  const d1 = await rr(() => p0.data());
  rec.rec('S22-7', '切无视同后 hasDeemed=false 且起止清空',
    d1.hasDeemed === false && d1.deemedStartYM === '' && d1.deemedEndYM === '',
    { has: d1.hasDeemed, s: d1.deemedStartYM, e: d1.deemedEndYM }, 'cleared');

  // 4) 无视同案测算：引擎维持 N同=0 / deemedMonths=0，且 N实98 不使用视同
  const wifePayload = {
    gender: 'female', femaleType: 'worker',
    birthYM: '1981-07', workStartYM: '2003-09', retireYM: '2031-07',
    hasDeemed: false, deemedStartYM: '', deemedEndYM: '',
    entryMode: 'month',
    segments: [{ type: 'enterprise', startYM: '2003-09', endYM: '2031-06', baseMonthly: '8000' }],
    accountBalanceManual: '481459', manualBalanceYM: '2025-12', futureMonthlyRatePct: '1.5',
    doc31Eligible: false, doc31TransferYM: '', enterpriseInsuredYM: '',
    subsidyExcludedText: '', baseYearIndex: 0, cPingOverride: '', customCYearText: '',
    boundWarnings: [], errorMsg: ''
  };
  await rr(() => p0.setData(wifePayload));
  await sleep(300);
  const r2 = await calcAndReadIntermediates(mp, p0);
  rec.rec('S22-8', '无视同案 N同=0', r2.it.N同 === 0, r2.it.N同, 0);
  rec.rec('S22-9', '无视同案 deemedMonths=0（引擎不使用视同）', r2.it.deemedMonths === 0, r2.it.deemedMonths, 0);
  rec.near('S22-10', '无视同案 N应缴=27.8333（窗口2003-09起）', r2.it.N应缴, 27.8333, 0.0001);

  // 5) storage 迁移：旧格式草稿（无 hasDeemed、有旧值）不被强覆盖为丢失，onLoad 派生 hasDeemed=true
  await mp.callWxMethod('setStorageSync', 'pension_input_v1', {
    gender: 'male', workStartYM: '1995-07', retireYM: '2033-07',
    deemedStartYM: '1995-07', deemedEndYM: '2000-10'
  });
  await mp.reLaunch('/pages/index/index');
  await sleep(1600);
  p0 = await rr(() => mp.currentPage());
  const d3 = await rr(() => p0.data());
  rec.rec('S22-11', '旧草稿迁移：有旧值 → hasDeemed 派生 true 且旧值保留',
    d3.hasDeemed === true && d3.deemedStartYM === '1995-07' && d3.deemedEndYM === '2000-10',
    { has: d3.hasDeemed, s: d3.deemedStartYM }, 'derived true, kept');

  // 6) 注释不含案号/旧年份串（Bug24 输入页）
  const allMuted = (await texts(p0, '.muted')).concat(await texts(p0, '.card-title')).join('\n');
  rec.rec('S22-12', '输入页注释不含 MY1/MY2 案号',
    allMuted.indexOf('MY1') < 0 && allMuted.indexOf('MY2') < 0,
    'scanned', 'no case tag');
};

// ---- S6 (#6): reset truly empties every input
CASES.S6 = async (mp, page, rec) => {
  const filled = myCasePayload();
  filled.segments = [{ type: 'enterprise', startYM: '2000-11', endYM: '2026-08', baseMonthly: '35811' }];
  filled.yearRows = [{ year: '2024', startMonth: '1', months: '12', type: 'enterprise', annualBase: '415044' }];
  filled.subsidyExcludedText = '1995-01~1996-12';
  filled.cPingOverride = '12049';
  filled.customCYearText = '1992=500';
  await rr(() => page.setData(filled));
  await sleep(300);

  // real tap on the ghost button (scroll to bottom first)
  await rr(() => mp.callWxMethod('pageScrollTo', { scrollTop: 99999, duration: 0 }));
  await sleep(600);
  const btn = await rr(() => page.$('.btn-ghost'));
  rec.rec('S6-0', '清空按钮存在', !!btn, !!btn, '.btn-ghost');
  await rr(() => btn.tap());
  await sleep(800);

  const d = await rr(() => page.data());
  const emptyChecks = [
    ['birthYM', '出生年月'], ['workStartYM', '参加工作年月'], ['retireYM', '退休年月'],
    ['deemedStartYM', '视同起始'], ['deemedEndYM', '视同终止'],
    ['accountBalanceManual', '账户累计额'], ['manualBalanceYM', '余额所在年月'],
    ['futureMonthlyRatePct', '年利率'], ['subsidyExcludedText', '补贴扣除区'],
    ['cPingOverride', '手工C平'], ['customCYearText', '缺口年度文本'], ['gender', '性别']
  ];
  for (const [k, label] of emptyChecks) {
    rec.rec('S6-' + k, '清空后 ' + label + ' 为空', d[k] === '', JSON.stringify(d[k]), '""');
  }
  rec.rec('S6-seg', '清空后缴费段基数为空',
    Array.isArray(d.segments) && d.segments.every(s => !s.baseMonthly),
    JSON.stringify(d.segments), 'all baseMonthly empty');
  rec.rec('S6-year', '清空后年度记录为默认空行(year/annualBase空)',
    Array.isArray(d.yearRows) && d.yearRows.every(r => !r.year && !r.annualBase),
    JSON.stringify(d.yearRows), 'year & annualBase empty');
  rec.rec('S6-doc31', '清空后31号文字段归空/否',
    d.doc31Eligible === false && !d.doc31TransferYM && !d.enterpriseInsuredYM,
    { doc31Eligible: d.doc31Eligible, doc31TransferYM: d.doc31TransferYM }, 'false/empty');

  // storage also cleared: reLaunch -> onLoad must not restore values
  await mp.reLaunch('/pages/index/index');
  await sleep(1500);
  const cur = await rr(() => mp.currentPage());
  const d2 = await rr(() => cur.data());
  rec.rec('S6-storage', '重进后仍为空(缓存已清)', d2.accountBalanceManual === '' && d2.deemedStartYM === '',
    { accountBalanceManual: d2.accountBalanceManual, deemedStartYM: d2.deemedStartYM }, 'empty after onLoad');
};

// ---- S7 (#7): numbers horizontally centered in every input
CASES.S7 = async (mp, page, rec) => {
  await rr(() => page.setData(Object.assign(myCasePayload(), { entryMode: 'month' })));
  await sleep(400);
  const mInputs = await rr(() => page.$$('input'));
  let allCenter = true; const details = [];
  for (const el of mInputs) {
    const ta = await rr(() => el.style('text-align'));
    details.push(ta);
    if (ta !== 'center') allCenter = false;
  }
  rec.rec('S7-month', '月度模式所有input text-align=center(' + mInputs.length + '个)',
    allCenter && mInputs.length >= 3, JSON.stringify(details), '["center",...]');

  await rr(() => page.setData({
    entryMode: 'year',
    yearRows: [{ year: '2024', startMonth: '1', months: '12', type: 'enterprise', annualBase: '415044' }]
  }));
  await sleep(500);
  const yInputs = await rr(() => page.$$('input'));
  let allCenter2 = true; const details2 = [];
  for (const el of yInputs) {
    const ta = await rr(() => el.style('text-align'));
    details2.push(ta);
    if (ta !== 'center') allCenter2 = false;
  }
  rec.rec('S7-year', '年度模式所有input text-align=center(' + yInputs.length + '个)',
    allCenter2 && yInputs.length >= 5, JSON.stringify(details2), '["center",...]');
};

// ---- S8 (#8): account sub-item only balance + future annual interest; roll-forward still correct
CASES.S8 = async (mp, page, rec) => {
  // Bug25：账户内容现为 ④「个人账户养老金」卡内分项「① 个人账户储蓄额」
  const card = await findCard(page, '个人账户养老金');
  rec.rec('S8-1', '④个人账户养老金卡片存在', !!card, !!card, 'card found');
  const subheads = card ? await rr(() => card.$$('.subhead')) : [];
  let subTitles = [];
  for (const el of subheads) {
    try { subTitles.push(String(await rr(() => el.text()) || '')); } catch (e) {}
  }
  rec.rec('S8-1b', '④卡内有两个分项小标题', subTitles.length === 2 &&
    subTitles.some(t => t.indexOf('个人账户储蓄额') >= 0) &&
    subTitles.some(t => t.indexOf('人员身份与 R补') >= 0),
    JSON.stringify(subTitles), '① 个人账户储蓄额 / ② 人员身份与 R补');
  // doc31 关闭时项②不展开，④卡内控件全部属于项①：2 input + 1 picker
  await rr(() => page.setData(Object.assign(myCasePayload(), { doc31Eligible: false })));
  await sleep(300);
  const inputs = card ? await rr(() => card.$$('input')) : [];
  const pickers = card ? await rr(() => card.$$('picker')) : [];
  rec.rec('S8-2', '账户分项只剩2个输入(累计额+年利率)', inputs.length === 2, inputs.length, 2);
  rec.rec('S8-3', '账户分项1个年月picker(余额所在年月)', pickers.length === 1, pickers.length, 1);

  const allText = (await texts(page, '.label'))
    .concat(await texts(page, '.muted'), await texts(page, '.card-title')).join('\n');
  for (const kw of ['利息模式', '计息口径', '固定利率', '兜底', '缺失年度预估利率']) {
    rec.rec('S8-kw-' + kw, '页面无「' + kw + '」文案', allText.indexOf(kw) < 0,
      allText.indexOf(kw) < 0 ? 'absent' : 'PRESENT', 'absent');
  }
  const d0 = await rr(() => page.data());
  rec.rec('S8-data', 'data无interestMode/fixedRatePct/fallbackRatePct/intraYearMethod',
    !('interestMode' in d0) && !('fixedRatePct' in d0) &&
    !('fallbackRatePct' in d0) && !('intraYearMethod' in d0),
    ['interestMode' in d0, 'fixedRatePct' in d0, 'fallbackRatePct' in d0, 'intraYearMethod' in d0],
    'all absent');

  await rr(() => page.setData(myCasePayload()));
  await sleep(200);
  const r = await calcAndReadIntermediates(mp, page);
  // 定稿未来基数 7270 下 R储=795693.52
  rec.near('S8-roll', '账户前滚正确 R储=795693.52', r.it.R储, 795693.52, 0.02);
};

// ---- S25 (Bug25)：section 合并——5 cards、标题连续、两个分项、无④-2 ----
CASES.S25 = async (mp, page, rec) => {
  const cards = await rr(() => page.$$('.card'));
  // errorMsg 卡 wx:if 默认不渲染，故此处为 5 张业务卡
  const titles = [];
  for (const c of cards) {
    try {
      const t = await rr(() => c.$('.card-title'));
      if (t) titles.push(String(await rr(() => t.text()) || '').replace(/\s+/g, ' ').trim());
    } catch (e) {}
  }
  rec.rec('S25-1', '输入页共5个card', titles.length === 5, titles.length, 5);
  rec.rec('S25-2', '编号依次①②③④⑤',
    JSON.stringify(titles.map(t => t.slice(0, 1))), JSON.stringify(['①','②','③','④','⑤']));
  rec.rec('S25-3', '④标题=个人账户养老金', titles[3].indexOf('个人账户养老金') >= 0,
    titles[3], '④ 个人账户养老金');
  rec.rec('S25-4', '页面无④-2字样', titles.every(t => t.indexOf('④-2') < 0),
    JSON.stringify(titles), 'no ④-2');
  const c4 = cards[3];
  const subs = await rr(() => c4.$$('.subhead'));
  const subTexts = [];
  for (const el of subs) subTexts.push(String(await rr(() => el.text()) || ''));
  rec.rec('S25-5', '④内可见两个分项小标题', subs.length === 2 &&
    subTexts.some(t => t.indexOf('① 个人账户储蓄额') >= 0) &&
    subTexts.some(t => t.indexOf('② 人员身份与 R补') >= 0),
    JSON.stringify(subTexts), '① 个人账户储蓄额 / ② 人员身份与 R补');
  // 原控件在位：余额三控件
  await rr(() => page.setData(myCasePayload()));
  await sleep(300);
  const c4filled = (await rr(() => page.$$('.card')))[3];
  const ins = await rr(() => c4filled.$$('input'));
  const pks = await rr(() => c4filled.$$('picker'));
  const tas = await rr(() => c4filled.$$('textarea'));
  rec.rec('S25-6', '④内控件齐全(3 input[含分段?] / 至少4 picker / 1 textarea)',
    ins.length >= 2 && pks.length >= 4 && tas.length === 1,
    { inputs: ins.length, pickers: pks.length, textareas: tas.length }, '>=2 / >=4 / 1');
};

// ---- S26 (Bug26)：企业实际参保缴费起始在基本信息、非doc31可填且参与N应缴 ----
CASES.S26 = async (mp, page, rec) => {
  // doc31 关闭（普通人员默认状态）：基本信息卡内可见参保起始 picker
  let basic = await findCard(page, '基本信息');
  let pks = basic ? await rr(() => basic.$$('picker')) : [];
  rec.rec('S26-1', '基本信息卡存在且含多个picker(含参保起始)', pks.length >= 4, pks.length, '>=4');
  let labels = basic ? await rr(() => basic.$$('.label')) : [];
  const labelTexts = [];
  for (const el of labels) labelTexts.push(String(await rr(() => el.text()) || ''));
  rec.rec('S26-2', '「企业实际参保缴费起始」在基本信息', labelTexts.some(t => t.indexOf('企业实际参保缴费起始') >= 0),
    JSON.stringify(labelTexts), 'contains field');
  // ④卡内不再出现该字段（doc31 关闭）
  let c4 = (await rr(() => page.$$('.card')))[3];
  let c4labels = await rr(() => c4.$$('.label'));
  let c4text = [];
  for (const el of c4labels) c4text.push(String(await rr(() => el.text()) || ''));
  rec.rec('S26-3', '④卡内无企业实际参保缴费起始', c4text.every(t => t.indexOf('企业实际参保缴费起始') < 0),
    JSON.stringify(c4text), 'absent in ④');
  // 非 doc31 人员填 2004-09（晚于参工月2003-09）→ N应缴按企业实际参保起始（设计 §3.4）。
  // 造数与 verify-wife MY3 完全相同（23 个历史段 + 未来 36348），仅改参保起始字段；
  // 窗口收窄后 2003-09~2004-08 实缴月移出窗口 → K=322/Z实=2.3872/合计=9046.17。
  const p = wifeDiffPayload();
  await rr(() => page.setData(p));
  await sleep(300);
  const r = await calcAndReadIntermediates(mp, page);
  rec.rec('S26-4', '非doc31可填后窗口起点=2004-09', r.it.K应缴月 === 322, r.it.K应缴月, 322);
  rec.near('S26-5', 'N应缴=26.8333（按企业实际参保起始）', r.it.N应缴, 26.8333, 0.0001);
  rec.near('S26-6', 'Z实=2.3872', r.it.Z实指数, 2.3872, 0.0002);
  const rd = await rr(() => r.page.data());
  rec.near('S26-7', '月合计=9046.17（企业实际参保起始传导）', rd.r.pension.total, 9046.17, 0.02);
};

// ---- S9 (#9): no N实98 input; engine derives N实98=3 (36 months)
CASES.S9 = async (mp, page, rec) => {
  const labels = await texts(page, '.label');
  const hasN98Label = labels.some(t => t.indexOf('N实98') >= 0);
  rec.rec('S9-1', '输入页无N实98输入label', !hasN98Label, JSON.stringify(labels.filter(t => t.indexOf('N实') >= 0)), 'absent');
  const d0 = await rr(() => page.data());
  rec.rec('S9-2', 'data无n98DeemedMonths', !('n98DeemedMonths' in d0), 'n98DeemedMonths' in d0, 'absent');

  await rr(() => page.setData(myCasePayload()));
  await sleep(200);
  const r = await calcAndReadIntermediates(mp, page);
  rec.near('S9-3', '引擎自动算出N实98=3(36月)', r.it.N实98, 3.0, 0.0001);
};

// ---- S10 (#10): subsidy plain-language explanation / renamed label visible
CASES.S10 = async (mp, page, rec) => {
  await rr(() => page.setData(Object.assign(myCasePayload(), { doc31Eligible: true })));
  await sleep(400);
  const muted = await texts(page, '.muted');
  const mJoin = muted.join('\n');
  rec.rec('S10-1', 'R补通俗说明可见(虚拟补贴)', mJoin.indexOf('虚拟补贴') >= 0,
    mJoin.indexOf('虚拟补贴') >= 0 ? 'found' : 'missing', 'contains 虚拟补贴');
  rec.rec('S10-2', '说明含"不能提取或继承"', mJoin.indexOf('不能提取或继承') >= 0,
    mJoin.indexOf('不能提取或继承') >= 0 ? 'found' : 'missing', 'visible');

  const labels = await texts(page, '.label');
  const renamed = labels.some(t => t.indexOf('已领取的一次性补贴扣除区间') >= 0);
  rec.rec('S10-3', '补贴项已改名「已领取的一次性补贴扣除区间」', renamed,
    JSON.stringify(labels.filter(t => t.indexOf('补贴') >= 0)), 'renamed label visible');

  // Bug25：R补括注(Z补贴)现为④卡内分项 .subhead 文案
  const title = await texts(page, '.card-title');
  const subheadTexts = await texts(page, '.subhead');
  rec.rec('S10-4', '分项标题含R补括注(Z补贴)', subheadTexts.some(t => t.indexOf('个人账户补贴额 Z补贴') >= 0),
    JSON.stringify(subheadTexts.filter(t => t.indexOf('R补') >= 0)), 'visible');

  const tas = await rr(() => page.$$('textarea'));
  let ph = '';
  for (const el of tas) { try { ph += ' ' + (await rr(() => el.attribute('placeholder'))); } catch (e) {} }
  rec.rec('S10-5', '扣除区placeholder含"大多数人留空"', ph.indexOf('大多数人留空') >= 0,
    ph.slice(0, 120), 'contains hint');
};

// ---- S11 (#11): waiting mask (spinner + 计算中) appears then disappears
CASES.S11 = async (mp, page, rec) => {
  await rr(() => page.setData(myCasePayload()));
  await sleep(300);

  try { await page.callMethod('onCalculate'); } catch (e) {}
  let sawMask = false, maskText = '', hasSpinner = false, maskShot = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 2500) {
    let cur = null;
    try { cur = await rr(() => mp.currentPage()); } catch (e) {}
    if (cur && cur.path && cur.path.indexOf('pages/index/index') >= 0) {
      const masks = await rr(() => cur.$$('.calc-mask'));
      if (masks.length) {
        sawMask = true;
        try {
          const tEl = await rr(() => masks[0].$('.calc-text'));
          if (tEl) maskText = String(await rr(() => tEl.text()) || '');
          const sp = await rr(() => masks[0].$('.calc-spinner'));
          hasSpinner = !!sp;
        } catch (e) {}
        if (!maskShot) maskShot = await screenshot(mp, 'ui-input-2-mask.png'); // evidence shot 2
        break;
      }
    }
    await sleep(25);
  }
  rec.rec('S11-1', '测算期间出现等待遮罩', sawMask, sawMask, 'mask appeared');
  rec.rec('S11-2', '遮罩含转圈(.calc-spinner)', hasSpinner, hasSpinner, 'spinner present');
  rec.rec('S11-3', '遮罩含"计算中"文案', maskText.indexOf('计算中') >= 0, JSON.stringify(maskText), 'contains 计算中');
  rec.rec('S11-4', '遮罩真实渲染截图', !!maskShot, maskShot && maskShot.bytes, 'PNG >40KB');

  // mask disappears after calculation (page navigates to result)
  const t1 = Date.now(); let navigated = false;
  while (Date.now() - t1 < 35000) {
    const cur = await rr(() => mp.currentPage());
    if (cur.path && cur.path.indexOf('pages/result/result') >= 0) { navigated = true; break; }
    await sleep(300);
  }
  rec.rec('S11-5', '计算结束跳转结果页(遮罩随之消失)', navigated, navigated, 'navigated to result');

  await mp.reLaunch('/pages/index/index').catch(() => {});
  await sleep(1500);
  // best-effort final cleanup check; connection may be exhausted after screenshot,
  // so never let it turn into a fatal (core mask lifecycle already asserted above)
  try {
    const cur = await rr(() => mp.currentPage());
    const gone = await rr(() => cur.$$('.calc-mask'));
    const dd = await rr(() => cur.data());
    rec.rec('S11-6', '返回输入页遮罩已消失/calculating=false',
      gone.length === 0 && dd.calculating === false,
      { maskNodes: gone.length, calculating: dd.calculating }, 'mask gone, false');
  } catch (e) {
    rec.rec('S11-6', '返回输入页遮罩状态(连接已尽，核心断言已全过)', false,
      'best-effort unavailable: ' + (e && e.message), 'mask gone, false');
  }
};

(async () => {
  if (!CASES[CASE]) throw new Error('unknown case ' + CASE);
  const mp = await connect();
  const rec = makeRec();
  let fatal = null;
  try {
    const page = await relaunchIndex(mp);
    await CASES[CASE](mp, page, rec);
  } catch (e) {
    fatal = String(e && e.message || e);
  } finally {
    try { await mp.disconnect(); } catch (e) {}
  }
  const totals = rec.list.reduce((a, x) => { x.pass ? a.pass++ : a.fail++; return a; }, { pass: 0, fail: 0 });
  const summary = {
    case: CASE, ok: !fatal && totals.fail === 0, fatal: fatal,
    totals: totals, assertions: rec.list,
    finishedAt: new Date().toISOString(),
    runContext: { automationPort: PORT, project: PROJECT }
  };
  fs.writeFileSync(path.join(OUT, 'ui-input-' + CASE + '.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log('DONE ' + CASE + ' pass=' + totals.pass + ' fail=' + totals.fail + (fatal ? ' fatal=' + fatal : ''));
  process.exit(summary.ok ? 0 : 2);
})();
