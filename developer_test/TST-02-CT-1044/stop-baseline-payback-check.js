// developer_test/TST-02-CT-1044/stop-baseline-payback-check.js
// TST-02-CT-1044 —— REQ-02-CAL-002（来源 BUG-02-0016，需求变更）
// 回本月数新增「R续=0（停保）」基准两行（利率 0% 与 页面利率）组件/模型级断言。
//
// ⚠️ 当前状态：需求未实现（matrix result=FAIL, bug=BUG-02-0016）。
//    本文件为 testcase 入口占位：定义断言骨架，待 worker3 按
//    docs/design/stop-baseline-payback-design-bug16.md 实现后填充被测调用并跑通。
//    设计见 docs/testcase_design/TST-02-CT-1044-stop-baseline-payback.md。
//
// 断言点（A1~A10）与独立性要求：期望值必须由本脚本按 spec §9.3 公式独立复算，
// 禁止读取被测模块中间结果或 UI 回显数字作为期望值。
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..', '..');

// 被测模块（实现后启用）：
// var CRM = require(path.join(ROOT, 'calculator', 'compareResultModel.js'));
// var ROIm = require(path.join(ROOT, 'calculator', 'roiModel.js'));

var pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

// ---- 独立复算（按 spec §9.3，基准=逐方案停保：月负担 0、T_b=T_k）----
// burdens: [{ ym, burden }]（继续情形逐月个人负担）；pCont/pStop: 继续/停保 P月；Tk: 退休前一月偏移
function independentPayback(burdens, pCont, pStop, Tk, annualRate) {
  var i = annualRate / 12;
  var FV = 0;
  burdens.forEach(function (b) {
    var m = b.idx;
    if (m < 0 || m > Tk) return;
    FV += b.burden * Math.pow(1 + i, Tk - m);
  });
  var dP = pCont - pStop;
  if (!(dP > 0)) return { branch: 'C', months: Infinity, ceil: null };
  if (i === 0) return { branch: 'B', months: FV / dP, ceil: Math.ceil(FV / dP) };
  var inner = 1 - FV * i / dP;
  if (inner <= 0) return { branch: 'C', months: Infinity, ceil: null };
  var n = -Math.log(inner) / Math.log(1 + i);
  return { branch: 'B', months: n, ceil: Math.ceil(n) };
}
module.exports = { independentPayback: independentPayback };

// ---- 断言骨架（实现后逐条启用）----
console.log('TST-02-CT-1044 stop-baseline payback — 需求未实现，占位骨架');
ok('A1 两行新行存在', false, 'pending implementation (BUG-02-0016)');
console.log('\nRESULT: ' + pass + ' pass / ' + fail + ' fail  [PENDING REQ-02-CAL-002 IMPLEMENTATION]');

// 需求未实现时以非零退出（便于 CI/门禁区分"未跑"与"跑通"）。
process.exit(fail === 0 ? 0 : 1);
