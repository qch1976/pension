// autotest/interaction-assert.js
// 批次2（#6/#7/#11）回归：node 纯函数/最小逻辑断言，不涉及 GUI。
// 验证：
//  - #6 重置后 data 各用户录入字段为空（含批次1新改起止年月/账户累计额/未来年利率/年度记录）；
//  - #11 遮罩开关函数正确；并通过最小沙箱真实加载 pages/index/index.js，
//    验证 onReset 接线 setData(空数据)+removeStorageSync，onCalculate 先置 calculating 再运算/关闭；
//  - #7 居中：app.wxss 中 input text-align:center。
// 运行：cd 项目根 ; node autotest/interaction-assert.js
'use strict';
var fs = require('fs');
var path = require('path');
var Module = require('module');
var P = require('../constants/policyData.js');
var Model = require('../calculator/inputPageModel.js');

var pass = 0, fail = 0;
function ok(label, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL ' + label + (extra != null ? ' :: ' + extra : '')); }
}
function eq(label, actual, expected) {
  ok(label, actual === expected, 'actual=' + JSON.stringify(actual) + ' expected=' + JSON.stringify(expected));
}

// ============ #6 buildResetData：全部用户录入字段为空 ============
var initial = Model.buildInitialData(P);
var reset = Model.buildResetData(P);

// 用户录入的标量字段（字符串类必须 === ''）
var mustEmptyStrings = [
  'birthYM', 'workStartYM', 'retireYM', 'retireHint',
  'deemedStartYM', 'deemedEndYM',                    // 批次1 起止年月
  'accountBalanceManual', 'manualBalanceYM',        // 批次1 账户累计额/锚点月
  'futureMonthlyRatePct',                           // 批次1 未来年利率
  'doc31TransferYM', 'enterpriseInsuredYM', 'subsidyExcludedText',
  'cPingOverride', 'customCYearText', 'errorMsg'
];
mustEmptyStrings.forEach(function (k) {
  eq('reset.' + k + "=''", reset[k], '');
});
ok('reset.boundWarnings=[]', Array.isArray(reset.boundWarnings) && reset.boundWarnings.length === 0);
eq('reset.calculating=false', reset.calculating, false);
eq('reset.doc31Eligible=false', reset.doc31Eligible, false);
eq('reset.entryMode=year (BUG-15)', reset.entryMode, 'year');

// 录入记录（分段/年度）内所有可录入值为空
ok('reset.segments length=1 + baseMonthly 空',
  reset.segments.length === 1 && reset.segments.every(function (s) { return s.baseMonthly === ''; }));
ok('reset.yearRows length=1 + annualBase 空',
  reset.yearRows.length === 1 && reset.yearRows.every(function (r) { return r.annualBase === ''; }));

// 与初始数据对比：初始未来年利率默认1.5，重置后必须为空（防止“数字没变”）
eq('initial.futureMonthlyRatePct=1.5', initial.futureMonthlyRatePct, '1.5');
eq('reset.futureMonthlyRatePct 为空', reset.futureMonthlyRatePct, '');

// 静态选项/占位文案保留（不是用户录入）
ok('reset.baseYearOptions 保留', Array.isArray(reset.baseYearOptions) && reset.baseYearOptions.length === 6);
ok('reset.pensionBase 字典保留', reset.pensionBase && typeof reset.pensionBase === 'object');
ok('reset 占位文案保留', /请选择/.test(reset.deemedStartPh) && /请选择/.test(reset.manualBalancePh));
ok('reset.policyVersion 保留', typeof reset.policyVersion === 'string' && reset.policyVersion.length > 0);

// 初始/重置两套数据键集合必须一致（避免新增字段漏重置）
eq('keys(initial)=keys(reset)', Object.keys(initial).sort().join(','), Object.keys(reset).sort().join(','));

// ============ #11 enterCalculating / exitCalculating ============
var entered = Model.enterCalculating(reset);
eq('enterCalculating.calculating=true', entered.calculating, true);
eq('enterCalculating.errorMsg 清空', entered.errorMsg, '');
eq('enterCalculating 不改原对象', reset.calculating, false); // 纯函数不可变
var exited = Model.exitCalculating(entered);
eq('exitCalculating.calculating=false', exited.calculating, false);

// ============ 最小沙箱：真实加载 pages/index/index.js 验证接线 ============
// 桩：getApp / wx / Page / setTimeout 立即执行（本沙箱内）
var appObj = { globalData: {} };
var storage = {};
var setDataCalls = [];
var navCalls = [];
var toastCalls = [];
var wxStub = {
  getStorageSync: function (k) { return storage[k]; },
  setStorageSync: function (k, v) { storage[k] = v; },
  removeStorageSync: function (k) { delete storage[k]; },
  navigateTo: function (o) { navCalls.push(o.url); },
  showToast: function (o) { toastCalls.push(o); }
};
var pageConfig = null;
var fakeSetData = function (patch, cb) {
  setDataCalls.push(patch);
  // 模拟合并
  Object.keys(patch).forEach(function (k) { this.data[k] = patch[k]; }, this);
  if (typeof cb === 'function') cb();
};

