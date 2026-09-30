// tests/compare-result-model-check.js
// D8 node 断言：结果页视图模型——绑定D2-D7输出（不重算）、【预估】角标逐方案、
// 灰显/ROI不可用、归一化条宽、下钻三段现金流、政策清单。
'use strict';
var CRM = require('../calculator/compareResultModel.js');
var D = require('../calculator/dateUtil.js');

var pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } }
function approx(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 0.01 : eps); }

function sharedInput(workStart, histStart, histEnd) {
  var ws = workStart || '1992-01';
  return {
    gender: 'male', femaleType: null, birthYM: '1976-09', workStartYM: ws,
    retireYM: null,
    deemedStartYM: ws <= '1995-12' ? '1992-01' : null,
    deemedEndYM: ws <= '1995-12' ? '1995-12' : null,
    segments: [{ type: 'enterprise', startYM: histStart, endYM: histEnd, baseMonthly: 12116 }],
    accountBalanceManual: 250000, accountBalanceManualYM: histEnd, futureMonthlyRate: null,
    baseYearOverride: 2025, cPingOverride: null, customCYear: { 2030: 13000 },
    doc31Eligible: false, doc31TransferYM: null, enterpriseInsuredYM: null, subsidyExcludedRanges: []
  };
}

// =====================================================================
// 角标逻辑（Q7）：窗口止于退休前一月
// =====================================================================
(function () {
  ok(CRM.planIsEstimated({ retireYM: '2026-12' }) === false, '退休2026-12 不打角标（止于2026-11）');
  ok(CRM.planIsEstimated({ retireYM: '2027-01' }) === false, '退休2027-01 止于2026-12 不打');
  ok(CRM.planIsEstimated({ retireYM: '2027-02' }) === true, '退休2027-02 止于2027-01 打角标');
  ok(CRM.planIsEstimated({ retireYM: '2030-09' }) === true, '退休2030-09 打角标');
})();

