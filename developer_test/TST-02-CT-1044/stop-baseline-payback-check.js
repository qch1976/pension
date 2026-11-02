// developer_test/TST-02-CT-1044/stop-baseline-payback-check.js
// TST-02-CT-1044 —— REQ-02-CAL-002（来源 BUG-02-0016，需求变更）
// 回本月数新增「R续=0（停保）」基准两行（利率 0% 与 页面利率）组件/模型级断言 A1~A10。
// 设计见 docs/testcase_design/TST-02-CT-1044-stop-baseline-payback.md，
// 实现规格 docs/design/stop-baseline-payback-design-bug16.md。
//
// 🔴 独立性：期望值全部由本脚本按设计规格 §4 公式【自行独立复算】。
//    不读取被测模块的 FV / dP / months / ceilMonths 等中间量自证；
//    仅 A4「勾稽」明确要求把 ROI 模型的 baselineMonthly / pMonthly 与回本行输入对齐
//    （这是需求本身要求的同源关系，属被测契约，不是自证）。
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var CRM = require(path.join(ROOT, 'calculator', 'compareResultModel.js'));
var ROIm = require(path.join(ROOT, 'calculator', 'roiModel.js'));
var Rmod = require(path.join(ROOT, 'calculator', 'rContribution.js'));
var Asm = require(path.join(ROOT, 'calculator', 'planAssembler.js'));
var PB = require(path.join(ROOT, 'calculator', 'paybackModel.js'));
var stlib = require(path.join(ROOT, 'system_test', 'common', 'st-case-lib.js'));
var CV = require(path.join(ROOT, 'services', 'caseValidator.js'));
var A = require(path.join(ROOT, 'developer_test', 'common', 'assert-ok.js')).create('TST-02-CT-1044');
var D0 = require(path.join(ROOT, 'calculator', 'dateUtil.js'));

// ===== 夹具：真实 My-Case.md（项目主用例），不手写常数 =====
var fx = stlib.parseFixture('My-Case.md');
var pageIndex = CV.mapParsedToPageData(fx.parsed, {});
var sharedInput = CV.buildInputLike(pageIndex);

// 方案集 A：3 方案，全部 R续>0（常规路径）
var PLANS_A = [
  { id: 'p0', retireYM: '2033-07', z: '0.6', segType: 'flexible', windowStartYM: '' },
  { id: 'p1', retireYM: '2035-09', z: '1.3', segType: 'enterprise', windowStartYM: '' },
  { id: 'p2', retireYM: '2030-12', z: '3.0', segType: 'flexible', windowStartYM: '' }
];
// 方案集 B：含一个 R续=0（起始月=退休月 ⇒ 无自动缴费段）的方案，覆盖「本身即停保」边界
var PLANS_B = [
  { id: 'p0', retireYM: '2033-07', z: '0.6', segType: 'flexible', windowStartYM: '' },
  { id: 'p1', retireYM: '2026-12', z: '1.0', segType: 'flexible', windowStartYM: '2026-12' }
];
// 方案集 C：停保基准不足最低缴费年限（裁短历史段 ⇒ baselineEligible=false）
var sharedShort = JSON.parse(JSON.stringify(sharedInput));
sharedShort.segments = sharedShort.segments.slice(-12); // 只剩 140 个月 < 最低需缴
var PLANS_C = [
  { id: 'p0', retireYM: '2033-07', z: '0.6', segType: 'flexible', windowStartYM: '' },
  { id: 'p1', retireYM: '2040-01', z: '1.0', segType: 'flexible', windowStartYM: '' }
];

