// developer_test/TST-02-UT-1010/casevalidator-partial-import-check.js
// TST-02-UT-1010（REQ-02-VAL-000，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：Q3 部分导入——正确字段直接回填 + 错误/缺失单列；手工补齐后同一套校验通过。
'use strict';
var path = require('path');
var CV = require(path.join(__dirname, '..', '..', 'services', 'caseValidator.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1010');

// case-specific input：部分导入 parsed（缺 retireYM + 一条非法月数）
var partialParsed = {
  fields: {
    birthday: '1976-09-08', workStartYM: '1995-07', accountStartYM: '2000-11',
    paidToYM: '2026-08', accountBalance: 100000, accountRate: 1.5
  },
  records: [
    { year: 2024, base: 100000, months: 12 },
    { year: 2025, base: 90000, months: 13 }   // 非法月数
  ],
  errors: []
};

// expect output 断言
var vp = CV.validate(partialParsed, 'basic');
A.ok(!vp.ok, '部分导入整体标记不通过');
// 正确字段仍在 validFields，可直接回填
A.ok(vp.validFields.indexOf('birthday') >= 0 && vp.validFields.indexOf('accountBalance') >= 0,
   'Q3 正确字段进入 validFields 可直接回填');
// 缺失 retireYM（basic）+ 非法月数 都被列出
A.ok(vp.missingFields.indexOf('retireYM') >= 0, 'Q3 缺 retireYM 列入 missingFields');
A.ok(vp.invalidOrMissing.some(function (e) { return /月数须在 1~12/.test(e.reason); }), 'Q3 非法月数列出');
A.ok(vp.invalidOrMissing.length >= 2, 'Q3 错误/缺失全部显示（≥2项）');
A.ok(/另有 \d+ 项待补充/.test(vp.summary), 'Q3 summary 提示待补充项数');

// 手工补齐后仍走同一套校验（VAL-000 尾句）
var fixedParsed = {
  fields: {
    birthday: '1976-09-08', workStartYM: '1995-07', accountStartYM: '2000-11',
    paidToYM: '2026-08', retireYM: '2033-07', accountBalance: 100000, accountRate: 1.5
  },
  records: [
    { year: 2024, base: 100000, months: 12 },
    { year: 2025, base: 90000, months: 12 }
  ],
  errors: []
};
var vf = CV.validate(fixedParsed, 'basic');
A.ok(vf.ok && vf.canCalculate, '手工补齐修正后同一套校验通过、可计算');
A.ok(vf.engineInput.retireYM === '2033-07', '补齐后 retireYM 进入 engineInput');
A.finish();
