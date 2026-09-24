// autotest/engine-assert.js
// 批次1（#5/#8/#9/#10）+ BUG-17/18 + Bug19/20/21 回归：直接 require 引擎，node 纯函数断言。
// 验证：视同起止年月→64月、N实98→3(36月)、账户区字段；
//  BUG-17：K=392/N应缴=32.6667 正确（窗口 2000-11~2033-06，无 off-by）；
//  BUG-18：月指数层 z=min(3,B月/C月)（非最终 Z实 层）：2019 zRaw=3.1169 → z=3、zCapped=true，
//    年表 Z年=3.0，封顶后 Z实=2.4032（MY1）/2.9053（MY2），封顶前 2.4068/2.9088；
//  Bug19：全链路 2026 历史年基=287562（8月，月均35945.25），源码/断言中零 2864xx88；
//  Bug20：未来段 2026-09~2033-06 共82月，MY1 月基数固定 7270（≈0.6），MY2 36348（=3.0）；
//  Bug21：buildAnnualIndexLedger 回年值法 Z年=Σ月z/12=Xn/(12×C月)；边界年稀释
//    （2000=0.4458、2033 MY1=0.3/MY2=1.5）；Σ34行 Z年 ÷ N应缴 与主汇总 Z实 闭合。
// 锁定基线：2026 历史年基 287562（8月）、未来段固定 7270/36348（=目标Z×12116）、2026 起分母 12116。
// 运行：cd 项目根 ; node autotest/engine-assert.js （session 0 可跑，不涉及 GUI）
'use strict';
var fs = require('fs');
var path = require('path');
var D = require('../calculator/dateUtil.js');
var Engine = require('../calculator/pensionEngine.js');

var hist = [
  [2000, 6142, 2], [2001, 41328], [2002, 47184], [2003, 58434], [2004, 69645],
  [2005, 81816], [2006, 95079], [2007, 105822], [2008, 116766], [2009, 130500],
  [2010, 142533], [2011, 149760], [2012, 163953], [2013, 183069], [2014, 198288],
  [2015, 220608], [2016, 243882], [2017, 266256], [2018, 291114], [2019, 293796],
  [2020, 300636], [2021, 328572], [2022, 360630], [2023, 394650], [2024, 415044],
  [2025, 426564], [2026, 287562, 8]
];

function buildSegments(z, type) {
  var segs = [];
  hist.forEach(function (row) {
    var y = row[0], annual = row[1], mo = row[2] || 12;
    var base = Math.round((annual / mo) * 100) / 100; // 部分年按实际缴费月摊（2000:3071，2026:35945.25）
    var s, e;
    if (y === 2000) { s = '2000-11'; e = '2000-12'; }
    else if (y === 2026) { s = '2026-01'; e = '2026-08'; }
    else { s = y + '-01'; e = y + '-12'; }
    segs.push({ type: 'enterprise', startYM: s, endYM: e, baseMonthly: base });
  });
  // Bug20：未来段基数由目标 Z × 2026社平12116 派生；0.6档按元取整=7270，3档=36348
  var SOCIAL_2026 = 12116;
  var fb = z === 0.6 ? 7270 : Math.round(z * SOCIAL_2026);
  segs.push({ type: type, startYM: '2026-09', endYM: '2033-06', baseMonthly: fb });
  return segs;
}

// #5/#8/#9 新契约：视同起止年月 + 账户三项
function makeInput(z, type, overrides) {
  var input = {
    gender: 'male', femaleType: null, birthYM: '1973-07', workStartYM: '1995-07', retireYM: '2033-07',
    deemedStartYM: '1995-07', deemedEndYM: '2000-10', // 视同起止（两端含当月）
    segments: buildSegments(z, type),
    accountBalanceManual: 672920, accountBalanceManualYM: '2026-08', futureMonthlyRate: 0.015,
    baseYearOverride: 2025, cPingOverride: null, customCYear: {},
    doc31Eligible: true, doc31TransferYM: '2000-11', enterpriseInsuredYM: '2000-11',
    subsidyExcludedRanges: []
  };
  if (overrides) Object.keys(overrides).forEach(function (k) { input[k] = overrides[k]; });
  return input;
}

