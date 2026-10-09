// tests/report-export-check.js
// E5 node 断言（纯逻辑，不依赖 wx）：
//  TST-02-UT-1015 基本报告头部版本/生成时点/UTF-8 txt 标识（OUT-004/Q4）
//  TST-02-UT-1016 基本报告总额/三分项/中间变量与 Engine 结果逐值一致、两位小数（OUT-002）
//  TST-02-UT-1017 基本报告 R储/R补/G同G实、按年表/年度指数与结果页值一致，【预估】角标
//  TST-02-UT-1018 比较报告逐方案 P月/三分项/R续/回本/ROI 与 compareResultModel view 逐值一致
//  TST-02-UT-1019 比较报告【预估】角标由 estimated 决定、条形对比与 barP/barRoi 一致
// coverage skill md5: bf3d2c90733a4bb449ede785cd608226（owner=developer）
'use strict';
var Engine = require('../calculator/pensionEngine.js');
var CRM = require('../calculator/compareResultModel.js');
var RE = require('../services/reportExport.js');

var pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } }
function f2(n) { return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2); }
function contains(text, sub, n) { ok(text.indexOf(sub) !== -1, n + " :: 缺「" + sub + "」"); }

// ---- 构造基本计算 engine 输入（与 Phase-0 buildInput 形态一致） ----
function basicInput() {
  return {
    gender: 'male', femaleType: null, birthYM: '1976-09', workStartYM: '1998-08',
    retireYM: '2036-09',
    deemedStartYM: null, deemedEndYM: null,
    segments: [{ type: 'enterprise', startYM: '1998-08', endYM: '2026-08', baseMonthly: 12116 }],
    accountBalanceManual: 250000, accountBalanceManualYM: '2026-08', futureMonthlyRate: 0.015,
    baseYearOverride: 2025, cPingOverride: null, customCYear: {},
    doc31Eligible: false, doc31TransferYM: null, enterpriseInsuredYM: null,
    subsidyExcludedRanges: []
  };
}
var result = Engine.calculate(basicInput());
var WHEN = '2026-10-09 23:10:00';
var basicText = RE.buildBasicReport(result, { generatedAt: WHEN });

// TST-02-UT-1015 头部
(function () {
  contains(basicText, 'PensionReport-v2.0', '1015 报告版本');
  contains(basicText, '生成时点：' + WHEN, '1015 生成时点');
  contains(basicText, 'UTF-8', '1015 UTF-8 标识');
  contains(basicText, '.txt', '1015 扩展名 txt');
  contains(basicText, '基本计算', '1015 基本计算标题');
})();

// TST-02-UT-1016 总额/三分项逐值
(function () {
  var pn = result.pension, it = result.intermediates;
  contains(basicText, '合计 P总：¥' + f2(pn.total), '1016 总额=' + f2(pn.total));
  contains(basicText, 'J基础：¥' + f2(pn.J基础), '1016 J基础');
  contains(basicText, 'J账户：¥' + f2(pn.J账户), '1016 J账户');
  contains(basicText, 'J过渡：¥' + f2(pn.J过渡), '1016 J过渡');
  contains(basicText, '计发月数 M：' + it.M, '1016 M');
  contains(basicText, f2(it.C平), '1016 C平');
  contains(basicText, 'Z实指数：' + it.Z实指数, '1016 Z实指数');
  // 两位小数格式校验：报告里所有 ¥ 金额都是两位小数
  var bad = 0;
  basicText.split('\r\n').forEach(function (line) {
    var m = line.match(/¥\s?(-?\d+(\.\d+)?)/g);
    if (m) m.forEach(function (x) {
      var num = x.replace('¥', '').trim();
      if (!/^\d+\.\d{2}$/.test(num)) bad++;
    });
  });
  ok(bad === 0, '1016 全部金额两位小数（违规' + bad + '处）');
})();

