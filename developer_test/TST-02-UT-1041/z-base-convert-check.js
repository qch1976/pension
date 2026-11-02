// developer_test/TST-02-UT-1041/z-base-convert-check.js
// TST-02-UT-1041（BUG-02-0017，方案乙，owner=developer）node 断言，纯逻辑不依赖 wx。
// 校验基本计算页「Z值 ⇄ 月缴费基数」双向自动转换：
//   ① 与方案比较页同源（denominatorForYear + roundLowestToYuan），不另写一套；
//   ② Z 保留 4 位小数；③ Z=0.6/1.3/3.0 三档基数正确；
//   ④ 双向往返自洽；⑤ 两页 P月 一致（0017 的 0.02 必须归零）；
//   ⑥ 红线：Z=0.6 取整（7270/1454）、Z=3.0 不取整（36348/7269.6）。
'use strict';
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var M = require(path.join(ROOT, 'calculator', 'inputPageModel.js'));
var Asm = require(path.join(ROOT, 'calculator', 'planAssembler.js'));
var RC = require(path.join(ROOT, 'calculator', 'rContribution.js'));
var Engine = require(path.join(ROOT, 'calculator', 'pensionEngine.js'));
var V = require(path.join(ROOT, 'calculator', 'inputValidator.js'));
var P = require(path.join(ROOT, 'constants', 'policyData.js'));
var D = require(path.join(ROOT, 'calculator', 'dateUtil.js'));
var A = require(path.join(ROOT, 'developer_test', 'common', 'assert-ok.js')).create('TST-02-UT-1041');

var Y = 2026; // 缴费年度（C 取该年）

// ===== 1. Z -> 基数：三档验收值（工单/项目主口径）=====
A.eq(M.baseFromZ(0.6, Y, {}), 7270, 'Z=0.6 → 基数 7270（最低档到元取整）');
A.eq(M.baseFromZ(1.3, Y, {}), 15750.800000000001, 'Z=1.3 → 基数 15750.800000000001（不取整，保留原值）');
A.eq(M.baseFromZ(3.0, Y, {}), 36348, 'Z=3.0 → 基数 36348（不取整）');
A.eq(M.baseFromZ(0.7, Y, {}), 8481.199999999999, 'Z=0.7 → 基数 8481.199999999999（不取整）');
A.eq(M.baseFromZ(1.0, Y, {}), 12116, 'Z=1.0 → 基数 12116');

// 与 planAssembler 同源验证：buildAutoSegments 产出必须与 baseFromZ 逐位相同
[0.6, 1.3, 3.0, 0.7, 1.0].forEach(function (z) {
  var segs = Asm.buildAutoSegments(
    { id: 'A', retireYM: '2033-07', z: String(z), segType: 'flexible', windowStartYM: '2026-09' }, null, '2026-09');
  A.eq(M.baseFromZ(z, Y, {}), segs[0].baseMonthly,
    'Z=' + z + ' baseFromZ 与 buildAutoSegments 同源一致');
});

// ===== 2. 基数 -> Z：保留 4 位小数 =====
A.eq(M.zFromBase(7270, Y, {}), 0.6, '基数 7270 → Z=0.6');
A.eq(M.zFromBase(15750.8, Y, {}), 1.3, '基数 15750.8 → Z=1.3');
A.eq(M.zFromBase(36348, Y, {}), 3, '基数 36348 → Z=3');
A.eq(M.zFromBase(8481.199999999999, Y, {}), 0.7, '基数 8481.199999999999 → Z=0.7');
// 4 位小数归一：无浮点尾巴
A.eq(M.zFromBase(15750.8, Y, {}).toFixed(M.Z_DECIMALS), '1.3000', 'Z 展示 4 位小数：1.3000');
A.eq(M.zFromBase(7270, Y, {}).toFixed(M.Z_DECIMALS), '0.6000', 'Z 展示 4 位小数：0.6000');
A.eq(M.zFromBase(36348, Y, {}).toFixed(M.Z_DECIMALS), '3.0000', 'Z 展示 4 位小数：3.0000');
A.eq(M.Z_DECIMALS, 4, 'Z_DECIMALS = 4');

// 非整数 Z 的 4 位小数能力（如 1.2345）
var z4 = M.zFromBase(M.baseFromZ(1.2345, Y, {}), Y, {});
A.eq(z4.toFixed(4), '1.2345', 'Z=1.2345 往返后仍保留 4 位小数');

// ===== 3. 双向往返自洽 =====
[0.6, 0.7, 1.0, 1.3, 1.5, 3.0].forEach(function (z) {
  var base = M.baseFromZ(z, Y, {});
  var back = M.zFromBase(base, Y, {});
  A.ok(Math.abs(back - z) < 1e-9, 'Z=' + z + ' 往返自洽（回算 ' + back + '）');
});

// ===== 4. 非法/空输入安全 =====
A.eq(M.baseFromZ(0, Y, {}), null, 'Z=0 返回 null');
A.eq(M.baseFromZ('', Y, {}), null, 'Z 空返回 null');
A.eq(M.baseFromZ('abc', Y, {}), null, 'Z 非数字返回 null');
A.eq(M.zFromBase(0, Y, {}), null, '基数 0 返回 null');
A.eq(M.zFromBase('', Y, {}), null, '基数空返回 null');
A.eq(M.baseFromZ(-1.3, Y, {}), null, '负 Z 返回 null');