// =====================================================================
// 完整视图：3 方案（两企业不同退休 + 一灵活），用户利率6%
// =====================================================================
(function () {
  var si = sharedInput(null, '1998-08', '2026-08');
  var plans = [
    { id: 'A', retireYM: '2030-09', z: '1.0', segType: 'enterprise' },
    { id: 'B', retireYM: '2033-09', z: '1.4', segType: 'enterprise' },
    { id: 'C', retireYM: '2031-09', z: '1.2', segType: 'flexible' }
  ];
  var v = CRM.buildView(si, plans, 0.06);

  ok(v.columns.length === 3, '3 列');
  ok(typeof v.baselineId === 'string' && v.columns.some(function (c) { return c.id === v.baselineId; }),
    '基准 id 指向某列');
  ok(v.userAnnualRate === 0.06 && v.userRatePercent === '6.00', '用户利率6%');

  // 全部合格（1998参保年限足）
  v.columns.forEach(function (c, i) {
    ok(c.eligible === true && c.grey === false, '列' + i + ' 合格不灰显');
    ok(c.estimated === true, '列' + i + ' 跨2027打角标');
    ok(typeof c.pMonthly === 'number' && typeof c.jBasic === 'number' &&
       typeof c.jAccount === 'number' && typeof c.jTransit === 'number',
       '列' + i + ' P月/三分项绑定数值');
    // P月=三分项和（绑定一致性，非重算）
    ok(approx(c.pMonthly, c.jBasic + c.jAccount + c.jTransit), '列' + i + ' P月=三分项和');
    ok(typeof c.rContinued === 'number' && c.rContinued > 0, '列' + i + ' R续');
    ok(c.pb0 && c.pb0.text, '列' + i + ' 0%回本列有值');
    ok(c.pbU && c.pbU.text, '列' + i + ' 用户利率回本列有值');
    ok(c.roiStatus === 'ok' && /%$/.test(c.roiText), '列' + i + ' ROI%');
  });

  // 基准方案回本两列=BASELINE
  var baseCol = v.columns.filter(function (c) { return c.id === v.baselineId; })[0];
  ok(baseCol.pb0Branch === 'BASELINE' && baseCol.pbUBranch === 'BASELINE', '基准两列BASELINE');

  // 归一化条宽：最大者=100，其余0~100，无硬编码
  var pBars = v.columns.map(function (c) { return c.barP; });
  ok(Math.max.apply(null, pBars) === 100, 'P条最大=100');
  ok(pBars.every(function (x) { return x >= 0 && x <= 100; }), 'P条0~100');
  var roiBars = v.columns.map(function (c) { return c.barRoi; });
  ok(Math.max.apply(null, roiBars) === 100 && roiBars.every(function (x) { return x >= 0 && x <= 100; }),
    'ROI条最大100且全0~100');

  // 下钻
  ok(v.drills.length === 3, '3 下钻');
  v.drills.forEach(function (dr, i) {
    ok(Array.isArray(dr.history) && dr.history.length === 1, '下钻' + i + ' 历史段1');
    ok(dr.deemed.start === '1992-01' && dr.deemed.end === '1995-12', '下钻' + i + ' 视同绑定');
    ok(dr.account.balance === 250000, '下钻' + i + ' 账户绑定');
    ok(dr.customCYear.length === 1 && dr.customCYear[0].year === '2030', '下钻' + i + ' customCYear绑定');
    ok(typeof dr.pension.total === 'number', '下钻' + i + ' J三分项');
  });
  // 基准下钻 cashflow=null，候选有三段现金流
  var baseDrill = v.drills.filter(function (d) { return d.id === v.baselineId; })[0];
  ok(baseDrill.cashflow === null, '基准无现金流下钻');
  var candDrill = v.drills.filter(function (d) { return d.id !== v.baselineId; })[0];
  ok(candDrill.cashflow && candDrill.cashflow.monthly.length > 0, '候选有逐月现金流');
  ok(typeof candDrill.cashflow.sumConcurrent === 'number' &&
     typeof candDrill.cashflow.sumOffset === 'number', '三段(并存/冲抵/月差)汇总');

  // 政策弹窗
  ok(Array.isArray(v.policies) && v.policies.length >= 4, '政策清单≥4');
  v.policies.forEach(function (p) {
    ok(p.name && p.docNo && p.clause && p.url, '政策条目字段齐全: ' + p.name);
  });
  ok(v.policies.some(function (p) { return p.docNo.indexOf('183') !== -1; }), '含183号令');
  ok(v.policies.some(function (p) { return p.docNo.indexOf('渐进式延迟') !== -1 || p.id === 'P-05'; }),
    '含P-05延迟决定');
})();

// =====================================================================
// 不足年限方案：整列灰显、ROI不可用、条宽P仍归一化不错位、不参与回本基准
// =====================================================================
(function () {
  var si = sharedInput('2011-09', '2011-09', '2026-08'); // 180月
  var plans = [
    { id: 'OK', retireYM: '2036-09', z: '1.2', segType: 'enterprise' }, // 续缴足
    { id: 'BLK', retireYM: '2030-09', z: '1.0', segType: 'enterprise' } // 继续可领，但停保基准不足->ROI blocked
  ];
  var v = CRM.buildView(si, plans, 0);
  var blk = v.columns.filter(function (c) { return c.id === 'BLK'; })[0];
  ok(blk.roiBlocked === true && blk.roiText === '不可用', 'ROI列红字不可用');
  ok(blk.rank === null, '阻断无排名');
  ok(typeof blk.barP === 'number' && blk.barP >= 0 && blk.barP <= 100, 'P条不错位(仍归一化)');
  ok(blk.barRoi === 0, 'ROI条宽0（无ROI）');

  // 回本基准不会选到导致ROI阻断之外的异常；baselineId合法
  ok(v.columns.some(function (c) { return c.id === v.baselineId; }), '基准合法');
})();

// =====================================================================
// 2026内退休不打角标：构造 2026-12 退休（需共享上下文支持早退休；男性1976出生无法2026退休，
// 改用纯函数已覆盖；此处直接验 buildView 的 estimated 由 planIsEstimated 决定）——跳过
// =====================================================================

console.log('\ncompare-result-model-check: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
