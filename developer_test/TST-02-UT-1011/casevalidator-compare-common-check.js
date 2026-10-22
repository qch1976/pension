// developer_test/TST-02-UT-1011/casevalidator-compare-common-check.js
// TST-02-UT-1011（REQ-02-IN-002, REQ-02-VAL-003，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：compare common 校验通过、可产出引擎输入（My/MyWife compare fixture）。
'use strict';
var path = require('path');
var CF = require(path.join(__dirname, '..', '..', 'services', 'caseFile.js'));
var CV = require(path.join(__dirname, '..', '..', 'services', 'caseValidator.js'));
var FIX = require(path.join(__dirname, '..', 'common', 'case-fixture.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1011');

// case-specific input：权威 compare 夹具
var myParsed = CF.parseCaseFile(FIX.loadMy(), 'compare');
var wifeParsed = CF.parseCaseFile(FIX.loadWife(), 'compare');

// expect output 断言
var v = CV.validate(myParsed, 'compare');
A.ok(v.ok, 'My compare 校验通过');
A.ok(v.canCalculate && v.engineInput, 'My 可计算、产出 engineInput');
A.eq(v.engineInput.birthYM, '1973-07', '生日->birthYM=1973-07');
A.eq(v.engineInput.accountBalanceManual, 672920, '账户金额映射=672920');
A.eq(v.engineInput.segments.length, 27, '27年缴费展开为27段');
A.ok(v.validFields.indexOf('records') >= 0 && v.validFields.indexOf('birthday') >= 0, 'validFields 含 records/birthday');
A.eq(v.invalidOrMissing.length, 0, '无错误项');
A.ok(/校验通过，共解析 27 条/.test(v.summary), 'summary 报告27条');
// compare 不要求 retireYM
A.ok(v.missingFields.indexOf('retireYM') < 0, 'compare 不把 retireYM 列为缺失');

var vw = CV.validate(wifeParsed, 'compare');
A.ok(vw.ok && vw.engineInput.segments.length === 23, 'Wife compare 通过、23段');
A.eq(vw.engineInput.birthYM, '1981-07', 'wife birthYM=1981-07');
A.finish();
