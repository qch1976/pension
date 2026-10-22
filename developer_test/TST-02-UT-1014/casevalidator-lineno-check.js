// developer_test/TST-02-UT-1014/casevalidator-lineno-check.js
// TST-02-UT-1014（REQ-02-VAL-002, REQ-02-VAL-004, REQ-02-VAL-005，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：语法行号透传（parsed.errors 带行号 -> invalidOrMissing 带同一行号）。
'use strict';
var path = require('path');
var CV = require(path.join(__dirname, '..', '..', 'services', 'caseValidator.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1014');

// case-specific input：带行号语法错误的 parsed
var syntaxParsed = {
  fields: { birthday: '1976-01-01', paidToYM: '2026-08', retireYM: '2030-01' },
  records: [],
  errors: [{ line: 7, reason: '缴费表数值列非数字：x' }]
};

// expect output 断言
var vs = CV.validate(syntaxParsed, 'basic');
A.ok(vs.invalidOrMissing.some(function (e) { return e.line === 7 && /数值列非数字/.test(e.reason); }), '第7行语法错误带行号列出');
A.finish();
