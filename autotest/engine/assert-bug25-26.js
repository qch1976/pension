// autotest/engine/assert-bug25-26.js
// Bug25/26 引擎层 + 输入页结构断言（纯 node，不依赖微信运行时 / automator）。
// Run: node autotest/engine/assert-bug25-26.js
// 依据：pension-ui-change-design-bug25-26.md（V1.8）§1.3 / §2.6 / §3.2。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const Engine = require(path.join(ROOT, 'calculator', 'pensionEngine.js'));
const D = require(path.join(ROOT, 'calculator', 'dateUtil.js'));
const P = require(path.join(ROOT, 'constants', 'policyData.js'));
const Model = require(path.join(ROOT, 'calculator', 'inputPageModel.js'));

const pass = [], fail = [];
function ok(cond, id, title, actual, expected) {
  (cond ? pass : fail).push({ id, title, actual, expected });
}
function near(id, title, actual, expected, tol) {
  const a = Number(actual);
  ok(isFinite(a) && Math.abs(a - expected) <= tol, id, title,
    Math.round(a * 1e6) / 1e6, expected + ' +/-' + tol);
}
function eq(id, title, actual, expected) {
  ok(actual === expected, id, title, actual, expected);
}

// ---------- 输入构造（与架构定稿四案一致，run-bug25-cases 同口径） ----------
const hist12 = [
  [2000, 6142, 2], [2001, 41328], [2002, 47184], [2003, 58434], [2004, 69645],
  [2005, 81816], [2006, 95079], [2007, 105822], [2008, 116766], [2009, 130500],
  [2010, 142533], [2011, 149760], [2012, 163953], [2013, 183069], [2014, 198288],
  [2015, 220608], [2016, 243882], [2017, 266256], [2018, 291114], [2019, 293796],
  [2020, 300636], [2021, 328572], [2022, 360630], [2023, 394650], [2024, 415044],
  [2025, 426564], [2026, 287562, 8]
];
function historicalSegments12() {
  return hist12.map(([y, annual, mo0]) => {
    const mo = mo0 || 12;
    let s, e;
    if (y === 2000) { s = y + '-11'; e = y + '-12'; }
    else if (y === 2026) { s = y + '-01'; e = y + '-08'; }
    else { s = y + '-01'; e = y + '-12'; }
    return { type: 'enterprise', startYM: s, endYM: e, baseMonthly: annual / mo };
  });
}
function base12(z, type) {
  const fb = type === 'flexible' ? 7270 : 36348;
  return {
    gender: 'male', femaleType: null, birthYM: '1973-07',
    workStartYM: '1995-07', retireYM: '2033-07',
    hasDeemed: true, deemedStartYM: '1995-07', deemedEndYM: '2000-10',
    segments: historicalSegments12().concat(
      { type, startYM: '2026-09', endYM: '2033-06', baseMonthly: fb }),
    accountBalanceManual: 672920, accountBalanceManualYM: '2026-08', futureMonthlyRate: 0.015,
    baseYearOverride: 2025, cPingOverride: null, customCYear: {},
    doc31Eligible: true, doc31TransferYM: '2000-11', enterpriseInsuredYM: '2000-11',
    subsidyExcludedRanges: []
  };
}
const wifeHist = [
  [2003, 10000, 4, 9], [2004, 39000, 12, 1], [2005, 27892, 7, 1], [2006, 38700, 9, 1],
  [2007, 59493], [2008, 71160], [2009, 89202], [2010, 101340], [2011, 121005],
  [2012, 137451], [2013, 160677], [2014, 170562], [2015, 190428], [2016, 212370],
  [2017, 210678], [2018, 215538], [2019, 224748], [2020, 222000], [2021, 236418],
  [2022, 345994], [2023, 394650], [2024, 415044], [2025, 426564]
];
function wifeHistoricalSegs() {
  return wifeHist.map(([y, annual, months0, startM]) => {
    const months = months0 || 12;
    const sm = startM || 1;
    const startIdx = y * 12 + (sm - 1);
    return {
      type: 'enterprise',
      startYM: D.toYM(startIdx), endYM: D.toYM(startIdx + months - 1),
      baseMonthly: annual / months
    };
  });
}
function wifeCase(retireYM, enterpriseInsuredYM) {
  const future = {
    type: 'enterprise', startYM: '2026-01',
    endYM: D.toYM(D.toIndex(retireYM) - 1), baseMonthly: 36348
  };
  return {
    gender: 'female', femaleType: 'worker', birthYM: '1981-07',
    workStartYM: '2003-09', retireYM: retireYM,
    hasDeemed: false, deemedStartYM: null, deemedEndYM: null,
    segments: wifeHistoricalSegs().concat(future),
    accountBalanceManual: 481459, accountBalanceManualYM: '2025-12', futureMonthlyRate: 0.015,
    baseYearOverride: 2025, cPingOverride: null, customCYear: {},
    doc31Eligible: false, doc31TransferYM: null,
    enterpriseInsuredYM: enterpriseInsuredYM,
    subsidyExcludedRanges: []
  };
}