var pass = 0, fail = 0;
function approx(actual, expected, tol) { return Math.abs(actual - expected) <= tol; }
function check(label, actual, expected, tol) {
  tol = tol == null ? 0.01 : tol;
  if (approx(actual, expected, tol)) { pass++; }
  else { fail++; console.log('FAIL ' + label + ' actual=' + actual + ' expected=' + expected); }
}
function eq(label, actual, expected) {
  if (actual === expected) { pass++; }
  else { fail++; console.log('FAIL ' + label + ' actual=' + actual + ' expected=' + expected); }
}
function throws(label, fn, fragment) {
  try { fn(); }
  catch (e) {
    if (fragment && String(e.message).indexOf(fragment) < 0) {
      fail++; console.log('FAIL ' + label + ' message="' + e.message + '" expected contain "' + fragment + '"');
    } else pass++;
    return;
  }
  fail++; console.log('FAIL ' + label + ' did not throw');
}

// ---- Bug19 静态自检：业务源码/autotest 中禁止出现 2864xx88 ----
(function () {
  var root = path.join(__dirname, '..');
  var exts = { '.js': 1, '.wxml': 1, '.json': 1 };
  // 定稿 §6-1：业务源码/autotest 零旧基数；docs 历史备忘录与 _backup 属豁免证据，不扫。
  var skipDirs = { node_modules: 1, _backup: 1, output: 1, docs: 1 };
  var hits = [];
  (function walk(dir) {
    fs.readdirSync(dir).forEach(function (name) {
      var p = path.join(dir, name);
      var st = fs.statSync(p);
      if (st.isDirectory()) {
        if (skipDirs[name]) return;
        walk(p);
      } else if (exts[path.extname(name)]) {
        var badBase = String.fromCharCode(50,56,54,52,56,56); if (fs.readFileSync(p, 'utf8').indexOf(badBase) >= 0) hits.push(p);
      }
    });
  })(root);
  eq('Bug19: 业务源码/autotest 零旧基数', hits.length, 0);
})();

// ---- 两案（MY1: Z=.6 灵活；MY2: Z=3 企业）----
//  基准为 Bug19/20/21 定稿实算值（月层封顶后）。
var cases = [
  { name: 'MY1', z: 0.6, type: 'flexible', fb: 7270, futureZ: 0.6,
    preZ: 2.4068, Z实: 2.4032, R补: 10923.92, G实: 868.70, R储: 795693.52,
    R储本金: 47691.20, R储利息: 75082.32,
    J基础: 7791.06, J账户: 5803.00, J过渡: 868.70, total: 14462.76,
    z2000: 0.4458, z2026: 2.1779, z2033: 0.3000, sum34: 78.5054 },
  { name: 'MY2', z: 3.0, type: 'enterprise', fb: 36348, futureZ: 3.0,
    preZ: 2.9088, Z实: 2.9053, R补: 13205.91, G实: 1050.17, R储: 996432.00,
    R储本金: 238442.88, R储利息: 85069.12,
    J基础: 8940.37, J账户: 7263.58, J过渡: 1050.17, total: 17254.12,
    z2000: 0.4458, z2026: 2.9778, z2033: 1.5000, sum34: 94.9053 }
];

