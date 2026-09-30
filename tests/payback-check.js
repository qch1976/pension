// tests/payback-check.js
// D6 node 断言：
//  A) 用 paybackModel（cashflows/futureValue/branchA/branchB）复现 §9.3 三例（r=0 FV=-21600第2月；FV=3600 n=18；Infinity）
//  B) 经由真实方案 series 适配器 + computeDouble 双利率列
'use strict';
var D = require('../calculator/dateUtil.js');
var PB = require('../calculator/paybackModel.js');
var Rmod = require('../calculator/rContribution.js');

var pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } }
function approx(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 1e-6 : eps); }

// ---- 手工构造 series（用于复现 spec 三例）----
function mkSeries(id, T, burdenByM, pMonthly) {
  return { id: id, T: T, burdens: burdenByM, pMonthly: pMonthly, rTotal: 0 };
}
// 由每月常数缴费构造 burdens，0..payMonths-1
function constBurdens(payMonths, amount) {
  var o = {};
  for (var m = 0; m < payMonths; m++) o[m] = amount;
  return o;
}
function fillRTotal(s) {
  var t = 0; Object.keys(s.burdens).forEach(function (m) { t += s.burdens[m]; });
  s.rTotal = t; return s;
}

// =====================================================================
// A1) 玩具例：b 缴800×12(Pb3000,Tb11)；k 缴1000×24(Pk4200,Tk23)
// =====================================================================
(function () {
  var b = fillRTotal(mkSeries('b', 11, constBurdens(12, 800), 3000));
  var k = fillRTotal(mkSeries('k', 23, constBurdens(24, 1000), 4200));

  // r=0
  var d = PB.cashflows(b, k);
  var FV0 = PB.futureValue(d, k.T, 0);
  ok(approx(FV0, -21600), '玩具例 r0 FV=-21600（实际 ' + FV0 + '）');
  var ba0 = PB.branchA(d, b, k, 0);
  ok(ba0.hit && ba0.monthsAfterB === 2, '玩具例 r0 分支A b退休后第2月（实际 ' +
    (ba0.hit ? ba0.monthsAfterB : 'no') + '）');
  var e0 = PB.evaluateOne(b, k, 0);
  ok(e0.branch === 'A' && e0.ceilMonths === 2, '玩具例 r0 evaluateOne 分支A ceil=2');

  // r=6%
  var i6 = 0.06 / 12;
  var FV6 = PB.futureValue(d, k.T, i6);
  ok(approx(FV6, -22051.85, 0.01), '玩具例 r6 FV=-22051.85（实际 ' + FV6.toFixed(2) + '）');
  var e6 = PB.evaluateOne(b, k, 0.06);
  ok(e6.branch === 'A', '玩具例 r6 仍分支A');

  // 基准选取：b 的 R续(12×800=9600) < k(24×1000=24000) -> b
  ok(PB.selectBaseline([b, k]).id === 'b', '玩具例基准=b');
})();

// =====================================================================
// A2) 冲抵不足例：b/k 同月退休缴18月，b月900 k月1100，Pb3000 Pk3200
// =====================================================================
(function () {
  var b = fillRTotal(mkSeries('b', 17, constBurdens(18, 900), 3000));
  var k = fillRTotal(mkSeries('k', 17, constBurdens(18, 1100), 3200));
  var d = PB.cashflows(b, k);
  var FV = PB.futureValue(d, k.T, 0);
  ok(approx(FV, 3600), '冲抵不足 FV=3600（实际 ' + FV + '）');
  var ba = PB.branchA(d, b, k, 0);
  ok(ba.hit === false, '冲抵不足 无分支A（Tb==Tk）');
  var n = PB.branchBMonths(FV, k.pMonthly - b.pMonthly, 0);
  ok(approx(n, 18), '冲抵不足 n=18（实际 ' + n + '）');
  var e = PB.evaluateOne(b, k, 0);
  ok(e.branch === 'B' && e.ceilMonths === 18, '冲抵不足 分支B ceil=18');
})();

