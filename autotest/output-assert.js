// autotest/output-assert.js
// 批次3（#12a/#12b/#13）+ BUG-15/16 + BUG-17/18 + Bug19/20/21 回归：node 纯函数断言，不涉及 GUI。
// 验证：
//  - #13/BUG-21 年度明细账 annualIndex：1992~退休年逐行；官方字面年值法
//    Z年=Σ月z/12=Xn/(12×C月)；边界年（2000=2月→0.4458、2033=6月→MY1 0.3/MY2 1.5）被全年分母稀释；
//    勾稽 Σ34行 Z年 ÷ N应缴(32.6667) = Z实（raw 严格恒等，round4 行值 0.0002 闭合）；
//  - Bug19：2026 历史年基=287562（8月），全源码零 2864xx88；
//  - Bug20：未来段82月，MY1 月基数 7270、月指数≈0.6；MY2 36348、月指数=3.0；
//  - BUG-15：inputPageModel 缺省 entryMode='year'（首次进入与清空后均年度模式），草稿不被强覆盖；
//  - BUG-16：结果页 data.pageLoading 缺省 true、onLoad 后同批置 false；遮罩 WXML 存在；
//    输入页 onCalculate 跳转前不关遮罩、navigateTo fail 可复位、onShow 复位；
//  - #12a R储 说明：本金起算月=2026-09，数字与引擎一致、锚定余额不重复；
//  - BUG-17：K=392/N应缴=32.6667 为引擎正确值；
//  - BUG-18：月指数层封顶 z=min(3,B月/C月)（不在最终 Z实 层）；2019 年12月 zRaw=3.1169 被封顶；
//    不误封顶；断缴/缺分母月仍 z=0。
// 锁定基线：2026 历史年基 287562（8个月）、未来段固定 7270/36348（=目标Z×12116）、
//   2026 起分母 12116（2026=official 键值；2027+ 回退 assumed）。
// 运行：cd 项目根 ; node autotest/output-assert.js
'use strict';
var fs = require('fs');
var path = require('path');
var Module = require('module');
var Engine = require('../calculator/pensionEngine.js');
var InputModel = require('../calculator/inputPageModel.js');
var D = require('../calculator/dateUtil.js');

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
    var base = Math.round((annual / mo) * 100) / 100;
    var s, e;
    if (y === 2000) { s = '2000-11'; e = '2000-12'; }
    else if (y === 2026) { s = '2026-01'; e = '2026-08'; }
    else { s = y + '-01'; e = y + '-12'; }
    segs.push({ type: 'enterprise', startYM: s, endYM: e, baseMonthly: base });
  });
  // Bug20：未来段基数由目标 Z × 2026社平12116 派生；0.6档=7270，3档=36348
  var SOCIAL_2026 = 12116;
  var fb = z === 0.6 ? 7270 : Math.round(z * SOCIAL_2026);
  segs.push({ type: type, startYM: '2026-09', endYM: '2033-06', baseMonthly: fb });
  return segs;
}
function makeInput(z, type) {
  return {
    gender: 'male', femaleType: null, birthYM: '1973-07', workStartYM: '1995-07',
    retireYM: '2033-07', deemedStartYM: '1995-07', deemedEndYM: '2000-10',
    segments: buildSegments(z, type),
    accountBalanceManual: 672920, accountBalanceManualYM: '2026-08', futureMonthlyRate: 0.015,
    baseYearOverride: 2025, cPingOverride: null, customCYear: {},
    doc31Eligible: true, doc31TransferYM: '2000-11', enterpriseInsuredYM: '2000-11',
    subsidyExcludedRanges: []
  };
}

