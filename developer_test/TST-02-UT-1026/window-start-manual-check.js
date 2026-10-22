// developer_test/TST-02-UT-1026/window-start-manual-check.js
// TST-02-UT-1026（BUG-02-0004，REQ-02-CAL-000，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：方案卡可手动编辑起始月并贯穿到自动段首月、止于退休前一月。
'use strict';
var path = require('path');
var V = require(path.join(__dirname, '..', '..', 'calculator', 'inputValidator.js'));
var Asm = require(path.join(__dirname, '..', '..', 'calculator', 'planAssembler.js'));
var P = require(path.join(__dirname, '..', '..', 'constants', 'policyData.js'));
var D = require(path.join(__dirname, '..', '..', 'calculator', 'dateUtil.js'));
var PF = require(path.join(__dirname, '..', 'common', 'plan-factory.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1026');

var shared = V.buildSharedInput(P, D, PF.pageData('1.5'), '2026-08');
var pl = PF.aPlan(1, '2033-07', '2028-03');
A.eq(Asm.resolveWindowStart(pl, shared), '2028-03', 'TST-02-UT-1026 手改值优先');
var inp = Asm.assemblePlanInput(shared, pl);
var auto = inp.segments.filter(function (s) { return s.startYM >= '2026-09'; });
A.ok(auto.length > 0 && auto[0].startYM === '2028-03', 'TST-02-UT-1026 自动段首月=2028-03');
// 自动段末月=退休前一月
var last = auto[auto.length - 1];
A.eq(last.endYM, '2033-06', 'TST-02-UT-1026 自动段止于退休前一月2033-06');
A.finish();
