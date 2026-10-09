// tests/case-validator-check.js
// E3 / TST-02-UT-1010~1014（REQ-02-VAL-000~006）node 断言。纯逻辑、不依赖 wx。
'use strict';
var path = require('path');
var fs = require('fs');
var CF = require(path.join(__dirname, '..', 'services', 'caseFile.js'));
var CV = require(path.join(__dirname, '..', 'services', 'caseValidator.js'));

var pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } }

var MY = fs.readFileSync(path.join(__dirname, 'fixtures-case', 'My-Case.md'), 'utf8');
var WIFE = fs.readFileSync(path.join(__dirname, 'fixtures-case', 'MyWife-Case.md'), 'utf8');

// 构造 parsed（复用 E2 解析器，保证与真实链一致）
var myParsed = CF.parseCaseFile(MY, 'compare');
var wifeParsed = CF.parseCaseFile(WIFE, 'compare');

// =====================================================================
// VAL-003/005：My common（compare）校验通过、可产出引擎输入
// =====================================================================
var v = CV.validate(myParsed, 'compare');
ok(v.ok, 'My compare 校验通过');
ok(v.canCalculate && v.engineInput, 'My 可计算、产出 engineInput');
ok(v.engineInput.birthYM === '1973-07', '生日->birthYM=1973-07');
ok(v.engineInput.accountBalanceManual === 672920, '账户金额映射=672920');
ok(v.engineInput.segments.length === 27, '27年缴费展开为27段');
ok(v.validFields.indexOf('records') >= 0 && v.validFields.indexOf('birthday') >= 0, 'validFields 含 records/birthday');
ok(v.invalidOrMissing.length === 0, '无错误项');
ok(/校验通过，共解析 27 条/.test(v.summary), 'summary 报告27条');
// compare 不要求 retireYM
ok(v.missingFields.indexOf('retireYM') < 0, 'compare 不把 retireYM 列为缺失');

var vw = CV.validate(wifeParsed, 'compare');
ok(vw.ok && vw.engineInput.segments.length === 23, 'Wife compare 通过、23段');
ok(vw.engineInput.birthYM === '1981-07', 'wife birthYM=1981-07');

// =====================================================================
// VAL-000（Q3）部分导入：正确字段直接回填 + 错误/缺失单列
// =====================================================================
var partialParsed = {
  fields: {
    birthday: '1976-09-08',
    workStartYM: '1995-07',
    accountStartYM: '2000-11',
    paidToYM: '2026-08',
    accountBalance: 100000,
    accountRate: 1.5
  },
  records: [
    { year: 2024, base: 100000, months: 12 },
    { year: 2025, base: 90000, months: 13 }   // 非法月数
  ],
  errors: []
};
var vp = CV.validate(partialParsed, 'basic');
ok(!vp.ok, '部分导入整体标记不通过');
// 正确字段仍在 validFields，可直接回填
ok(vp.validFields.indexOf('birthday') >= 0 && vp.validFields.indexOf('accountBalance') >= 0,
   'Q3 正确字段进入 validFields 可直接回填');
// 缺失 retireYM（basic）+ 非法月数 都被列出
ok(vp.missingFields.indexOf('retireYM') >= 0, 'Q3 缺 retireYM 列入 missingFields');
ok(vp.invalidOrMissing.some(function (e) { return /月数须在 1~12/.test(e.reason); }), 'Q3 非法月数列出');
ok(vp.invalidOrMissing.length >= 2, 'Q3 错误/缺失全部显示（≥2项）');
ok(/另有 \d+ 项待补充/.test(vp.summary), 'Q3 summary 提示待补充项数');

// =====================================================================
// 手工补齐后仍走同一套校验（VAL-000 尾句）：补齐 retireYM、修正月数 -> 通过
// =====================================================================
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
ok(vf.ok && vf.canCalculate, '手工补齐修正后同一套校验通过、可计算');
ok(vf.engineInput.retireYM === '2033-07', '补齐后 retireYM 进入 engineInput');

// =====================================================================
// VAL-001：空文件 / 读取错误
// =====================================================================
var emptyParsed = CF.parseCaseFile('', 'basic');
var ve = CV.validate(emptyParsed, 'basic');
ok(!ve.ok && ve.invalidOrMissing.some(function (e) { return /文件为空或不可读/.test(e.reason); }), '空文件报错、不可计算');
ok(ve.canCalculate === false, '空文件不可计算');

