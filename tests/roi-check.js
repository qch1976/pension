// tests/roi-check.js
// D7（REQ-01-CAL-004）node 断言：
//  1) 逐方案0投入基准：继续/停保两入参除 2026-09 后缴费段外完全一致；
//  2) ROI=(P月-P基准)/R续 手算复算（≤1e-6/4位）；
//  3) 不足最低年限夹具：P基准不可领 => blocked、无ROI、不参与排名；
//  4) 排名仅含 ok。
'use strict';
var ROI = require('../calculator/roiModel.js');
var Asm = require('../calculator/planAssembler.js');
var Rmod = require('../calculator/rContribution.js');

var pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } }
function approx(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 1e-6 : eps); }

// 共享入参夹具（D2 共享区语义）：指定历史段
function sharedInput(workStart, histStart, histEnd, extra) {
  var o = {
    gender: 'male', femaleType: null, birthYM: '1976-09', workStartYM: workStart,
    retireYM: null, deemedStartYM: null, deemedEndYM: null,
    segments: [{ type: 'enterprise', startYM: histStart, endYM: histEnd, baseMonthly: 12116 }],
    accountBalanceManual: 250000, accountBalanceManualYM: histEnd, futureMonthlyRate: null,
    baseYearOverride: 2025, cPingOverride: null, customCYear: {},
    doc31Eligible: false, doc31TransferYM: null, enterpriseInsuredYM: null, subsidyExcludedRanges: []
  };
  if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
  return o;
}

// =====================================================================
// 1) 正常例：1998-08 参保，历史至 2026-08；方案退休 2030-09、Z1.0、企业
//    继续与停保均满足最低年限 -> ROI 可算
// =====================================================================
(function () {
  var si = sharedInput('1998-08', '1998-08', '2026-08');
  var plan = { id: 'A', retireYM: '2030-09', z: '1.0', segType: 'enterprise' };
  var r = ROI.computeROI(si, plan);

  ok(r.status === 'ok', '正常例 status=ok（实际 ' + r.status + '）');
  ok(r.baselineEligible === true, '停保基准按月可领（eligible=true）');
  ok(r.eligible === true, '继续情形可领');
  ok(r.minRequiredMonths === 186, '2030 最低月数=186（实际 ' + r.minRequiredMonths + '）');
  ok(r.rContinued > 0, 'R续>0（实际 ' + r.rContinued + '）');

  // 手算 ROI（独立从两个引擎结果取值，不复用 r.roi）
  var p = r.continueResult.pension.total;
  var pb = r.baselineResult.pension.total;
  var rc = Rmod.computeR(plan, {}).total;
  var expectROI = (p - pb) / rc;
  ok(approx(r.roi, expectROI), 'ROI 手算复算一致（期望 ' + expectROI.toFixed(6) + ' 实际 ' + r.roi.toFixed(6) + '）');
  ok(approx(r.roiRounded, ROI.round4(expectROI)), 'ROI 4位');
  ok(r.percentText === (expectROI * 100).toFixed(2) + '%', '百分比文本=' + r.percentText);
  ok(r.pMonthly > r.baselineMonthly, '继续缴费 P月(' + r.pMonthly + ') > 停保P月(' + r.baselineMonthly + ')');

  // 两入参除 segments 外完全一致
  var a = r.continueInput, b = r.baselineInput;
  ok(a.retireYM === b.retireYM && a.retireYM === '2030-09', '退休年龄一致（不混入差异）');
  var keys = Object.keys(a);
  var same = keys.every(function (k) {
    if (k === 'segments') return true;
    return JSON.stringify(a[k]) === JSON.stringify(b[k]);
  });
  ok(same, '两入参除 segments 外完全一致');

  // segments：停保=历史1段；继续=历史+自动段；历史段内容相同；自动段起2026-09止退休前一月
  ok(b.segments.length === 1, '停保仅历史段');
  ok(a.segments.length === 2, '继续=历史+1自动段（连续同B合并）');
  ok(JSON.stringify(a.segments[0]) === JSON.stringify(b.segments[0]), '历史段两情形完全相同');
  var auto = a.segments[1];
  ok(auto.startYM === '2026-09' && auto.endYM === '2030-08' && auto.type === 'enterprise',
    '自动段 [2026-09,2030-08]（实际 ' + auto.startYM + '..' + auto.endYM + '）');
  ok(approx(auto.baseMonthly, 12116), '自动段 B=12116');
})();