// TST-02-UT-1017 R储/R补/按年/年度指数 + 【预估】
(function () {
  var it = result.intermediates, acct = result.account;
  contains(basicText, 'R储（个人账户累计储存额）：¥' + f2(it.R储), '1017 R储');
  // 未来段月滚：记账利息带【预估】
  var isFutureRoll = acct.manual && acct.yearly.some(function (a) { return a.rateSource === 'future-monthly'; });
  if (isFutureRoll) {
    contains(basicText, '记账利息【预估】：¥' + f2(it.R储利息), '1017 利息【预估】');
  }
  contains(basicText, 'R补（Z补贴·虚拟计发额）：¥' + f2(it.R补), '1017 R补');
  contains(basicText, 'G同：¥' + f2(it.G同), '1017 G同');
  contains(basicText, 'G实：¥' + f2(it.G实), '1017 G实');
  // 按年表取一条核对
  var y0 = acct.yearly[0];
  contains(basicText, String(y0.year), '1017 按年表年度');
  contains(basicText, f2(y0.endBalance), '1017 年末余额');
  // 年度指数取一条核对
  var a0 = result.annualIndex.filter(function (a) { return a.zYear != null; })[0];
  if (a0) {
    contains(basicText, 'Z年=' + a0.zYear.toFixed(4), '1017 Z年指数');
  }
})();

// ---- 构造比较 view（复用 compareResultModel 测试形态） ----
function sharedInput() {
  return {
    gender: 'male', femaleType: null, birthYM: '1976-09', workStartYM: '1998-08',
    retireYM: null, deemedStartYM: null, deemedEndYM: null,
    segments: [{ type: 'enterprise', startYM: '1998-08', endYM: '2026-08', baseMonthly: 12116 }],
    accountBalanceManual: 250000, accountBalanceManualYM: '2026-08', futureMonthlyRate: null,
    baseYearOverride: 2025, cPingOverride: null, customCYear: {},
    doc31Eligible: false, doc31TransferYM: null, enterpriseInsuredYM: null, subsidyExcludedRanges: []
  };
}
var plans = [
  { id: 'A', retireYM: '2026-12', z: '1.0', segType: 'enterprise' },
  { id: 'B', retireYM: '2033-09', z: '1.4', segType: 'enterprise' },
  { id: 'C', retireYM: '2031-09', z: '1.2', segType: 'flexible' }
];
var view = CRM.buildView(sharedInput(), plans, 0.06);
var cmpText = RE.buildCompareReport(view, { generatedAt: WHEN });

// TST-02-UT-1018 头部 + 逐方案逐值
(function () {
  contains(cmpText, 'PensionReport-v2.0', '1018 报告版本');
  contains(cmpText, '生成时点：' + WHEN, '1018 生成时点');
  contains(cmpText, '方案比较', '1018 标题');
  contains(cmpText, '6.00%', '1018 用户利率档');
  view.columns.forEach(function (c, i) {
    var tag = '方案' + (i + 1) + ' ';
    contains(cmpText, '退休年月：' + c.retireYM, tag + '退休');
    contains(cmpText, '缴费性质：' + c.segLabel, tag + '性质');
    contains(cmpText, 'Z（月缴费指数）：' + c.z, tag + 'Z');
    contains(cmpText, '缴费月数：' + c.contMonths + ' 月', tag + '月数');
    contains(cmpText, '月养老金 P月：¥' + f2(c.pMonthly), tag + 'P月');
    contains(cmpText, '基础 J基础：¥' + f2(c.jBasic), tag + 'J基础');
    contains(cmpText, '账户 J账户：¥' + f2(c.jAccount), tag + 'J账户');
    contains(cmpText, '过渡 J过渡：¥' + f2(c.jTransit), tag + 'J过渡');
    contains(cmpText, '继续缴费 R续：¥' + f2(c.rContinued), tag + 'R续');
    contains(cmpText, '月均 ¥' + f2(c.monthlyBurden), tag + '月均');
    contains(cmpText, '回本月数（0%）：' + c.pb0.text, tag + '回本0');
    contains(cmpText, 'ROI：' + c.roiText, tag + 'ROI');
  });
})();

// TST-02-UT-1019 【预估】角标由 estimated 决定 + 条形
(function () {
  view.columns.forEach(function (c, i) {
    var tag = '方案' + (i + 1) + ' ';
    if (c.estimated) {
      ok(cmpText.indexOf('【预估】') !== -1, tag + ' 有【预估】角标');
    }
  });
  // 方案1 退休 2026-12（止于2026-11）不应 estimated
  ok(view.columns[0].estimated === false, '1019 方案1 不预估');
  ok(view.columns[1].estimated === true && view.columns[2].estimated === true, '1019 方案2/3 预估');
  contains(cmpText, '月养老金 P月 对比', '1019 P月条形标题');
  contains(cmpText, 'ROI 对比', '1019 ROI条形标题');
  // 脚注口径
  contains(cmpText, 'OUT-002', '1019 角标口径脚注');
})();

console.log('report-export-check: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
