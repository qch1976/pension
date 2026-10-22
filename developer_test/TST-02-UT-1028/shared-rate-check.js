// developer_test/TST-02-UT-1028/shared-rate-check.js
// TST-02-UT-1028（BUG-02-0005，REQ-02-CAL-001, REQ-02-VAL-004，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：共享区单一记账利率解析与透传（缺省1.5%，0，越界）；buildSharedInput 透传不写死 null；SHARED_KEYS 含字段。
'use strict';
var path = require('path');
var V = require(path.join(__dirname, '..', '..', 'calculator', 'inputValidator.js'));
var P = require(path.join(__dirname, '..', '..', 'constants', 'policyData.js'));
var D = require(path.join(__dirname, '..', '..', 'calculator', 'dateUtil.js'));
var PF = require(path.join(__dirname, '..', 'common', 'plan-factory.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1028');

A.approx(V.parseSharedRatePct('1.5').rate, 0.015, 1e-12, 'TST-02-UT-1028 1.5%→0.015');
A.ok(A && Math.abs(V.parseSharedRatePct('').rate - 0.015) < 1e-12 && V.parseSharedRatePct('').usedDefault === true,
  'TST-02-UT-1028 留空→缺省1.5%');
A.approx(V.parseSharedRatePct('0').rate, 0, 1e-12, 'TST-02-UT-1028 填0→0（不计息）');
A.throws(function () { V.parseSharedRatePct('25'); }, '0~20', 'TST-02-UT-1028 25%越界抛错');
// buildSharedInput 透传到引擎入参（不再写死 null）
var s15 = V.buildSharedInput(P, D, PF.pageData('1.5'), '2026-08');
var s0 = V.buildSharedInput(P, D, PF.pageData('0'), '2026-08');
var sBlank = V.buildSharedInput(P, D, PF.pageData(''), '2026-08');
A.approx(s15.futureMonthlyRate, 0.015, 1e-12, 'TST-02-UT-1028 共享入参带1.5%利率');
A.approx(s0.futureMonthlyRate, 0, 1e-12, 'TST-02-UT-1028 共享入参0利率');
A.approx(sBlank.futureMonthlyRate, 0.015, 1e-12, 'TST-02-UT-1028 留空缺省1.5%');
// SHARED_KEYS 含该字段，文件/common 缺省可 applyPrefill
A.ok(V.SHARED_KEYS.indexOf('futureMonthlyRatePct') !== -1, 'TST-02-UT-1028 SHARED_KEYS 含记账利率');
A.finish();
