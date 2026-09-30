// tests/plan-assembler-check.js
// D4（REQ-01-PLN-006）node 断言：
//  1) 自动段区间 [2026-09, 退休前一月]、类型、2026-09 当月 B=Z×12116（Q9）；2027+ C 沿用12116（Q7）
//  2) 组装后引擎逐月 z 恰为用户 Z（不触发封顶）
//  3) 【主验收】computePlan 的 P月 与「用组装出的同一份入参直接调用引擎」结果一致，|Δ|≤0.01
//  4) J基础/J账户/J过渡 三分项保留
//  5) customCYear 覆盖时 B/C 仍恒等 Z
'use strict';
var D = require('../calculator/dateUtil.js');
var Engine = require('../calculator/pensionEngine.js');
var Asm = require('../calculator/planAssembler.js');

var pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } }
function approx(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 1e-9 : eps); }

// ---- 共享历史入参夹具（普通男职工，历史缴到 2026-08，账户手填余额；不含方案退休/自动段）----
function sharedInput(overrides) {
  var base = {
    gender: 'male',
    femaleType: null,
    birthYM: '1976-09',
    workStartYM: '1998-08',
    retireYM: '2039-09', // 会被方案覆盖
    deemedStartYM: null,
    deemedEndYM: null,
    // 历史段：1998-08~2026-08 单一企业段（边界 ≤2026-08，由 D2 保证）
    segments: [
      { type: 'enterprise', startYM: '1998-08', endYM: '2026-08', baseMonthly: 12116 }
    ],
    accountBalanceManual: 250000,
    accountBalanceManualYM: '2026-08',
    futureMonthlyRate: null,
    baseYearOverride: 2025,
    cPingOverride: null,
    customCYear: {},
    doc31Eligible: false,
    doc31TransferYM: null,
    enterpriseInsuredYM: null,
    subsidyExcludedRanges: []
  };
  if (overrides) Object.keys(overrides).forEach(function (k) { base[k] = overrides[k]; });
  return base;
}

// =====================================================================
// 1) 自动段结构：区间/类型/首月 B=Z×12116；C 沿用
// =====================================================================
(function () {
  var plan = { retireYM: '2039-09', z: '1.0', segType: 'enterprise' };
  var segs = Asm.buildAutoSegments(plan, {});
  ok(segs.length >= 1, '自动段至少1段');

  // 首段起点恰 2026-09；末段终点 = 退休前一月 2039-08
  ok(segs[0].startYM === '2026-09', '自动段起点=2026-09（实际 ' + segs[0].startYM + '）');
  var last = segs[segs.length - 1];
  ok(last.endYM === '2039-08', '自动段终点=退休前一月2039-08（实际 ' + last.endYM + '）');
  ok(segs.every(function (s) { return s.type === 'enterprise'; }), '类型全部enterprise');

  // Q9：2026-09 当月 C=12116，B=Z×12116=12116
  ok(approx(segs[0].baseMonthly, 1.0 * 12116), '2026-09 当月 B=Z×12116（实际 ' + segs[0].baseMonthly + '）');

  // 直接核对 denominatorForYear：2026=12116，2027/2030 assumed 沿用12116
  ok(approx(Asm.denominatorForYear(2026, {}), 12116), 'C_2026=12116');
  ok(approx(Asm.denominatorForYear(2027, {}), 12116), 'C_2027 沿用12116（Q7）');
  ok(approx(Asm.denominatorForYear(2035, {}), 12116), 'C_2035 沿用12116（Q7）');

  // C 恒为12116、Z恒定 -> 全区间同一基数 -> 合并成恰好1段
  ok(segs.length === 1, 'B全程恒定应合并为1段（实际 ' + segs.length + '）');

  // 覆盖全部月份：2026-09..2039-08 = 13年差一月... 计算
  var expectMonths = D.toIndex('2039-08') - D.toIndex('2026-09') + 1;
  var gotMonths = segs.reduce(function (a, s) {
    return a + (D.toIndex(s.endYM) - D.toIndex(s.startYM) + 1);
  }, 0);
  ok(gotMonths === expectMonths, '自动段覆盖月数=' + expectMonths + '（实际 ' + gotMonths + '）');
})();

// =====================================================================
// 2) 组装入参 -> 引擎逐月 z=Z；历史段 + 自动段无重叠
// =====================================================================
(function () {
  var Z = 1.5;
  var plan = { retireYM: '2039-09', z: String(Z), segType: 'flexible' };
  var input = Asm.assemblePlanInput(sharedInput(), plan);
  ok(input.retireYM === '2039-09', '方案退休年月已覆盖');

  var res = Engine.calculate(input);
  // 自动段月份（>=2026-09）逐月 z 应=Z
  var autoRows = res.monthlyDetails.filter(function (r) { return r.ym >= '2026-09'; });
  ok(autoRows.length > 0, '存在自动段月明细');
  var allEqZ = autoRows.every(function (r) { return approx(r.z, Z, 1e-9) && r.zCapped === false; });
  ok(allEqZ, '自动段每月 z=' + Z + ' 且未封顶');
  ok(autoRows.every(function (r) { return r.type === 'flexible'; }), '自动段类型flexible透传');

  // 历史段最后一月 2026-08 存在，自动段从 2026-09 起，无重叠（月数连续）
  var md = res.monthlyDetails;
  var has08 = md.some(function (r) { return r.ym === '2026-08'; });
  ok(has08, '历史段2026-08在明细中');
})();

