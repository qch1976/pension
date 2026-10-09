// tests/case-file-check.js
// E2 / TST-02-UT-1005~1009（REQ-02-FMT-000/IN-005/VAL-001/002）node 断言。纯逻辑，不依赖 wx。
'use strict';
var path = require('path');
var fs = require('fs');
var CF = require(path.join(__dirname, '..', 'services', 'caseFile.js'));

var pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } }

var MY = fs.readFileSync(path.join(__dirname, 'fixtures-case', 'My-Case.md'), 'utf8');
var WIFE = fs.readFileSync(path.join(__dirname, 'fixtures-case', 'MyWife-Case.md'), 'utf8');

// ===================== My：compare（common + MY1/2/3）=====================
var r = CF.parseCaseFile(MY, 'compare');
ok(r.ok, 'My compare 解析无错误');
ok(r.fields.birthday === '1973-07-10', 'common 生日=1973-07-10');
ok(r.fields.workStartYM === '1995-07', 'common 参加工作=1995-07');
ok(r.fields.accountStartYM === '2000-11', 'common 建账=2000-11');
ok(r.fields.deemedStartYM === '1995-07' && r.fields.deemedEndYM === '2000-10', 'common 视同起止解析');
ok(r.fields.paidToYM === '2026-08', 'common 共享时点 paidTo=2026-08');
ok(r.fields.accountBalance === 672920, 'common 账户金额数值化=672920');
ok(r.fields.accountRate === 1.5, 'common 账户利率去%数值化=1.5');
ok(r.records.length === 27, 'common 缴费记录27条(2000-2026)');
ok(r.records[0].year === 2000 && r.records[0].base === 6142 && r.records[0].months === 2, '首条 2000/6142/2');
ok(r.records[26].year === 2026 && r.records[26].months === 8, '末条 2026/8月');
// 方案差异项在各差异块中出现 -> 收集忽略 + 提示
ok(r.ignoredDiffFields.indexOf('retireYM') >= 0, '检测到差异字段 retireYM');
ok(r.ignoredDiffFields.indexOf('zValue') >= 0, '检测到差异字段 zValue');
ok(r.notices.some(function (n) { return /方案差异项以界面为准/.test(n.reason); }), '给出「方案差异项以界面为准」提示');
ok(r.planBlocks.length >= 3, '识别至少3个方案块');
// common 内不应有差异字段（它们只在差异块）
ok(r.fields.retireYM == null && r.fields.zValue == null, 'common 不含方案差异字段');

// ===================== Wife：compare（common + MY4/5/6）=====================
var w = CF.parseCaseFile(WIFE, 'compare');
ok(w.ok, 'Wife compare 解析无错误');
ok(w.fields.birthday === '1981-07-02', 'wife 生日=1981-07-02');
ok(w.fields.accountStartYM === '2003-09', 'wife 建账=2003-09');
ok(w.fields.paidToYM === '2025-12', 'wife 共享时点=2025-12');
ok(w.fields.accountBalance === 481459 && w.fields.accountRate === 1.5, 'wife 账户金额/利率');
ok(w.records.length === 23, 'wife 缴费记录23条(2003-2025)');
ok(w.records[0].months === 4 && w.records[2].months === 7, 'wife 部分年2003=4月、2005=7月');
ok(w.ignoredDiffFields.indexOf('contributionNature') >= 0, 'wife 差异字段 缴费性质 检测');
// wife common 无视同字段
ok(w.fields.deemedStartYM == null, 'wife 无视同字段（允许缺省）');

// ===================== basic 正常：单块一份数据 =====================
var single = '# 生日: 1976-09-08\n# 参加工作时间: 1995-07\n# 首次建立养老账号: 2000-11\n' +
  '# 养老保险目前交到: 2026-08\n# 个人账户金额: 100000\n# 个人账户利率: 1.5%\n' +
  '# 预计退休时间: 2033-07\n# 往后的缴费性质: 企业职工\n# 每月缴费Z值: 1.0\n' +
  '# 缴费记录\n| 年份 | 基数 | 月数 |\n| --- | --- | --- |\n| 2020 | 50000 | 12 |\n';
var bs = CF.parseCaseFile(single, 'basic');
ok(bs.ok, 'basic 单块解析通过');
ok(bs.records.length === 1 && bs.fields.retireYM === '2033-07', 'basic 含退休时间与1条记录');
ok(bs.fields.contributionNature === '企业职工' && bs.fields.zValue === 1, 'basic 差异字段作为常规字段保留');

// ===================== REQ-02-IN-005：basic 多数据块报错 =====================
var multi = '``` a ```\n# 生日: 1976-01-01\n``` b ```\n# 生日: 1977-01-01\n';
var bm = CF.parseCaseFile(multi, 'basic');
ok(!bm.ok, 'basic 多块判定不通过');
ok(bm.errors.some(function (e) { return /一份文件只能包含一份数据/.test(e.reason); }), 'IN-005 报「一份文件只能包含一份数据」');

// ===================== VAL-001：空/不可读 =====================
ok(!CF.parseCaseFile('', 'basic').ok, '空文件不通过');
ok(CF.parseCaseFile('   \n\t', 'basic').errors[0].reason === '文件为空或不可读', '纯空白=文件为空或不可读');
ok(CF.parseCaseFile(null, 'compare').errors.length === 1, 'null 文件报错');

// ===================== VAL-002：行级语法错误定位到行 =====================
var bad = '# 生日: 1976-09-08\n# 某个不存在的字段: x\n# 参加工作时间:\n' +
  '| a | b |\n| 2020 | x | 12 |\n';
var be = CF.parseCaseFile(bad, 'basic');
ok(be.errors.some(function (e) { return e.line === 2 && /无法识别的头部字段/.test(e.reason); }), '第2行 无法识别字段');
ok(be.errors.some(function (e) { return e.line === 3 && /缺少值/.test(e.reason); }), '第3行 缺值');
ok(be.errors.some(function (e) { return e.line === 4 && /列数应为 3/.test(e.reason); }), '第4行 列数错误');
ok(be.errors.some(function (e) { return e.line === 5 && /数值列非数字/.test(e.reason); }), '第5行 非数字');

// compare 缺 common
var nc = CF.parseCaseFile('``` x ```\n# 生日: 1-1\n``` y ```\n# 生日: 2-2\n', 'compare');
ok(!nc.ok && nc.errors.some(function (e) { return /缺少共用数据块/.test(e.reason); }), 'compare 多块且无common报错');

console.log('\ncase-file-check: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