cases.forEach(function (c) {
  var r = Engine.calculate(makeInput(c.z, c.type));
  var it = r.intermediates, pn = r.pension;
  var p = c.name + ':';
  // #5 视同起止→64月（含边界）
  eq(p + ' 视同月=64', it.deemedMonths, 64);
  check(p + ' N实同=38.0', it.N实同, 38.0, 0.0001);
  check(p + ' N同=0', it.N同, 0, 0.0001);
  // #9 N实98→3（36月：1995-07~1998-06）
  check(p + ' N实98=3.0', it.N实98, 3.0, 0.0001);

  // ---- BUG-17：窗口索引 / N应缴 / K ----
  eq(p + ' K应缴月=392', it.K应缴月, 392);
  check(p + ' N应缴=32.6667', it.N应缴, 32.6667, 0.0001);
  eq(p + ' 逐月首月=2000-11', r.monthlyDetails[0].ym, '2000-11');
  eq(p + ' 逐月末月=2033-06', r.monthlyDetails[391].ym, '2033-06');
  eq(p + ' 逐月长度=392', r.monthlyDetails.length, 392);
  eq(p + ' 实缴月=392', it.actualPaidMonths, 392);

  // ---- BUG-18：封顶层级在月指数 ----
  var m2019 = r.monthlyDetails.filter(function (d) { return d.ym.slice(0, 4) === '2019'; });
  eq(p + ' 2019 12个月', m2019.length, 12);
  m2019.forEach(function (d) {
    check(p + ' 2019 zRaw=3.1169', d.zRaw, 3.1169, 0.0001);
    eq(p + ' 2019 zCapped=true', d.zCapped, true);
    check(p + ' 2019 z=3', d.z, 3);
  });
  // 非封顶月 z=zRaw、zCapped=false
  var badOther = r.monthlyDetails.filter(function (d) {
    return d.ym.slice(0, 4) !== '2019' && (d.zCapped || (d.zRaw <= 3 && d.z !== d.zRaw));
  });
  eq(p + ' 非2019月均未被封顶', badOther.length, 0);

  // 封顶前 Z实（ΣzRaw/392）→ 封顶后 Z实（主汇总）
  var rawSum = r.monthlyDetails.reduce(function (a, d) { return a + d.zRaw; }, 0);
  check(p + ' 封顶前 Z实=' + c.preZ, rawSum / 392, c.preZ, 0.0002);
  check(p + ' 封顶后 Z实(主汇总)=' + c.Z实, it.Z实指数, c.Z实, 0.0002);
  check(p + ' 封顶削减=1.4024',
    r.monthlyDetails.reduce(function (a, d) { return a + d.zRaw - d.z; }, 0),
    1.4024, 0.001);

  // ---- Bug19：2026 历史段月基数=35945.25（=287562/8）----
  var h2026 = r.monthlyDetails.filter(function (d) {
    return d.ym >= '2026-01' && d.ym <= '2026-08';
  });
  eq(p + ' 2026历史段=8月', h2026.length, 8);
  h2026.forEach(function (d) {
    check(p + ' 2026历史月 base=35945.25', d.base, 35945.25, 0.001);
  });

  // ---- Bug20：未来段82月，月基数与月指数 ----
  var future = r.monthlyDetails.filter(function (d) {
    return d.ym >= '2026-09' && d.ym <= '2033-06';
  });
  eq(p + ' 未来段=82月', future.length, 82);
  eq(p + ' 未来段首月=2026-09', future[0].ym, '2026-09');
  eq(p + ' 未来段末月=2033-06', future[future.length - 1].ym, '2033-06');
  future.forEach(function (d) {
    check(p + ' 未来月 base=' + c.fb, d.base, c.fb, 0.001);
    check(p + ' 未来月 z=' + c.futureZ, d.z, c.futureZ, 0.0001);
    eq(p + ' 未来月 zCapped=false', d.zCapped, false);
  });

  // ---- Bug21：年表年值法关键行 ----
  var r2000 = r.annualIndex[2000 - 1992];
  eq(p + ' 2000 windowMonths=2', r2000.windowMonths, 2);
  check(p + ' 2000 Xn=6142', r2000.xAnnual, 6142);
  check(p + ' 2000 Z年=0.4458(年值稀释)', r2000.zYear, c.z2000, 0.0001);
  eq(p + ' 2000 partialYear=true', r2000.partialYear, true);
  check(p + ' 年表2019 Z年=3.0', r.annualIndex[2019 - 1992].zYear, 3);
  check(p + ' 年表2026 Z年=' + c.z2026, r.annualIndex[2026 - 1992].zYear, c.z2026, 0.0001);
  for (var y = 2027; y <= 2032; y++) {
    check(p + ' 年表' + y + ' Z年=' + c.futureZ, r.annualIndex[y - 1992].zYear, c.futureZ, 0.0001);
  }
  var r2033 = r.annualIndex[2033 - 1992];
  eq(p + ' 2033 windowMonths=6', r2033.windowMonths, 6);
  check(p + ' 2033 Z年=' + c.z2033 + '(年值稀释)', r2033.zYear, c.z2033, 0.0001);
  eq(p + ' 2033 partialYear=true', r2033.partialYear, true);
  // 整年行不回归
  check(p + ' 2001 Z年=2.6280', r.annualIndex[9].zYear, 2.6280, 0.0001);
  check(p + ' 2025 Z年=2.9779', r.annualIndex[2025 - 1992].zYear, 2.9779, 0.0001);

  // ---- Bug21 勾稽（核心）：Σ34行 Z年 ÷ N应缴 = 主汇总 Z实 ----
  // raw 级：用未舍入月 z 重算年值，与主汇总严格恒等
  var rawByYear = {};
  r.monthlyDetails.forEach(function (d) {
    var yy = Number(d.ym.slice(0, 4));
    rawByYear[yy] = (rawByYear[yy] || 0) + d.z;
  });
  var rawSum34 = 0;
  Object.keys(rawByYear).forEach(function (yy) { rawSum34 += rawByYear[yy] / 12; });
  var rawZReal = r.monthlyDetails.reduce(function (a2, d2) { return a2 + d2.z; }, 0) / it.K应缴月;
  check(p + ' raw: Σ34行/(K/12)=主汇总Z实(1e-12)', rawSum34 / (it.K应缴月 / 12), rawZReal, 1e-12);
  // round4 行值级
  var directSum = r.annualIndex.reduce(function (a, d) {
    return d.zYear != null && d.windowMonths > 0 ? a + d.zYear : a;
  }, 0);
  check(p + ' Σ34行 round4 直接和=' + c.sum34, directSum, c.sum34, 0.0002);
  check(p + ' Σ34行/N应缴=Z实(0.0002)', directSum / it.N应缴, c.Z实, 0.0002);

  check(p + ' G同=0', it.G同, 0);
  check(p + ' G实(封顶Z实)', it.G实, c.G实);
  // Bug3 R补（参保后 Z实 同样是封顶口径）
  check(p + ' R补', it.R补, c.R补);
  eq(p + ' subsidy applicable', r.accountSubsidy.applicable, true);
  check(p + ' subsidy zRealUsed=封顶值', r.accountSubsidy.zRealUsed, c.Z实, 0.0002);
  eq(p + ' M=139', it.M, 139);
  // #8 R储 月滚 + 未来段本金/利息（封顶不影响账户）
  check(p + ' R储', it.R储, c.R储);
  check(p + ' R储本金', it.R储本金, c.R储本金);
  check(p + ' R储利息', it.R储利息, c.R储利息);
  check(p + ' 672920+本金+利息=R储', 672920 + it.R储本金 + it.R储利息, c.R储, 0.01);
  // 三分项与合计基准
  check(p + ' J基础', pn.J基础, c.J基础);
  check(p + ' J账户', pn.J账户, c.J账户);
  check(p + ' J过渡', pn.J过渡, c.J过渡);
  check(p + ' total', pn.total, c.total);
});