var pass = 0, fail = 0;
function check(label, actual, expected, tol) {
  tol = tol == null ? 0.0001 : tol;
  if (Math.abs(actual - expected) <= tol) pass++;
  else { fail++; console.log('FAIL ' + label + ' actual=' + actual + ' expected=' + expected); }
}
function eq(label, actual, expected) {
  if (actual === expected) pass++;
  else { fail++; console.log('FAIL ' + label + ' actual=' + JSON.stringify(actual) + ' expected=' + JSON.stringify(expected)); }
}
function ok(label, cond, extra) {
  if (cond) pass++;
  else { fail++; console.log('FAIL ' + label + (extra != null ? ' :: ' + extra : '')); }
}

// 两案基准（Bug19/20/21 定稿实算值）：
//  preZ 为封顶前 Z实（用 monthly zRaw 独立汇总），Z实 为月层封顶后主汇总值。
var cases = [
  { name: 'MY1', z: 0.6, type: 'flexible', fb: 7270, futureZ: 0.6,
    preZ: 2.4068, Z实: 2.4032, sumZYear: 78.5054,
    z2026: 2.1779, zFuture: 0.6000,
    principal: 47691.20, interest: 75082.32, R储: 795693.52, R补: 10923.92,
    J基础: 7791.06, J账户: 5803.00, J过渡: 868.70, total: 14462.76 },
  { name: 'MY2', z: 3.0, type: 'enterprise', fb: 36348, futureZ: 3.0,
    preZ: 2.9088, Z实: 2.9053, sumZYear: 94.9053,
    z2026: 2.9778, zFuture: 3.0000,
    principal: 238442.88, interest: 85069.12, R储: 996432.00, R补: 13205.91,
    J基础: 8940.37, J账户: 7263.58, J过渡: 1050.17, total: 17254.12 }
];

// #12b WXML/WXSS 静态检查
var resultWxml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'result', 'result.wxml'), 'utf8');
ok('12b: 重复“本金/利息”行已删除', !/└ 本金 \/ 利息/.test(resultWxml));
ok('12b: 旧 rPrincipalText/rInterestText 绑定已不存在', !/rPrincipalText|rInterestText/.test(resultWxml));
ok('12b: 31号文 Z补贴 说明保留', /notIncludedNote/.test(resultWxml) && /Z补贴/.test(resultWxml));
ok('12a: R储 说明绑定 vm.rStore.explain', /vm\.rStore\.explain/.test(resultWxml));
ok('13: 年度明细账卡片存在', /年度明细账/.test(resultWxml) && /vmAnnual/.test(resultWxml));

var resultJsText = fs.readFileSync(path.join(__dirname, '..', 'pages', 'result', 'result.js'), 'utf8');
var engineText = fs.readFileSync(path.join(__dirname, '..', 'calculator', 'pensionEngine.js'), 'utf8');

// ---- Bug21 静态检查：旧月均/加权文案已彻底删除，新直接相加脚注存在 ----
ok('B21: 不再含“不可直接相加”提示', !/不可.{0,4}相加/.test(resultWxml));
ok('B21: 不再含“直接相加会虚高”', !/相加会虚高|结果虚高/.test(resultWxml));
ok('B21: 不再含“按应缴月加权/加权勾稽”', !/按应缴月.{0,6}加权|加权勾稽/.test(resultWxml));
ok('B21: 不再含“非整年·月均”标记', !/非整年·月均/.test(resultWxml));
ok('B21: 不再含“按实际应缴月数折算”', !/按实际应缴月数折算|按【实际应缴月数】/.test(resultWxml));
// Bug24：勾稽脚注改为 {{vm.notes.ledgerReconcile}} 动态绑定（result.js buildLedgerReconcileNote）。
ok('B21: 脚注动态绑定 vm.notes.ledgerReconcile',
  /vm\.notes\.ledgerReconcile/.test(resultWxml));
