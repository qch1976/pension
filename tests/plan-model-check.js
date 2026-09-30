// tests/plan-model-check.js
// D3 方案卡纯函数 node 断言（不依赖 wx/组件）：
//  1) Z：非数字/越界阻断；0.60、3.00 合法；边界 <0.60、>3.00 阻断
//  2) 缴费性质：非法值阻断；enterprise/flexible 合法
//  3) 退休年月：合法区间与 retireSchedule.flexibleRange 一致，且不早于 2026-09；越界阻断
//  4) 空卡/部分卡/有效卡；默认 2 张、最多 3、增删判定
'use strict';
var D = require('../calculator/dateUtil.js');
var Schedule = require('../calculator/retireSchedule.js');
var PM = require('../calculator/planModel.js');

var pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } }
function hasError(fnResult, frag, n) {
  ok(fnResult && fnResult.indexOf(frag) !== -1, n + ' (实际: ' + fnResult + ')');
}

// 典型男职工上下文：1976-09 出生（法定63，2039-09；区间远于2026-09，窗口下限2026-09不起作用）
var maleCtx = { gender: 'male', femaleType: '', birthYM: '1976-09' };
// 临近窗口的男职工：法定退休约在2026年，区间下限受 2026-09 约束
var nearCtx = { gender: 'male', femaleType: '', birthYM: '1966-06' };

// ---- 1) Z ----
(function () {
  hasError(PM.validateZ('abc'), '数字', 'Z非数字阻断');
  hasError(PM.validateZ('0.59'), '0.60~3.00', 'Z=0.59越界');
  hasError(PM.validateZ('3.01'), '0.60~3.00', 'Z=3.01越界');
  hasError(PM.validateZ('0'), '0.60~3.00', 'Z=0越界');
  ok(PM.validateZ('0.60') === null, 'Z=0.60合法');
  ok(PM.validateZ('3.00') === null, 'Z=3.00合法');
  ok(PM.validateZ('1.5') === null, 'Z=1.5合法');
  ok(PM.validateZ('') === null, 'Z空不直接报错（由未填全处理）');
})();

// ---- 2) 缴费性质 ----
(function () {
  hasError(PM.validateSegType('bogus'), '非法', '缴费性质非法值');
  ok(PM.validateSegType('enterprise') === null, 'enterprise合法');
  ok(PM.validateSegType('flexible') === null, 'flexible合法');
  ok(PM.validateSegType('') === null, '性质空不直接报错');
})();

// ---- 3) 退休年月区间 ----
(function () {
  var range = PM.legalRange(maleCtx, D);
  var key = Schedule.keyOf(maleCtx.gender, maleCtx.femaleType);
  var raw = Schedule.flexibleRange(key, maleCtx.birthYM);
  // 与 flexibleRange 一致
  ok(range.maxIdx === raw.max, '上限与flexibleRange一致');
  // 下限取 flexibleRange.min 与 2026-09 的较严者
  var expectMin = Math.max(raw.min, D.toIndex('2026-09'));
  ok(range.minIdx === expectMin, '下限=flexibleRange.min与2026-09取严');
  ok(range.statutoryYM === D.toYM(raw.statutory), '法定退休年月一致');

  // 区间内合法
  var inYM = D.toYM(raw.statutory);
  ok(PM.validateRetireYM(inYM, maleCtx, D) === null, '法定退休年月合法');
  ok(PM.validateRetireYM(D.toYM(raw.max), maleCtx, D) === null, '上限点合法');
  ok(PM.validateRetireYM(D.toYM(expectMin), maleCtx, D) === null, '下限点合法');

  // 越界阻断
  hasError(PM.validateRetireYM(D.toYM(raw.max + 1), maleCtx, D), '合法上限', '晚于上限阻断');
  hasError(PM.validateRetireYM(D.toYM(expectMin - 1), maleCtx, D), '合法下限', '早于下限阻断');
  hasError(PM.validateRetireYM('2026-08', maleCtx, D), '合法下限', '早于窗口起点2026-09阻断');
  hasError(PM.validateRetireYM('bad', maleCtx, D), 'YYYY-MM', '格式非法阻断');

  // nearCtx：窗口起点 2026-09 成为有效约束
  var nr = PM.legalRange(nearCtx, D);
  ok(nr.minIdx === D.toIndex('2026-09'), 'nearCtx下限为2026-09（窗口起约束）');
  hasError(PM.validateRetireYM('2026-08', nearCtx, D), '2026-09', 'nearCtx早于窗口阻断');
  ok(PM.validateRetireYM('2026-09', nearCtx, D) === null, 'nearCtx恰2026-09合法');

  // 上下文不足
  ok(PM.legalRange({ gender: 'male' }, D) === null, '缺出生年月无区间');
  hasError(PM.validateRetireYM('2030-01', { gender: 'male' }, D), '共享数据区', '上下文不足时阻断');
})();

// ---- 4) 空卡/部分卡/有效卡 + 增删 ----
(function () {
  var blank = { retireYM: '', z: '', segType: '' };
  ok(PM.isEmptyPlan(blank), '三项全空=空卡');
  ok(!PM.isValidPlan(blank, maleCtx, D), '空卡不可比较');

  var full = { retireYM: PM.defaultRetireYM(maleCtx), z: '1.0', segType: 'enterprise' };
  ok(!PM.isEmptyPlan(full), '填全非空卡');
  ok(PM.isValidPlan(full, maleCtx, D), '三项填全合法=有效卡');

  var partial = { retireYM: PM.defaultRetireYM(maleCtx), z: '', segType: 'enterprise' };
  ok(PM.isPartialPlan(partial), '缺Z=部分卡');
  ok(!PM.isValidPlan(partial, maleCtx, D), '部分卡不可比较');

  var badZ = { retireYM: PM.defaultRetireYM(maleCtx), z: '5', segType: 'enterprise' };
  ok(!PM.isValidPlan(badZ, maleCtx, D), 'Z越界卡不可比较');

  // 默认两张
  var ini = PM.initialPlans(maleCtx);
  ok(ini.length === 2, '默认2张方案卡');
  ok(ini[0].retireYM === PM.defaultRetireYM(maleCtx), '默认卡预填法定退休年月');

  // 增删
  ok(PM.canAdd(2) === true, '2张可再添加');
  ok(PM.canAdd(3) === false, '3张不可添加');
  ok(PM.belowCompareAfterRemove(2) === true, '从2删1后低于比较数量');
  ok(PM.belowCompareAfterRemove(3) === false, '从3删1后仍可比较');

  // 上下文不足时的空卡 retireYM 为空
  var noCtx = { gender: '' };
  ok(PM.emptyPlan(noCtx).retireYM === '', '上下文不足空卡退休年月为空');
})();

console.log('\\nplan-model-check: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