// ============================================================================
// 独立复算（按设计规格 §4，基准=逐方案停保：月负担 0、T_b = T_k）
//   d_m = burdenK_m ; FV = Σ d_m·(1+i)^(T_k−m) ; ΔP = P月_继续 − P月_停保
//   r=0 → n = FV/ΔP ; r>0 → n = −ln(1 − FV·i/ΔP)/ln(1+i) ; 展示向上取整
// 入参 burdens 由本脚本用 rContribution 独立算出（不是读 paybackModel 的产物）。
// ============================================================================
function independentStopPaybackIn(inp, plan, originYM, pCont, pStop, annualRate, stopEligible) {
  var rCont = Rmod.computeR(plan, inp.customCYear, Asm.resolveWindowStart(plan, inp));
  var originIdx = D0.toIndex(originYM);
  var Tk = PB.retireOffset(plan.retireYM, originYM); // 退休前一月偏移（仅供 FV 上界，属时间口径非被测数值）

  if (stopEligible === false) return { branch: 'NA', text: '不可用', sub: '（停保基准不足最低缴费年限）' };
  if (!(rCont.total > 0)) return { branch: 'SELF', text: '—', sub: '（即停保基准）' };

  var i = annualRate / 12;
  var FV = 0;
  rCont.monthly.forEach(function (mm) {
    var m = D0.toIndex(mm.ym) - originIdx;
    if (m < 0 || m > Tk) return;
    FV += mm.burden * Math.pow(1 + i, Tk - m);
  });
  var dP = pCont - pStop;
  if (!(dP > 0)) return { branch: 'C', text: '无法抵回', sub: '（该利率下）' };
  var n;
  if (i === 0) n = FV / dP;
  else {
    var inner = 1 - FV * i / dP;
    if (inner <= 0) return { branch: 'C', text: '无法抵回', sub: '（该利率下）' };
    n = -Math.log(inner) / Math.log(1 + i);
  }
  if (!isFinite(n)) return { branch: 'C', text: '无法抵回', sub: '（该利率下）' };
  return { branch: 'B', text: '退休后抵回', sub: Math.ceil(n) + '个月' };
}
// 供旧调用点复用（使用默认夹具）
function independentStopPayback(plan, originYM, pCont, pStop, annualRate, stopEligible) {
  return independentStopPaybackIn(sharedInput, plan, originYM, pCont, pStop, annualRate, stopEligible);
}

var D = require(path.join(ROOT, 'calculator', 'dateUtil.js'));

// 取某方案独立复算结果（pCont/pStop 取自 ROI 模型——A4 明确要求的同源契约）
function indepOf(plans, rate, planId, si) {
  var inp = si || sharedInput;
  var originYM = Asm.defaultWindowStart(inp);
  var it = ROIm.computeAll(inp, plans).items.filter(function (x) { return x.id === planId; })[0];
  return independentStopPaybackIn(inp, it.plan, originYM, it.pMonthly, it.baselineMonthly, rate, it.baselineEligible);
}

// ============================================================================
// A1 — 两行新行存在且标签正确（页面视图字段 pbS0 / pbSU 均被构建）
// ============================================================================
console.log('== A1 两行新行存在 ==');
var vA = CRM.buildView(sharedInput, PLANS_A, 0.015);
A.ok(!!vA.columns.length, 'buildView 产出列');
vA.columns.forEach(function (c) {
  A.ok(c.pbS0 && typeof c.pbS0.text === 'string', 'A1 ' + c.id + ' 新行1 pbS0.text 存在');
  A.ok(c.pbSU && typeof c.pbSU.text === 'string', 'A1 ' + c.id + ' 新行2 pbSU.text 存在');
  A.ok(!!c.pbS0Branch, 'A1 ' + c.id + ' 新行1 branch 存在（' + c.pbS0Branch + '）');
  A.ok(!!c.pbSUBranch, 'A1 ' + c.id + ' 新行2 branch 存在（' + c.pbSUBranch + '）');
});

// WXML 标签字面量（A1 行名要求）
var fs = require('fs');
var wxml = fs.readFileSync(path.join(ROOT, 'pages', 'compare-result', 'compare-result.wxml'), 'utf8');
A.ok(wxml.indexOf('回本月数（停保基准·0%）') >= 0, 'A1 WXML 含「回本月数（停保基准·0%）」标签');
A.ok(wxml.indexOf('回本月数（停保基准·{{view.userRatePercent}}%）') >= 0,
  'A1 WXML 含「回本月数（停保基准·{{view.userRatePercent}}%）」标签');
