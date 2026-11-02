// calculator/paybackModel.js
// D6（REQ-01-CAL-002~003）：回本月数——冲抵现金流 + 三分支判定 + 0%/用户利率双列。
// 严格依据 spec §9.3（裁定 Q4/Q6）。
//
// 现金流符号（同 spec）：d_m 为候选 k 相对基准 b 的【净多缴】，正=多缴/未抵回。
//   并存缴费期  m<=Tb           : d_m = burdenK_m - burdenB_m
//   b退休后k在缴 Tb<m<=Tk       : d_m = burdenK_m - P月_b
// k退休时点终值：FV_k = Σ_{m=0..Tk} d_m × (1+i)^(Tk-m)
// 三分支：
//   A k退休前已抵回：滚动 A_m=Σ_{j=0..m} d_j(1+i)^(m-j)，首个 m(Tb<m<=Tk) 使 A_m<=0
//                   回本月数 = m-Tb（b退休后第几个月）
//   B 退休后年金抵回：FV>0 且 dP>0：n=-ln(1-FV·i/dP)/ln(1+i)；i=0 时 n=FV/dP；向上取整
//   C 无法抵回：dP<=0，或 1-FV·i/dP<=0 -> Infinity
// 纯函数、不依赖 wx；月序号0=2026-09。
'use strict';

var D = require('./dateUtil.js');

var ORIGIN_YM = '2026-09';

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// 退休前一月相对起点的偏移 T（若起点=退休月 => T=-1，无缴费月）。
// BUG-02-0004：originYM 可传动态缴费起始月；缺省回退 ORIGIN_YM=2026-09。
function retireOffset(retireYM, originYM) {
  var origin = /^\d{4}-\d{2}$/.test(originYM || '') ? originYM : ORIGIN_YM;
  return D.toIndex(retireYM) - D.toIndex(origin) - 1;
}

// 由方案序列求 m 月个人负担（无则0）。burdens 为以偏移 m 为键的对象。
function burdenAt(series, m) {
  var v = series.burdens[m];
  return typeof v === 'number' ? v : 0;
}

// 构造逐月净差额 d_0..d_Tk
function cashflows(b, k) {
  var d = [];
  for (var m = 0; m <= k.T; m++) {
    var bk = burdenAt(k, m);
    var bval = m <= b.T ? burdenAt(b, m) : b.pMonthly;
    d.push(bk - bval);
  }
  return d;
}

// k 退休时点终值
function futureValue(d, Tk, i) {
  var s = 0;
  for (var m = 0; m <= Tk; m++) s += d[m] * Math.pow(1 + i, Tk - m);
  return s;
}

// 分支A：从 b 退休后次月(m=Tb+1)起滚动余额，首个 A_m<=0（m<=Tk）
function branchA(d, b, k, i) {
  for (var m = b.T + 1; m <= k.T; m++) {
    var A = 0;
    for (var j = 0; j <= m; j++) A += d[j] * Math.pow(1 + i, m - j);
    if (A <= 0) return { hit: true, monthsAfterB: m - b.T, atM: m, balance: A };
  }
  return { hit: false };
}

// 分支B/C：退休后年金抵回月数；无法抵回返回 Infinity
function branchBMonths(FV, dP, i) {
  if (!(dP > 0)) return Infinity;
  if (i === 0) {
    if (FV <= 0) return 0;
    return FV / dP;
  }
  var inner = 1 - FV * i / dP;
  if (inner <= 0) return Infinity;
  return -Math.log(inner) / Math.log(1 + i);
}

// 单方案在给定年利率下的回本判定
function evaluateOne(b, k, annualRate) {
  var i = annualRate / 12;
  var dP = k.pMonthly - b.pMonthly;

  // b 即 k 自身：基准方案不做回本比较
  if (k === b) {
    return { branch: 'BASELINE', months: null, ceilMonths: null, FV: 0, dP: 0, rate: annualRate };
  }

  var d = cashflows(b, k);
  var FV = futureValue(d, k.T, i);
  var ba = branchA(d, b, k, i);

  if (ba.hit) {
    return {
      branch: 'A', label: '退休前已抵回',
      months: ba.monthsAfterB, ceilMonths: Math.ceil(ba.monthsAfterB),
      FV: round2(FV), dP: round2(dP), rate: annualRate
    };
  }
  var n = branchBMonths(FV, dP, i);
  if (!isFinite(n)) {
    return {
      branch: 'C', label: '该利率下无法抵回',
      months: Infinity, ceilMonths: null,
      FV: round2(FV), dP: round2(dP), rate: annualRate
    };
  }
  return {
    branch: 'B', label: '退休后抵回',
    months: n, ceilMonths: Math.ceil(n),
    FV: round2(FV), dP: round2(dP), rate: annualRate
  };
}

