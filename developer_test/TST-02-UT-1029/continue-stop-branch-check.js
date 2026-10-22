// developer_test/TST-02-UT-1029/continue-stop-branch-check.js
// TST-02-UT-1029（BUG-02-0005，REQ-02-CAL-001，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：继续/停保两情形接通——continue 含自动段透传共享利率；stop 无自动段且未来零利率。
'use strict';
var path = require('path');
var V = require(path.join(__dirname, '..', '..', 'calculator', 'inputValidator.js'));
var ROI = require(path.join(__dirname, '..', '..', 'calculator', 'roiModel.js'));
var P = require(path.join(__dirname, '..', '..', 'constants', 'policyData.js'));
var D = require(path.join(__dirname, '..', '..', 'calculator', 'dateUtil.js'));
var PF = require(path.join(__dirname, '..', 'common', 'plan-factory.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1029');

var shared = V.buildSharedInput(P, D, PF.pageData('1.5'), '2026-08');
var pl = PF.aPlan(1, '2033-07', '');
var cont = ROI.buildCaseInput(shared, pl, true);
var stop = ROI.buildCaseInput(shared, pl, false);
A.ok(cont.segments.some(function (s) { return s.startYM === '2026-09'; }),
  'TST-02-UT-1029 continue 含自动段');
A.approx(cont.futureMonthlyRate, 0.015, 1e-12, 'TST-02-UT-1029 continue 透传共享利率1.5%');
A.ok(!stop.segments.some(function (s) { return s.startYM >= '2026-09'; }),
  'TST-02-UT-1029 stop 无自动段');
A.ok(stop.futureMonthlyRate === null, 'TST-02-UT-1029 stop 未来零利率（静态基准）');
A.finish();
