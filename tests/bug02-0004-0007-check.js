// tests/bug02-0004-0007-check.js
// D1 回归：BUG-02-0004（缴费起始时间动态化+可编辑）、BUG-02-0005~0007（共享区单一记账利率透传
//   引擎滚动分支，basic/compare 同输入 ±0.001 一致，J账随 Z 拉开）。
// 纯函数、不依赖 wx，可 node 直接断言；不跑 GUI。
'use strict';
var V = require('../calculator/inputValidator.js');
var Asm = require('../calculator/planAssembler.js');
var ROI = require('../calculator/roiModel.js');
var Engine = require('../calculator/pensionEngine.js');
var D = require('../calculator/dateUtil.js');
var P = require('../constants/policyData.js');
var PM = require('../calculator/planModel.js');

var pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; } else { fail++; console.log('  FAIL: ' + n); } }
function approx(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 0.001 : eps); }

// 方案卡可接受的最小共享 page data（手工录入口径），历史缴费截至 2026-08。
function pageData(ratePct, histEnd) {
  var end = histEnd || '2026-08';
  return {
    gender: 'male', femaleType: '', birthYM: '1976-09', workStartYM: '1998-08',
    hasDeemed: false, deemedStartYM: '', deemedEndYM: '', entryMode: 'seg',
    segments: [
      { type: 'enterprise', startYM: '1998-08', endYM: '2010-12', baseMonthly: '5000' },
      { type: 'enterprise', startYM: '2011-01', endYM: end, baseMonthly: '12116' }
    ],
    yearRows: [], accountBalanceManual: '250000', manualBalanceYM: end,
    futureMonthlyRatePct: ratePct, baseYearOptions: ['2025'], baseYearIndex: 0,
    cPingOverride: '', customCYearText: '',
    doc31Eligible: false, doc31TransferYM: '', enterpriseInsuredYM: '', subsidyExcludedText: ''
  };
}
function aPlan(z, retireYM, windowStartYM) {
  return { id: 'A', retireYM: retireYM, z: String(z), segType: 'enterprise',
    windowStartYM: windowStartYM == null ? '' : windowStartYM };
}

// =====================================================================
// TST-02-UT-1025 BUG-02-0004：缺省缴费起始月 = 实际缴费最后月 +1（不再写死）
// =====================================================================
(function () {
  var shared = V.buildSharedInput(P, D, pageData('1.5', '2026-08'), '2026-08');
  ok(Asm.defaultWindowStart(shared) === '2026-09', 'TST-02-UT-1025 交到2026-08→缺省2026-09');
  var pl = aPlan(1, '2033-07', '');
  ok(Asm.resolveWindowStart(pl, shared) === '2026-09', 'TST-02-UT-1025 空 windowStartYM 取动态缺省');

  // 历史末月不同 → 缺省随之变化（动态性证明）
  var shared2 = V.buildSharedInput(P, D, pageData('1.5', '2025-03'), '2026-08');
  // 注：pageData 手工造历史末月=2025-03
  shared2.segments = [
    { type: 'enterprise', startYM: '2000-01', endYM: '2025-03', baseMonthly: 10000 }
  ];
  ok(Asm.defaultWindowStart(shared2) === '2025-04', 'TST-02-UT-1025 交到2025-03→缺省2025-04（动态）');
})();

// =====================================================================
// TST-02-UT-1026 BUG-02-0004：方案卡可手动编辑起始月并贯穿到自动段首月
// =====================================================================
(function () {
  var shared = V.buildSharedInput(P, D, pageData('1.5'), '2026-08');
  var pl = aPlan(1, '2033-07', '2028-03');
  ok(Asm.resolveWindowStart(pl, shared) === '2028-03', 'TST-02-UT-1026 手改值优先');
  var inp = Asm.assemblePlanInput(shared, pl);
  var auto = inp.segments.filter(function (s) { return s.startYM >= '2026-09'; });
  ok(auto.length > 0 && auto[0].startYM === '2028-03', 'TST-02-UT-1026 自动段首月=2028-03');
  // 自动段末月=退休前一月
  var last = auto[auto.length - 1];
  ok(last.endYM === '2033-06', 'TST-02-UT-1026 自动段止于退休前一月2033-06');
})();

// =====================================================================
// TST-02-UT-1027 BUG-02-0004：起始月越界校验（介于历史末月与退休前一月）
// =====================================================================
(function () {
  var shared = V.buildSharedInput(P, D, pageData('1.5'), '2026-08');
  var ctx = { gender: 'male', birthYM: '1976-09', historyEndYM: '2026-08' };
  // 早于历史末月
  var early = aPlan(1, '2033-07', '2025-01');
  try { Asm.assemblePlanInput(shared, early); ok(false, 'TST-02-UT-1027 早于历史末月应抛错'); }
  catch (e) { ok(/早于最后缴费月/.test(e.message), 'TST-02-UT-1027 早于历史末月抛错: ' + e.message); }
  // 晚于退休前一月
  var late = aPlan(1, '2027-02', '2028-01');
  try { Asm.assemblePlanInput(shared, late); ok(false, 'TST-02-UT-1027 晚于退休前一月应抛错'); }
  catch (e) { ok(/不得晚于退休前一月/.test(e.message), 'TST-02-UT-1027 晚于退休前一月抛错: ' + e.message); }
  // planModel 纯函数层
  ok(/早于最后缴费月/.test(PM.validateWindowStartYM('2025-01', ctx, '2033-07', D) || ''),
    'TST-02-UT-1027 planModel 早界');
  ok(/不得晚于退休前一月/.test(PM.validateWindowStartYM('2040-01', ctx, '2033-07', D) || ''),
    'TST-02-UT-1027 planModel 晚界');
  ok(PM.validateWindowStartYM('', ctx, '2033-07', D) === null, 'TST-02-UT-1027 留空合法（取缺省）');
  ok(PM.defaultWindowStartYM(ctx, D) === '2026-09', 'TST-02-UT-1027 planModel 缺省=末月+1');
})();