// 自定义 C 年仍同源
A.eq(M.baseFromZ(1.3, Y, { 2026: 12116 }), 15750.800000000001, '自定义 C 年生效且同源');
A.eq(M.baseFromZ(1.3, Y, { 2026: 10000 }), 13000, '自定义 C=10000 时 Z=1.3 → 13000');

// ===== 5. 红线：0014 口径不得被破坏 =====
A.eq(M.baseFromZ(0.6, Y, {}), 7270, '红线：Z=0.6 基数 7270');
var r06 = RC.computeR({ retireYM: '2033-07', z: '0.6', segType: 'flexible', windowStartYM: '2026-09' }, null, '2026-09');
A.eq(r06.monthly[0].burden, 1454, '红线：Z=0.6 灵活月缴 1454');
var r60e = RC.computeR({ retireYM: '2033-07', z: '0.6', segType: 'enterprise', windowStartYM: '2026-09' }, null, '2026-09');
A.eq(r60e.monthly[0].burden, 582, '红线：Z=0.6 企业月缴 582');
A.eq(M.baseFromZ(3.0, Y, {}), 36348, '红线：Z=3.0 基数 36348');
var r30 = RC.computeR({ retireYM: '2033-07', z: '3.0', segType: 'flexible', windowStartYM: '2026-09' }, null, '2026-09');
A.eq(r30.monthly[0].burden, 7269.6, '红线：Z=3.0 灵活月缴 7269.6（不得取整）');
A.ok(r30.monthly[0].burden !== 7270, '红线：Z=3.0 月缴 ≠ 7270（证明未取整）');

// ===== 6. 两页一致性：用「Z→基数」生成的基本页段 vs 比较页 assemblePlanInput =====
// 基线数据（等同 e7-my1 形态的共享历史段 + 账户锚点）
function mkShared(z, segType) {
  var page = {
    gender: 'male', femaleType: '', birthYM: '1973-07', workStartYM: '1995-07',
    hasDeemed: true, deemedStartYM: '1995-07', deemedEndYM: '2000-10',
    entryMode: 'seg',
    segments: [
      { type: 'enterprise', startYM: '2000-01', endYM: '2000-02', baseMonthly: '3071' },
      { type: 'enterprise', startYM: '2011-01', endYM: '2026-08', baseMonthly: '12116' }
    ],
    yearRows: [], accountBalanceManual: '672920', manualBalanceYM: '2026-08',
    futureMonthlyRatePct: '0', baseYearOptions: ['2025'], baseYearIndex: 0,
    cPingOverride: '', customCYearText: '', doc31Eligible: false, doc31TransferYM: '',
    enterpriseInsuredYM: '', subsidyExcludedText: ''
  };
  return V.buildSharedInput(P, D, page, '2026-08');
}

var RET = '2033-07';
[0.6, 1.3, 3.0].forEach(function (z) {
  var sh = mkShared(z, 'flexible');

  // 比较页路径
  var bIn = Asm.assemblePlanInput(sh, { id: 'A', retireYM: RET, z: String(z), segType: 'flexible', windowStartYM: '2026-09' });
  var rB = Engine.calculate(bIn);
  var autoB = bIn.segments.filter(function (s) { return s.startYM >= '2026-09'; });

  // 基本页路径：用户填 Z → 页面转换出基数 → 手填段
  var base = M.baseFromZ(z, Y, {});
  var aIn = JSON.parse(JSON.stringify(sh));
  aIn.retireYM = RET;
  aIn.segments = aIn.segments.concat([{
    type: 'flexible', startYM: '2026-09', endYM: D.toYM(D.toIndex(RET) - 1), baseMonthly: base
  }]);
  var rA = Engine.calculate(aIn);

  A.eq(base, autoB[0].baseMonthly, 'Z=' + z + ' 两页基数逐位相同');
  A.ok(Math.abs(rA.pension.total - rB.pension.total) < 0.01,
    'Z=' + z + ' 两页 P月 Δ<0.01（基本 ' + rA.pension.total + ' vs 比较 ' + rB.pension.total + '）');
  A.ok(Math.abs(rA.pension.J基础 - rB.pension.J基础) < 0.01 &&
       Math.abs(rA.pension.J账户 - rB.pension.J账户) < 0.01 &&
       Math.abs(rA.pension.J过渡 - rB.pension.J过渡) < 0.01,
    'Z=' + z + ' 两页三分项逐项 Δ<0.01');
});

// 0017 现场参数（Z=1.3 + 利率0）：Δ 必须为 0（0.02 已归零）
(function () {
  var sh = mkShared(1.3, 'flexible');
  var bIn = Asm.assemblePlanInput(sh, { id: 'A', retireYM: RET, z: '1.3', segType: 'flexible', windowStartYM: '2026-09' });
  var rB = Engine.calculate(bIn);
  var base = M.baseFromZ(1.3, Y, {});
  var aIn = JSON.parse(JSON.stringify(sh));
  aIn.retireYM = RET;
  aIn.segments = aIn.segments.concat([{ type: 'flexible', startYM: '2026-09', endYM: D.toYM(D.toIndex(RET) - 1), baseMonthly: base }]);
  var rA = Engine.calculate(aIn);
  A.ok(Math.abs(rA.pension.total - rB.pension.total) < 1e-9,
    'BUG-02-0017：Z=1.3 两页 P月 完全相等（Δ=' + (rA.pension.total - rB.pension.total) + '）');
})();

A.finish();