A.ok(/c\.pbS0\.text/.test(wxml) && /c\.pbS0\.sub/.test(wxml), 'A1 WXML 绑定 pbS0.text/sub');
A.ok(/c\.pbSU\.text/.test(wxml) && /c\.pbSU\.sub/.test(wxml), 'A1 WXML 绑定 pbSU.text/sub');
// 旧两行仍在（保留，不替换）
A.ok(wxml.indexOf('回本月数（0%）') >= 0 && wxml.indexOf('回本月数（{{view.userRatePercent}}%）') >= 0,
  'A1 原有两行保留（共 4 行）');

// ============================================================================
// A2 — 覆盖全部方案列（含 R续 最大者），不缺失不错位
// ============================================================================
console.log('== A2 覆盖全部方案列 ==');
A.eq(vA.columns.map(function (c) { return c.id; }).join(','), PLANS_A.map(function (p) { return p.id; }).join(','),
  'A2 列顺序与方案顺序一致');
var maxRCol = vA.columns.reduce(function (a, b) { return b.rContinued > a.rContinued ? b : a; });
A.ok(!!maxRCol.pbS0 && !!maxRCol.pbSU && maxRCol.pbS0Branch !== undefined,
  'A2 R续 最大者（' + maxRCol.id + ' rCont=' + maxRCol.rContinued + '）也有新两行（旧行是 BASELINE 时新行仍给数值）');
A.ok(maxRCol.pbS0Branch !== 'BASELINE', 'A2 新行不使用 BASELINE 分支（停保基准对每个方案都有定义）');

// ============================================================================
// A3 — 每方案新行数值 = 独立复算（向上取整整月），误差 0
// ============================================================================
console.log('== A3 数值与独立复算一致 ==');
[['利率0%', 0, 'pbS0'], ['利率1.5%', 0.015, 'pbSU'], ['利率20%', 0.20, 'pbSU']].forEach(function (t) {
  var v = CRM.buildView(sharedInput, PLANS_A, t[1]);
  v.columns.forEach(function (c) {
    var ind = indepOf(PLANS_A, t[1], c.id);
    var got = c[t[2]];
    A.eq(got.text + '|' + got.sub, ind.text + '|' + ind.sub,
      'A3 [' + t[0] + '] ' + c.id + ' = 独立复算（' + ind.text + ' ' + ind.sub + '）');
  });
});

// ============================================================================
// A4 — 与 ROI 勾稽：停保基准 P月 === computeROI().baselineMonthly；继续 P月 === pMonthly
// ============================================================================
console.log('== A4 ROI 勾稽 ==');
var itemsA = ROIm.computeAll(sharedInput, PLANS_A).items;
var serie = PB.computeStopBaseline(itemsA.map(function (it) {
  return {
    id: it.id, T: PB.retireOffset(it.plan.retireYM, Asm.defaultWindowStart(sharedInput)),
    burdens: (function () {
      var r = Rmod.computeR(it.plan, sharedInput.customCYear, Asm.resolveWindowStart(it.plan, sharedInput));
      var o = D.toIndex(Asm.defaultWindowStart(sharedInput));
      var b = {};
      r.monthly.forEach(function (mm) { b[D.toIndex(mm.ym) - o] = mm.burden; });
      return b;
    })(),
    pMonthly: it.pMonthly, rTotal: it.rContinued,
    pStop: it.baselineMonthly, stopEligible: it.baselineEligible
  };
}), 0.015);
itemsA.forEach(function (it) {
  A.eq(serie.byId[it.id].dP, PB.round2(it.pMonthly - it.baselineMonthly),
    'A4 ' + it.id + ' 新行 ΔP === pMonthly − baselineMonthly（与 ROI 分子同一减数）');
  // 与 ROI 模型自身产出的显式比对（契约同源）
  A.eq(it.baselineMonthly, ROIm.computeROI(sharedInput, it.plan).baselineMonthly,
    'A4 ' + it.id + ' 停保基准 P月 === computeROI().baselineMonthly');
  A.eq(it.pMonthly, ROIm.computeROI(sharedInput, it.plan).pMonthly,
    'A4 ' + it.id + ' 继续 P月 === computeROI().pMonthly');
});