// =====================================================================
// TST-02-UT-1028 BUG-02-0005：共享区单一记账利率解析与透传（缺省1.5%，0，越界）
// =====================================================================
(function () {
  ok(approx(V.parseSharedRatePct('1.5').rate, 0.015), 'TST-02-UT-1028 1.5%→0.015');
  ok(approx(V.parseSharedRatePct('').rate, 0.015) && V.parseSharedRatePct('').usedDefault === true,
    'TST-02-UT-1028 留空→缺省1.5%');
  ok(approx(V.parseSharedRatePct('0').rate, 0), 'TST-02-UT-1028 填0→0（不计息）');
  try { V.parseSharedRatePct('25'); ok(false, 'TST-02-UT-1028 25%越界应抛错'); }
  catch (e) { ok(/0~20/.test(e.message), 'TST-02-UT-1028 25%越界抛错: ' + e.message); }
  // buildSharedInput 透传到引擎入参（不再写死 null）
  var s15 = V.buildSharedInput(P, D, pageData('1.5'), '2026-08');
  var s0 = V.buildSharedInput(P, D, pageData('0'), '2026-08');
  var sBlank = V.buildSharedInput(P, D, pageData(''), '2026-08');
  ok(approx(s15.futureMonthlyRate, 0.015), 'TST-02-UT-1028 共享入参带1.5%利率');
  ok(approx(s0.futureMonthlyRate, 0), 'TST-02-UT-1028 共享入参0利率');
  ok(approx(sBlank.futureMonthlyRate, 0.015), 'TST-02-UT-1028 留空缺省1.5%');
  // SHARED_KEYS 含该字段，文件/common 缺省可 applyPrefill
  ok(V.SHARED_KEYS.indexOf('futureMonthlyRatePct') !== -1, 'TST-02-UT-1028 SHARED_KEYS 含记账利率');
})();

// =====================================================================
// TST-02-UT-1029 BUG-02-0005：停保分支无自动段且未来零利率（continue 与 stop 都接通）
// =====================================================================
(function () {
  var shared = V.buildSharedInput(P, D, pageData('1.5'), '2026-08');
  var pl = aPlan(1, '2033-07', '');
  var cont = ROI.buildCaseInput(shared, pl, true);
  var stop = ROI.buildCaseInput(shared, pl, false);
  ok(cont.segments.some(function (s) { return s.startYM === '2026-09'; }),
    'TST-02-UT-1029 continue 含自动段');
  ok(approx(cont.futureMonthlyRate, 0.015), 'TST-02-UT-1029 continue 透传共享利率1.5%');
  ok(!stop.segments.some(function (s) { return s.startYM >= '2026-09'; }),
    'TST-02-UT-1029 stop 无自动段');
  ok(stop.futureMonthlyRate === null, 'TST-02-UT-1029 stop 未来零利率（静态基准）');
})();

// =====================================================================
// TST-02-UT-1030 BUG-02-0006/0007：basic 与 compare 同输入结果 ±0.001 一致
//   （利率 0 / 1.5% 两档 × Z 0.6 / 3.0，R储 / J账户 / P月）
// =====================================================================
(function () {
  [0, 1.5].forEach(function (ratePct) {
    [0.6, 3.0].forEach(function (z) {
      var shared = V.buildSharedInput(P, D, pageData(String(ratePct)), '2026-08');
      var pl = aPlan(z, '2033-07', '');
      var basic = Engine.calculate(Asm.assemblePlanInput(shared, pl));          // basic 路径
      var cmp = Engine.calculate(ROI.buildCaseInput(shared, pl, true));         // compare 路径
      var tag = 'rate' + ratePct + '% Z' + z;
      ok(approx(basic.intermediates.R储, cmp.intermediates.R储, 0.001),
        'TST-02-UT-1030 R储一致 ' + tag + ' ' + basic.intermediates.R储 + '/' + cmp.intermediates.R储);
      ok(approx(basic.pension.J账户, cmp.pension.J账户, 0.001),
        'TST-02-UT-1030 J账户一致 ' + tag + ' ' + basic.pension.J账户 + '/' + cmp.pension.J账户);
      ok(approx(basic.pension.total, cmp.pension.total, 0.001),
        'TST-02-UT-1030 P月一致 ' + tag + ' ' + basic.pension.total + '/' + cmp.pension.total);
    });
  });
})();

// =====================================================================
// TST-02-UT-1031 BUG-02-0007：compare 方案 J账随 Z(0.6→3.0) 显著拉开（不再相同）
// =====================================================================
(function () {
  [0, 1.5].forEach(function (ratePct) {
    var shared = V.buildSharedInput(P, D, pageData(String(ratePct)), '2026-08');
    var j06 = Engine.calculate(ROI.buildCaseInput(shared, aPlan(0.6, '2033-07', ''), true)).pension.J账户;
    var j30 = Engine.calculate(ROI.buildCaseInput(shared, aPlan(3.0, '2033-07', ''), true)).pension.J账户;
    ok(j06 !== j30 && j30 > j06,
      'TST-02-UT-1031 rate' + ratePct + '% J账随Z拉开 J(0.6)=' + j06 + ' J(3.0)=' + j30);
    // 差距应显著（>100 元），证明滚动分支对 Z 敏感
    ok((j30 - j06) > 100, 'TST-02-UT-1031 rate' + ratePct + '% J账拉开>100：' + (j30 - j06).toFixed(2));
  });
})();

console.log('\nbug02-0004-0007-check: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
