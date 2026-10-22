// developer_test/TST-02-UT-1035/compare-pipeline-identity-check.js
// TST-02-UT-1035（BUG-02-0010，REQ-02-SCOPE-003/NFR-001，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：文件比较主链路身份合法出结果（分段④）+ 双保险兜底 enterprise（分段④b）。
'use strict';
var path = require('path');
var CF = require(path.join(__dirname, '..', '..', 'services', 'caseFile.js'));
var CV = require(path.join(__dirname, '..', '..', 'services', 'caseValidator.js'));
var V = require(path.join(__dirname, '..', '..', 'calculator', 'inputValidator.js'));
var Asm = require(path.join(__dirname, '..', '..', 'calculator', 'planAssembler.js'));
var Eng = require(path.join(__dirname, '..', '..', 'calculator', 'pensionEngine.js'));
var CRM = require(path.join(__dirname, '..', '..', 'calculator', 'compareResultModel.js'));
var P = require(path.join(__dirname, '..', '..', 'constants', 'policyData.js'));
var D = require(path.join(__dirname, '..', '..', 'calculator', 'dateUtil.js'));
var FIX = require(path.join(__dirname, '..', 'common', 'case-fixture.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1035');

var MY = FIX.loadMy();
var myParsed = CF.parseCaseFile(MY, 'compare');

// ---- 分段④：文件比较主链路 ----
(function () {
  var parsed = CF.parseCaseFile(MY, 'compare');
  var validation = CV.validate(parsed, 'compare', {});
  A.ok(validation.ok && validation.canCalculate, 'My validate ok & canCalculate');
  var shared = V.buildSharedInput(P, D, validation.pageData);
  A.ok(shared.segments.length === 27 && shared.segments.every(function (s) {
    return s.type === 'enterprise' || s.type === 'flexible';
  }), '共享入参 27 段身份全部合法（无 undefined）');

  var plans = [
    { id: 'a', retireYM: '2033-07', z: 0.6, segType: 'enterprise' },
    { id: 'b', retireYM: '2033-07', z: 3.0, segType: 'enterprise' }
  ];
  var engineErr = null;
  var pMonthlies = plans.map(function (pl) {
    var inp = Asm.assemblePlanInput(shared, pl);
    try { return Eng.calculate(inp).pension.total; } catch (e) { engineErr = e.message; return null; }
  });
  A.ok(engineErr === null, 'Engine.calculate 两方案均不抛「身份类型非法」');
  A.ok(isFinite(pMonthlies[0]) && isFinite(pMonthlies[1]) && pMonthlies[0] > 0 && pMonthlies[1] > 0, '两方案 P月均为正数');
  A.ok(pMonthlies[1] > pMonthlies[0], 'Z=3.0 方案 P月高于 Z=0.6');
  var view = CRM.buildViewSafe(shared, plans, 0);
  A.ok(view.ok && view.view.columns.length === 2, 'buildViewSafe 主链路产出 2 列');
})();

// ---- 分段④b：双保险兜底 enterprise ----
(function () {
  var shared = V.buildSharedInput(P, D, CV.mapParsedToPageData(myParsed, {}));
  shared.segments[5].type = undefined; // 模拟上游漏传
  var pl = { id: 'a', retireYM: '2033-07', z: 0.6, segType: 'enterprise' };
  var inp = Asm.assemblePlanInput(shared, pl);
  A.eq(inp.segments[5].type, 'enterprise', 'planAssembler 段身份缺失兜底 enterprise');
  var threw = false;
  try { Eng.calculate(inp); } catch (e) { threw = true; }
  A.ok(!threw, '兜底后引擎不因身份缺失抛错');
})();
A.finish();
