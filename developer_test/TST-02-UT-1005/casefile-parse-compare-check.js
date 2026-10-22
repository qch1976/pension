// developer_test/TST-02-UT-1005/casefile-parse-compare-check.js
// TST-02-UT-1005（REQ-02-FMT-000，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：compare fixture（#头部+三列表）解析通过——My（common+MY1/2/3）与 MyWife（common+MY4/5/6）。
'use strict';
var path = require('path');
var CF = require(path.join(__dirname, '..', '..', 'services', 'caseFile.js'));
var FIX = require(path.join(__dirname, '..', 'common', 'case-fixture.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1005');

// case-specific input：权威 compare 夹具
var MY = FIX.loadMy();
var WIFE = FIX.loadWife();

// ---- My：compare（common + MY1/2/3）----
var r = CF.parseCaseFile(MY, 'compare');
A.ok(r.ok, 'My compare 解析无错误');
A.eq(r.fields.birthday, '1973-07-10', 'common 生日=1973-07-10');
A.eq(r.fields.workStartYM, '1995-07', 'common 参加工作=1995-07');
A.eq(r.fields.accountStartYM, '2000-11', 'common 建账=2000-11');
A.ok(r.fields.deemedStartYM === '1995-07' && r.fields.deemedEndYM === '2000-10', 'common 视同起止解析');
A.eq(r.fields.paidToYM, '2026-08', 'common 共享时点 paidTo=2026-08');
A.eq(r.fields.accountBalance, 672920, 'common 账户金额数值化=672920');
A.eq(r.fields.accountRate, 1.5, 'common 账户利率去%数值化=1.5');
A.eq(r.records.length, 27, 'common 缴费记录27条(2000-2026)');
A.ok(r.records[0].year === 2000 && r.records[0].base === 6142 && r.records[0].months === 2, '首条 2000/6142/2');
A.ok(r.records[26].year === 2026 && r.records[26].months === 8, '末条 2026/8月');

// ---- Wife：compare（common + MY4/5/6）----
var w = CF.parseCaseFile(WIFE, 'compare');
A.ok(w.ok, 'Wife compare 解析无错误');
A.eq(w.fields.birthday, '1981-07-02', 'wife 生日=1981-07-02');
A.eq(w.fields.accountStartYM, '2003-09', 'wife 建账=2003-09');
A.eq(w.fields.paidToYM, '2025-12', 'wife 共享时点=2025-12');
A.ok(w.fields.accountBalance === 481459 && w.fields.accountRate === 1.5, 'wife 账户金额/利率');
A.eq(w.records.length, 23, 'wife 缴费记录23条(2003-2025)');
A.ok(w.records[0].months === 4 && w.records[2].months === 7, 'wife 部分年2003=4月、2005=7月');
A.ok(w.fields.deemedStartYM == null, 'wife 无视同字段（允许缺省）');

A.finish();
