// developer_test/TST-02-UT-1017/report-basic-account-check.js
// TST-02-UT-1017（REQ-02-OUT-002，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：基本报告 R储/R补/G同G实、按年表/年度指数与结果页值一致，【预估】角标。
'use strict';
var path = require('path');
var Engine = require(path.join(__dirname, '..', '..', 'calculator', 'pensionEngine.js'));
var RE = require(path.join(__dirname, '..', '..', 'services', 'reportExport.js'));
var RF = require(path.join(__dirname, '..', 'common', 'report-factory.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1017');

// case-specific input
var result = Engine.calculate(RF.basicInput());
var basicText = RE.buildBasicReport(result, { generatedAt: RF.WHEN });

// expect output 断言
var it = result.intermediates, acct = result.account, f2 = RF.f2;
A.contains(basicText, 'R储（个人账户累计储存额）：¥' + f2(it.R储), '1017 R储');
// 未来段月滚：记账利息带【预估】
var isFutureRoll = acct.manual && acct.yearly.some(function (a) { return a.rateSource === 'future-monthly'; });
if (isFutureRoll) {
  A.contains(basicText, '记账利息【预估】：¥' + f2(it.R储利息), '1017 利息【预估】');
}
A.contains(basicText, 'R补（Z补贴·虚拟计发额）：¥' + f2(it.R补), '1017 R补');
A.contains(basicText, 'G同：¥' + f2(it.G同), '1017 G同');
A.contains(basicText, 'G实：¥' + f2(it.G实), '1017 G实');
// 按年表取一条核对
var y0 = acct.yearly[0];
A.contains(basicText, String(y0.year), '1017 按年表年度');
A.contains(basicText, f2(y0.endBalance), '1017 年末余额');
// 年度指数取一条核对
var a0 = result.annualIndex.filter(function (a) { return a.zYear != null; })[0];
if (a0) {
  A.contains(basicText, 'Z年=' + a0.zYear.toFixed(4), '1017 Z年指数');
}
A.finish();
