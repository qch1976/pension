// autotest/yearbase-test.js
// 年度模式年缴费基数录入 bug 的纯函数断言（不跑 GUI、不调 cli preview）。
// 用法：node autotest/yearbase-test.js
'use strict';

// Mock 小程序运行时，使 pages/index/index.js 可在 node 中加载
var pageObj = null;
global.Page = function (obj) { pageObj = obj; };
global.getApp = function () { return { globalData: {} }; };
global.wx = {
  getStorageSync: function () { return ''; },
  setStorageSync: function () {},
  showToast: function () {},
  showActionSheet: function () {}
};

require('../pages/index/index.js');

var pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('  FAIL: ' + msg); }
}
function approx(a, b) { return Math.abs(a - b) < 1e-6; }

console.log('== expandYearRows: 年缴费基数 / 月数 / 起始月 -> 月段 ==');

// 边界1：2000 年 annualBase=6142、2 个月、从 11 月起 -> 2000-11..2000-12，baseMonthly=3071
var s1 = pageObj.expandYearRows([
  { year: '2000', startMonth: '11', type: 'enterprise', annualBase: '6142', months: '2' }
]);
assert(s1.length === 1, '2000 展开应为 1 段，实际 ' + s1.length);
assert(s1[0].startYM === '2000-11', '2000 startYM 应为 2000-11，实际 ' + s1[0].startYM);
assert(s1[0].endYM === '2000-12', '2000 endYM 应为 2000-12，实际 ' + s1[0].endYM);
assert(approx(s1[0].baseMonthly, 3071), '2000 baseMonthly 应为 3071，实际 ' + s1[0].baseMonthly);
assert(s1[0].type === 'enterprise', '2000 type 应保留 enterprise');

// 边界2：2026 年 annualBase=287562、8 个月、从 1 月起 -> 2026-01..2026-08，baseMonthly=35945.25
var s2 = pageObj.expandYearRows([
  { year: '2026', startMonth: '1', type: 'enterprise', annualBase: '287562', months: '8' }
]);
assert(s2.length === 1, '2026 展开应为 1 段，实际 ' + s2.length);
assert(s2[0].startYM === '2026-01', '2026 startYM 应为 2026-01，实际 ' + s2[0].startYM);
assert(s2[0].endYM === '2026-08', '2026 endYM 应为 2026-08，实际 ' + s2[0].endYM);
assert(approx(s2[0].baseMonthly, 35945.25), '2026 baseMonthly 应为 35945.25，实际 ' + s2[0].baseMonthly);

// 全年12个月：2024 年 annualBase=120000 -> 2024-01..2024-12，10000/月
var s3 = pageObj.expandYearRows([
  { year: '2024', startMonth: '1', type: 'flexible', annualBase: '120000', months: '12' }
]);
assert(s3.length === 1, '2024 展开应为 1 段，实际 ' + s3.length);
assert(s3[0].startYM === '2024-01', '2024 startYM 应为 2024-01，实际 ' + s3[0].startYM);
assert(s3[0].endYM === '2024-12', '2024 endYM 应为 2024-12，实际 ' + s3[0].endYM);
assert(approx(s3[0].baseMonthly, 10000), '2024 baseMonthly 应为 10000，实际 ' + s3[0].baseMonthly);
assert(s3[0].type === 'flexible', '2024 type 应保留 flexible');

// 连续排月可跨年：起始月11 + 12 个月 -> 2000-11..2001-10，月基数不变
var s4 = pageObj.expandYearRows([
  { year: '2000', startMonth: '11', type: 'enterprise', annualBase: '12000', months: '12' }
]);
assert(s4[0].startYM === '2000-11', '跨年 startYM 应为 2000-11，实际 ' + s4[0].startYM);
assert(s4[0].endYM === '2001-10', '跨年 endYM 应为 2001-10，实际 ' + s4[0].endYM);
assert(approx(s4[0].baseMonthly, 1000), '跨年 baseMonthly 应为 1000，实际 ' + s4[0].baseMonthly);

// 多行：用户真实年度数据口径（2000=2个月11-12、2026=8个月1-8、其余12个月）
var s5 = pageObj.expandYearRows([
  { year: '2000', startMonth: '11', type: 'enterprise', annualBase: '6142', months: '2' },
  { year: '2024', startMonth: '1', type: 'enterprise', annualBase: '120000', months: '12' },
  { year: '2026', startMonth: '1', type: 'enterprise', annualBase: '287562', months: '8' }
]);
assert(s5.length === 3, '多行应展开为 3 段，实际 ' + s5.length);

// 无效行被跳过，不产生脏段
var s6 = pageObj.expandYearRows([
  { year: '', startMonth: '1', type: 'enterprise', annualBase: '1000', months: '12' },
  { year: '2010', startMonth: '1', type: 'enterprise', annualBase: '', months: '12' }
]);
assert(s6.length === 0, '无效年度行应跳过，实际 ' + s6.length);

console.log('== collectYearRowWarnings / validateYearRows: 年基数与月数校验 ==');

// 月数越界（1-12 之外）给提示
var w1 = pageObj.collectYearRowWarnings([
  { year: '2024', startMonth: '1', type: 'enterprise', annualBase: '120000', months: '13' }
]);
assert(w1.length === 1 && /1~12/.test(w1[0]), '月数13 应给 1~12 提示，实际 ' + JSON.stringify(w1));

// 起始月越界给提示
var w2 = pageObj.collectYearRowWarnings([
  { year: '2024', startMonth: '0', type: 'enterprise', annualBase: '120000', months: '12' }
]);
assert(w2.length === 1 && /起始月/.test(w2[0]), '起始月0 应提示，实际 ' + JSON.stringify(w2));

// 年基数非正数给提示
var w3 = pageObj.collectYearRowWarnings([
  { year: '2024', startMonth: '1', type: 'enterprise', annualBase: '-1', months: '12' }
]);
assert(w3.length === 1 && /年缴费基数/.test(w3[0]), '年基数-1 应提示，实际 ' + JSON.stringify(w3));

// 正常行无月数/起始月类提示
var w4 = pageObj.collectYearRowWarnings([
  { year: '2000', startMonth: '11', type: 'enterprise', annualBase: '6142', months: '2' }
]);
assert(!w4.some(function (w) { return /月数|起始月|大于 0/.test(w); }),
  '正常2000行不应有录入类提示，实际 ' + JSON.stringify(w4));

// validateYearRows：非法月数 / 非法基数抛错
var threw1 = false, threw2 = false;
try { pageObj.validateYearRows([{ year: '2024', startMonth: '1', annualBase: '1', months: '0' }]); }
catch (e) { threw1 = /1~12/.test(e.message); }
assert(threw1, '月数0 应抛 1~12 错误');
try { pageObj.validateYearRows([{ year: '2024', startMonth: '1', annualBase: '', months: '12' }]); }
catch (e) { threw2 = /年缴费基数/.test(e.message); }
assert(threw2, '空年基数应抛错');
var noThrow = true;
try { pageObj.validateYearRows([{ year: '2026', startMonth: '1', annualBase: '287562', months: '8' }]); }
catch (e) { noThrow = false; }
assert(noThrow, '合法年度行不应抛错');

console.log('');
console.log('RESULT pass=' + pass + ' fail=' + fail);
if (fail) process.exit(1);