// =====================================================================
// 2) 阻断夹具：2011-09 参保连续缴至 2026-08 = 180 月；2030-09 退休需 186 月
//    停保基准 180 < 186 => 不可领 => blocked；继续 +48 = 228 合格
// =====================================================================
(function () {
  var si = sharedInput('2011-09', '2011-09', '2026-08');
  var plan = { id: 'B', retireYM: '2030-09', z: '1.0', segType: 'enterprise' };
  var r = ROI.computeROI(si, plan);

  ok(r.baselineTotalMonths === 180, '停保累计月数=180（实际 ' + r.baselineTotalMonths + '）');
  ok(r.minRequiredMonths === 186, '2030 需186月');
  ok(r.baselineEligible === false, '停保基准不可领');
  ok(r.eligible === true, '继续情形228月可领');
  ok(r.status === 'blocked', 'status=blocked（实际 ' + r.status + '）');
  ok(r.roi === null && r.roiRounded === null && r.percentText === null, '阻断无ROI/百分比');
  ok(r.reason === '0投入基准不满足按月领取条件，ROI不可用', '阻断红字提示语');

  // 两入参同样仅 segments 不同
  var same = Object.keys(r.continueInput).every(function (k) {
    if (k === 'segments') return true;
    return JSON.stringify(r.continueInput[k]) === JSON.stringify(r.baselineInput[k]);
  });
  ok(same, '阻断夹具两入参除 segments 外一致');
})();

// =====================================================================
// 3) 批量 + 排名：一正常一阻断；阻断不参与排名；正常项 rank=1
// =====================================================================
(function () {
  var siOK = sharedInput('1998-08', '1998-08', '2026-08');
  var siBlk = sharedInput('2011-09', '2011-09', '2026-08');
  var all = ROI.computeAll(siOK, [{ id: 'OK', retireYM: '2030-09', z: '1.0', segType: 'enterprise' }]);
  // computeAll 用同一 sharedInput；为混排，手工分别计算并排序：
  var r1 = ROI.computeROI(siOK, { id: 'OK', retireYM: '2030-09', z: '1.0', segType: 'enterprise' });
  var r2 = ROI.computeROI(siBlk, { id: 'BLK', retireYM: '2030-09', z: '1.0', segType: 'enterprise' });
  var ranked = [r1, r2].filter(function (x) { return x.status === 'ok'; })
    .sort(function (a, b) { return b.roi - a.roi; });
  ok(ranked.length === 1 && ranked[0] === r1, '排名仅含OK方案，阻断被排除');
  ok(all.ranking.length === 1 && all.ranking[0].id === 'OK' && all.ranking[0].rank === 1,
    'computeAll ranking OK#1（实际 ' + JSON.stringify(all.ranking) + '）');
  ok(all.items[0].status === 'ok', 'computeAll item ok');
})();

// =====================================================================
// 4) 灵活就业：同机制成立，R续按20%，ROI 可算
// =====================================================================
(function () {
  var si = sharedInput('1998-08', '1998-08', '2026-08');
  var plan = { id: 'F', retireYM: '2031-09', z: '1.2', segType: 'flexible' };
  var r = ROI.computeROI(si, plan);
  ok(r.status === 'ok', '灵活例 ok');
  var expectROI = (r.continueResult.pension.total - r.baselineResult.pension.total) /
    Rmod.computeR(plan, {}).total;
  ok(approx(r.roi, expectROI), '灵活 ROI 手算一致');
  ok(r.continueInput.segments[1].type === 'flexible', '自动段类型=flexible');
})();

console.log('\nroi-check: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
