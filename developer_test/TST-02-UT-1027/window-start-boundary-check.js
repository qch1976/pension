// developer_test/TST-02-UT-1027/window-start-boundary-check.js
// TST-02-UT-1027（BUG-02-0004，REQ-02-CAL-000, REQ-02-VAL-004，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：起始月越界校验（介于历史末月与退休前一月），留空合法。
'use strict';
var path = require('path');
var V = require(path.join(__dirname, '..', '..', 'calculator', 'inputValidator.js'));
var Asm = require(path.join(__dirname, '..', '..', 'calculator', 'planAssembler.js'));
var PM = require(path.join(__dirname, '..', '..', 'calculator', 'planModel.js'));
var P = require(path.join(__dirname, '..', '..', 'constants', 'policyData.js'));
var D = require(path.join(__dirname, '..', '..', 'calculator', 'dateUtil.js'));
var PF = require(path.join(__dirname, '..', 'common', 'plan-factory.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1027');

var shared = V.buildSharedInput(P, D, PF.pageData('1.5'), '2026-08');
var ctx = { gender: 'male', birthYM: '1976-09', historyEndYM: '2026-08' };
// 早于历史末月
var early = PF.aPlan(1, '2033-07', '2025-01');
try { Asm.assemblePlanInput(shared, early); A.ok(false, 'TST-02-UT-1027 早于历史末月应抛错'); }
catch (e) { A.ok(/早于最后缴费月/.test(e.message), 'TST-02-UT-1027 早于历史末月抛错: ' + e.message); }
// 晚于退休前一月
var late = PF.aPlan(1, '2027-02', '2028-01');
try { Asm.assemblePlanInput(shared, late); A.ok(false, 'TST-02-UT-1027 晚于退休前一月应抛错'); }
catch (e) { A.ok(/不得晚于退休前一月/.test(e.message), 'TST-02-UT-1027 晚于退休前一月抛错: ' + e.message); }
// planModel 纯函数层
A.ok(/早于最后缴费月/.test(PM.validateWindowStartYM('2025-01', ctx, '2033-07', D) || ''),
  'TST-02-UT-1027 planModel 早界');
A.ok(/不得晚于退休前一月/.test(PM.validateWindowStartYM('2040-01', ctx, '2033-07', D) || ''),
  'TST-02-UT-1027 planModel 晚界');
A.ok(PM.validateWindowStartYM('', ctx, '2033-07', D) === null, 'TST-02-UT-1027 留空合法（取缺省）');
A.eq(PM.defaultWindowStartYM(ctx, D), '2026-09', 'TST-02-UT-1027 planModel 缺省=末月+1');
// ===== BUG-02-0009 等值边界（下界＝历史末月+1，历史末月当月不合法）=====
var H = '2026-08', H1 = '2026-09', Hm1 = '2026-07';
var RET9 = '2033-08';
// isValidPlan 走 planErrors 全套（含 validateRetireYM）：ctx birthYM=1976-09 合法退休下限=2036-09，故端到端断言用该退休月。
var RET_VALID = '2036-09';
// planModel 层：start==历史末月当月 必须拦截（文案含“次月”）
A.ok(/不得早于最后缴费月/.test(PM.validateWindowStartYM(H, ctx, RET9, D) || ''),
  'TST-02-UT-1027 等值边界 start=历史末月当月应拦截');
A.ok(/次月/.test(PM.validateWindowStartYM(H, ctx, RET9, D) || ''),
  'TST-02-UT-1027 等值边界文案含次月');
// start==历史末月+1 合法
A.ok(PM.validateWindowStartYM(H1, ctx, RET9, D) === null,
  'TST-02-UT-1027 等值边界 start=历史末月+1 合法');
// start==历史末月-1 拦截
A.ok(/不得早于最后缴费月/.test(PM.validateWindowStartYM(Hm1, ctx, RET9, D) || ''),
  'TST-02-UT-1027 等值边界 start=历史末月-1 拦截');
// isValidPlan 端到端：当月双计起点无效，次月起点有效
A.ok(PM.isValidPlan(PF.aPlan(1, RET_VALID, H), ctx, D) === false,
  'TST-02-UT-1027 isValidPlan start=历史末月当月 false');
A.ok(PM.isValidPlan(PF.aPlan(1, RET_VALID, H1), ctx, D) === true,
  'TST-02-UT-1027 isValidPlan start=历史末月+1 true');

// assemblePlanInput 层：合法起点自动段首月＝历史末月+1，历史/自动段月份零交集
var monthCount = function (segs) {
  var m = {};
  (segs || []).forEach(function (s) {
    var a = D.toIndex(s.startYM), b = D.toIndex(s.endYM);
    for (var i = a; i <= b; i++) m[i] = (m[i] || 0) + 1;
  });
  return m;
};
var legalInput = Asm.assemblePlanInput(shared, PF.aPlan(1, RET9, H1));
var autoSegs = legalInput.segments.filter(function (s) { return D.toIndex(s.startYM) >= D.toIndex(H1); });
A.eq(D.toYM(D.toIndex(autoSegs[0].startYM)), H1, 'TST-02-UT-1027 合法起点自动段首月=历史末月+1');
var mc = monthCount(legalInput.segments);
var overlapMonths = Object.keys(mc).filter(function (k) { return mc[k] > 1; });
A.eq(overlapMonths.length, 0, 'TST-02-UT-1027 历史段与自动段月份零交集');
// 对照：start=历史末月当月 assemblePlanInput 必须抛错（修复前会放行重叠双计）
try { Asm.assemblePlanInput(shared, PF.aPlan(1, RET9, H)); A.ok(false, 'TST-02-UT-1027 assemble 当月起点应抛错'); }
catch (e) { A.ok(/不得早于最后缴费月/.test(e.message), 'TST-02-UT-1027 assemble 当月起点抛错: ' + e.message); }

A.finish();