// ---- BUG-18：构造 zRaw>3 的其他年份（如2015）同样月层封顶 ----
(function () {
  var input = makeInput(0.6, 'flexible');
  // 把 2015 全年段基数改成 40000（缴费年2015分母=键值round2(77560/12)=6463.33 → zRaw≈6.19）
  input.segments = input.segments.map(function (s) {
    if (s.startYM === '2015-01' && s.endYM === '2015-12') {
      return Object.assign({}, s, { baseMonthly: 40000 });
    }
    return s;
  });
  var r = Engine.calculate(input);
  var m2015 = r.monthlyDetails.filter(function (d) { return d.ym.slice(0, 4) === '2015'; });
  m2015.forEach(function (d) {
    eq('B18 2015 zCapped=true', d.zCapped, true);
    check('B18 2015 z=3', d.z, 3);
    check('B18 2015 zRaw≈6.1888', d.zRaw, 40000 / 6463.33, 0.001);
  });
  check('B18 2015 年表 Z年=3', r.annualIndex[2015 - 1992].zYear, 3);
})();

// ---- BUG-18：封顶层级反证 —— “仅最终层封顶”方案不可取 ----
// 最终层方案对本案（Z实<3）完全不触发；断言高指数月已在月层被削，且其削减传导到 Z实。
(function () {
  var r = Engine.calculate(makeInput(0.6, 'flexible'));
  // 若错误地只在最终层 min(3,Z实)，2019 月 z 会保留 3.1169 且 Z实=2.4068
  var m2019 = r.monthlyDetails.filter(function (d) { return d.ym.slice(0, 4) === '2019'; });
  check('B18 反证: 2019 z 不是原样 3.1169', m2019[0].z, 3);
  check('B18 反证: Z实 不是封顶前 2.4068', r.intermediates.Z实指数, 2.4032, 0.0002);
})();