// ============================================================================
// A5 — 页面利率=0 时新两行同值，且仍显示两行（不合并）
// ============================================================================
console.log('== A5 利率=0 双行同值 ==');
var v0 = CRM.buildView(sharedInput, PLANS_A, 0);
v0.columns.forEach(function (c) {
  A.eq(c.pbS0.text + '|' + c.pbS0.sub, c.pbSU.text + '|' + c.pbSU.sub,
    'A5 利率0% ' + c.id + ' 新行1 === 新行2');
});
A.eq(v0.userRatePercent, '0.00', 'A5 view.userRatePercent=0.00（两行标签仍各自渲染）');
A.ok(/回本月数（停保基准·0%）/.test(wxml) && /停保基准·\{\{view\.userRatePercent\}\}/.test(wxml),
  'A5 两行标签独立存在，利率0%时不合并');

// ============================================================================
// A6 — 某方案 R续=0（本身即停保）：显示「—（即停保基准）」，不参与排名
// ============================================================================
console.log('== A6 R续=0 方案 ==');
var vB = CRM.buildView(sharedInput, PLANS_B, 0.015);
var selfCol = vB.columns.filter(function (c) { return c.rContinued === 0; })[0];
A.ok(!!selfCol, 'A6 方案集 B 中存在 R续=0 的方案（' + (selfCol && selfCol.id) + '）');
A.eq(selfCol.pbS0.text, '—', 'A6 该方案新行1 text=「—」');
A.eq(selfCol.pbS0.sub, '（即停保基准）', 'A6 该方案新行1 sub=「（即停保基准）」');
A.eq(selfCol.pbSU.text, '—', 'A6 该方案新行2 text=「—」');
A.eq(selfCol.pbS0Branch, 'SELF', 'A6 branch=SELF（不参与排名）');
// 其它方案仍有正常数值
vB.columns.filter(function (c) { return c.rContinued > 0; }).forEach(function (c) {
  A.ok(c.pbS0Branch === 'B' || c.pbS0Branch === 'C', 'A6 其它方案 ' + c.id + ' 仍给正常结果（' + c.pbS0Branch + '）');
});

// ============================================================================
// A7 — 停保基准 baselineEligible=false：显示「不可用（停保基准不足最低缴费年限）」
// ============================================================================
console.log('== A7 停保基准不合格 ==');
var vC = CRM.buildView(sharedShort, PLANS_C, 0.015);
var naCount = 0;
vC.columns.forEach(function (c) {
  if (c.pbS0Branch === 'NA') {
    naCount++;
    A.eq(c.pbS0.text, '不可用', 'A7 ' + c.id + ' 新行1 text=「不可用」');
    A.eq(c.pbS0.sub, '（停保基准不足最低缴费年限）', 'A7 ' + c.id + ' 新行1 sub 文案');
    A.eq(c.pbSU.text, '不可用', 'A7 ' + c.id + ' 新行2 text=「不可用」');
    // 与 ROI blocked 口径一致（ROI 在停保基准不合格时 blocked）
    var itC = ROIm.computeAll(sharedShort, PLANS_C).items.filter(function (x) { return x.id === c.id; })[0];
    A.eq(itC.baselineEligible, false, 'A7 ' + c.id + ' 该方案 baselineEligible 确为 false（文案口径与 ROI 一致）');
    A.ok(itC.status !== 'ok', 'A7 ' + c.id + ' ROI 同步 blocked');
  }
});
A.ok(naCount > 0, 'A7 方案集 C 至少一列命中 NA 分支（实测 ' + naCount + ' 列；若为 0 说明夹具未覆盖该边界）');
// 直接构造 stopEligible=false 的最小 series，确保分支逻辑本身可达
var forced = PB.computeStopBaseline([{
  id: 'fx', T: 10, burdens: { 0: 1000 }, pMonthly: 5000, rTotal: 12000, pStop: 4000, stopEligible: false
}], 0.015);
A.eq(forced.byId.fx.branch, 'NA', 'A7 构造 stopEligible=false ⇒ branch=NA（分支可达）');

