// developer_test/TST-02-UT-1031/compare-jz-spread-check.js
// TST-02-UT-1031（BUG-02-0007，REQ-02-CAL-001, REQ-02-NFR-001，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：compare 方案 J账随 Z(0.6→3.0) 显著拉开（>100，不再静态相同）。
'use strict';
var path = require('path');
var V = require(path.join(__dirname, '..', '..', 'calculator', 'inputValidator.js'));
var ROI = require(path.join(__dirname, '..', '..', 'calculator', 'roiModel.js'));
var Engine = require(path.join(__dirname, '..', '..', 'calculator', 'pensionEngine.js'));
var P = require(path.join(__dirname, '..', '..', 'constants', 'policyData.js'));
var D = require(path.join(__dirname, '..', '..', 'calculator', 'dateUtil.js'));
var PF = require(path.join(__dirname, '..', 'common', 'plan-factory.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1031');

[0, 1.5].forEach(function (ratePct) {
  var shared = V.buildSharedInput(P, D, PF.pageData(String(ratePct)), '2026-08');
  var j06 = Engine.calculate(ROI.buildCaseInput(shared, PF.aPlan(0.6, '2033-07', ''), true)).pension.J账户;
  var j30 = Engine.calculate(ROI.buildCaseInput(shared, PF.aPlan(3.0, '2033-07', ''), true)).pension.J账户;
  A.ok(j06 !== j30 && j30 > j06,
    'TST-02-UT-1031 rate' + ratePct + '% J账随Z拉开 J(0.6)=' + j06 + ' J(3.0)=' + j30);
  // 差距应显著（>100 元），证明滚动分支对 Z 敏感
  A.ok((j30 - j06) > 100, 'TST-02-UT-1031 rate' + ratePct + '% J账拉开>100：' + (j30 - j06).toFixed(2));
});
A.finish();
