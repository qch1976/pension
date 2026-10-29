// developer_test/TST-02-UT-1039/roi-drill-check.js
// TST-02-UT-1039（BUG-02-0012，owner=developer）node 断言，纯逻辑不依赖 wx。
// 校验比较结果页下钻 drills.roi（ROI 计算细节）：
//   正常分支字段齐备且数值自洽（月差额 = P月 − 基准；ROI = 月差额 ÷ R续）；
//   blocked 分支只给原因与月数依据、不给公式结果；字段全部源自 roiModel 实际产出。
'use strict';
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var CRM = require(path.join(ROOT, 'calculator', 'compareResultModel.js'));
var ROIm = require(path.join(ROOT, 'calculator', 'roiModel.js'));
var V = require(path.join(ROOT, 'calculator', 'inputValidator.js'));
var P = require(path.join(ROOT, 'constants', 'policyData.js'));
var D = require(path.join(ROOT, 'calculator', 'dateUtil.js'));
var PF = require(path.join(ROOT, 'developer_test', 'common', 'plan-factory.js'));
var A = require(path.join(ROOT, 'developer_test', 'common', 'assert-ok.js')).create('TST-02-UT-1039');

function n2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }

// ===== 1. 正常分支：两方案均有 ROI 明细 =====
var shared = V.buildSharedInput(P, D, PF.pageData('0.6'), '2026-08');
var plans = [PF.aPlan(0.6, '2035-09', ''), PF.aPlan(1.5, '2036-09', '')];
plans[0].id = 'A'; plans[1].id = 'B';
var view = CRM.buildView(shared, plans, 0.03);

A.eq(view.drills.length, 2, '下钻含 2 个方案');
A.ok(view.drills.every(function (d) { return !!d.roi; }), '每个下钻均带 roi 明细对象');
A.ok(view.drills.every(function (d) { return d.roi.ok === true; }), '正常情形 roi.ok=true');
A.eq(view.drills[0].roi.userRatePercent, '3.00', '只读上下文：用户年利率 3.00%');

// 与 roiModel 独立算一遍比对（不引用 drills 自身回推）
var raw0 = ROIm.computeROI(shared, plans[0]);
var d0 = view.drills[0].roi;
A.eq(d0.pMonthly, n2(raw0.pMonthly), 'pMonthly 与 roiModel 一致');
A.eq(d0.baselineMonthly, n2(raw0.baselineMonthly), 'baselineMonthly 与 roiModel 一致');
A.eq(d0.rContinued, n2(raw0.rContinued), 'rContinued 与 roiModel 一致');
A.eq(d0.roiRounded, raw0.roiRounded, 'roiRounded 与 roiModel 一致');
A.eq(d0.percentText, raw0.percentText, 'percentText 与 roiModel 一致');

// 数值勾稽：月差额 = P月 − 基准
A.eq(d0.deltaMonthly, n2(d0.pMonthly - d0.baselineMonthly), '月差额 = 继续P月 − 停保基准P月');
A.ok(d0.deltaMonthly > 0, '继续缴费应比停保基准多领（月差额>0）');

// 数值勾稽：ROI = 月差额 ÷ R续（用未舍入原值验，容差 1e-4）
var roiCalc = (raw0.pMonthly - raw0.baselineMonthly) / raw0.rContinued;
A.ok(Math.abs(roiCalc - raw0.roi) < 1e-6, 'ROI = (P月−基准)/R续（原值恒等）');
A.ok(Math.abs(d0.roiRounded - roiCalc) < 1e-3, 'roiRounded ≈ 手算 ROI（4 位舍入内）');

// 第二个方案同样勾稽
var raw1 = ROIm.computeROI(shared, plans[1]);
var d1 = view.drills[1].roi;
A.eq(d1.pMonthly, n2(raw1.pMonthly), '方案B pMonthly 一致');
A.eq(d1.deltaMonthly, n2(d1.pMonthly - d1.baselineMonthly), '方案B 月差额勾稽');
A.ok(Math.abs(d1.roiRounded - ((raw1.pMonthly - raw1.baselineMonthly) / raw1.rContinued)) < 1e-3,
  '方案B ROI 勾稽');

// 只读上下文：回本分支文案非空（来自 paybackModel，不参与 ROI 公式）
A.ok(typeof d0.paybackText === 'string' && d0.paybackText.length > 0, '回本情况文案非空');
A.ok(typeof d0.contMonths === 'number' && d0.contMonths > 0, 'R续缴费月数非空');