function metrics(r) {
  let sumZY = 0, sumMonthZ = 0;
  r.annualIndex.forEach(a => { if (a.windowMonths > 0) sumZY += a.zYear; });
  r.monthlyDetails.forEach(m => { sumMonthZ += m.z; });
  const it = r.intermediates, pn = r.pension;
  return {
    window: [r.inputs.windowStartYM, r.inputs.windowEndYM],
    K: it.K应缴月, N应缴: it.N应缴,
    sumMonthZ: Engine.round4(sumMonthZ), Z实: it.Z实指数,
    sumWindowZY: Engine.round4(sumZY),
    paid: it.actualPaidMonths, N实同: it.N实同, N同: it.N同, N实98: it.N实98,
    M: it.M, R储: it.R储, R储本金: it.R储本金, R储利息: it.R储利息, R补: it.R补,
    J基础: pn.J基础, J账户: pn.J账户, J过渡: pn.J过渡, total: pn.total,
    personType: r.meta.personType, eligible: r.meta.eligible
  };
}

// 设计 §3.2 权威期望值
const EXPECT = {
  MY1: { window: ['2000-11', '2033-06'], K: 392, N应缴: 32.6667, sumMonthZ: 942.0684,
    Z实: 2.4032, sumWindowZY: 78.5054, paid: 392, N实同: 38, N同: 0, N实98: 3, M: 139,
    R储: 795693.52, R储本金: 47691.20, R储利息: 75082.32, R补: 10923.92,
    J基础: 7791.06, J账户: 5803.00, J过渡: 868.70, total: 14462.76 },
  MY2: { window: ['2000-11', '2033-06'], K: 392, N应缴: 32.6667, sumMonthZ: 1138.8657,
    Z实: 2.9053, sumWindowZY: 94.9053, paid: 392, N实同: 38, N同: 0, N实98: 3, M: 139,
    R储: 996432.00, R储本金: 238442.88, R储利息: 85069.12, R补: 13205.91,
    J基础: 8940.37, J账户: 7263.58, J过渡: 1050.17, total: 17254.12 },
  MY3: { window: ['2003-09', '2031-06'], K: 334, N应缴: 27.8333, sumMonthZ: 787.4583,
    Z实: 2.3577, sumWindowZY: 65.6215, paid: 326, N实同: 27.1667, N同: 0, N实98: 0, M: 195,
    R储: 722763.05, R储本金: 191917.44, R储利息: 49386.61, R补: 0,
    J基础: 5495.33, J账户: 3706.48, J过渡: 0, total: 9201.81 },
  MY4: { window: ['2003-09', '2036-06'], K: 394, N应缴: 32.8333, sumMonthZ: 967.4583,
    Z实: 2.4555, sumWindowZY: 80.6215, paid: 386, N实同: 32.1667, N同: 0, N实98: 0, M: 170,
    R储: 960080.64, R储本金: 366387.84, R储利息: 112233.80, R补: 0,
    J基础: 6696.30, J账户: 5647.53, J过渡: 0, total: 12343.83 }
};