// ---- #9 边界联动：视同终点改为1997-12 → N实98=2.5 ----
var rEnd97 = Engine.calculate(makeInput(0.6, 'flexible', { deemedEndYM: '1997-12' }));
check('endYM=1997-12 视同月=30', rEnd97.intermediates.deemedMonths, 30);
check('endYM=1997-12 N实98=2.5', rEnd97.intermediates.N实98, 2.5, 0.0001);

// ---- #5 边界：视同起止 1990-01~1998-06 → N实98=69月=5.75 ----
var rPre = Engine.calculate(makeInput(0.6, 'flexible', {
  deemedStartYM: '1990-01', deemedEndYM: '1998-06', workStartYM: '1990-01'
}));
check('1990-01~1998-06 N实98=69月=5.75', rPre.intermediates.N实98, 69 / 12, 0.0001);
check('1990-01~1998-06 视同月=102', rPre.intermediates.deemedMonths, 102);

// ---- #5 校验错误 ----
throws('起>止报错', function () {
  Engine.calculate(makeInput(0.6, 'flexible', { deemedStartYM: '2001-01', deemedEndYM: '2000-10' }));
}, '起始年月不得晚于终止年月');
throws('只填起始报错', function () {
  Engine.calculate(makeInput(0.6, 'flexible', { deemedStartYM: '1995-07', deemedEndYM: '' }));
}, '起止年月须同时填写');
throws('起早于workStart报错', function () {
  Engine.calculate(makeInput(0.6, 'flexible', { deemedStartYM: '1990-01' }));
}, '不得早于参加工作年月');
throws('止晚于参保前一月报错', function () {
  Engine.calculate(makeInput(0.6, 'flexible', { deemedEndYM: '2000-11' }));
}, '不晚于企业实际参保起始月的前一月');

// ---- #8 账户必填：空 → 硬错误；填0 允许 ----
throws('账户累计额空报错', function () {
  Engine.calculate(makeInput(0.6, 'flexible', { accountBalanceManual: null }));
}, '请填写个人账户累计储存额');
var rZero = Engine.calculate(makeInput(0.6, 'flexible', {
  accountBalanceManual: 0, accountBalanceManualYM: '2026-08'
}));
eq('账户填0允许', rZero.intermediates.R储 >= 0, true);

// ---- #8 历史重建逃生口 ----
var rRec = Engine.calculate(makeInput(0.6, 'flexible', {
  accountBalanceManual: null, accountReconstruct: true,
  interestMode: 'fixed', fixedRate: 0.04
}));
eq('重建路径可跑', typeof rRec.intermediates.R储, 'number');

// ---- 普通人员：doc31=false，R补=0 ----
var ordinary = Engine.calculate({
  gender: 'male', femaleType: null, birthYM: '1973-07', workStartYM: '1990-01', retireYM: '2033-07',
  deemedStartYM: '1990-01', deemedEndYM: '1998-06',
  segments: [{ type: 'enterprise', startYM: '1992-10', endYM: '1998-06', baseMonthly: 5000 }],
  accountBalanceManual: 100000, baseYearOverride: 2025, cPingOverride: null, customCYear: {},
  doc31Eligible: false, subsidyExcludedRanges: []
});
var oit = ordinary.intermediates;
check('ordinary N应缴=40.75', oit.N应缴, 40.75, 0.0001);
check('ordinary 视同=33月', oit.deemedMonths, 33);
check('ordinary N同=2.75', oit.N同, 2.75, 0.0001);
check('ordinary N实98=5.75', oit.N实98, 5.75, 0.0001);
check('ordinary R补=0', oit.R补, 0);

// ---- 无视同、无实缴的普通用户 N实98=0 ----
var blank98 = Engine.calculate({
  gender: 'male', femaleType: null, birthYM: '1980-01', workStartYM: '2005-01', retireYM: '2040-01',
  segments: [{ type: 'enterprise', startYM: '2005-01', endYM: '2039-12', baseMonthly: 8000 }],
  accountBalanceManual: 200000, accountBalanceManualYM: '2026-08', futureMonthlyRate: 0.015,
  baseYearOverride: 2025, doc31Eligible: false
});
check('blank98 N实98=0', blank98.intermediates.N实98, 0, 0.0001);

console.log('RESULT pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