// 字段完整性（严格按 roiModel 实际产出，不多不少关键项）
['ok', 'status', 'reason', 'userRatePercent', 'paybackText', 'pMonthly', 'baselineMonthly',
 'deltaMonthly', 'rContinued', 'contMonths', 'roiRounded', 'percentText',
 'minRequiredMonths', 'baselineTotalMonths', 'eligible', 'baselineEligible'
].forEach(function (k) {
  A.ok(Object.prototype.hasOwnProperty.call(d0, k), 'roi 明细含字段 ' + k);
});

// ===== 2. blocked 分支：停保基准不满足按月领取 =====
var sharedShort = {
  gender: 'male', femaleType: null, birthYM: '1990-01', workStartYM: '2015-01',
  deemedStartYM: null, deemedEndYM: null,
  segments: [{ type: 'enterprise', startYM: '2015-01', endYM: '2026-08', baseMonthly: 12116 }],
  accountBalanceManual: 80000, accountBalanceManualYM: '2026-08', futureMonthlyRate: null,
  baseYearOverride: 2025, cPingOverride: null, customCYear: {},
  doc31Eligible: false, doc31TransferYM: null, enterpriseInsuredYM: null, subsidyExcludedRanges: []
};
var plansShort = [
  { id: 'A', retireYM: '2050-01', z: '0.6', segType: 'enterprise', windowStartYM: '' },
  { id: 'B', retireYM: '2051-01', z: '1.5', segType: 'enterprise', windowStartYM: '' }
];
var vb = CRM.buildView(sharedShort, plansShort, 0.03);
A.eq(vb.drills.length, 2, 'blocked 情形下钻仍含 2 方案');
A.ok(vb.drills.every(function (d) { return d.roi.ok === false; }), 'blocked 情形 roi.ok=false');
A.ok(vb.drills.every(function (d) { return d.roi.status === 'blocked'; }), 'blocked 情形 status=blocked');
A.ok(/不满足按月领取条件/.test(vb.drills[0].roi.reason), 'blocked 原因文案正确');
A.ok(vb.drills.every(function (d) { return d.roi.roiRounded === null; }), 'blocked 不给 ROI 结果（null）');
A.ok(vb.drills.every(function (d) { return d.roi.percentText === ''; }), 'blocked 不给百分比文案');
A.ok(vb.drills.every(function (d) { return d.roi.baselineEligible === false; }), 'blocked：停保基准不合格');
A.ok(vb.drills.every(function (d) { return typeof d.roi.minRequiredMonths === 'number'; }), 'blocked 给出最低需缴月数');
A.ok(vb.drills.every(function (d) { return typeof d.roi.baselineTotalMonths === 'number'; }), 'blocked 给出停保累计月数');
A.ok(vb.drills.every(function (d) { return d.roi.baselineTotalMonths < d.roi.minRequiredMonths; }),
  'blocked 依据自洽：停保累计月数 < 最低需缴月数');
// blocked 时页面列 ROI 文案也应为不可用（与既有列口径一致）
A.ok(vb.columns.every(function (c) { return c.roiText === '不可用'; }), 'blocked 列 ROI 显示不可用');

// ===== 3. buildRoiDrill 纯函数边界：缺 payback 结果不炸 =====
var fake = { status: 'ok', pMonthly: 100, baselineMonthly: 80, rContinued: 400,
  roi: 0.05, roiRounded: 0.05, percentText: '5.00%', eligible: true, baselineEligible: true,
  minRequiredMonths: 180, baselineTotalMonths: 300 };
var out = CRM.buildRoiDrill(fake, 100, '3.00', null);
A.eq(out.deltaMonthly, 20, 'buildRoiDrill 月差额 = 20');
A.eq(out.percentText, '5.00%', 'buildRoiDrill 透传 percentText');
A.ok(typeof out.paybackText === 'string', 'buildRoiDrill 无 payback 结果时文案兜底不炸');
A.eq(out.ok, true, 'buildRoiDrill ok 透传');

// ===== 4. 回归：drills 既有字段未被破坏 =====
A.ok(view.drills.every(function (d) { return Array.isArray(d.history); }), 'drills.history 仍在');
A.ok(view.drills.every(function (d) { return d.deemed && typeof d.deemed.text === 'string'; }), 'drills.deemed 仍在');
A.ok(view.drills.every(function (d) { return d.account && d.account.balance !== undefined; }), 'drills.account 仍在');
A.ok(view.drills.every(function (d) { return Array.isArray(d.customCYear); }), 'drills.customCYear 仍在');
A.ok(view.drills.every(function (d) { return d.pension && typeof d.pension.total === 'number'; }), 'drills.pension 仍在');
A.ok(view.columns.every(function (c) { return typeof c.roiText === 'string'; }), 'columns.roiText 未被破坏');

A.finish();