// =====================================================================
// 3) 【主验收】computePlan P月 == 直接调引擎（同一份组装入参），|Δ|≤0.01
// =====================================================================
(function () {
  [0.6, 1.0, 2.35, 3.0].forEach(function (Z) {
    var plan = { retireYM: '2039-09', z: String(Z), segType: 'enterprise' };
    var si = sharedInput();

    // 路径A：D4 组装并调用
    var resA = Asm.computePlan(si, plan);
    // 路径B：用 D4 组装出的同一份入参，直接调用引擎（独立取值，不引用 resA）
    var assembledInput = Asm.assemblePlanInput(si, plan);
    var resB = Engine.calculate(assembledInput);

    ok(approx(resA.pension.total, resB.pension.total, 0.01),
      'Z=' + Z + ' P月一致 ≤0.01（A=' + resA.pension.total + ' B=' + resB.pension.total + '）');
    // 因入参完全相同，理论上严格相等
    ok(resA.pension.total === resB.pension.total, 'Z=' + Z + ' P月严格相等（同源入参）');

    // 4) 三分项保留
    ok(typeof resA.pension.J基础 === 'number' && typeof resA.pension.J账户 === 'number' &&
       typeof resA.pension.J过渡 === 'number', 'Z=' + Z + ' J基础/J账户/J过渡三分项保留');
    ok(approx(resA.pension.total,
      resA.pension.J基础 + resA.pension.J账户 + resA.pension.J过渡, 0.02),
      'Z=' + Z + ' total≈三分项之和');
  });
})();

// =====================================================================
// 5) customCYear 覆盖：B 随 C 变化，B/C 仍恒等 Z（不破坏方案语义）
// =====================================================================
(function () {
  var Z = 1.2;
  var plan = { retireYM: '2028-09', z: String(Z), segType: 'enterprise' };
  // 自定义 2027 年度分母（影响 2028 缴费年？按缴费年度键 custom[yearY]）：设 2027->13000
  var si = sharedInput({ customCYear: { 2027: 13000 } });
  var segs = Asm.buildAutoSegments(plan, si.customCYear);
  // 2027 年月份（2027-01..12 但段从2026-09起），落在2027的月 B=Z×13000
  var seg2027 = segs.filter(function (s) { return s.startYM <= '2027-12' && s.endYM >= '2027-01'; });
  ok(seg2027.length >= 1, 'customCYear：2027有对应段');
  var base2027 = seg2027.map(function (s) { return s.baseMonthly; });
  ok(base2027.some(function (b) { return approx(b, Z * 13000); }),
    'customCYear：2027 B=Z×13000（实际 ' + JSON.stringify(base2027) + '）');

  // 引擎算出该年 z 仍=Z
  var res = Asm.computePlan(si, plan);
  var rows2027 = res.monthlyDetails.filter(function (r) {
    return r.ym >= '2027-01' && r.ym <= '2027-12';
  });
  ok(rows2027.length && rows2027.every(function (r) { return approx(r.z, Z, 1e-9); }),
    'customCYear：2027每月z仍=Z');
})();

// =====================================================================
// 边界：非法 Z/性质/退休 抛错；退休早于窗口返回空/错误
// =====================================================================
(function () {
  function throws(fn, frag, n) {
    try { fn(); ok(false, n + '（未抛错）'); }
    catch (e) { ok(String(e.message).indexOf(frag) !== -1, n + '（实际: ' + e.message + '）'); }
  }
  throws(function () { Asm.buildAutoSegments({ retireYM: '2030-01', z: '5', segType: 'enterprise' }, {}); },
    '0.60~3.00', 'Z=5 抛错');
  throws(function () { Asm.buildAutoSegments({ retireYM: '2030-01', z: '1', segType: 'bogus' }, {}); },
    '缴费性质', '非法性质抛错');
  throws(function () { Asm.buildAutoSegments({ retireYM: '', z: '1', segType: 'enterprise' }, {}); },
    '退休年月', '缺退休抛错');
  // 退休=2026-09 -> 缴到2026-08，早于窗口起点 -> 空段
  var empty = Asm.buildAutoSegments({ retireYM: '2026-09', z: '1', segType: 'enterprise' }, {});
  ok(Array.isArray(empty) && empty.length === 0, '退休=2026-09 自动段为空');
})();

console.log('\nplan-assembler-check: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
