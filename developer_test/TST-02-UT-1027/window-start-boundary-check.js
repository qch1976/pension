// developer_test/TST-02-UT-1027/window-start-boundary-check.js
// TST-02-UT-1027（BUG-02-0004，REQ-02-CAL-000, REQ-02-VAL-004，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：起始月越界校验（介于历史末月与退休前一月），留空合法。
'use strict';
var path = require('path');
var V = require(path.join(__dirname, '..', '..', 'calculator', 'inputValidator.js'));
var Asm = require(path.join(__dirname, '..', '..', 'calculator', 'planAssembler.js'));
var PM = require(path.join(__dirname, '..', '..', 'calculator', 'planModel.js'));
var P = require(path.join(__dirname, '..', '..', 'constants', 'policyData.js'));
var D = require(path.join(__dirname, '..', '..', 'calculator', 'dateUtil.js'));
var PF = require(path.join(__dirname, '..', 'common', 'plan-factory.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1027');

var shared = V.buildSharedInput(P, D, PF.pageData('1.5'), '2026-08');
var ctx = { gender: 'male', birthYM: '1976-09', historyEndYM: '2026-08' };
// 早于历史末月
var early = PF.aPlan(1, '2033-07', '2025-01');
try { Asm.assemblePlanInput(shared, early); A.ok(false, 'TST-02-UT-1027 早于历史末月应抛错'); }
catch (e) { A.ok(/早于最后缴费月/.test(e.message), 'TST-02-UT-1027 早于历史末月抛错: ' + e.message); }
// 晚于退休前一月
var late = PF.aPlan(1, '2027-02', '2028-01');
try { Asm.assemblePlanInput(shared, late); A.ok(false, 'TST-02-UT-1027 晚于退休前一月应抛错'); }
catch (e) { A.ok(/不得晚于退休前一月/.test(e.message), 'TST-02-UT-1027 晚于退休前一月抛错: ' + e.message); }
// planModel 纯函数层
A.ok(/早于最后缴费月/.test(PM.validateWindowStartYM('2025-01', ctx, '2033-07', D) || ''),
  'TST-02-UT-1027 planModel 早界');
A.ok(/不得晚于退休前一月/.test(PM.validateWindowStartYM('2040-01', ctx, '2033-07', D) || ''),
  'TST-02-UT-1027 planModel 晚界');
A.ok(PM.validateWindowStartYM('', ctx, '2033-07', D) === null, 'TST-02-UT-1027 留空合法（取缺省）');
A.eq(PM.defaultWindowStartYM(ctx, D), '2026-09', 'TST-02-UT-1027 planModel 缺省=末月+1');
A.finish();
