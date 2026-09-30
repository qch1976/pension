// tests/plan-compare-table.js
// D4 把关点2：逐【方案】把 computePlan 与「用同一份组装入参直接调引擎」逐项比对，
// 输出 P月(total) 及 J基础/J账户/J过渡 三路值与 |Δ|，要求全部 ≤0.01。
'use strict';
var D = require('../calculator/dateUtil.js');
var Engine = require('../calculator/pensionEngine.js');
var Asm = require('../calculator/planAssembler.js');

function sharedInput(overrides) {
  var base = {
    gender: 'male', femaleType: null, birthYM: '1976-09', workStartYM: '1998-08',
    retireYM: '2039-09', deemedStartYM: null, deemedEndYM: null,
    segments: [{ type: 'enterprise', startYM: '1998-08', endYM: '2026-08', baseMonthly: 12116 }],
    accountBalanceManual: 250000, accountBalanceManualYM: '2026-08', futureMonthlyRate: null,
    baseYearOverride: 2025, cPingOverride: null, customCYear: {},
    doc31Eligible: false, doc31TransferYM: null, enterpriseInsuredYM: null, subsidyExcludedRanges: []
  };
  if (overrides) Object.keys(overrides).forEach(function (k) { base[k] = overrides[k]; });
  return base;
}

var cases = [
  { name: 'Z0.60/2039-09', plan: { retireYM: '2039-09', z: '0.60', segType: 'enterprise' } },
  { name: 'Z1.00/2039-09', plan: { retireYM: '2039-09', z: '1.00', segType: 'enterprise' } },
  { name: 'Z2.35/2039-09', plan: { retireYM: '2039-09', z: '2.35', segType: 'enterprise' } },
  { name: 'Z3.00/2039-09', plan: { retireYM: '2039-09', z: '3.00', segType: 'enterprise' } },
  { name: 'Z1.20/2032-09',  plan: { retireYM: '2032-09', z: '1.20', segType: 'flexible' } },
  { name: 'Z1.80/2042-09',  plan: { retireYM: '2042-09', z: '1.80', segType: 'enterprise' } }
];

var keys = ['J基础', 'J账户', 'J过渡', 'total'];
var rows = [];
var allWithin = true;

cases.forEach(function (c) {
  var si = sharedInput();
  var resA = Asm.computePlan(si, c.plan);
  var inputB = Asm.assemblePlanInput(si, c.plan);
  var resB = Engine.calculate(inputB);
  keys.forEach(function (k) {
    var a = resA.pension[k], b = resB.pension[k], d = Math.abs(a - b);
    if (d > 0.01) allWithin = false;
    rows.push({ case: c.name, item: k, A: a, B: b, d: d });
  });
});

// 文本表格
var lines = [];
lines.push('D4 逐项比对表：computePlan(A) vs 同组装入参直接调引擎(B)，阈值|Δ|≤0.01');
lines.push('| 方案 | 分项 | A(computePlan) | B(直接引擎) | |Δ| | 判定 |');
lines.push('|---|---|---|---|---|---|');
rows.forEach(function (r) {
  lines.push('| ' + r.case + ' | ' + r.item + ' | ' + r.A.toFixed(2) + ' | ' + r.B.toFixed(2) +
    ' | ' + r.d.toFixed(4) + ' | ' + (r.d <= 0.01 ? 'OK' : 'X') + ' |');
});
lines.push('');
lines.push('总体判定: ' + (allWithin ? 'ALL WITHIN 0.01 (' + rows.length + ' cells)' : 'MISMATCH'));
var out = lines.join('\n');
console.log('\n' + out + '\n');

var fs = require('fs');
var path = require('path');
var OUT = path.join(__dirname, '..', 'autotest', 'output', 'gui');
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'd4-compare-table.md'), out, 'utf8');
console.log('saved autotest/output/gui/d4-compare-table.md');
process.exit(allWithin ? 0 : 1);