// ============================================================================
// A8 — 永不回本：显示「无法抵回（该利率下）」，不出现 NaN/Infinity
// ============================================================================
console.log('== A8 永不回本 ==');
var vHigh = CRM.buildView(sharedInput, PLANS_A, 0.20);
var cCount = 0;
vHigh.columns.forEach(function (c) {
  if (c.pbSUBranch === 'C') {
    cCount++;
    A.eq(c.pbSU.text, '无法抵回', 'A8 ' + c.id + ' 高利率分支C text');
    A.eq(c.pbSU.sub, '（该利率下）', 'A8 ' + c.id + ' 高利率分支C sub');
    A.ok(!/NaN|Infinity|undefined|null/.test(c.pbSU.text + c.pbSU.sub),
      'A8 ' + c.id + ' 不出现 NaN/Infinity/undefined（实际 ' + c.pbSU.text + c.pbSU.sub + '）');
  }
});
A.ok(cCount > 0, 'A8 20% 利率下至少一列命中分支C（实测 ' + cCount + '）');
// ΔP<=0 构造：pStop 高于 pCont ⇒ 分支C（不抛错）
var negDP = PB.computeStopBaseline([{
  id: 'n1', T: 10, burdens: { 0: 1000 }, pMonthly: 5000, rTotal: 12000, pStop: 6000, stopEligible: true
}], 0);
A.eq(negDP.byId.n1.branch, 'C', 'A8 ΔP<=0 ⇒ 分支C（不产生负月数）');
A.ok(negDP.byId.n1.ceilMonths === null, 'A8 分支C ceilMonths=null（不是 NaN/Infinity）');
// 所有分支输出都不得含 NaN
var allBranches = [v0, vA, vB, vC, vHigh];var nanHit = [];
allBranches.forEach(function (v) {
  v.columns.forEach(function (c) {
    ['pbS0', 'pbSU'].forEach(function (k) {
      var s = c[k].text + '|' + c[k].sub;
      if (/NaN|Infinity/.test(s)) nanHit.push(c.id + '.' + k + '=' + s);
    });
  });
});
A.eq(nanHit.length, 0, 'A8 全部视图新行无 NaN/Infinity（命中 ' + JSON.stringify(nanHit) + '）');

