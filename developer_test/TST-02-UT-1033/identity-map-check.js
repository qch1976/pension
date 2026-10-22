// developer_test/TST-02-UT-1033/identity-map-check.js
// TST-02-UT-1033（BUG-02-0010，REQ-02-IN-003/VAL-004，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：中文缴费身份→引擎枚举唯一映射（分段②+2b+2c）。
'use strict';
var path = require('path');
var CF = require(path.join(__dirname, '..', '..', 'services', 'caseFile.js'));
var CV = require(path.join(__dirname, '..', '..', 'services', 'caseValidator.js'));
var V = require(path.join(__dirname, '..', '..', 'calculator', 'inputValidator.js'));
var P = require(path.join(__dirname, '..', '..', 'constants', 'policyData.js'));
var D = require(path.join(__dirname, '..', '..', 'calculator', 'dateUtil.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1033');

// ---- 唯一函数 mapIdentityToType ----
[['单位', 'enterprise'], ['企业职工', 'enterprise'], ['企业', 'enterprise'],
 ['灵活', 'flexible'], ['灵活就业', 'flexible'], ['失业灵活就业', 'flexible'],
 ['enterprise', 'enterprise'], ['flexible', 'flexible']].forEach(function (pair) {
  A.eq(CF.mapIdentityToType(pair[0]), pair[1], '身份映射 ' + pair[0] + ' -> ' + pair[1]);
});
A.eq(CF.mapIdentityToType('个体户'), null, '非法身份「个体户」→null');
A.eq(CF.mapIdentityToType(''), null, '空身份 →null');
A.eq(CF.mapIdentityToType(null), null, 'null 身份 →null');

// ---- 2b) 文件内灵活身份 5列行级 ----
var flexFile = [
  '``` My case: common ```', '# 生日: 2000-01', '# 养老保险目前交到: 2026-08', '# 缴费记录',
  '| 年份 | 养老缴纳基数(年) | 年内起始月份(1~12) | 年内缴纳月数 | 缴费身份 |',
  '| 2020 | 12000 | 1 | 12 | 灵活就业 |',
  '| 2021 | 12000 | 1 | 6 | 失业灵活就业 |', '``` end ```'
].join('\n');
var flexParsed = CF.parseCaseFile(flexFile, 'compare');
A.ok(flexParsed.ok, '灵活身份文件解析通过');
A.eq(flexParsed.records[0].type, 'flexible', '灵活就业→flexible（record）');
A.eq(flexParsed.records[1].type, 'flexible', '失业灵活就业→flexible（record）');
var flexSegs = V.buildSharedInput(P, D, CV.mapParsedToPageData(flexParsed, {})).segments;
A.ok(flexSegs.every(function (s) { return s.type === 'flexible'; }), '灵活身份透传到历史段 type=flexible');

// ---- 非法身份行级报错 ----
var badIdFile = [
  '``` My case: common ```', '# 生日: 2000-01', '# 养老保险目前交到: 2026-08', '# 缴费记录',
  '| 年份 | 养老缴纳基数(年) | 年内起始月份(1~12) | 年内缴纳月数 | 缴费身份 |',
  '| 2020 | 12000 | 1 | 12 | 个体户 |', '``` end ```'
].join('\n');
var badIdParsed = CF.parseCaseFile(badIdFile, 'compare');
A.ok(!badIdParsed.ok && badIdParsed.errors.some(function (e) { return /缴费身份无法识别/.test(e.reason); }), '非法身份报清晰错误');

// ---- 2c) 起始月越界 ----
var badMonthFile = [
  '``` My case: common ```', '# 生日: 2000-01', '# 养老保险目前交到: 2026-08', '# 缴费记录',
  '| 年份 | 养老缴纳基数(年) | 年内起始月份(1~12) | 年内缴纳月数 | 缴费身份 |',
  '| 2020 | 12000 | 13 | 1 | 单位 |', '``` end ```'
].join('\n');
var badMonthParsed = CF.parseCaseFile(badMonthFile, 'compare');
A.ok(!badMonthParsed.ok && badMonthParsed.errors.some(function (e) { return /起始月份须为 1~12/.test(e.reason); }), '起始月13越界报错');
A.finish();
