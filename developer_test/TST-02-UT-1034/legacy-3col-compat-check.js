// developer_test/TST-02-UT-1034/legacy-3col-compat-check.js
// TST-02-UT-1034（BUG-02-0010，REQ-02-FMT-000/NFR-004，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：旧3列文件向后兼容（分段③：起始月缺省1/身份缺省enterprise）+ 4列报清晰错误（分段③b）。
'use strict';
var path = require('path');
var CF = require(path.join(__dirname, '..', '..', 'services', 'caseFile.js'));
var CV = require(path.join(__dirname, '..', '..', 'services', 'caseValidator.js'));
var V = require(path.join(__dirname, '..', '..', 'calculator', 'inputValidator.js'));
var P = require(path.join(__dirname, '..', '..', 'constants', 'policyData.js'));
var D = require(path.join(__dirname, '..', '..', 'calculator', 'dateUtil.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1034');

// ---- 分段③：旧 3 列向后兼容 ----
var old3 = [
  '``` My case: common ```', '# 生日: 1973-07', '# 养老保险目前交到: 2026-08', '# 缴费记录',
  '| 年份 | 养老缴纳基数(年) | 年内缴纳月数 |',
  '| 2000 | 6142 | 2 |', '| 2001 | 41328 | 12 |', '``` end ```'
].join('\n');
var oldParsed = CF.parseCaseFile(old3, 'compare');
A.ok(oldParsed.ok, '旧3列文件解析不报错');
A.eq(oldParsed.records[0].startMonth, 1, '旧3列起始月缺省=1');
A.eq(oldParsed.records[0].type, 'enterprise', '旧3列身份缺省=enterprise');
var oldSegs = V.buildSharedInput(P, D, CV.mapParsedToPageData(oldParsed, {})).segments;
A.eq(oldSegs[0].startYM, '2000-01', '旧3列 2000 段仍起 2000-01（兼容旧语义）');
A.eq(oldSegs[0].endYM, '2000-02', '旧3列 2000 k2 止 2000-02');
A.eq(oldSegs[0].type, 'enterprise', '旧3列段身份 enterprise');

// ---- 分段③b：列数既非3也非5 报清晰错误 ----
var badColsFile = [
  '``` My case: common ```', '# 生日: 2000-01', '# 养老保险目前交到: 2026-08', '# 缴费记录',
  '| 年份 | 养老缴纳基数(年) | 年内缴纳月数 | 备注 |',
  '| 2020 | 12000 | 12 | x |', '``` end ```'
].join('\n');
var badColsParsed = CF.parseCaseFile(badColsFile, 'compare');
A.ok(!badColsParsed.ok && badColsParsed.errors.some(function (e) { return /列数应为 3 或 5/.test(e.reason); }), '4列报「应为3或5」清晰错误');
A.finish();
