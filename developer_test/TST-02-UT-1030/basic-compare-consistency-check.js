// developer_test/TST-02-UT-1030/basic-compare-consistency-check.js
// TST-02-UT-1030（BUG-02-0006/0007，REQ-02-CAL-001, REQ-02-NFR-001，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：basic 与 compare 同输入结果 ±0.001 一致（利率 0/1.5% × Z 0.6/3.0，R储/J账户/P月）。
'use strict';
var path = require('path');
var V = require(path.join(__dirname, '..', '..', 'calculator', 'inputValidator.js'));
var Asm = require(path.join(__dirname, '..', '..', 'calculator', 'planAssembler.js'));
var ROI = require(path.join(__dirname, '..', '..', 'calculator', 'roiModel.js'));
var Engine = require(path.join(__dirname, '..', '..', 'calculator', 'pensionEngine.js'));
var P = require(path.join(__dirname, '..', '..', 'constants', 'policyData.js'));
var D = require(path.join(__dirname, '..', '..', 'calculator', 'dateUtil.js'));
var PF = require(path.join(__dirname, '..', 'common', 'plan-factory.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1030');

[0, 1.5].forEach(function (ratePct) {
  [0.6, 3.0].forEach(function (z) {
    var shared = V.buildSharedInput(P, D, PF.pageData(String(ratePct)), '2026-08');
    var pl = PF.aPlan(z, '2033-07', '');
    var basic = Engine.calculate(Asm.assemblePlanInput(shared, pl));          // basic 路径
    var cmp = Engine.calculate(ROI.buildCaseInput(shared, pl, true));         // compare 路径
    var tag = 'rate' + ratePct + '% Z' + z;
    A.approx(basic.intermediates.R储, cmp.intermediates.R储, 0.001,
      'TST-02-UT-1030 R储一致 ' + tag + ' ' + basic.intermediates.R储 + '/' + cmp.intermediates.R储);
    A.approx(basic.pension.J账户, cmp.pension.J账户, 0.001,
      'TST-02-UT-1030 J账户一致 ' + tag + ' ' + basic.pension.J账户 + '/' + cmp.pension.J账户);
    A.approx(basic.pension.total, cmp.pension.total, 0.001,
      'TST-02-UT-1030 P月一致 ' + tag + ' ' + basic.pension.total + '/' + cmp.pension.total);
  });
});
A.finish();
