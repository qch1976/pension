// tests/r-contribution-check.js
// D5（REQ-01-CAL-001）node 断言：8%/20% 表驱动、逐月累计、区间同 D4；
// 手算小例独立比对（不引用被测函数回推），|Δ|≤0.01。
'use strict';
var D = require('../calculator/dateUtil.js');
var Rmod = require('../calculator/rContribution.js');
var Engine = require('../calculator/pensionEngine.js');

var pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } }
function approx(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 0.01 : eps); }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// =====================================================================
// 手工小例 1：退休=2026-12 => 自动段 [2026-09,2026-11] 共3个月，Z=1.0，C=12116，B=12116
// =====================================================================
(function () {
  var Z = 1.0, C = 12116, nMonths = 3;
  var B = Z * C;
  var expectEnterprise = round2(nMonths * B * 0.08); // 手算
  var expectFlexible = round2(nMonths * B * 0.20);

  var re = Rmod.computeR({ retireYM: '2026-12', z: '1.0', segType: 'enterprise' }, {});
  var rf = Rmod.computeR({ retireYM: '2026-12', z: '1.0', segType: 'flexible' }, {});

  ok(re.months === 3, '企业：缴费月数=3（实际 ' + re.months + '）');
  ok(approx(re.totalRounded, expectEnterprise),
    '企业 R续=3×12116×8%=' + expectEnterprise + '（实际 ' + re.totalRounded + '）');
  // 数值核对：3*12116*0.08=2907.84
  ok(approx(re.totalRounded, 2907.84), '企业 R续手算值2907.84');

  ok(rf.months === 3, '灵活：缴费月数=3');
  ok(approx(rf.totalRounded, expectFlexible),
    '灵活 R续=3×12116×20%=' + expectFlexible + '（实际 ' + rf.totalRounded + '）');
  ok(approx(rf.totalRounded, 7269.60), '灵活 R续手算值7269.60');

  // 逐月明细：3条，起止正确，每月 burden 正确
  ok(re.monthly.length === 3 && re.monthly[0].ym === '2026-09' && re.monthly[2].ym === '2026-11',
    '逐月明细起2026-09止2026-11');
  ok(re.monthly.every(function (m) { return approx(m.burden, 12116 * 0.08); }), '企业逐月负担=969.28');
  ok(rf.monthly.every(function (m) { return approx(m.burden, 12116 * 0.20); }), '灵活逐月负担=2423.20');

  // 费率表
  ok(Rmod.rateFor('enterprise') === 0.08, '企业费率0.08');
  ok(Rmod.rateFor('flexible') === 0.20, '灵活费率0.20');

  // 月负担额（全区间均值）
  ok(approx(re.monthlyBurden, 969.28), '企业月负担969.28');
})();

// =====================================================================
// 手工小例 2：跨年——退休=2027-03 => 自动段 [2026-09,2027-02] 共6个月
//   2026月:9,10,11,12=4个月(C2026=12116)；2027月:1,2=2个月(C2027沿用12116)；Z=1.5
// =====================================================================
(function () {
  var Z = 1.5, C = 12116, n = 6, B = Z * C;
  var expectEnt = round2(n * B * 0.08);
  var expectFlex = round2(n * B * 0.20);

  var re = Rmod.computeR({ retireYM: '2027-03', z: '1.5', segType: 'enterprise' }, {});
  var rf = Rmod.computeR({ retireYM: '2027-03', z: '1.5', segType: 'flexible' }, {});

  ok(re.months === 6, '跨年企业月数=6（实际 ' + re.months + '）');
  ok(approx(re.totalRounded, expectEnt), '跨年企业 R续=' + expectEnt + '（实际 ' + re.totalRounded + '）');
  // 手算: 6*1.5*12116*0.08 = 8723.52
  ok(approx(re.totalRounded, 8723.52), '跨年企业手算8723.52');
  ok(approx(rf.totalRounded, expectFlex), '跨年灵活 R续=' + expectFlex);
  // 手算: 6*1.5*12116*0.20 = 21808.80
  ok(approx(rf.totalRounded, 21808.80), '跨年灵活手算21808.80');

  // 逐月起2026-09止2027-02
  ok(re.monthly[0].ym === '2026-09' && re.monthly[5].ym === '2027-02', '跨年逐月边界');
})();

// =====================================================================
// 一致性：灵活 R续 = 企业 R续 × (0.20/0.08)=2.5（同Z/区间）；且 R续 = ΣB×rate 与引擎principal8对照
// =====================================================================
(function () {
  var plan = { retireYM: '2030-09', z: '2.0', segType: 'enterprise' };
  var re = Rmod.computeR(plan, {});
  var rf = Rmod.computeR({ retireYM: '2030-09', z: '2.0', segType: 'flexible' }, {});
  ok(approx(re.totalRounded * 2.5, rf.totalRounded, 0.02), '灵活R续=企业R续×2.5');

  // 企业R续 应等于引擎月明细中自动段 principal8 之和（principal8=round2(B*0.08)，逐月2位）
  var Asm = require('../calculator/planAssembler.js');
  var si = {
    gender: 'male', femaleType: null, birthYM: '1976-09', workStartYM: '1998-08',
    retireYM: '2030-09', deemedStartYM: null, deemedEndYM: null,
    segments: [{ type: 'enterprise', startYM: '1998-08', endYM: '2026-08', baseMonthly: 12116 }],
    accountBalanceManual: 250000, accountBalanceManualYM: '2026-08', futureMonthlyRate: null,
    baseYearOverride: 2025, cPingOverride: null, customCYear: {},
    doc31Eligible: false, doc31TransferYM: null, enterpriseInsuredYM: null, subsidyExcludedRanges: []
  };
  var engineRes = Asm.computePlan(si, plan);
  var sumPrincipal8 = engineRes.monthlyDetails
    .filter(function (r) { return r.ym >= '2026-09'; })
    .reduce(function (a, r) { return a + r.principal8; }, 0);
  // 企业R续用未舍入逐月、引擎principal8逐月2位——允许累计舍入差（每月≤0.005×月数）
  var months = re.months;
  ok(Math.abs(re.totalRounded - round2(sumPrincipal8)) <= months * 0.01,
    '企业R续与引擎principal8逐月累计一致（R=' + re.totalRounded + ' Σp8=' + round2(sumPrincipal8) + '）');
})();

// =====================================================================
// 边界：非法性质抛错；退休=2026-09 自动段为空 -> R续0、月数0
// =====================================================================
(function () {
  try { Rmod.rateFor('bogus'); ok(false, '非法性质应抛错'); }
  catch (e) { ok(String(e.message).indexOf('enterprise/flexible') !== -1, '非法性质抛错'); }

  var r0 = Rmod.computeR({ retireYM: '2026-09', z: '1.0', segType: 'enterprise' }, {});
  ok(r0.months === 0 && r0.totalRounded === 0, '空区间R续=0月数0');
})();

console.log('\nr-contribution-check: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
