// /tmp/viewmodel-audit.js —— 第二轮回归：ASCII 视图模型映射完整性审计（一次性审计脚本）
// 方法：stub 小程序运行时(Page/getApp/wx)，加载真实 pages/result/result.js 执行 onLoad，
// 再从真实 result.wxml 提取全部 {{}} 表达式中的成员访问路径，结合渲染上下文(root/vm/vmYearly/item、monthlyGroups/g/m、refDetail)
// 求值；任何解析到 undefined 的绑定即判定为漏映射。
var fs = require('fs');
var path = require('path');

var ROOT = process.argv[2] && require('fs').existsSync(process.argv[2]) ? process.argv[2] : path.join(__dirname, '..');
var Engine = require(path.join(ROOT, 'calculator', 'pensionEngine.js'));

// 批次1 #8 契约收紧后（accountBalanceManual UI 路径必填），旧套件统一走保留的历史重建逃生口。
var __engineCalculate = Engine.calculate;
Engine.calculate = function (input) {
  if (input && input.accountBalanceManual == null && input.accountReconstruct == null) {
    input.accountReconstruct = true;
  }
  return __engineCalculate(input);
};
var P = require(path.join(ROOT, 'constants', 'policyData.js'));

function seg(t, a, b, x) { return { type: t, startYM: a, endYM: b, baseMonthly: x }; }

