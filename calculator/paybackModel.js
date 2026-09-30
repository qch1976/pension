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

// 退休前一月相对 2026-09 的偏移 T（若退休=2026-09 => T=-1，无缴费月）
function retireOffset(retireYM) {
  return D.toIndex(retireYM) - D.toIndex(ORIGIN_YM) - 1;
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
  round2: round2
};
