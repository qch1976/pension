// tests/oracle.js
// 独立参照实现（independent oracle）：严格按 docs/specification.md 第4章公式重新实现，
// 不复制 pensionEngine.js 的代码路径（月入账不逐月 round2），
// 用于与被测引擎交叉验证。官方数值共享 constants/policyData.js（数据本身来自官方文件）。
// 2026-09-21 批次1 同步（pension-ui-change-design §6.4）：
//   - deemedStartYM/deemedEndYM 起止区间（有效窗口交集）；
//   - N实98 = 1992-10~1998-06 内实缴 ∪ 视同交集月；
//   - 手工锚定余额 + anchorYM/futureMonthlyRate 的未来段滚动（独立实现一遍以交叉验证）。
var path = require('path');
var D = require(path.join(__dirname, '..', 'calculator', 'dateUtil.js'));
var P = require(path.join(__dirname, '..', 'constants', 'policyData.js'));

function idx(ym) { return D.toIndex(ym); }

// 独立的月覆盖图：重叠段以后录入段为准（与 spec 录入语义一致）
function buildMonthMap(segments, lo, hi) {
  var map = {};
  (segments || []).forEach(function (s) {
    var a = Math.max(idx(s.startYM), lo);
    var b = Math.min(idx(s.endYM), hi);
    for (var i = a; i <= b; i++) map[i] = { base: s.baseMonthly, type: s.type };
  });
  return map;
}

function denom(yearY, custom) {
  custom = custom || {};
  if (custom[yearY] != null) return custom[yearY];
  if (P.indexDenominatorMonthly[yearY] != null) return P.indexDenominatorMonthly[yearY];
  var keys = Object.keys(P.indexDenominatorMonthly).map(Number).sort(function (a, b) { return a - b; });
  if (yearY > keys[keys.length - 1]) return P.indexDenominatorMonthly[keys[keys.length - 1]]; // assumed
  return null; // 1992-1995 缺口
}

// 参照账户（手工锚定余额 + 未来段月滚；独立实现）。中间值不 round2（spec 4.7）。
function rollManualExact(input, retireIdx) {
  var anchorIdx = idx(input.accountBalanceManualYM);
  var endIdx = retireIdx - 1;
  var rMonthly = input.futureMonthlyRate / 12;
  var bal = input.accountBalanceManual, principal = 0, interest = 0, yearly = [];
  var rollStart = anchorIdx + 1;
  // 需要 monthMap：从参数取（下方包装）
  var map = arguments[3] || {};
  for (var y = D.yearOf(rollStart); y <= D.yearOf(endIdx); y++) {
    var yStart = bal, yp = 0, yi = 0;
    var ma = (y === D.yearOf(rollStart)) ? rollStart : y * 12;
    var mb = Math.min(y * 12 + 11, endIdx);
    for (var mi = ma; mi <= mb; mi++) {
      var m = map[mi];
      var add = (m && m.base > 0) ? m.base * 0.08 : 0;
      var itr = bal * rMonthly;
      bal += itr + add; yp += add; yi += itr;
    }
    principal += yp; interest += yi;
    yearly.push({ year: y, principal: yp, interest: yi, endBalance: bal });
  }
  return { R储: bal, principal: principal, interest: interest, yearly: yearly };
}

// 参照账户（历史重建路径）：月计入额全程不做 round2（spec 4.7）
function calcAccountExact(input, map, paidIdxs, retireIdx) {
  if (input.accountBalanceManual != null) {
    if (input.accountBalanceManualYM && input.futureMonthlyRate != null) {
      return rollManualExact(input, retireIdx, null, map);
    }
    return { R储: input.accountBalanceManual, principal: null, interest: null, yearly: [] };
  }
  var mode = input.interestMode || 'official';
  var startY = D.yearOf(Math.min.apply(null, paidIdxs.length ? paidIdxs : [idx(P.deemedContributionStart)]));
  var endY = D.yearOf(retireIdx);
  var bal = 0, principal = 0, interest = 0, yearly = [];
  for (var y = startY; y <= endY; y++) {
    var yStart = bal, yp = 0, contribs = [];
    var y0 = y * 12, y1 = y * 12 + 11;
    var last = (y === endY) ? retireIdx - 1 : y1;
    for (var i = y0; i <= Math.min(y1, last); i++) {
      var m = map[i];
      if (m) { var add = m.base * 0.08; yp += add; contribs.push({ i: i, add: add }); }
    }
    var r = 0;
    if (mode === 'fixed') r = input.fixedRate || 0;
    else if (mode === 'official') {
      r = P.accountInterestRate[y] != null ? P.accountInterestRate[y] : (input.fallbackRate != null ? input.fallbackRate : 0.0262);
    }
    var yi = 0;
    if (r > 0) {
      var bf = (y === endY) ? (D.monthOf(retireIdx) - 1) / 12 : 1;
      yi += yStart * r * bf;
      contribs.forEach(function (c) {
        var w = (input.intraYearMethod === 'half') ? 0.5 : (12 - (c.i - y0)) / 12;
        yi += c.add * r * w;
      });
    }
    bal = yStart + yp + yi; principal += yp; interest += yi;
    yearly.push({ year: y, principal: yp, interest: yi, endBalance: bal });
  }
  return { R储: bal, principal: principal, interest: interest, yearly: yearly };
}

