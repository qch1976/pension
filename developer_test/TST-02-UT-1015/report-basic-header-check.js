// developer_test/TST-02-UT-1015/report-basic-header-check.js
// TST-02-UT-1015（REQ-02-OUT-004/Q4，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：基本报告头部——版本/生成时点/UTF-8 txt 标识/标题。
'use strict';
var path = require('path');
var Engine = require(path.join(__dirname, '..', '..', 'calculator', 'pensionEngine.js'));
var RE = require(path.join(__dirname, '..', '..', 'services', 'reportExport.js'));
var RF = require(path.join(__dirname, '..', 'common', 'report-factory.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1015');

// case-specific input
var result = Engine.calculate(RF.basicInput());
var basicText = RE.buildBasicReport(result, { generatedAt: RF.WHEN });

// expect output 断言
A.contains(basicText, 'PensionReport-v2.0', '1015 报告版本');
A.contains(basicText, '生成时点：' + RF.WHEN, '1015 生成时点');
A.contains(basicText, 'UTF-8', '1015 UTF-8 标识');
A.contains(basicText, '.txt', '1015 扩展名 txt');
A.contains(basicText, '基本计算', '1015 基本计算标题');
A.finish();
