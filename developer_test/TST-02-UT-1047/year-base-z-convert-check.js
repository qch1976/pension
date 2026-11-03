// developer_test/TST-02-UT-1047/year-base-z-convert-check.js
// TST-02-UT-1047（BUG-02-0022 / REQ-02-IN-008）：年度录入模式 缴费基数↔Z 双向转换纯函数断言。
// 覆盖口径（与方案比较页/月度模式同源，C 取 planAssembler.denominatorForYear）：
//   Z=0.6 -> 月基数 7270（最低档 roundLowestToYuan 取整到元）；
//   Z=1.3 -> 月基数 15750.8（不强制取整，保留裸值）；
//   Z=3.0 -> 月基数 36348；
//   年基数 = 月基数 × 缴费月数；反向 Z=月基数/C，4 位小数。
'use strict';
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var M = require(path.join(ROOT, 'calculator', 'inputPageModel.js'));
var A = require(path.join(ROOT, 'developer_test', 'common', 'assert-ok.js')).create('TST-02-UT-1047');

function near(a, b, t) { return isFinite(+a) && isFinite(+b) && Math.abs(+a - +b) <= (t == null ? 1e-6 : t); }
function yr(year, months, annualBase) {
  return { year: String(year), startMonth: '1', months: String(months), annualBase: annualBase == null ? '' : String(annualBase) };
}

// 当前权威 C2026（若 policyData 变更则以引擎同源于准；12116 为需求给定冻结值）
var C2026 = 12116;

// ===== Z -> 月基数（12 个月年行），三档取整规则 =====
console.log('== Z -> 月基数/年基数 ==');
var t06 = M.yearAnnualFromZ('0.6', yr(2026, 12), null);
A.eq(t06.monthly, 7270, 'Z=0.6 -> 月基数 7270（最低档取整到元）');
A.eq(t06.annual, 7270 * 12, 'Z=0.6 -> 年基数 7270×12=' + (7270 * 12));
var t13 = M.yearAnnualFromZ('1.3', yr(2026, 12), null);
A.ok(near(t13.monthly, 15750.8, 1e-6), 'Z=1.3 -> 月基数 15750.8（不取整，实测 ' + t13.monthly + '）');
A.ok(near(t13.annual, 15750.8 * 12, 1e-6), 'Z=1.3 -> 年基数 15750.8×12=' + (15750.8 * 12));
var t30 = M.yearAnnualFromZ('3.0', yr(2026, 12), null);
A.eq(t30.monthly, 36348, 'Z=3.0 -> 月基数 36348');
A.eq(t30.annual, 36348 * 12, 'Z=3.0 -> 年基数 36348×12=' + (36348 * 12));

// ===== Z 与月度模式同源：yearAnnualFromZ 的月基数 === inputPageModel.baseFromZ =====
console.log('== 与月度模式同源 ==');
[['0.6', 7270], ['1.3', 15750.8], ['3.0', 36348]].forEach(function (kv) {
  var monthlyFromYear = M.yearAnnualFromZ(kv[0], yr(2026, 12), null).monthly;
  var monthlyFromMonth = M.baseFromZ(kv[0], 2026, null);
  A.eq(monthlyFromYear, monthlyFromMonth,
    'Z=' + kv[0] + ' 年度模式月基数 === 月度模式 baseFromZ（同源，0 误差）');
});

// ===== 非 12 个月年行（年基数 = 月基数 × months） =====
console.log('== 非 12 个月年行 ==');
[['0.6', 1, 7270], ['0.6', 6, 7270], ['1.3', 7, 15750.8], ['3.0', 3, 36348]].forEach(function (kv) {
  var o = M.yearAnnualFromZ(kv[0], yr(2026, kv[1]), null);
  A.ok(near(o.monthly, kv[2], 1e-6), '月数' + kv[1] + ' Z=' + kv[0] + ' 月基数 ' + kv[2] + '（实测 ' + o.monthly + '）');
  A.ok(near(o.annual, kv[2] * kv[1], 0.01), '月数' + kv[1] + ' Z=' + kv[0] + ' 年基数=月基数×' + kv[1] + '（实测 ' + o.annual + '）');
});

