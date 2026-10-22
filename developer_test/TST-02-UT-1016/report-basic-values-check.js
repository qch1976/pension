// developer_test/TST-02-UT-1016/report-basic-values-check.js
// TST-02-UT-1016（REQ-02-OUT-002，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：基本报告总额/三分项/中间变量与 Engine 结果逐值一致、两位小数。
'use strict';
var path = require('path');
var Engine = require(path.join(__dirname, '..', '..', 'calculator', 'pensionEngine.js'));
var RE = require(path.join(__dirname, '..', '..', 'services', 'reportExport.js'));
var RF = require(path.join(__dirname, '..', 'common', 'report-factory.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1016');

// case-specific input
var result = Engine.calculate(RF.basicInput());
var basicText = RE.buildBasicReport(result, { generatedAt: RF.WHEN });

// expect output 断言
var pn = result.pension, it = result.intermediates, f2 = RF.f2;
A.contains(basicText, '合计 P总：¥' + f2(pn.total), '1016 总额=' + f2(pn.total));
A.contains(basicText, 'J基础：¥' + f2(pn.J基础), '1016 J基础');
A.contains(basicText, 'J账户：¥' + f2(pn.J账户), '1016 J账户');
A.contains(basicText, 'J过渡：¥' + f2(pn.J过渡), '1016 J过渡');
A.contains(basicText, '计发月数 M：' + it.M, '1016 M');
A.contains(basicText, f2(it.C平), '1016 C平');
A.contains(basicText, 'Z实指数：' + it.Z实指数, '1016 Z实指数');
// 两位小数格式校验：报告里所有 ¥ 金额都是两位小数
var bad = 0;
basicText.split('\r\n').forEach(function (line) {
  var m = line.match(/¥\s?(-?\d+(\.\d+)?)/g);
  if (m) m.forEach(function (x) {
    var num = x.replace('¥', '').trim();
    if (!/^\d+\.\d{2}$/.test(num)) bad++;
  });
});
A.ok(bad === 0, '1016 全部金额两位小数（违规' + bad + '处）');
A.finish();