ok('B21: 勾稽构造含“Σ(”与“÷ N应缴”', /Σ\(/.test(resultJsText) && /÷ N应缴/.test(resultJsText));
// 定稿：WXML/result.js 中不得再写死 MY1/MY2 直接相加数值（78.5054/94.9053）。
ok('B24: 脚注不再写死 MY1 Σ=78.5054', !/78\.5054/.test(resultWxml) && !/78\.5054/.test(resultJsText));
ok('B24: 脚注不再写死 MY2 Σ=94.9053', !/94\.9053/.test(resultWxml) && !/94\.9053/.test(resultJsText));
// Bug24：WXML 不再含“34行”（行数随案）。
ok('B24: WXML 无“34行”写死', !/34行/.test(resultWxml));
ok('B21: 引擎不再用 sumMonthZ/windowMonths 月均',
  !/sumMonthZ\s*\/\s*windowMonths/.test(engineText));
ok('B21: 引擎年值法 sumMonthZ/12 存在', /sumMonthZ\s*\/\s*12/.test(engineText));

// ---- Bug19 静态检查：全源码零 2864xx88 ----
(function () {
  var root = path.join(__dirname, '..');
  var exts = { '.js': 1, '.wxml': 1, '.json': 1 };
  // 定稿 §6-1：业务源码/autotest/docs(除历史备忘录) 零命中；docs 历史备忘录与 _backup 属豁免证据，不扫。
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

// ---- 旧 BUG-14 残留检查 ----
ok('B14: result.js 不再引用 zMonthAvg', !/zMonthAvg/.test(resultJsText));
ok('B14: ledger 行不再产出 zMonthAvg', !/zMonthAvg/.test(engineText));
ok('B17: 分母说明为 12116', /12116/.test(resultWxml));

// ---- BUG-18 静态检查：封顶层级（月指数层）与依据标注 ----
ok('B18: 引擎在月指数层 min(3)（zRaw/zCapped）', /zRaw/.test(engineText) && /zCapped/.test(engineText));
ok('B18: 封顶不是只加在最终 Z实 层', !/Z实\s*>\s*3\s*\?\s*3/.test(engineText));
ok('B18: 结果页含 300% 上限/封顶说明', /300%|封顶/.test(resultWxml));
ok('B18: result.js 透传 zCapped/zRaw', /zCapped/.test(resultJsText) && /zRaw/.test(resultJsText));

// ---- BUG-15：缺省 entryMode='year'（首次进入与清空后均年度模式） ----
var P = require('../constants/policyData.js');
eq('B15: buildInitialData entryMode=year', InputModel.buildInitialData(P).entryMode, 'year');
eq('B15: buildResetData entryMode=year', InputModel.buildResetData(P).entryMode, 'year');
ok('B15: 缺省 yearRows 为年度模板',
  InputModel.buildInitialData(P).yearRows[0].year === '2024' &&
  InputModel.buildInitialData(P).yearRows[0].months === '12');

// ---- BUG-16 静态检查 ----
ok('B16: result.wxml 含 pageLoading 遮罩', /pageLoading/.test(resultWxml) && /calc-mask/.test(resultWxml));
var indexJsText = fs.readFileSync(path.join(__dirname, '..', 'pages', 'index', 'index.js'), 'utf8');
ok('B16: index.js 含 onShow 复位', /onShow: function/.test(indexJsText));
ok('B16: navigateTo 含 fail 复位', /fail: \(\)/.test(indexJsText) || /fail:function/.test(indexJsText));
var indexWxssText = fs.readFileSync(path.join(__dirname, '..', 'pages', 'index', 'index.wxss'), 'utf8');
var appWxssText = fs.readFileSync(path.join(__dirname, '..', 'app.wxss'), 'utf8');
ok('B16: 遮罩样式已上移 app.wxss', /\.calc-mask/.test(appWxssText) && /@keyframes calc-spin/.test(appWxssText));
ok('B16: index.wxss 不再重复定义遮罩', !/\.calc-mask/.test(indexWxssText));

cases.forEach(function (c) {
  var r = Engine.calculate(makeInput(c.z, c.type));
  var ledger = r.annualIndex;
  var p = c.name + ':';

  // ---- BUG-17：窗口索引/分母 ----
  eq(p + ' ledger 42 行', ledger.length, 42);
  eq(p + ' 首行1992', ledger[0].year, 1992);
  eq(p + ' 末行2033', ledger[41].year, 2033);
  eq(p + ' K应缴月=392', r.intermediates.K应缴月, 392);
  check(p + ' N应缴=32.6667', r.intermediates.N应缴, 32.6667);
  eq(p + ' 逐月首月=2000-11', r.monthlyDetails[0].ym, '2000-11');
  eq(p + ' 逐月末月=2033-06', r.monthlyDetails[391].ym, '2033-06');
  eq(p + ' 逐月长度=392', r.monthlyDetails.length, 392);

  // ---- Bug20：未来段82月，月基数/月指数/区间边界 ----
  var future = r.monthlyDetails.filter(function (d) {
    return d.ym >= '2026-09' && d.ym <= '2033-06';
  });
  eq(p + ' 未来段=82月', future.length, 82);
  future.forEach(function (d) {
    check(p + ' 未来月 base=' + c.fb, d.base, c.fb, 0.001);
    check(p + ' 未来月 z=' + c.zFuture, d.z, c.zFuture, 0.0001);
  });

  // ---- Bug21：勾稽（直接相加式）----
  var directSum = 0, totalWindowMonths = 0;
  ledger.forEach(function (a) {
    if (a.zYear != null && a.windowMonths > 0) {
      directSum += a.zYear;
      totalWindowMonths += a.windowMonths;
    }
  });
  eq(p + ' ΣwindowMonths=K(392)', totalWindowMonths, r.intermediates.K应缴月);
  check(p + ' ΣZ年(34行直接和)', directSum, c.sumZYear, 0.0002);
  check(p + ' Σ34行/N应缴=Z实(核心勾稽)', directSum / r.intermediates.N应缴, c.Z实, 0.0002);
  check(p + ' Z实指数(主汇总)', r.intermediates.Z实指数, c.Z实);
  // raw 级严格恒等
  var rawByYear = {};
  r.monthlyDetails.forEach(function (d) {
    var yy = Number(d.ym.slice(0, 4));
    rawByYear[yy] = (rawByYear[yy] || 0) + d.z;
  });
  var rawSum34 = 0;
  Object.keys(rawByYear).forEach(function (yy) { rawSum34 += rawByYear[yy] / 12; });
  var rawZReal = r.monthlyDetails.reduce(function (a2, d2) { return a2 + d2.z; }, 0) / r.intermediates.K应缴月;
  check(p + ' raw: Σ34行/(K/12)=主汇总Z实(1e-12)', rawSum34 / (r.intermediates.K应缴月 / 12), rawZReal, 1e-12);

  // ---- BUG-18：封顶前 Z实（用 zRaw 独立汇总，证明主汇总是“已封顶月 z”口径）----
  var rawSum = 0, cappedMonths = 0, negRaw = 0, overCap = 0;
  r.monthlyDetails.forEach(function (d) {
    rawSum += d.zRaw;
    if (d.zCapped) cappedMonths++;
    if (d.zRaw < 0) negRaw++;
    if (d.z > 3) overCap++;
  });
  eq(p + ' zRaw 恒≥0（无负值月）', negRaw, 0);
  eq(p + ' z 恒≤3（无漏封月）', overCap, 0);
  check(p + ' 封顶前 Z实(ΣzRaw/392)=' + c.preZ, rawSum / 392, c.preZ, 0.0002);
  eq(p + ' 封顶月数=12（仅2019年）', cappedMonths, 12);
  var capReduction = r.monthlyDetails.reduce(function (a, d) { return a + d.zRaw - d.z; }, 0);
  check(p + ' 封顶削减量=1.4024', capReduction, 1.4024, 0.001);

  // 2019 逐月：zRaw=3.1169、zCapped=true、z=3
  var m2019 = r.monthlyDetails.filter(function (d) { return d.ym.slice(0, 4) === '2019'; });
  eq(p + ' 2019 12个月', m2019.length, 12);
  m2019.forEach(function (d) {
    check(p + ' 2019 zRaw=3.1169', d.zRaw, 3.1169, 0.0001);
    eq(p + ' 2019 zCapped=true', d.zCapped, true);
    check(p + ' 2019 z=3(封顶)', d.z, 3);
  });

  // 无缴费窗口年份（1992~1999；窗口自2000-11）
  [1992, 1993, 1994, 1995].forEach(function (y) {
    var row = ledger[y - 1992];
    eq(p + ' ' + y + ' 缺分母/无缴费', row.paidMonths, 0);
    eq(p + ' ' + y + ' cPrevAnnual=null', row.cPrevAnnual, null);
    eq(p + ' ' + y + ' zYear=null', row.zYear, null);
  });
  [1996, 1997, 1998, 1999].forEach(function (y) {
    var row = ledger[y - 1992];
    eq(p + ' ' + y + ' paidMonths=0', row.paidMonths, 0);
    check(p + ' ' + y + ' zYear=0', row.zYear, 0);
  });

  // 2000：2个月窗口，年值法 Z年=0.4458（稀释，非月均2.6747）
  var r2000 = ledger[2000 - 1992];
  eq(p + ' 2000 windowMonths=2', r2000.windowMonths, 2);
  eq(p + ' 2000 paidMonths=2', r2000.paidMonths, 2);
  check(p + ' 2000 Xn=6142', r2000.xAnnual, 6142);
  check(p + ' 2000 C全年=13778.04(展示)', r2000.cPrevAnnual, 13778.04);
  check(p + ' 2000 Z年=0.4458(年值稀释)', r2000.zYear, 0.4458);
  eq(p + ' 2000 partialYear=true', r2000.partialYear, true);
  check(p + ' 2001 Z年=2.6280', ledger[9].zYear, 2.6280);
  check(p + ' 2025 Z年=2.9779', ledger[2025 - 1992].zYear, 2.9779);

  // 2019 年表：封顶后 Z年=3.0000
  var r2019 = ledger[2019 - 1992];
  check(p + ' 2019 Z年=3.0000(年表同步封顶)', r2019.zYear, 3);
  eq(p + ' 2019 source=official', r2019.denomSource, 'official');

  // 2026：8月历史(287562/8=35945.25) + 4月未来段；分母键 2026=12116 official
  var r2026 = ledger[2026 - 1992];
  check(p + ' 2026 Z年=' + c.z2026, r2026.zYear, c.z2026);
  eq(p + ' 2026 source=official', r2026.denomSource, 'official');
  eq(p + ' 2026 partialYear=false', r2026.partialYear, false);

  // 2027~2032：未来段整年，分母 assumed 回退 12116
  for (var y = 2027; y <= 2032; y++) {
    var row = ledger[y - 1992];
    check(p + ' ' + y + ' Z年=' + c.zFuture, row.zYear, c.zFuture);
    eq(p + ' ' + y + ' source=assumed', row.denomSource, 'assumed');
    eq(p + ' ' + y + ' partialYear=false', row.partialYear, false);
  }

  // 2033：仅6个月窗口；年值法稀释 MY1=0.3000 / MY2=1.5000
  var r2033 = ledger[2033 - 1992];
  eq(p + ' 2033 windowMonths=6', r2033.windowMonths, 6);
  eq(p + ' 2033 paidMonths=6', r2033.paidMonths, 6);
  check(p + ' 2033 Z年(年值稀释)', r2033.zYear, c.name === 'MY1' ? 0.3 : 1.5);
  eq(p + ' 2033 partialYear=true', r2033.partialYear, true);

  // R储（封顶不影响账户累积）
  check(p + ' R储本金', r.intermediates.R储本金, c.principal);
  check(p + ' R储利息', r.intermediates.R储利息, c.interest);
  check(p + ' R储', r.intermediates.R储, c.R储);
  check(p + ' 672920+本金+利息=R储', 672920 + c.principal + c.interest, c.R储, 0.02);
  // R补 用参保后（已封顶）Z实
  check(p + ' R补(参保后封顶Z实)', r.intermediates.R补, c.R补, 0.02);
  check(p + ' G实(含封顶Z实)', r.intermediates.G实, c.J过渡, 0.02);
  // 三分项与合计
  check(p + ' J基础', r.pension.J基础, c.J基础, 0.02);
  check(p + ' J账户', r.pension.J账户, c.J账户, 0.02);
  check(p + ' J过渡', r.pension.J过渡, c.J过渡, 0.02);
  check(p + ' total', r.pension.total, c.total, 0.01);
});

// ---- BUG-18 未触发场景：所有月 zRaw≤3 时不得误封顶 ----
(function () {
  var input = makeInput(1.0, 'enterprise'); // 未来段=12116（z=1）→ zRaw=1<3
  // 2019 历史段 zRaw 恒=3.1169，同步压低到 10000/月（<3），否则 2019 仍触发封顶
  input.segments = input.segments.map(function (s) {
    if (s.startYM === '2019-01' && s.endYM === '2019-12') {
      return Object.assign({}, s, { baseMonthly: 10000 });
    }
    return s;
  });
  var r = Engine.calculate(input);
  var anyCapped = r.monthlyDetails.some(function (d) {
    return d.zCapped || d.z !== d.zRaw;
  });
  eq('B18 低指数案无误封顶', anyCapped, false);
})();

// ---- BUG-18 断缴/缺分母月：z=zRaw=0，仍计入窗口与分母 ----
(function () {
  var input = makeInput(0.6, 'flexible');
  // 删除 2010 全年缴费段（窗口内断缴12月）
  input.segments = input.segments.filter(function (s) {
    return !(s.startYM === '2010-01' && s.endYM === '2010-12');
  });
  var r = Engine.calculate(input);
  var gaps = r.monthlyDetails.filter(function (d) { return d.ym.slice(0, 4) === '2010'; });
  eq('B18 断缴12月仍在窗口', gaps.length, 12);
  gaps.forEach(function (d) {
    check('B18 断缴 z=0', d.z, 0);
    check('B18 断缴 zRaw=0', d.zRaw, 0);
    eq('B18 断缴 zCapped=false', d.zCapped, false);
  });
  eq('B18 K仍=392（断缴计分母）', r.intermediates.K应缴月, 392);
})();

// ---- #12a buildRStoreVm 沙箱接线验证 ----
ok('12a: 结果页不再出现“用户口径符号”旧文案', !/用户口径符号/.test(resultJsText));

var appObj = { globalData: {} };
var navBack = 0;
var wxStub = {
  showToast: function () {}, setClipboardData: function (o) { o.success && o.success(); },
  navigateBack: function () { navBack++; }
};
var pageConfig = null;
var sandbox = {
  getApp: function () { return appObj; },
  wx: wxStub,
  Page: function (cfg) { pageConfig = cfg; },
  console: console, process: process
};
var resultIndexPath = path.join(__dirname, '..', 'pages', 'result', 'result.js');
var requireLocal = Module.createRequire(resultIndexPath);
sandbox.require = requireLocal;
var vm = require('vm');
var ctx = vm.createContext(sandbox);
var wrapped = Module.wrap(fs.readFileSync(resultIndexPath, 'utf8'));
vm.runInContext(wrapped, ctx)({}, requireLocal, resultIndexPath, path.dirname(resultIndexPath));

var initialPageData = JSON.parse(JSON.stringify(pageConfig.data));

cases.forEach(function (c) {
  var r = Engine.calculate(makeInput(c.z, c.type));
  appObj.globalData.lastResult = r;
  var inst = { data: JSON.parse(JSON.stringify(initialPageData)) };
  inst.setData = function (patch) {
    Object.keys(patch).forEach(function (k) { this.data[k] = patch[k]; }, this);
  };
  inst.setData = inst.setData.bind(inst);
  eq(c.name + ': B16 onLoad 前 pageLoading=true', inst.data.pageLoading, true);
  pageConfig.onLoad.call(inst);
  eq(c.name + ': B16 onLoad 后 pageLoading=false', inst.data.pageLoading, false);
  var rs = inst.data.vm.rStore;
  var p = c.name + ':';
  eq(p + ' rStore.kind=future-roll', rs.kind, 'future-roll');
  eq(p + ' 起算月 fromYM=2026-09', rs.fromYM, '2026-09');
  eq(p + ' anchorYM=2026-08', rs.anchorYM, '2026-08');
  eq(p + ' toYM=2033-06', rs.toYM, '2033-06');
  eq(p + ' months=82', rs.months, 82);
  eq(p + ' anchor=672920', rs.anchor, '672920');
  eq(p + ' principalText', rs.principalText, String(c.principal));
  eq(p + ' interestText', rs.interestText, String(c.interest));
  ok(p + ' explain 含起算口径与恒等式',
    rs.explain.indexOf('2026-09') >= 0 && rs.explain.indexOf('672920') >= 0 &&
    rs.explain.indexOf('不重复计算') >= 0 && rs.explain.indexOf(String(c.R储)) >= 0,
    rs.explain.slice(0, 120));
  // 年度账 vmAnnual
  eq(p + ' vmAnnual 42 行', inst.data.vmAnnual.length, 42);
  eq(p + ' vmAnnual 2000 zYearText=0.4458', inst.data.vmAnnual[8].zYearText, '0.4458');
  eq(p + ' vmAnnual 2000 partial=true', inst.data.vmAnnual[8].partial, true);
  eq(p + ' vmAnnual 2019 zYearText=3.0000', inst.data.vmAnnual[27].zYearText, '3.0000');
  eq(p + ' vmAnnual 2019 capped=true', inst.data.vmAnnual[27].capped, true);
  eq(p + ' vmAnnual 2026 zYearText=' + c.z2026.toFixed(4),
    inst.data.vmAnnual[34].zYearText, c.z2026.toFixed(4));
  eq(p + ' vmAnnual 2033 zYearText=' + (c.name === 'MY1' ? '0.3000' : '1.5000'),
    inst.data.vmAnnual[41].zYearText, c.name === 'MY1' ? '0.3000' : '1.5000');
  eq(p + ' vmAnnual 2033 partial=true', inst.data.vmAnnual[41].partial, true);
});

// ---- BUG-16 异常路径 ----
appObj.globalData.lastResult = null;
(function () {
  var inst2 = { data: { pageLoading: true } };
  inst2.setData = function (patch) {
    Object.keys(patch).forEach(function (k) { this.data[k] = patch[k]; }, this);
  };
  inst2.setData = inst2.setData.bind(inst2);
  pageConfig.onLoad.call(inst2);
  eq('B16 无结果异常 pageLoading=false', inst2.data.pageLoading, false);
})();

// ---- BUG-15 草稿兼容 ----
(function () {
  var draftMonth = Object.assign(InputModel.buildInitialData(P), { entryMode: 'month' });
  var merged1 = Object.assign(InputModel.buildInitialData(P), draftMonth, { calculating: false, errorMsg: '' });
  eq('B15: month 草稿回填 month', merged1.entryMode, 'month');
  var draftYear = Object.assign(InputModel.buildInitialData(P), { entryMode: 'year', yearRows: [{ year: '2010' }] });
  var merged2 = Object.assign(InputModel.buildInitialData(P), draftYear, { calculating: false, errorMsg: '' });
  eq('B15: year 草稿回填 year', merged2.entryMode, 'year');
  eq('B15: 草稿 yearRows 不被覆盖', merged2.yearRows[0].year, '2010');
})();

console.log('RESULT pass=' + pass + ' fail=' + fail);

// ---- BUG-16 index.js 行为沙箱 ----
(function () {
  var indexPath = path.join(__dirname, '..', 'pages', 'index', 'index.js');
  var requireLocalIdx = Module.createRequire(indexPath);
  var navCalls = [], toastCalls = [];
  var appStub = { globalData: {} };
  var storage = {};
  var wxIdx = {
    getStorageSync: function (k) { return storage[k]; },
    setStorageSync: function (k, v) { storage[k] = v; },
    removeStorageSync:function (k) { delete storage[k]; },
    showToast: function (o) { toastCalls.push(o); },
    navigateTo: function (o) {
      navCalls.push(o);
      if (wxIdx._navFail) o.fail && o.fail();
    }
  };
  var idxPage = null;
  var sb = {
    getApp: function () { return appStub; },
    wx: wxIdx,
    Page: function (cfg) { idxPage = cfg; },
    setTimeout: function (fn) { fn(); },
    console: console, process: process
  };
  sb.require = requireLocalIdx;
  var ctx2 = require('vm').createContext(sb);
  var wrappedIdx = Module.wrap(fs.readFileSync(indexPath, 'utf8'));
  require('vm').runInContext(wrappedIdx, ctx2)({}, requireLocalIdx, indexPath, path.dirname(indexPath));

  function freshInstance() {
    var inst = Object.assign({}, idxPage);
    inst.data = JSON.parse(JSON.stringify(idxPage.data));
    inst.setData = function (patch, cb) {
      Object.keys(patch).forEach(function (k) { this.data[k] = patch[k]; }, this);
      if (cb) cb.call(this);
    };
    inst.setData = inst.setData.bind(inst);
    return inst;
  }

  var i0 = freshInstance();
  idxPage.onLoad.call(i0);
  eq('B15: index onLoad 后 entryMode=year', i0.data.entryMode, 'year');

  var i1 = freshInstance();
  idxPage.onLoad.call(i1);
  i1.data.yearRows = [
    { year: '2024', startMonth: '1', type: 'enterprise', annualBase: '120000', months: '12' },
    { year: '2025', startMonth: '1', type: 'enterprise', annualBase: '120000', months: '6' }
  ];
  i1.data.retireYM = '2026-10';
  i1.data.birthYM = '1965-10';
  i1.data.gender = 'male';
  i1.data.futureMonthlyRatePct = '';
  i1.data.accountBalanceManual = '0';
  navCalls.length = 0; toastCalls.length = 0;
  idxPage.onCalculate.call(i1);
  eq('B16: 成功路径 navigateTo 已发起', navCalls.length, 1);
  eq('B16: 跳转时遮罩仍在 calculating=true', i1.data.calculating, true);
  idxPage.onShow.call(i1);
  eq('B16: onShow 后 calculating=false', i1.data.calculating, false);

  var i2 = freshInstance();
  idxPage.onLoad.call(i2);
  i2.data.yearRows = [
    { year: '2024', startMonth: '1', type: 'enterprise', annualBase: '120000', months: '12' }
  ];
  i2.data.retireYM = '2026-10';
  i2.data.birthYM = '1965-10';
  i2.data.gender = 'male';
  i2.data.futureMonthlyRatePct = '';
  i2.data.accountBalanceManual = '0';
  wxIdx._navFail = true;
  idxPage.onCalculate.call(i2);
  wxIdx._navFail = false;
  eq('B16: navigateTo fail 后 calculating=false', i2.data.calculating, false);

  var i3 = freshInstance();
  idxPage.onLoad.call(i3);
  i3.data.yearRows = [
    { year: '2024', startMonth: '1', type: 'enterprise', annualBase: '', months: '12' }
  ];
  i3.data.retireYM = '2026-10';
  i3.data.birthYM = '1965-10';
  i3.data.gender = 'male';
  idxPage.onCalculate.call(i3);
  eq('B16: 校验失败 calculating=false', i3.data.calculating, false);
  ok('B16: 校验失败 errorMsg 有值', !!i3.data.errorMsg, i3.data.errorMsg);
})();

console.log('FINAL pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