// ===== 年基数 -> Z（4 位小数），含月数非 12 =====
console.log('== 年基数 -> Z ==');
A.eq(M.yearZFromAnnual(yr(2026, 12, 15750.8 * 12), null).toFixed(4), '1.3000', '年基数 15750.8×12 -> Z=1.3000');
A.eq(M.yearZFromAnnual(yr(2026, 12, 7270 * 12), null).toFixed(4), '0.6000', '年基数 7270×12 -> Z=0.6000');
A.eq(M.yearZFromAnnual(yr(2026, 12, 36348 * 12), null).toFixed(4), '3.0000', '年基数 36348×12 -> Z=3.0000');
// 6 个月：年基数 = 15750.8×6，月基数仍 15750.8 -> Z=1.3
A.eq(M.yearZFromAnnual(yr(2026, 6, 15750.8 * 6), null).toFixed(4), '1.3000', '6 个月月数年行年基数 15750.8×6 -> Z=1.3000');

// ===== 往返一致（Z -> 年基数 -> Z） =====
console.log('== 往返一致 ==');
['0.6', '1.3', '3.0'].forEach(function (z) {
  [12, 6, 3, 1].forEach(function (mo) {
    var o = M.yearAnnualFromZ(z, yr(2026, mo), null);
    var back = M.yearZFromAnnual(yr(2026, mo, o.annual), null);
    A.eq(back.toFixed(4), Number(z).toFixed(4), 'Z=' + z + ' 月数' + mo + ' 往返一致');
  });
});

// ===== 与需求冻结 C2026=12116 勾稽（Z=月基数/C） =====
console.log('== C2026 勾稽 ==');
A.ok(near(7270 / C2026, 0.6, 1e-4), '7270/12116 ≈ 0.6000（最低档取整后）');
A.ok(near(15750.8 / C2026, 1.3, 1e-6), '15750.8/12116 = 1.3');
A.ok(near(36348 / C2026, 3.0, 1e-6), '36348/12116 = 3.0');

// ===== 非法输入返回 null（不抛错、不产 NaN） =====
console.log('== 非法输入 ==');
A.eq(M.yearZFromAnnual(yr(2026, 12, ''), null), null, '空年基数 -> null');
A.eq(M.yearZFromAnnual(yr(2026, 12, 0), null), null, '年基数 0 -> null');
A.eq(M.yearZFromAnnual(yr(2026, 12, -100), null), null, '负年基数 -> null');
A.eq(M.yearZFromAnnual(yr('', 12, 87240), null), null, '缺年份 -> null');
A.eq(M.yearZFromAnnual(yr(2026, 0, 87240), null), null, '月数 0 -> null');
A.eq(M.yearZFromAnnual(yr(2026, 13, 87240), null), null, '月数 13 -> null');
A.eq(M.yearAnnualFromZ('abc', yr(2026, 12), null), null, '非法 Z -> null');
A.eq(M.yearAnnualFromZ('0', yr(2026, 12), null), null, 'Z=0（<=0 不可算）-> null');
// 注：baseFromZ 不做 0.6~3 区间拦截（与月度模式一致），越界提示归 caseValidator（zValue 0.60~3.00）
// 与 boundWarnings，转换函数本身不抛错；Z=5 仍给出裸转换值。
var o5 = M.yearAnnualFromZ('5', yr(2026, 12), null);
A.ok(near(o5.monthly, 5 * 12116, 1e-6), 'Z=5 转换不抛错（区间校验归 validator；实测月基数 ' + o5.monthly + '）');

// ===== 年度月基数裸值辅助函数 =====
console.log('== yearRowMonthly ==');
A.ok(near(M.yearRowMonthly(yr(2026, 12, 189009.6)), 15750.8, 1e-6), 'yearRowMonthly 189009.6/12=15750.8');
A.eq(M.yearRowMonthly(yr(2026, 6, 7270 * 6)), 7270, 'yearRowMonthly 6 个月年行=7270');
A.eq(M.yearRowMonthly(yr(2026, 12, '')), null, 'yearRowMonthly 空值 null');

A.finish();