var sandbox = {
  getApp: function () { return appObj; },
  wx: wxStub,
  Page: function (cfg) { pageConfig = cfg; },
  console: console,
  require: require,
  module: { exports: {} },
  exports: {},
  __dirname: path.join(__dirname, '..', 'pages', 'index'),
  process: process,
  setTimeout: function (fn) { fn(); return 0; }, // 立即让出一帧
  clearTimeout: function () {}
};

var indexPath = path.join(__dirname, '..', 'pages', 'index', 'index.js');
var code = fs.readFileSync(indexPath, 'utf8');
var wrapped = Module.wrap(code);
var requireLocal = Module.createRequire(indexPath);
sandbox.require = requireLocal;
var fn = require('vm').runInNewContext(wrapped, { require: require, module: Module, exports: {}, __dirname: __dirname, process: process, console: console });
// 上面只是拿到 wrapper；真正编译用 vm with context
var vm = require('vm');
var ctx = vm.createContext(sandbox);
vm.runInContext(wrapped, ctx)(sandbox.exports, requireLocal, indexPath, path.dirname(indexPath));

ok('Page() 已注册', !!pageConfig);

// --- 实例化页面（模拟框架）---
var inst = {
  data: pageConfig.data
};
inst.setData = fakeSetData.bind(inst);
Object.keys(pageConfig).forEach(function (k) {
  if (k !== 'data' && typeof pageConfig[k] === 'function') inst[k] = pageConfig[k].bind(inst);
});

// #6 onReset：setData 数据必须含全空字段 + Storage 删除
storage.pension_input_v1 = { junk: 1 };
setDataCalls.length = 0;
inst.onReset();
ok('onReset 调用 setData', setDataCalls.length >= 1);
var resetPatch = setDataCalls[0];
['deemedStartYM', 'deemedEndYM', 'accountBalanceManual', 'futureMonthlyRatePct', 'manualBalanceYM'].forEach(function (k) {
  eq('onReset patch.' + k + "=''", resetPatch[k], '');
});
ok('onReset 删除 Storage', !('pension_input_v1' in storage));
eq('onReset 后 data.deemedStartYM 空', inst.data.deemedStartYM, '');
eq('onReset 后 data.accountBalanceManual 空', inst.data.accountBalanceManual, '');
eq('onReset 后 data.futureMonthlyRatePct 空', inst.data.futureMonthlyRatePct, '');

// #11 onCalculate（输入为空→校验失败路径）：遮罩开后必须关闭，errorMsg 有值
setDataCalls.length = 0;
inst.onCalculate();
var opened = setDataCalls.some(function (p) { return p.calculating === true; });
ok('onCalculate 期间遮罩曾开启', opened);
eq('失败路径遮罩最终关闭', inst.data.calculating, false);
ok('失败路径 errorMsg 有值', /[\u4e00-\u9fa5]/.test(inst.data.errorMsg), inst.data.errorMsg);

// #11 成功路径：填入合法数据（简化：一段企业缴费+账户额），遮罩关闭并导航
inst.setData({
  gender: 'male', femaleType: 'worker', birthYM: '1973-07', workStartYM: '1995-07',
  retireYM: '2033-07', hasDeemed: true, deemedStartYM: '1995-07', deemedEndYM: '2000-10',
  entryMode: 'month',
  segments: [{ type: 'enterprise', startYM: '2000-11', endYM: '2033-06', baseMonthly: '30000' }],
  accountBalanceManual: '672920', manualBalanceYM: '2026-08', futureMonthlyRatePct: '1.5',
  doc31Eligible: true, doc31TransferYM: '2000-11', enterpriseInsuredYM: '2000-11',
  subsidyExcludedText: '', baseYearIndex: 0, cPingOverride: '', customCYearText: '',
  boundWarnings: [], errorMsg: '', calculating: false
});
navCalls.length = 0;
inst.onCalculate();
// BUG-16：成功路径【跳转前不关遮罩】，calculating 保持 true，由结果页同名遮罩接棒
eq('成功路径遮罩保持 calculating=true', inst.data.calculating, true);
ok('成功路径导航结果页', navCalls.length === 1 && /pages\/result\/result/.test(navCalls[0]), navCalls.join(','));
// 从结果页返回触发 onShow：遮罩复位
inst.onShow();
eq('onShow 返回后遮罩关闭', inst.data.calculating, false);

// ============ #7 居中样式 ============
var appWxss = fs.readFileSync(path.join(__dirname, '..', 'app.wxss'), 'utf8');
ok('app.wxss: input text-align:center', /input\s*\{[^}]*text-align:\s*center/.test(appWxss));
ok('app.wxss: 不再有 input text-align:right', !/input\s*\{[^}]*text-align:\s*right/.test(appWxss));

console.log('RESULT pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
