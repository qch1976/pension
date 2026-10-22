// developer_test/TST-02-UT-1008/casefile-basic-block-check.js
// TST-02-UT-1008（REQ-02-SCOPE-004，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：basic 单块合法、多块报错（IN-005）。
'use strict';
var path = require('path');
var CF = require(path.join(__dirname, '..', '..', 'services', 'caseFile.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1008');

// case-specific input：basic 单块合法数据
var single = '# 生日: 1976-09-08\n# 参加工作时间: 1995-07\n# 首次建立养老账号: 2000-11\n' +
  '# 养老保险目前交到: 2026-08\n# 个人账户金额: 100000\n# 个人账户利率: 1.5%\n' +
  '# 预计退休时间: 2033-07\n# 往后的缴费性质: 企业职工\n# 每月缴费Z值: 1.0\n' +
  '# 缴费记录\n| 年份 | 基数 | 月数 |\n| --- | --- | --- |\n| 2020 | 50000 | 12 |\n';
// case-specific input：basic 多数据块
var multi = '``` a ```\n# 生日: 1976-01-01\n``` b ```\n# 生日: 1977-01-01\n';

// expect output 断言
var bs = CF.parseCaseFile(single, 'basic');
A.ok(bs.ok, 'basic 单块解析通过');
A.ok(bs.records.length === 1 && bs.fields.retireYM === '2033-07', 'basic 含退休时间与1条记录');
A.ok(bs.fields.contributionNature === '企业职工' && bs.fields.zValue === 1, 'basic 差异字段作为常规字段保留');

// IN-005：basic 多数据块报错
var bm = CF.parseCaseFile(multi, 'basic');
A.ok(!bm.ok, 'basic 多块判定不通过');
A.ok(bm.errors.some(function (e) { return /一份文件只能包含一份数据/.test(e.reason); }), 'IN-005 报「一份文件只能包含一份数据」');
A.finish();
