// developer_test/TST-02-UT-1018/report-compare-values-check.js
// TST-02-UT-1018（REQ-02-SCOPE-003, REQ-02-OUT-001，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：比较报告头部 + 逐方案 P月/三分项/R续/回本/ROI 与 compareResultModel view 逐值一致。
'use strict';
var path = require('path');
var CRM = require(path.join(__dirname, '..', '..', 'calculator', 'compareResultModel.js'));
var RE = require(path.join(__dirname, '..', '..', 'services', 'reportExport.js'));
var RF = require(path.join(__dirname, '..', 'common', 'report-factory.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1018');

// case-specific input
var view = CRM.buildView(RF.sharedInput(), RF.plans(), 0.06);
var cmpText = RE.buildCompareReport(view, { generatedAt: RF.WHEN });

// expect output 断言
var f2 = RF.f2;
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
A.finish();