// 视同区间与有效工龄窗口的闭交集月数（两端含当月）
function deemedOverlap(input) {
  var hasRange = input.deemedStartYM && input.deemedEndYM;
  if (!hasRange) return null;
  var dS = idx(input.deemedStartYM), dE = idx(input.deemedEndYM);
  var doc31 = input.doc31Eligible === true && input.enterpriseInsuredYM;
  var winS = input.workStartYM ? idx(input.workStartYM) : dS;
  // Bug23 后普通人员窗口自参工月起，视同区间不再以 1992-09 硬截断（窗口起点截断即够）。
  var winE = doc31 ? (idx(input.enterpriseInsuredYM) - 1) : hi;
  var s = Math.max(dS, winS), e = Math.min(dE, winE);
  return { months: e >= s ? e - s + 1 : 0, dS: dS, dE: dE };
}

// Bug23/V1.7 窗口起点（与 pensionEngine.insuredWindowStart 同口径）：
//   doc31 人员=enterpriseInsuredYM；普通=max(1992-10, workStartYM)；缺失回退 1992-10。
function insuredWindowStartIdx(input) {
  var def = idx(P.deemedContributionStart);
  if (input.doc31Eligible === true && input.enterpriseInsuredYM) {
    var ei = idx(input.enterpriseInsuredYM);
    if (ei >= def) return ei;
  }
  if (input.doc31Eligible !== true && input.workStartYM) {
    var ws = idx(input.workStartYM);
    if (ws > def) return ws;
  }
  return def;
}

function oracle(input) {
  var retireIdx = idx(input.retireYM);
  var hi = retireIdx - 1;
  var startIdx = insuredWindowStartIdx(input);
  var K = hi - startIdx + 1;
  var map = buildMonthMap(input.segments, startIdx, hi);

  var paidMonths = 0, sumZ = 0, paidIdxs = [];
  for (var i = startIdx; i <= hi; i++) {
    var m = map[i];
    if (m && m.base > 0) {
      paidMonths++; paidIdxs.push(i);
      var c = denom(D.yearOf(i), input.customCYear);
      if (c != null) sumZ += m.base / c;
    }
  }
  // #5 视同月数：起止区间∩有效窗口；旧契约（deemedMonths/workStart估算）兼容
  var deemed = 0;
  var range = deemedOverlap(input);
  var hasRange = range !== null;
  if (hasRange) deemed = range.months;
  else if (input.deemedMonths != null) deemed = Math.max(0, input.deemedMonths);
  // Bug23：无显式视同区间时，按“窗口起点前一月 − 参工月 + 1”推定参工→窗口前连续工龄。
  else if (input.workStartYM) deemed = Math.max(0, startIdx - 1 - idx(input.workStartYM) + 1);

  // N同：视同月中 1992-09（含）以前部分
  var nTong = 0;
  if (hasRange) {
    var ts = Math.max(range.dS, input.workStartYM ? idx(input.workStartYM) : range.dS);
    var te = Math.min(range.dE, idx('1992-09'));
    nTong = te >= ts ? te - ts + 1 : 0;
  } else {
    nTong = deemed;
  }

  var Z = sumZ / K;
  var N应缴 = K / 12;
  var N同 = nTong / 12;
  var N实同 = (paidMonths + deemed) / 12;
  // #9 N实98：窗口内实缴 ∪ 视同区间月 的并集
  var n98 = 0;
  var n98Lo = startIdx, n98Hi = Math.min(idx('1998-06'), hi);
  for (var j = n98Lo; j <= n98Hi; j++) {
    var inPaid = !!map[j];
    var inDeemed = hasRange && j >= range.dS && j <= range.dE;
    if (inPaid || inDeemed) n98++;
  }
  var N实98 = n98 / 12;

  var age = D.wholeYearsBetween(input.birthYM, input.retireYM);
  var M = P.monthsTable[age];
  var baseYear = input.baseYearOverride || P.pensionBaseDefaultYear;
  var C平 = input.cPingOverride != null ? input.cPingOverride : P.pensionBaseByYear[baseYear];

  var isZhong = input.workStartYM ? idx(input.workStartYM) < idx(P.personBoundary) : (deemed > 0 || n98 > 0);
  var J基础 = (C平 + C平 * Z) / 2 * N实同 * 0.01;
  var G同 = isZhong ? C平 * P.deemedIndex * N同 * 0.01 : 0;
  var G实 = isZhong ? C平 * Z * N实98 * 0.01 : 0;
  var acc = calcAccountExact(input, map, paidIdxs, retireIdx);
  var J账户 = acc.R储 / M;
  return {
    Z: Z, N应缴: N应缴, K: K, N同: N同, N实同: N实同, N实98: N实98,
    paidMonths: paidMonths, deemed: deemed, age: age, M: M, C平: C平,
    J基础: J基础, G同: G同, G实: G实, R储: acc.R储, principal: acc.principal,
    interest: acc.interest, J账户: J账户, total: J基础 + J账户 + G同 + G实,
    isZhong: isZhong, yearly: acc.yearly
  };
}
module.exports = { oracle: oracle };
