// developer_test/TST-02-UT-1025/window-start-default-check.js
// TST-02-UT-1025（BUG-02-0004，REQ-02-CAL-000，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：缺省缴费起始月 = 实际缴费最后月 +1（动态，非写死）。
'use strict';
var path = require('path');
var V = require(path.join(__dirname, '..', '..', 'calculator', 'inputValidator.js'));
var Asm = require(path.join(__dirname, '..', '..', 'calculator', 'planAssembler.js'));
var P = require(path.join(__dirname, '..', '..', 'constants', 'policyData.js'));
var D = require(path.join(__dirname, '..', '..', 'calculator', 'dateUtil.js'));
var PF = require(path.join(__dirname, '..', 'common', 'plan-factory.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1025');

// case-specific input + expect 断言
var shared = V.buildSharedInput(P, D, PF.pageData('1.5', '2026-08'), '2026-08');
A.eq(Asm.defaultWindowStart(shared), '2026-09', 'TST-02-UT-1025 交到2026-08→缺省2026-09');
var pl = PF.aPlan(1, '2033-07', '');
A.eq(Asm.resolveWindowStart(pl, shared), '2026-09', 'TST-02-UT-1025 空 windowStartYM 取动态缺省');

// 历史末月不同 → 缺省随之变化（动态性证明）
var shared2 = V.buildSharedInput(P, D, PF.pageData('1.5', '2025-03'), '2026-08');
shared2.segments = [{ type: 'enterprise', startYM: '2000-01', endYM: '2025-03', baseMonthly: 10000 }];
A.eq(Asm.defaultWindowStart(shared2), '2025-04', 'TST-02-UT-1025 交到2025-03→缺省2025-04（动态）');
A.finish();
