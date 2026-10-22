// developer_test/TST-02-UT-1018/report-export-all-check.js
// TST-02-UT-1018（REQ-02-SCOPE-003, REQ-02-OUT-001/002/004, owner=developer）node 断言，纯逻辑不依赖 wx。
// 口径①（Manager 裁定 2026-10-23）：report-export 组矩阵仅 1018 一行，吸收源脚本 1015/1016/1017/1018/1019 五组断言。
// case-specific 分段：基本报告头部(1015) / 基本报告数值(1016) / 基本报告账户(1017) / 比较报告逐值(1018) / 比较报告【预估】(1019)。
'use strict';
var path = require('path');
var Engine = require(path.join(__dirname, '..', '..', 'calculator', 'pensionEngine.js'));
var CRM = require(path.join(__dirname, '..', '..', 'calculator', 'compareResultModel.js'));
var RE = require(path.join(__dirname, '..', '..', 'services', 'reportExport.js'));
var RF = require(path.join(__dirname, '..', 'common', 'report-factory.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1018');
var f2 = RF.f2;

// ========== 分段① 基本报告（1015/1016/1017）：Engine.calculate 链路 ==========
var result = Engine.calculate(RF.basicInput());
var basicText = RE.buildBasicReport(result, { generatedAt: RF.WHEN });

// —— 1015 基本报告头部 ——
A.contains(basicText, 'PensionReport-v2.0', '1015 报告版本');
A.contains(basicText, '生成时点：' + RF.WHEN, '1015 生成时点');
A.contains(basicText, 'UTF-8', '1015 UTF-8 标识');
A.contains(basicText, '.txt', '1015 扩展名 txt');
A.contains(basicText, '基本计算', '1015 基本计算标题');

// —— 1016 基本报告数值 ——
var pn = result.pension, it = result.intermediates;
A.contains(basicText, '合计 P总：¥' + f2(pn.total), '1016 总额=' + f2(pn.total));
A.contains(basicText, 'J基础：¥' + f2(pn.J基础), '1016 J基础');
A.contains(basicText, 'J账户：¥' + f2(pn.J账户), '1016 J账户');
A.contains(basicText, 'J过渡：¥' + f2(pn.J过渡), '1016 J过渡');
A.contains(basicText, '计发月数 M：' + it.M, '1016 M');
A.contains(basicText, f2(it.C平), '1016 C平');
A.contains(basicText, 'Z实指数：' + it.Z实指数, '1016 Z实指数');
var bad = 0;
basicText.split('\r\n').forEach(function (line) {
  var m = line.match(/¥\s?(-?\d+(\.\d+)?)/g);
  if (m) m.forEach(function (x) {
    var num = x.replace('¥', '').trim();
    if (!/^\d+\.\d{2}$/.test(num)) bad++;
  });
});
A.ok(bad === 0, '1016 全部金额两位小数（违规' + bad + '处）');

// —— 1017 基本报告账户 ——
var acct = result.account;
A.contains(basicText, 'R储（个人账户累计储存额）：¥' + f2(it.R储), '1017 R储');
var isFutureRoll = acct.manual && acct.yearly.some(function (a) { return a.rateSource === 'future-monthly'; });
if (isFutureRoll) {
  A.contains(basicText, '记账利息【预估】：¥' + f2(it.R储利息), '1017 利息【预估】');
}
A.contains(basicText, 'R补（Z补贴·虚拟计发额）：¥' + f2(it.R补), '1017 R补');
A.contains(basicText, 'G同：¥' + f2(it.G同), '1017 G同');
A.contains(basicText, 'G实：¥' + f2(it.G实), '1017 G实');
var y0 = acct.yearly[0];
A.contains(basicText, String(y0.year), '1017 按年表年度');
A.contains(basicText, f2(y0.endBalance), '1017 年末余额');
var a0 = result.annualIndex.filter(function (a) { return a.zYear != null; })[0];
if (a0) {
  A.contains(basicText, 'Z年=' + a0.zYear.toFixed(4), '1017 Z年指数');
}

// ========== 分段② 比较报告（1018/1019）：CRM.buildView 链路 ==========
var view = CRM.buildView(RF.sharedInput(), RF.plans(), 0.06);
var cmpText = RE.buildCompareReport(view, { generatedAt: RF.WHEN });

// —— 1018 比较报告逐值 ——
A.contains(cmpText, 'PensionReport-v2.0', '1018 报告版本');
A.contains(cmpText, '生成时点：' + RF.WHEN, '1018 生成时点');
A.contains(cmpText, '方案比较', '1018 标题');
A.contains(cmpText, '6.00%', '1018 用户利率档');
view.columns.forEach(function (c, i) {
  var tag = '方案' + (i + 1) + ' ';
  A.contains(cmpText, '退休年月：' + c.retireYM, tag + '退休');
  A.contains(cmpText, '缴费性质：' + c.segLabel, tag + '性质');
  A.contains(cmpText, 'Z（月缴费指数）：' + c.z, tag + 'Z');
  A.contains(cmpText, '缴费月数：' + c.contMonths + ' 月', tag + '月数');
  A.contains(cmpText, '月养老金 P月：¥' + f2(c.pMonthly), tag + 'P月');
  A.contains(cmpText, '基础 J基础：¥' + f2(c.jBasic), tag + 'J基础');
  A.contains(cmpText, '账户 J账户：¥' + f2(c.jAccount), tag + 'J账户');
  A.contains(cmpText, '过渡 J过渡：¥' + f2(c.jTransit), tag + 'J过渡');
  A.contains(cmpText, '继续缴费 R续：¥' + f2(c.rContinued), tag + 'R续');
  A.contains(cmpText, '月均 ¥' + f2(c.monthlyBurden), tag + '月均');
  A.contains(cmpText, '回本月数（0%）：' + c.pb0.text, tag + '回本0');
  A.contains(cmpText, 'ROI：' + c.roiText, tag + 'ROI');
});

// —— 1019 比较报告【预估】 ——
view.columns.forEach(function (c, i) {
  var tag = '方案' + (i + 1) + ' ';
  if (c.estimated) {
    A.ok(cmpText.indexOf('【预估】') !== -1, tag + ' 有【预估】角标');
  }
});
A.ok(view.columns[0].estimated === false, '1019 方案1 不预估');
A.ok(view.columns[1].estimated === true && view.columns[2].estimated === true, '1019 方案2/3 预估');
A.contains(cmpText, '月养老金 P月 对比', '1019 P月条形标题');
A.contains(cmpText, 'ROI 对比', '1019 ROI条形标题');
A.contains(cmpText, 'OUT-002', '1019 角标口径脚注');

A.finish();
