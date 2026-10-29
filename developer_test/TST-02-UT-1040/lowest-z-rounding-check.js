// developer_test/TST-02-UT-1040/lowest-z-rounding-check.js
// TST-02-UT-1040（BUG-02-0014，owner=developer）node 断言，纯逻辑不依赖 wx。
// 校验「仅最低缴费档 Z=0.6」的自动段基数与月缴精确到个位、四舍五入；
// 0.6<Z<=3.0 一律不取整（保持既有精确算法）——本组断言即为防回归红线。
'use strict';
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var Asm = require(path.join(ROOT, 'calculator', 'planAssembler.js'));
var RC = require(path.join(ROOT, 'calculator', 'rContribution.js'));
var P = require(path.join(ROOT, 'constants', 'policyData.js'));
var D = require(path.join(ROOT, 'calculator', 'dateUtil.js'));
var V = require(path.join(ROOT, 'calculator', 'inputValidator.js'));
var Engine = require(path.join(ROOT, 'calculator', 'pensionEngine.js'));
var PF = require(path.join(ROOT, 'developer_test', 'common', 'plan-factory.js'));
var A = require(path.join(ROOT, 'developer_test', 'common', 'assert-ok.js')).create('TST-02-UT-1040');

var WS = '2026-09', RET = '2035-09';
function plan(z, segType) { return { id: 'A', retireYM: RET, z: String(z), segType: segType || 'flexible', windowStartYM: WS }; }
function baseOf(z) { return Asm.buildAutoSegments(plan(z), null, WS)[0].baseMonthly; }
function burdenOf(z, t) { return RC.computeR(plan(z, t), null, WS).monthly[0].burden; }

// ===== 1. 最低档判定（唯一事实来源 = policyData.baseRatio.min）=====
A.eq(P.baseRatio.min, 0.6, 'policyData.baseRatio.min=0.6（政策核定区间下限）');
A.eq(Asm.LOWEST_Z, 0.6, 'planAssembler.LOWEST_Z 取自 policyData，无硬编码');
A.eq(Asm.isLowestZ(0.6), true, 'isLowestZ(0.6)=true');
A.eq(Asm.isLowestZ('0.6'), true, "isLowestZ('0.6')=true（字符串归一）");
A.eq(Asm.isLowestZ('0.60'), true, "isLowestZ('0.60')=true（两位写法等价）");
A.eq(Asm.isLowestZ(0.7), false, 'isLowestZ(0.7)=false（非最低档，不取整）');
A.eq(Asm.isLowestZ(1.0), false, 'isLowestZ(1.0)=false');
A.eq(Asm.isLowestZ(1.3), false, 'isLowestZ(1.3)=false');
A.eq(Asm.isLowestZ(3.0), false, 'isLowestZ(3.0)=false');
A.eq(Asm.isLowestZ(''), false, 'isLowestZ(空)=false');

// roundYuan 只在最低档路径被调用；本身行为校验
A.eq(Asm.roundYuan(7269.6), 7270, 'roundYuan(7269.6)=7270');
A.eq(Asm.roundYuan(1453.92), 1454, 'roundYuan(1453.92)=1454');
A.eq(Asm.roundYuan(581.568), 582, 'roundYuan(581.568)=582');
A.eq(Asm.roundLowestToYuan(7269.6, 0.6), 7270, 'roundLowestToYuan(7269.6, Z=0.6)=7270');
A.eq(Asm.roundLowestToYuan(7269.6, 0.7), 7269.6, 'roundLowestToYuan(…, Z=0.7) 不取整（原值）');

// ===== 2. Z=0.6 基数与月缴取整（工单验收值）=====
A.eq(baseOf(0.6), 7270, 'Z=0.6 自动段基数=7270（12116×0.6=7269.6→7270）');
A.ok(Number.isInteger(baseOf(0.6)), 'Z=0.6 基数为整元');
A.eq(burdenOf(0.6, 'flexible'), 1454, 'Z=0.6 灵活月缴=1454（7270×20%）');
A.eq(burdenOf(0.6, 'enterprise'), 582, 'Z=0.6 企业月缴=582（7270×8%=581.6→582）');
A.ok(Number.isInteger(burdenOf(0.6, 'flexible')), 'Z=0.6 灵活月缴为整元');
A.ok(Number.isInteger(burdenOf(0.6, 'enterprise')), 'Z=0.6 企业月缴为整元');

// 先整基数再整月缴的顺序验证：不可用未取整基数直接乘
A.eq(Asm.roundYuan(Asm.roundYuan(0.6 * 12116) * 0.20), 1454, '顺序：先整基数(7270)再×20%再取整=1454');
A.ok(Asm.roundYuan(7269.6 * 0.20) === 1454, '对照：用裸基数 7269.6×20%=1453.92→1454（本例恰同值）');

// 全年整段逐月均为整元
(function () {
  var r = RC.computeR(plan(0.6, 'flexible'), null, WS);
  A.ok(r.monthly.every(function (m) { return Number.isInteger(m.base) && Number.isInteger(m.burden); }),
    'Z=0.6 全区间逐月基数与月缴均整元');
  A.eq(r.total, r.months * 1454, 'Z=0.6 R续合计=月数×1454');
})();