// ---------- 1. 四案逐项断言（零回归，不容差放宽） ----------
const inputs = {
  MY1: base12(0.6, 'flexible'),
  MY2: base12(3, 'enterprise'),
  MY3: wifeCase('2031-07', '2003-09'),
  MY4: wifeCase('2036-07', '2003-09')
};
const got = {};
for (const k of Object.keys(inputs)) {
  got[k] = metrics(Engine.calculate(inputs[k]));
  const m = got[k], e = EXPECT[k];
  eq(k + '-win', k + ' 窗口', m.window.join('~'), e.window.join('~'));
  eq(k + '-K', k + ' K应缴月', m.K, e.K);
  near(k + '-N', k + ' N应缴', m.N应缴, e.N应缴, 0.0001);
  near(k + '-smz', k + ' Σ月z', m.sumMonthZ, e.sumMonthZ, 0.0001);
  near(k + '-Z', k + ' Z实指数', m.Z实, e.Z实, 0.0002);
  near(k + '-szy', k + ' Σ窗口Z年', m.sumWindowZY, e.sumWindowZY, 0.001);
  eq(k + '-paid', k + ' 实缴月', m.paid, e.paid);
  near(k + '-nrt', k + ' N实同', m.N实同, e.N实同, 0.0001);
  eq(k + '-nt', k + ' N同', m.N同, e.N同);
  eq(k + '-n98', k + ' N实98', m.N实98, e.N实98);
  eq(k + '-M', k + ' M', m.M, e.M);
  near(k + '-R', k + ' R储', m.R储, e.R储, 0.01);
  near(k + '-Rp', k + ' R储本金', m.R储本金, e.R储本金, 0.01);
  near(k + '-Ri', k + ' R储利息', m.R储利息, e.R储利息, 0.01);
  near(k + '-Rb', k + ' R补', m.R补, e.R补, 0.01);
  near(k + '-Jb', k + ' J基础', m.J基础, e.J基础, 0.02);
  near(k + '-Ja', k + ' J账户', m.J账户, e.J账户, 0.02);
  near(k + '-Jt', k + ' J过渡', m.J过渡, e.J过渡, 0.02);
  near(k + '-T', k + ' 月合计', m.total, e.total, 0.02);
  eq(k + '-elig', k + ' eligible', m.eligible, true);
}

// ---------- 2. Bug26 新规则：N应缴按企业实际参保起始（AC-B26-04） ----------
const diff = metrics(Engine.calculate(wifeCase('2031-07', '2004-09')));
eq('DIFF-win', '差异案窗口=2004-09~2031-06', diff.window.join('~'), '2004-09~2031-06');
eq('DIFF-K', '差异案 K=322', diff.K, 322);
near('DIFF-N', '差异案 N应缴=26.8333', diff.N应缴, 26.8333, 0.0001);
near('DIFF-smz', '差异案 Σ月z=768.6934', diff.sumMonthZ, 768.6934, 0.0001);
near('DIFF-Z', '差异案 Z实=2.3872', diff.Z实, 2.3872, 0.0002);
eq('DIFF-paid', '差异案 实缴月=314', diff.paid, 314);
near('DIFF-nrt', '差异案 N实同=26.1667', diff.N实同, 26.1667, 0.0001);
near('DIFF-Jb', '差异案 J基础=5339.69', diff.J基础, 5339.69, 0.02);
near('DIFF-Ja', '差异案 J账户=3706.48 不变', diff.J账户, 3706.48, 0.02);
near('DIFF-T', '差异案 月合计=9046.17', diff.total, 9046.17, 0.02);

// ---------- 3. 空值回退（AC-B26-03）：字段留空 == V1.7 口径B ----------
const emp = metrics(Engine.calculate(wifeCase('2031-07', null)));
eq('EMP-K', '留空回退 K=334', emp.K, EXPECT.MY3.K);
near('EMP-N', '留空回退 N应缴=27.8333', emp.N应缴, EXPECT.MY3.N应缴, 0.0001);
near('EMP-Z', '留空回退 Z实=2.3577', emp.Z实, EXPECT.MY3.Z实, 0.0002);
near('EMP-T', '留空回退 月合计=9201.81', emp.total, EXPECT.MY3.total, 0.02);

// ---------- 4. 类型判定不漂移（AC-B26-06） ----------
ok(String(diff.personType).indexOf('新人') >= 0, 'DIFF-type',
  '参保起始晚于1998-07 仍判新人（以参工月为界）', diff.personType, '含「新人」');
ok(String(got.MY1.personType).indexOf('中人') >= 0, 'MY1-type',
  'MY1 人员类型=中人', got.MY1.personType, '含「中人」');

// ---------- 5. 输入数据模型（inputPageModel） ----------
const init = Model.buildInitialData(P);
const reset = Model.buildResetData(P);
eq('M-ei-init', '初始数据含 enterpriseInsuredYM 空串', init.enterpriseInsuredYM, '');
eq('M-ei-reset', '清空数据 enterpriseInsuredYM 归空', reset.enterpriseInsuredYM, '');
eq('M-doc-reset', '清空数据 doc31Eligible=false', reset.doc31Eligible, false);

