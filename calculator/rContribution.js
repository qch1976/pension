// calculator/rContribution.js
// D5（REQ-01-CAL-001）：2026-09 起继续缴费的个人负担 R续，表驱动、逐月累计。
// 口径（裁定 Q3；京政府令183号第19条）：
//   - 企业职工：R续 = Σ B_m × 0.08（单位缴费不计个人负担）
//   - 灵活就业：R续 = Σ B_m × 0.20（全额自担，其中8%入个人账户）
// 区间 [2026-09, 退休前一月] 与 D4 自动段完全一致（退休当月不缴费）；
// B_m = Z × C_m 复用 planAssembler 同源生成（2026=12116，2027+ 沿用并带预估语义）。
// 纯函数、不依赖 wx，可在 node 直接断言。
'use strict';

var D = require('./dateUtil.js');
var P = require('../constants/policyData.js');
var Asm = require('./planAssembler.js');

// 个人负担费率表（表驱动，勿写死散落常量）。
var RATE_TABLE = {
  enterprise: P.contributionRate.personalAccount, // 0.08
  flexible: P.contributionRate.flexibleTotal      // 0.20
};

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// 个人负担费率
function rateFor(segType) {
  var r = RATE_TABLE[segType];
  if (r == null) throw new Error('缴费性质非法（须为 enterprise/flexible）');
  return r;
}

// 逐月计算 R续：基于 D4 自动段展开到每月，输出逐月明细与汇总。
// 返回 {
//   segType, rate, months(缴费月数),
//   monthly: [{ ym, base, burden, denomSource }],
//   total(中间不舍入的精确和), totalRounded(2位),
//   monthlyBurden(月负担额=按全区间均值，展示用，2位)
// }
function computeR(plan, customCYear) {
  var rate = rateFor(plan.segType);
  var autoSegs = Asm.buildAutoSegments(plan, customCYear);

  var monthly = [];
  var total = 0;
  autoSegs.forEach(function (s) {
    var a = D.toIndex(s.startYM), b = D.toIndex(s.endYM);
    for (var i = a; i <= b; i++) {
      var burden = s.baseMonthly * rate;
      total += burden;
      monthly.push({ ym: D.toYM(i), base: s.baseMonthly, burden: burden });
    }
  });

  var months = monthly.length;
  return {
    segType: plan.segType,
    rate: rate,
    months: months,
    monthly: monthly,
    total: total,
    totalRounded: round2(total),
    monthlyBurden: months ? round2(total / months) : 0
  };
}

module.exports = {
  RATE_TABLE: RATE_TABLE,
  rateFor: rateFor,
  computeR: computeR,
  round2: round2
};
