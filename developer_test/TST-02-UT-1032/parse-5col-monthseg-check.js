// developer_test/TST-02-UT-1032/parse-5col-monthseg-check.js
// TST-02-UT-1032（BUG-02-0010，REQ-02-IN-003/FMT-000/VAL-004，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：5列解析+年内起始月/身份透传（分段①）+ 月段展开起止（分段①b）。
'use strict';
var path = require('path');
var CF = require(path.join(__dirname, '..', '..', 'services', 'caseFile.js'));
var CV = require(path.join(__dirname, '..', '..', 'services', 'caseValidator.js'));
var V = require(path.join(__dirname, '..', '..', 'calculator', 'inputValidator.js'));
var P = require(path.join(__dirname, '..', '..', 'constants', 'policyData.js'));
var D = require(path.join(__dirname, '..', '..', 'calculator', 'dateUtil.js'));
var FIX = require(path.join(__dirname, '..', 'common', 'case-fixture.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1032');

function segByStart(segs, ym) { return segs.filter(function (s) { return s.startYM === ym; })[0]; }

// ---- 分段①：5 列解析 + 起始月/身份透传 ----
var myParsed = CF.parseCaseFile(FIX.loadMy(), 'compare');
A.ok(myParsed.ok, 'My-Case 5列解析无错误');
A.eq(myParsed.records.length, 27, 'My-Case 解析 27 个年度行');
var my0 = myParsed.records[0];
A.eq(my0.year, 2000, 'My 首行年份 2000');
A.eq(my0.startMonth, 11, 'My 2000 起始月=11');
A.eq(my0.months, 2, 'My 2000 年内月数=2');
A.eq(my0.type, 'enterprise', 'My 2000 身份 单位→enterprise');
A.ok(myParsed.records.every(function (r) { return r.type === 'enterprise'; }), 'My 历史身份列全为「单位」→enterprise');

var wifeParsed = CF.parseCaseFile(FIX.loadWife(), 'compare');
A.ok(wifeParsed.ok, 'MyWife 5列解析无错误');
var wifeByYear = {};
wifeParsed.records.forEach(function (r) { wifeByYear[r.year] = r; });
A.eq(wifeByYear[2003].startMonth, 9, 'Wife 2003 起始月=9');
A.eq(wifeByYear[2003].months, 4, 'Wife 2003 月数=4');
A.eq(wifeByYear[2005].startMonth, 1, 'Wife 2005 起始月=1');
A.eq(wifeByYear[2005].months, 7, 'Wife 2005 月数=7');
A.eq(wifeByYear[2006].startMonth, 4, 'Wife 2006 起始月=4');
A.eq(wifeByYear[2006].months, 9, 'Wife 2006 月数=9');

// ---- 分段①b：月段展开（mapParsedToPageData -> buildSharedInput -> 段起止） ----
var myPage = CV.mapParsedToPageData(myParsed, {});
var myRowsByYear = {};
myPage.yearRows.forEach(function (r) { myRowsByYear[r.year] = r; });
A.eq(myRowsByYear['2000'].startMonth, '11', 'yearRows 透传 My 2000 startMonth=11');
A.eq(myRowsByYear['2000'].type, 'enterprise', 'yearRows 透传 My 2000 type=enterprise');
var myShared = V.buildSharedInput(P, D, myPage);
A.eq(myShared.segments.length, 27, 'My 展开 27 个历史段');
A.eq(myShared.segments[0].startYM, '2000-11', 'My 首段起 2000-11');
A.eq(myShared.segments[0].endYM, '2000-12', 'My 首段止 2000-12（与建账2000-11对齐）');
A.eq(myShared.segments[0].type, 'enterprise', 'My 首段身份 enterprise');

var wifeShared = V.buildSharedInput(P, D, CV.mapParsedToPageData(wifeParsed, {}));
A.eq(segByStart(wifeShared.segments, '2003-09').endYM, '2003-12', 'Wife 2003 展开 2003-09~2003-12(k4)');
var w2006 = wifeShared.segments.filter(function (s) { return s.startYM.substr(0, 4) === '2006'; })[0];
A.eq(w2006.startYM, '2006-04', 'Wife 2006 起 2006-04');
A.eq(w2006.endYM, '2006-12', 'Wife 2006 止 2006-12(k9)');
var w2005 = wifeShared.segments.filter(function (s) { return s.startYM.substr(0, 4) === '2005'; })[0];
A.eq(w2005.startYM, '2005-01', 'Wife 2005 起 2005-01');
A.eq(w2005.endYM, '2005-07', 'Wife 2005 止 2005-07(k7)');
A.finish();