// 选取基准 b = R续(总个人负担)最小者；并列取退休更早(T更小)者，仍并列取先出现者。
function selectBaseline(series) {
  var bidx = 0;
  for (var i = 1; i < series.length; i++) {
    var cur = series[bidx], cand = series[i];
    if (cand.rTotal < cur.rTotal - 1e-9 ||
        (Math.abs(cand.rTotal - cur.rTotal) <= 1e-9 && cand.T < cur.T)) {
      bidx = i;
    }
  }
  return series[bidx];
}

// 计算全部方案在单一利率下的回本结果，返回 { baselineId, byId:{} }
function computeAtRate(series, annualRate) {
  var b = selectBaseline(series);
  var byId = {};
  series.forEach(function (k) {
    byId[k.id] = evaluateOne(b, k, annualRate);
  });
  return { baselineId: b.id, annualRate: annualRate, byId: byId };
}

// 双列：固定 0% 一列 + 用户给定利率一列（用户=0时两列相同）。
function computeDouble(series, userAnnualRate) {
  var rate = typeof userAnnualRate === 'number' ? userAnnualRate : 0;
  return {
    baselineId: selectBaseline(series).id,
    at0: computeAtRate(series, 0),
    atUser: computeAtRate(series, rate),
    userAnnualRate: rate
  };
}

// ============================================================================
// BUG-02-0016（REQ-02-CAL-002）：停保（R续=0）基准回本月数——纯新增，不改上面任何函数语义。
// 基准＝逐方案自身「0 投入」情形（T_b ＝ T_k，故分支 A 不会触发），月负担恒 0：
//   d_m = burdenK_m − 0 = burdenK_m
//   FV_k = Σ_{m=0..T_k} d_m·(1+i)^(T_k−m)
//   ΔP_k = P月_k^继续 − P月_k^停保   ← 与 ROI 分子同一个减数（调用方传入 it.pMonthly / it.baselineMonthly）
//   r=0: n=FV/ΔP；r>0: n=−ln(1−FV·i/ΔP)/ln(1+i)；向上取整到整月
// 分支码：'SELF' 该方案本身即停保基准 / 'NA' 停保基准不足最低缴费年限 /
//         'B' 退休后抵回 / 'C' 该利率下无法抵回。
// ============================================================================
function computeStopBaseline(series, annualRate) {
  var rate = typeof annualRate === 'number' ? annualRate : 0;
  var i = rate / 12;
  var byId = {};

  series.forEach(function (k) {
    var pStop = (typeof k.pStop === 'number') ? k.pStop : null;
    var dP = (typeof k.pMonthly === 'number' && pStop != null) ? round2(k.pMonthly - pStop) : null;

    // 边界 3：停保基准不满足最低缴费年限 —— 无回本可言
    if (k.stopEligible === false) {
      byId[k.id] = { branch: 'NA', months: null, ceilMonths: null, FV: null, dP: dP, rate: rate };
      return;
    }
    // 边界 1：该方案本身即停保（R续=0，继续==停保）—— 它是自己的基准，不参与排名
    if (!(k.rTotal > 0)) {
      byId[k.id] = { branch: 'SELF', months: null, ceilMonths: null, FV: 0, dP: 0, rate: rate };
      return;
    }

    // 停保侧月负担恒 0（T_b == T_k，故全程落在 m<=T_b 区间，d_m = burdenK_m）
    var stopB = { id: k.id + ':stop', T: k.T, burdens: {}, pMonthly: 0 };
    var FV = futureValue(cashflows(stopB, k), k.T, i);

    // 边界 2：ΔP_k <= 0（多投入不多领）或年金现值不足 → 无法抵回
    var n = branchBMonths(FV, dP, i);
    if (!isFinite(n)) {
      byId[k.id] = { branch: 'C', months: Infinity, ceilMonths: null, FV: round2(FV), dP: dP, rate: rate };
      return;
    }
    byId[k.id] = { branch: 'B', months: n, ceilMonths: Math.ceil(n), FV: round2(FV), dP: dP, rate: rate };
  });

  return { mode: 'stop', annualRate: rate, byId: byId };
}

// 停保基准双列（0% + 页面利率），结构对齐 computeDouble（仅为排版一致，不复用其结果）。
function computeStopDouble(series, userAnnualRate) {
  var rate = typeof userAnnualRate === 'number' ? userAnnualRate : 0;
  return {
    at0: computeStopBaseline(series, 0),
    atUser: computeStopBaseline(series, rate),
    userAnnualRate: rate
  };
}

module.exports = {
  ORIGIN_YM: ORIGIN_YM,
  retireOffset: retireOffset,
  burdenAt: burdenAt,
  cashflows: cashflows,
  futureValue: futureValue,
  branchA: branchA,
  branchBMonths: branchBMonths,
  selectBaseline: selectBaseline,
  evaluateOne: evaluateOne,
  computeAtRate: computeAtRate,
  computeDouble: computeDouble,
  computeStopBaseline: computeStopBaseline,
  computeStopDouble: computeStopDouble,
  round2: round2
};