// ===== 3. 非最低档一律不取整（防回归红线）=====
// 期望值 = 原精确算式 z*C（不取整），逐档严格相等
[0.7, 1.0, 1.3, 1.5, 2.0, 3.0].forEach(function (z) {
  var rawBase = z * 12116;
  A.eq(baseOf(z), rawBase, 'Z=' + z + ' 基数保持精确值 ' + rawBase + '（不取整）');
  A.eq(burdenOf(z, 'flexible'), rawBase * 0.20, 'Z=' + z + ' 灵活月缴保持精确值（不取整）');
  A.eq(burdenOf(z, 'enterprise'), rawBase * 0.08, 'Z=' + z + ' 企业月缴保持精确值（不取整）');
});

// 重点档位显式断言（与改动前口径逐位一致）
A.eq(baseOf(0.7), 8481.199999999999, 'Z=0.7 基数=8481.199999999999（非 8481）');
A.eq(burdenOf(0.7, 'flexible'), 1696.2399999999998, 'Z=0.7 灵活月缴未被取整');
A.eq(baseOf(1.0), 12116, 'Z=1.0 基数=12116');
A.eq(burdenOf(1.0, 'flexible'), 2423.2000000000003, 'Z=1.0 灵活月缴保持 2423.2…（未取整为 2423）');
A.ok(burdenOf(1.0, 'flexible') !== 2423, 'Z=1.0 月缴 ≠ 2423（证明未取整）');
A.eq(baseOf(1.3), 15750.800000000001, 'Z=1.3 基数保持精确');
A.eq(burdenOf(1.3, 'flexible'), 3150.1600000000003, 'Z=1.3 灵活月缴保持精确');
A.eq(baseOf(3.0), 36348, 'Z=3.0 基数=36348');
A.eq(burdenOf(3.0, 'flexible'), 7269.6, 'Z=3.0 灵活月缴=7269.6（未取整为 7270）');
A.ok(burdenOf(3.0, 'flexible') !== 7270, 'Z=3.0 月缴 ≠ 7270（证明未取整）');

// ===== 4. 引擎侧：自动段基数随最低档变 7270，非最低档仍精确 =====
(function () {
  var shared = V.buildSharedInput(P, D, PF.pageData('0.6'), '2026-08');
  var inLow = Asm.assemblePlanInput(shared, PF.aPlan(0.6, RET, ''));
  var resLow = Engine.calculate(inLow);
  var autoLow = resLow.monthlyDetails.filter(function (r) { return r.ym >= WS; });
  A.ok(autoLow.length > 0, '引擎 Z=0.6 自动段月明细非空');
  A.eq(autoLow[0].base, 7270, '引擎 Z=0.6 自动段基数=7270');
  A.ok(autoLow.every(function (r) { return r.base === 7270; }), '引擎 Z=0.6 逐月基数均 7270');

  var shared2 = V.buildSharedInput(P, D, PF.pageData('1.3'), '2026-08');
  var in13 = Asm.assemblePlanInput(shared2, PF.aPlan(1.3, RET, ''));
  var res13 = Engine.calculate(in13);
  var auto13 = res13.monthlyDetails.filter(function (r) { return r.ym >= WS; });
  A.eq(auto13[0].base, 1.3 * 12116, '引擎 Z=1.3 自动段基数保持精确（不取整）');
  A.ok(auto13[0].base !== 15751, '引擎 Z=1.3 基数 ≠ 15751（未四舍五入）');
})();

// ===== 5. 不影响 P月/三分项自洽（本改动不触碰 engine 计发）=====
(function () {
  var shared = V.buildSharedInput(P, D, PF.pageData('0.6'), '2026-08');
  var res = Engine.calculate(Asm.assemblePlanInput(shared, PF.aPlan(0.6, RET, '')));
  A.ok(typeof res.pension.total === 'number' && res.pension.total > 0, 'Z=0.6 P月仍正常计算');
  A.ok(Math.abs((res.pension.J基础 + res.pension.J账户 + res.pension.J过渡) - res.pension.total) < 0.02,
    'Z=0.6 三分项之和 ≈ P月（自洽）');
  var shared13 = V.buildSharedInput(P, D, PF.pageData('1.3'), '2026-08');
  var res13 = Engine.calculate(Asm.assemblePlanInput(shared13, PF.aPlan(1.3, RET, '')));
  A.ok(Math.abs((res13.pension.J基础 + res13.pension.J账户 + res13.pension.J过渡) - res13.pension.total) < 0.02,
    'Z=1.3 三分项之和 ≈ P月（自洽，未受本改动影响）');
})();

// ===== 6. 边界：非法/空 Z 不进入取整路径 =====
(function () {
  A.eq(Asm.isLowestZ(NaN), false, 'isLowestZ(NaN)=false');
  A.eq(Asm.isLowestZ('abc'), false, "isLowestZ('abc')=false");
  A.eq(Asm.roundLowestToYuan(1234.5, 'abc'), 1234.5, 'Z 非法时不取整（原值返回）');
})();

A.finish();