// =====================================================================
// VAL-002：语法行号错误透传（构造带行号的 parsed.errors）
// =====================================================================
var syntaxParsed = {
  fields: { birthday: '1976-01-01', paidToYM: '2026-08', retireYM: '2030-01' },
  records: [],
  errors: [{ line: 7, reason: '缴费表数值列非数字：x' }]
};
var vs = CV.validate(syntaxParsed, 'basic');
ok(vs.invalidOrMissing.some(function (e) { return e.line === 7 && /数值列非数字/.test(e.reason); }), '第7行语法错误带行号列出');

// =====================================================================
// VAL-004：非法值/范围（利率越界、Z越界、年份重复、负数基数、日期格式）
// =====================================================================
var badParsed = {
  fields: {
    birthday: '1976/09/08',        // 格式错
    paidToYM: '2026.08',           // 格式错
    retireYM: '2033-13',           // 月份非法
    accountRate: 50,               // 越界
    zValue: 0.3,                   // 越界
    contributionNature: '其它'      // 非二值
  },
  records: [
    { year: 2020, base: 10000, months: 12 },
    { year: 2020, base: 20000, months: 12 }, // 年份重复
    { year: 2021, base: -5, months: 12 }    // 基数负
  ],
  errors: []
};
var vb = CV.validate(badParsed, 'basic');
var reasons = vb.invalidOrMissing.map(function (e) { return e.reason; });
ok(reasons.some(function (r) { return /生日须为/.test(r); }), '生日格式错误');
ok(reasons.some(function (r) { return /养老保险目前交到须为/.test(r); }), 'paidTo 格式错误');
ok(reasons.some(function (r) { return /预计退休时间须为/.test(r); }), '退休月份非法');
ok(reasons.some(function (r) { return /利率超出合理范围/.test(r); }), '利率越界');
ok(reasons.some(function (r) { return /Z 值须在/.test(r); }), 'Z越界');
ok(reasons.some(function (r) { return /缴费性质须为/.test(r); }), '缴费性质非二值');
ok(reasons.some(function (r) { return /缴费年份重复/.test(r); }), '年份重复');
ok(reasons.some(function (r) { return /基数须大于 0/.test(r); }), '基数为负');

// =====================================================================
// VAL-005：业务交叉（时间先后）——文件通道不比手工宽松
// =====================================================================
var orderParsed = {
  fields: { birthday: '1976-01-01', paidToYM: '2020-01', retireYM: '2010-01' }, // 共享时点>退休
  records: [{ year: 2019, base: 10000, months: 12 }],
  errors: []
};
var vo = CV.validate(orderParsed, 'basic');
ok(vo.invalidOrMissing.some(function (e) { return /时间先后错误/.test(e.reason); }), '时间先后错误被交叉校验抓住');
ok(!vo.canCalculate, '时间先后错误不可计算');

// 视同起始晚于结束
var deemedParsed = {
  fields: {
    birthday: '1970-01-01', paidToYM: '2026-08', retireYM: '2030-01',
    deemedStartYM: '2000-10', deemedEndYM: '2000-01'
  },
  records: [], errors: []
};
var vd = CV.validate(deemedParsed, 'basic');
ok(vd.invalidOrMissing.some(function (e) { return /视同起始晚于结束/.test(e.reason); }), '视同起止颠倒报错');

// 无缴费且无账户金额 -> 最低数据要求
var noDataParsed = {
  fields: { birthday: '1976-01-01', paidToYM: '2026-08', retireYM: '2030-01' },
  records: [], errors: []
};
var vn = CV.validate(noDataParsed, 'basic');
ok(vn.invalidOrMissing.some(function (e) { return /请至少录入一段实际缴费基数/.test(e.reason); }), '无缴费无账户提示最低数据要求');

// 同口径：手工(buildInputLike) 与 文件 映射对同一数据一致
var same = CV.buildInputLike(CV.mapParsedToPageData(fixedParsed, {}));
ok(same.birthYM === '1976-09' && same.segments.length === 2 && same.retireYM === '2033-07',
   '文件映射经 buildInputLike 与手工同口径');

console.log('\ncase-validator-check: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
