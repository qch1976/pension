// developer_test/TST-02-UT-1013/casevalidator-empty-file-check.js
// TST-02-UT-1013（REQ-02-VAL-001，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：空文件/读取错误不可计算（canCalculate=false 且列出「文件为空或不可读」）。
'use strict';
var path = require('path');
var CF = require(path.join(__dirname, '..', '..', 'services', 'caseFile.js'));
var CV = require(path.join(__dirname, '..', '..', 'services', 'caseValidator.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1013');

// case-specific input：空文件
var emptyParsed = CF.parseCaseFile('', 'basic');

// expect output 断言
var ve = CV.validate(emptyParsed, 'basic');
A.ok(!ve.ok && ve.invalidOrMissing.some(function (e) { return /文件为空或不可读/.test(e.reason); }), '空文件报错、不可计算');
A.ok(ve.canCalculate === false, '空文件不可计算');
A.finish();