// =====================================================================
// A3) 年金现值不足：FV=100000 dP=500 i=0.005 -> Infinity
// =====================================================================
(function () {
  var n = PB.branchBMonths(100000, 500, 0.005);
  ok(n === Infinity, '年金不足 Infinity');
  // 经 evaluateOne：造 series 使 FV=100000、dP=500（直接核对分支C返回）
  // 用临界：inner=0
  ok(PB.branchBMonths(100000, 500, 0.0050001) === Infinity, 'inner<0 亦 Infinity');
  // dP<=0
  ok(PB.branchBMonths(1000, 0, 0) === Infinity, 'dP=0 Infinity');
})();

// =====================================================================
// B) 真实方案适配器：从 D5 R续结果 + P月 构造 series，跑 computeDouble
// =====================================================================
// series 构造：plan 提供退休/Z/性质；burdens 取 Rmod.computeR 的逐月 burden
function buildSeries(id, plan) {
  var r = Rmod.computeR(plan, {});
  var burdens = {};
  r.monthly.forEach(function (mm) {
    var m = D.toIndex(mm.ym) - D.toIndex(PB.ORIGIN_YM);
    burdens[m] = mm.burden;
  });
  return {
    id: id,
    T: PB.retireOffset(plan.retireYM),
    burdens: burdens,
    pMonthly: plan.pMonthly,
    rTotal: r.total
  };
}

(function () {
  // 两方案（手设 P月以便可复算）：b 退休2030-09 Z0.8企业；k 退休2036-09 Z2.0企业
  var sB = buildSeries('p1', { retireYM: '2030-09', z: '0.8', segType: 'enterprise', pMonthly: 9000 });
  var sK = buildSeries('p2', { retireYM: '2036-09', z: '2.0', segType: 'enterprise', pMonthly: 12000 });
  ok(PB.selectBaseline([sB, sK]).id === 'p1', '真实：R续小者p1为基准');

  var dbl = PB.computeDouble([sB, sK], 0.06);
  ok(dbl.baselineId === 'p1', '双列 baseline=p1');
  // 0% 列基准方案标记 BASELINE
  ok(dbl.at0.byId.p1.branch === 'BASELINE', 'p1在0%列=BASELINE');
  // 候选 k 两列均有合法分支（A/B/C之一），用户利率列标注
  ok(['A', 'B', 'C'].indexOf(dbl.at0.byId.p2.branch) >= 0, 'p2 0%列有分支');
  ok(['A', 'B', 'C'].indexOf(dbl.atUser.byId.p2.branch) >= 0, 'p2 用户利率列有分支');
  ok(dbl.atUser.annualRate === 0.06, '用户利率=6%');

  // 用户利率=0 时两列相同
  var dbl0 = PB.computeDouble([sB, sK], 0);
  ok(dbl0.atUser.byId.p2.branch === dbl0.at0.byId.p2.branch &&
     dbl0.atUser.byId.p2.ceilMonths === dbl0.at0.byId.p2.ceilMonths,
     '用户利率0 两列相同');
})();

// 折现方向抽查：d_0=100 折到 Tk=23，权重应为 (1+i)^23；i>0 显著放大早期正现金流
(function () {
  var d = []; for (var m = 0; m <= 23; m++) d.push(0); d[0] = 100;
  var fv0 = PB.futureValue(d, 23, 0), fvi = PB.futureValue(d, 23, 0.005);
  ok(approx(fv0, 100), 'd0折到Tk r0=100');
  ok(approx(fvi, 100 * Math.pow(1.005, 23), 1e-6), 'd0折到Tk 含息=100×1.005^23（实际 ' + fvi.toFixed(2) + '）');
  ok(fvi > fv0, 'i>0 早期正d FV增大（折现方向正确）');
  // 紧邻 Tk 的 d_23 权重恒=1
  var d2 = []; for (m = 0; m <= 23; m++) d2.push(0); d2[23] = 50;
  ok(approx(PB.futureValue(d2, 23, 0.005), 50), 'd_Tk 权重=1 不被利率改变');
})();

console.log('\npayback-check: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
