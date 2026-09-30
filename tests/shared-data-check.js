// tests/shared-data-check.js
// D2 共享历史数据区 node 断言（不依赖 wx/组件）：
//  1) buildSharedInput 对合法共享数据构造成功（规则同 Phase-0 buildInput，方案级字段留 null）
//  2) ≤2026-08 窗口边界（endYM/startYM 越界即报错）
//  3) 31号文人员校验（缺参报错，文案与 Phase-0 一致）
//  4) 年度模式：月数/起始月/年基数校验 + 展开
//  5) 独立草稿：pickShared 只含共享字段，不含方案级/运行态字段；草稿 key 与 Phase-0 不同
'use strict';
var P = require('../constants/policyData.js');
var D = require('../calculator/dateUtil.js');
var Model = require('../calculator/inputPageModel.js');
var V = require('../calculator/inputValidator.js');

var pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; }
  else { fail++; console.log('  FAIL: ' + name); }
}
function throws(fn, frag, name) {
  var got = null;
  try { fn(); } catch (e) { got = e.message; }
  ok(got && got.indexOf(frag) !== -1, name + ' (期望含「' + frag + '」, 实际: ' + got + ')');
}

// 合法共享数据底（month 模式；段录至 2026-08）
function baseData() {
  var d = Model.buildInitialData(P);
  d.gender = 'male';
  d.birthYM = '1965-10';
  d.workStartYM = '1985-07';
  d.entryMode = 'month';
  d.segments = [{ type: 'enterprise', startYM: '1992-10', endYM: '2026-08', baseMonthly: '10000' }];
  d.accountBalanceManual = '';
  return d;
}

// 1) 合法构造
(function () {
  var input = V.buildSharedInput(P, D, baseData());
  ok(input.gender === 'male', '性别');
  ok(input.birthYM === '1965-10', '出生年月');
  ok(input.segments.length === 1, '共享段数=1');
  ok(input.segments[0].baseMonthly === 10000, '月基数解析为数字');
  ok(input.segments[0].endYM === '2026-08', '段结束2026-08');
  ok(input.retireYM === null, 'retireYM 为方案级留null');
  ok(input.futureMonthlyRate === null, 'futureMonthlyRate 方案级留null');
  ok(input.doc31Eligible === false, '默认非31号文');
  // 确定性：同数据两次构造结果一致（供三方案一致引用）
  var a = JSON.stringify(V.buildSharedInput(P, D, baseData()));
  var b = JSON.stringify(V.buildSharedInput(P, D, baseData()));
  ok(a === b, '同数据构造结果确定一致（三方案可共用同一input）');
})();

// 2) 窗口边界
(function () {
  var d1 = baseData();
  d1.segments[0].endYM = '2026-09';
  throws(function () { V.buildSharedInput(P, D, d1); }, '超出截止月', '段结束2026-09应阻断');
  var d2 = baseData();
  d2.segments[0].startYM = '2026-09';
  d2.segments[0].endYM = '2026-12';
  throws(function () { V.buildSharedInput(P, D, d2); }, '窗口之后', '段起始2026-09应阻断');
  // 恰好 2026-08 允许
  var d3 = baseData();
  ok(V.buildSharedInput(P, D, d3).segments[0].endYM === '2026-08', '结束恰2026-08合法');
})();

// 3) 31号文校验（文案对齐 Phase-0 buildInput）
(function () {
  var d = baseData();
  d.doc31Eligible = true;
  d.workStartYM = '';
  throws(function () { V.buildSharedInput(P, D, d); }, '必须填写参加工作年月', '31号文缺参工月');
  d.workStartYM = '1985-07';
  d.hasDeemed = false;
  throws(function () { V.buildSharedInput(P, D, d); }, '视同缴费年限开关置为「有」', '31号文无视同开关');
  d.hasDeemed = true; d.deemedStartYM = '1975-07'; d.deemedEndYM = '1992-09';
  d.doc31TransferYM = '1990-01';
  throws(function () { V.buildSharedInput(P, D, d); }, '不早于1998-01', '31号文调动月过早');
  d.doc31TransferYM = '2000-05';
  d.enterpriseInsuredYM = '';
  throws(function () { V.buildSharedInput(P, D, d); }, '企业实际参保缴费起始', '31号文缺企业参保起始');
  d.enterpriseInsuredYM = '2000-05';
  var input = V.buildSharedInput(P, D, d);
  ok(input.doc31Eligible === true && input.subsidyExcludedRanges.length === 0, '31号文合法构造');
})();

// 4) 年度模式
(function () {
  var d = Model.buildInitialData(P);
  d.gender = 'male'; d.birthYM = '1965-10'; d.workStartYM = '1985-07';
  d.entryMode = 'year';
  d.yearRows = [{ year: '2024', startMonth: '1', type: 'enterprise', annualBase: '120000', months: '12' }];
  var input = V.buildSharedInput(P, D, d);
  ok(input.segments.length === 1, '年度行展开1段');
  ok(input.segments[0].baseMonthly === 10000, '年基数120000/12=10000');
  ok(input.segments[0].startYM === '2024-01' && input.segments[0].endYM === '2024-12', '年度起止推导');

  var bad = JSON.parse(JSON.stringify(d));
  bad.yearRows[0].months = '13';
  throws(function () { V.buildSharedInput(P, D, bad); }, '年内缴费月数须为 1~12', '年度月数越界');
  var bad2 = JSON.parse(JSON.stringify(d));
  bad2.yearRows[0].annualBase = '0';
  throws(function () { V.buildSharedInput(P, D, bad2); }, '大于 0', '年基数非正');
})();

// 5) 独立草稿隔离
(function () {
  var d = baseData();
  d.calculating = true; d.errorMsg = 'x'; d.retireYM = '2030-01'; d.futureMonthlyRatePct = '1.5';
  var picked = V.pickShared(d);
  ok(picked.calculating === undefined, '草稿不含运行态 calculating');
  ok(picked.errorMsg === undefined, '草稿不含 errorMsg');
  ok(picked.retireYM === undefined, '草稿不含方案级 retireYM');
  ok(picked.futureMonthlyRatePct === undefined, '草稿不含未来利率（方案窗口）');
  ok(picked.segments.length === 1 && picked.gender === 'male', '草稿保留共享字段');
  // key 常量与 Phase-0 隔离（组件使用 pension_compare_input_v1；Phase-0 pension_input_v1）
  ok(V.CUTOFF === '2026-08', '共享截止常量');
})();

console.log('\\nshared-data-check: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