// ---- 场景集：S1 老中人不计息 / S2 女工固定利率 / S3 新人官方利率 / 手工余额(manual,yearly=[]) / none利率(rate=null行) ----
var s1 = { gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10', interestMode: 'none', segments: [], customCYear: { 1992: 500, 1993: 600, 1994: 700, 1995: 678.67 } };
[['1992-10', '1992-12', 500], ['1993-01', '1993-12', 600], ['1994-01', '1994-12', 700], ['1995-01', '1995-12', 678.67]]
  .forEach(function (a) { s1.segments.push(seg('enterprise', a[0], a[1], a[2])); });
Object.keys(P.indexDenominatorMonthly).forEach(function (yy) {
  yy = +yy;
  s1.segments.push(seg('enterprise', yy + '-01', yy === 2025 ? '2025-09' : yy + '-12', P.indexDenominatorMonthly[yy]));
});
var s2 = { gender: 'female', femaleType: 'worker', birthYM: '1975-05', workStartYM: '1995-08', retireYM: '2025-05', interestMode: 'fixed', fixedRate: 0.04, intraYearMethod: 'monthly', customCYear: { 1995: 678.67 },
  segments: [seg('enterprise', '1995-08', '2015-12', 6000), seg('flexible', '2018-01', '2025-04', 4713)] };
var s3 = { gender: 'male', birthYM: '1965-09', workStartYM: '2000-09', retireYM: '2025-09', interestMode: 'official', fallbackRate: 0.0262, segments: [seg('enterprise', '2000-09', '2025-08', 10000)] };
var sManual = { gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10', interestMode: 'none', accountBalanceManual: 139000, segments: [] };
var sNone = { gender: 'male', birthYM: '1965-09', workStartYM: '2000-09', retireYM: '2025-09', interestMode: 'none', segments: [seg('enterprise', '2020-01', '2025-08', 8000)] };
// S6：31号文机关调入人员（spec V1.2 R补=Z补贴），1985参加工作、2003-01起企业参保
var sDoc31 = { gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10', interestMode: 'none',
  doc31Eligible: true, doc31TransferYM: '2003-01', enterpriseInsuredYM: '2003-01', segments: [] };
Object.keys(P.indexDenominatorMonthly).map(Number).filter(function (y) { return y >= 2003; }).forEach(function (yy) {
  sDoc31.segments.push(seg('enterprise', yy + '-01', yy === 2025 ? '2025-09' : yy + '-12', P.indexDenominatorMonthly[yy]));
});

// ---- stub 运行时，加载真实 result.js ----
var pageDef;
var appHolder = { globalData: { lastResult: null } };
global.Page = function (def) { pageDef = def; };
global.getApp = function () { return appHolder; };
global.wx = { showToast: function () {}, setClipboardData: function () {}, navigateBack: function () {} };
require(path.join(ROOT, 'pages', 'result', 'result.js'));

function loadPage(result) {
  appHolder.globalData.lastResult = result;
  var instance = { data: JSON.parse(JSON.stringify(pageDef.data || {})) }; // 真实运行时会用 Page({data:{}}) 初始化
  instance.setData = function (d) { Object.keys(d).forEach(function (k) { instance.data[k] = d[k]; }); };
  pageDef.onLoad.call(instance);
  return instance.data;
}
// WXML 内 <wxs module="ui"> 提供 collapse/expand；此处模拟为可调用函数
var uiWxs = { collapse: function (y) { return y + ' 收起 ▲'; }, expand: function (y) { return y + ' 展开 ▼'; } };

// ---- 从 wxml 提取绑定路径 ----
var wxml = fs.readFileSync(path.join(ROOT, 'pages', 'result', 'result.wxml'), 'utf8');
var exprs = [];
var re = /\{\{([\s\S]*?)\}\}/g, mm;
while ((mm = re.exec(wxml))) exprs.push(mm[1]);

// 抽成员访问链：识别 r.xxx / vm.xxx / item.xxx / g.xxx / m.xxx / ui.xxx / refDetail.xxx / totalDisplay/ready/expandedYear/monthlyGroups/vmYearly 等
function pathsOf(expr) {
  var out = [];
  var re2 = /\b(r|vm|item|g|m|ui|refDetail|totalDisplay|ready|expandedYear|monthlyGroups|vmYearly|vmAnnual)\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/g;
  var x;
  while ((x = re2.exec(expr))) out.push(x[1] === 'r' ? x[0] : x[0]);
  // 裸根名
  ['ready','totalDisplay','expandedYear','vmYearly','monthlyGroups','vmAnnual','vm','r','ui','refDetail'].forEach(function (n) {
    if (new RegExp('\\b' + n + '\\b').test(expr)) out.push(n);
  });
  return out;
}

function getp(obj, p) {
  var parts = p.split('.');
  var cur = obj;
  for (var i = 0; i < parts.length; i++) {
    if (cur == null) return { ok: false, reason: 'parent-null@' + parts[i] };
    cur = cur[parts[i]];
    if (cur === undefined) return { ok: false, reason: 'undefined@' + parts.slice(0, i + 1).join('.') };
  }
  return { ok: true, value: cur };
}

var scenarios = { S1: s1, S2: s2, S3: s3, S4_manual: sManual, S5_noneRate: sNone, S6_doc31: sDoc31 };
var totalBad = 0;
Object.keys(scenarios).forEach(function (name) {
  var result = Engine.calculate(scenarios[name]);
  var data = loadPage(result);
  // 构造求值上下文：root 平铺页面 data 键；item 取 vmYearly 首行/或 formula 行；g/m 取 group 首年首月
  var yearItem = (data.vmYearly && data.vmYearly[0]) || null;
  var formulaItem = result.formulaLines[0];
  var annualItem = (data.vmAnnual && data.vmAnnual[0]) || null; // #13 年度明细账 item 作用域
  // V1.2：R补（Z补贴）分档 wx:for="{{vm.subsidy.tiers}}" 的 item 作用域，受 showFormula 守卫
  var subsidyTierReachable = !!(data.vm && data.vm.subsidy && data.vm.subsidy.showFormula);
  var subsidyTierItem = subsidyTierReachable ? data.vm.subsidy.tiers[0] : null;
  // 选一个 account 非空的年组验证账户块；所有空账户年组必须被 wx:if="{{g.account}}" 守卫（静态检查在循环外做一次）
  var gAcct = (data.monthlyGroups || []).filter(function (x) { return x.account; })[0] || null;
  var g0 = (data.monthlyGroups || [])[0] || null; // g/m 通用字段用任意年组验证
  var m0 = g0 && g0.items[0];
  var ctxRef = { name: 'x', docNo: 'x', clause: 'x', effective: 'x', status: 'x', url: 'x' }; // 弹窗字段存在性在下方单独核
  var bad = [];
  // 作用域可达性：被 wx:if 守卫隐藏的分支不渲染，不算漏映射
  var yearlyReachable = data.vmYearly.length > 0;                 // wx:if="{{vmYearly.length}}"
  var groupsReachable = data.monthlyGroups.length > 0;           // wx:for 空数组不渲染
  var acctBlockReachable = !!gAcct;                                  // 账户块 wx:if="{{g.account}}"
  var scheduleReachable = !!result.meta.retireSchedule;          // 延退卡 wx:if
  var formulaReachable = result.formulaLines.length > 0;
  var guardOk = /wx:if="\{\{vmYearly\.length\}\}"/.test(wxml) &&
    /wx:if="\{\{g\.account\}\}"/.test(wxml) &&
    /wx:if="\{\{r\.meta\.retireSchedule\}\}"/.test(wxml);
  if (!guardOk) bad.push('wx:if 守卫结构缺失（vmYearly/g.account/retireSchedule）');

  exprs.forEach(function (expr) {
    pathsOf(expr).forEach(function (p) {
      var root = p.split('.')[0];
      var ctx;
      if (root === 'item') {
        // item 三个作用域：vmYearly 行（vmYearly.length 守卫）、formulaLines 行、subsidy.tiers 行（showFormula 守卫）
        if (/\.year|\.interest|\.endBalance|\.rateText|\.rateSource/.test(p) && !yearlyReachable) return;
        if (/\.ratePct|\.sumCWage|\.bracket|\.months/.test(p)) {
          if (!subsidyTierReachable) return; // wx:if="{{vm.subsidy.showFormula}}" 未渲染
          var c = getp({ item: subsidyTierItem }, p);
          if (!c.ok) bad.push(p + ' [' + c.reason + '] in: ' + expr.trim().slice(0, 50));
          return;
        }
        var annualOnly = /\.(paidMonths|xText|cText|zYearText|zMonthText|source|sourceText)$/.test(p);
        var a = yearItem ? getp({ item: yearItem }, p) : null;
        var b = formulaReachable ? getp({ item: formulaItem }, p) : null;
        var c = annualItem ? getp({ item: annualItem }, p) : null;
        if (annualOnly) {
          if (!c || !c.ok) bad.push(p + ' [' + (c ? c.reason : 'no-annual') + '] in: ' + expr.trim().slice(0, 50));
        } else if ((!a || !a.ok) && (!b || !b.ok) && (!c || !c.ok)) {
          bad.push(p + ' [' + (a ? a.reason : 'no-year') + '] in: ' + expr.trim().slice(0, 50));
        }
        return;
      }
      if (root === 'g') {
        if (!groupsReachable) return;
        if (/^g\.account(\.|$)/.test(p)) { if (!gAcct) return; ctx = { g: gAcct }; } // wx:if="{{g.account}}"
        else ctx = { g: g0 };
      } else if (root === 'm') { if (!groupsReachable) return; ctx = { m: m0 }; }
      else if (root === 'refDetail') ctx = { refDetail: ctxRef };
      else if (root === 'ui') ctx = { ui: uiWxs };
      else if (p.indexOf('r.meta.retireSchedule') === 0 && !scheduleReachable) return;
      else ctx = data;
      var rr = getp(ctx, p);
      if (!rr.ok) bad.push(p + ' [' + rr.reason + '] in: ' + expr.trim().slice(0, 50));
    });
  });
  if (!/wx:if="\{\{g\.account\}\}"/.test(wxml)) bad.push('g.account 空值守卫 wx:if 缺失');
  var nullGroups = data.monthlyGroups.filter(function (x) { return x.account === null; }).length;
  // 弹窗字段（policyRefs P01/P02/P04/P05/P10/P12 逐条）
  var REFS = require(path.join(ROOT, 'constants', 'policyRefs.js'));
  ['P01', 'P02', 'P04', 'P05', 'P10', 'P12'].forEach(function (k) {
    var rf = REFS[k];
    ['name', 'docNo', 'clause', 'effective', 'status', 'url'].forEach(function (f) {
      if (!rf || rf[f] === undefined) bad.push('REFS.' + k + '.' + f + ' 缺失');
    });
  });
  if (nullGroups) console.log('    (info: ' + name + ' 有 ' + nullGroups + ' 个年组 account=null，由 wx:if 守卫隐藏)');
  var uniq = Array.from(new Set(bad));
  totalBad += uniq.length;
  console.log('--- ' + name + '：' + (uniq.length ? '发现 ' + uniq.length + ' 处未解析绑定' : '全部绑定可解析，无 undefined'));
  uniq.forEach(function (b) { console.log('    ✗ ' + b); });
});

// ---- 专项：不计息场景 rate=null 时 rateText 必须是「不计息」而不是 undefined ----
(function () {
  var data = loadPage(Engine.calculate(sNone));
  var yr = data.vmYearly.find(function (a) { return a.year === 2020; });
  var okText = yr && yr.rateText === '不计息';
  var g = data.monthlyGroups.find(function (x) { return x.year === '2020'; });
  var okGroup = g && g.account && g.account.rateText === '不计息';
  console.log('--- 不计息 rateText：按年表=' + (okText ? '✓不计息' : '✗' + JSON.stringify(yr)) +
    '；折叠区=' + (okGroup ? '✓不计息' : '✗' + JSON.stringify(g && g.account)));
  if (!okText || !okGroup) totalBad++;
})();

// ---- 专项：手工账户余额 yearly=[] 时大表隐藏、groups.account=null 折叠区隐藏 ----
(function () {
  var data = loadPage(Engine.calculate(sManual));
  var hideYearly = data.vmYearly.length === 0; // wxml wx:if="{{vmYearly.length}}"
  var noAcct = data.monthlyGroups.every(function (g) { return g.account === null; });
  console.log('--- 手工余额：vmYearly=[](' + hideYearly + '，卡片隐藏)，groups.account 全 null(' + noAcct + '，折叠区利率块隐藏)');
  if (!hideYearly || !noAcct) totalBad++;
})();

process.exit(totalBad ? 1 : 0);