// ---------- 6. UI 结构断言（解析 index.wxml；AC-B25-01/02、AC-B26-01/02） ----------
const wxml = fs.readFileSync(path.join(ROOT, 'pages', 'index', 'index.wxml'), 'utf8');
// 切出所有 card 块（含 .card.error-text）
const cardRanges = [];
const reCard = /<view class="card(?:\s[^"]*)?">/g;
let mCard;
while ((mCard = reCard.exec(wxml))) cardRanges.push(mCard.index);
cardRanges.push(wxml.length);
const cards = cardRanges.slice(0, -1).map((pos, i) => wxml.slice(pos, cardRanges[i + 1]));
function titleOf(block) {
  const t = block.match(/<view class="card-title">([\s\S]*?)<\/view>/);
  return t ? t[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
}
const titles = cards.map(titleOf).filter(Boolean);
eq('UI-cards', '输入页 card 数=5', titles.length, 5);
eq('UI-titles', 'card 标题依次①②③④⑤',
  JSON.stringify(titles.map(t => t.slice(0, 1))), JSON.stringify(['①', '②', '③', '④', '⑤']));
ok(titles[0].indexOf('基本信息') >= 0, 'UI-c1', '① 基本信息', titles[0], '① 基本信息');
ok(titles[3].indexOf('个人账户养老金') >= 0, 'UI-c4', '④ 个人账户养老金', titles[3], '④ 个人账户养老金');
ok(titles[4].indexOf('计发基数') >= 0, 'UI-c5', '⑤ 计发基数', titles[4], '⑤ 计发基数…');
eq('UI-no42', '页面不存在「④-2」字样', wxml.indexOf('④-2'), -1);

// section ④ 内两个分项小标题
ok(cards[3].indexOf('① 个人账户储蓄额') >= 0, 'UI-sub1',
  '④ 内分项「① 个人账户储蓄额」', cards[3].indexOf('① 个人账户储蓄额') >= 0 ? 'found' : 'missing', 'found');
ok(cards[3].indexOf('② 人员身份与 R补') >= 0, 'UI-sub2',
  '④ 内分项「② 人员身份与 R补」', cards[3].indexOf('② 人员身份与 R补') >= 0 ? 'found' : 'missing', 'found');

// 「企业实际参保缴费起始」在 section ①、且不被 doc31 条件包裹
const inC1 = cards[0].indexOf('企业实际参保缴费起始') >= 0;
ok(inC1, 'UI-ei-c1', '企业实际参保缴费起始在 section①', inC1 ? 'found' : 'missing', 'found');
ok(cards[0].indexOf('doc31Eligible') < 0, 'UI-ei-visible',
  'section① 内该字段不挂 doc31 条件（所有人员可填）',
  cards[0].indexOf('doc31Eligible') < 0 ? 'free' : 'guarded', 'free');
// 该控件在参加工作年月之后
const iWs = cards[0].indexOf('参加工作年月');
const iEi = cards[0].indexOf('企业实际参保缴费起始');
ok(iWs >= 0 && iEi > iWs, 'UI-ei-order', '该字段紧随参加工作年月之后',
  { workStart: iWs, insured: iEi }, 'insured > workStart');
// section ④ 内不再出现该字段
eq('UI-ei-c4', 'section④ 内无企业实际参保缴费起始控件',
  cards[3].indexOf('企业实际参保缴费起始'), -1);
// 控件绑定保持 onEnterpriseInsured / enterpriseInsuredYM
ok(cards[0].indexOf('bindchange="onEnterpriseInsured"') >= 0 &&
  cards[0].indexOf('value="{{enterpriseInsuredYM}}"') >= 0, 'UI-ei-bind',
  '字段绑定 onEnterpriseInsured / enterpriseInsuredYM 不变', 'bound', 'bound');

// ---------- 汇总输出 ----------
const summary = {
  ok: fail.length === 0,
  pass: pass.length, fail: fail.length,
  failures: fail,
  finishedAt: new Date().toISOString()
};
const outDir = path.join(ROOT, 'autotest', 'output', 'engine');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'bug25-26-assert.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log('assert-bug25-26: pass=' + pass.length + ' fail=' + fail.length);
if (fail.length) {
  fail.forEach(f => console.log('FAIL ' + f.id + ' ' + f.title +
    ' | actual=' + JSON.stringify(f.actual) + ' expected=' + JSON.stringify(f.expected)));
}
process.exit(fail.length ? 1 : 0);
