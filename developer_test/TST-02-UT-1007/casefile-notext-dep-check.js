// developer_test/TST-02-UT-1007/casefile-notext-dep-check.js
// TST-02-UT-1007（REQ-02-NFR-005，owner=developer）node 断言。
// case-specific：纯文本自解析、无三方依赖——caseFile.js 不 require 任何模块，parseCaseFile 直接可用。
'use strict';
var path = require('path');
var fs = require('fs');
var CF = require(path.join(__dirname, '..', '..', 'services', 'caseFile.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1007');

// case-specific input：caseFile.js 源码
var src = fs.readFileSync(path.join(__dirname, '..', '..', 'services', 'caseFile.js'), 'utf8');

// expect output 断言
// 1) 无 require( 任何模块（含 node 内置与三方）
A.ok(!/require\s*\(/.test(src), 'caseFile.js 无任何 require（纯文本自解析、无三方依赖）');
// 2) parseCaseFile 是导出函数且可直接对纯文本运行（无外部初始化）
A.ok(typeof CF.parseCaseFile === 'function', 'parseCaseFile 导出为函数');
var r = CF.parseCaseFile('# 生日: 1976-09-08\n# 参加工作时间: 1995-07\n', 'basic');
A.ok(r && typeof r === 'object' && r.mode === 'basic', '纯文本直接解析返回结构化结果');
A.finish();