// ============================================================================
// A9 — 回归：原有两行（argmin R续 基准）数值与改动前完全一致（±0）
//    期望值以「改动前实现口径」独立复算：旧行 = computeDouble(selectBaseline)/evaluateOne
//    这里直接对 PB.computeDouble 的公开语义做快照比对（数值冻结）
// ============================================================================
console.log('== A9 旧两行数值冻结 ==');
// 变动前快照（2026-11-03 在 bfd8e88 上实跑取得，见工单 verification）。
// 快照 key = 方案集|利率标签|列id，value = pb0.text|pb0.sub（旧行 0% 列）。
// 旧行「用户利率」列在 rate=0 时与 0% 列同值，快照同样适用。
var FROZEN = {
  'A|0|p0': '基准方案|（R续最小）', 'A|0|p1': '退休前抵回|1个月', 'A|0|p2': '退休后抵回|907个月',
  'A|1.5|p0': '基准方案|（R续最小）', 'A|1.5|p1': '退休前抵回|1个月', 'A|1.5|p2': '退休后抵回|907个月',
  'A|20|p0': '基准方案|（R续最小）', 'A|20|p1': '退休前抵回|1个月', 'A|20|p2': '退休后抵回|907个月',
  'B|0|p0': '退休前抵回|1个月', 'B|0|p1': '基准方案|（R续最小）',
  'B|1.5|p0': '退休前抵回|1个月', 'B|1.5|p1': '基准方案|（R续最小）'
};
// 旧行「用户利率」列快照（pbU）——非 0 利率单独冻结，防新代码误改旧列
var FROZEN_U = {
  'A|1.5|p0': '基准方案|（R续最小）', 'A|1.5|p1': '退休前抵回|1个月', 'A|1.5|p2': '无法抵回|（该利率下）',
  'A|20|p0': '基准方案|（R续最小）', 'A|20|p1': '退休前抵回|1个月', 'A|20|p2': '无法抵回|（该利率下）',
  'B|1.5|p0': '退休前抵回|1个月', 'B|1.5|p1': '基准方案|（R续最小）'
};
[[PLANS_A, 0, '0'], [PLANS_A, 0.015, '1.5'], [PLANS_A, 0.20, '20'], [PLANS_B, 0, '0'], [PLANS_B, 0.015, '1.5']].forEach(function (t) {
  var setName = t[0] === PLANS_A ? 'A' : 'B';
  var v = CRM.buildView(sharedInput, t[0], t[1]);
  v.columns.forEach(function (c) {
    var k = setName + '|' + t[2] + '|' + c.id;
    if (FROZEN[k]) A.eq(c.pb0.text + '|' + c.pb0.sub, FROZEN[k], 'A9 旧行(0%) ' + k + ' 与改动前一致');
    if (FROZEN_U[k]) A.eq(c.pbU.text + '|' + c.pbU.sub, FROZEN_U[k], 'A9 旧行(用户利率) ' + k + ' 与改动前一致');
  });
});
// 旧行分支码未被新代码影响：BASELINE 仍归属 argmin R续 方案，且只有一个
A.eq(vA.columns.filter(function (c) { return c.pb0Branch === 'BASELINE'; }).length, 1,
  'A9 旧行 BASELINE 唯一（argmin R续）');
A.eq(vA.baselineId, 'p0', 'A9 baselineId 仍为 R续 最小方案 p0');
// 停保基准不占列、不加徽标（列数不变）
A.eq(vA.columns.length, PLANS_A.length, 'A9 停保基准未新增列（列数=方案数）');

// ============================================================================
// A10 — 边界利率：0 / 1.5 / 大值 20 均不抛错；rate=null 按 0 处理
// ============================================================================
console.log('== A10 利率边界 ==');
[0, 0.015, 0.20, 1.0].forEach(function (r) {
  var v = null, err = null;
  try { v = CRM.buildView(sharedInput, PLANS_A, r); } catch (e) { err = e.message; }
  A.ok(!err && v && v.columns.length === 3, 'A10 利率 ' + (r * 100) + '% 不抛错并产出 3 列' + (err ? ' :: ' + err : ''));
});
var vNull = CRM.buildView(sharedInput, PLANS_A, null);
A.eq(vNull.userRatePercent, '0.00', 'A10 rate=null 按 0 处理（userRatePercent=0.00）');
vNull.columns.forEach(function (c) {
  A.eq(c.pbSU.text + '|' + c.pbSU.sub, c.pbS0.text + '|' + c.pbS0.sub,
    'A10 rate=null 时新行1===新行2（' + c.id + '）');
});
var vUndef = CRM.buildView(sharedInput, PLANS_A, undefined);
A.eq(vUndef.userRatePercent, '0.00', 'A10 rate=undefined 按 0 处理');
// buildViewSafe 不因新行抛错
var safe = CRM.buildViewSafe(sharedInput, PLANS_A, 0.015);
A.eq(safe.ok, true, 'A10 buildViewSafe.ok=true（新增两行不影响容错）');

A.finish();
