// developer_test/TST-02-UT-1012/casefile-planblock-diff-check.js
// TST-02-UT-1012（REQ-02-IN-003，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：方案块差异字段识别忽略——retireYM/zValue 等差异项收集忽略并提示，common 不含差异字段。
'use strict';
var path = require('path');
var CF = require(path.join(__dirname, '..', '..', 'services', 'caseFile.js'));
var FIX = require(path.join(__dirname, '..', 'common', 'case-fixture.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1012');

// case-specific input：My compare（common + MY1/2/3 方案差异块）
var MY = FIX.loadMy();

// expect output 断言
var r = CF.parseCaseFile(MY, 'compare');
A.ok(r.ok, 'My compare 解析无错误');
// 方案差异项在各差异块中出现 -> 收集忽略 + 提示
A.ok(r.ignoredDiffFields.indexOf('retireYM') >= 0, '检测到差异字段 retireYM');
A.ok(r.ignoredDiffFields.indexOf('zValue') >= 0, '检测到差异字段 zValue');
A.ok(r.notices.some(function (n) { return /方案差异项以界面为准/.test(n.reason); }), '给出「方案差异项以界面为准」提示');
A.ok(r.planBlocks.length >= 3, '识别至少3个方案块');
// common 内不应有差异字段（它们只在差异块）
A.ok(r.fields.retireYM == null && r.fields.zValue == null, 'common 不含方案差异字段');
A.finish();
