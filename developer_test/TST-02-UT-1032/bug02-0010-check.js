// tests/bug02-0010-check.js
// BUG-02-0010 node 断言（纯逻辑，不依赖 wx）：
//   1) 文件缴费表 5 列（年份|基数(年)|年内起始月份|年内月数|缴费身份）解析与月段展开；
//   2) 中文缴费身份 -> 引擎枚举唯一映射（单位/企业职工=enterprise；灵活/灵活就业/失业灵活就业=flexible；非法报错）；
//   3) 旧 3 列文件向后兼容（起始月缺省 1、身份缺省 enterprise）；
//   4) 文件比较主链路：新 My-Case parse→validate→buildSharedInput→assemblePlanInput→Engine，27 段身份全合法、不再抛“身份类型非法”；
//   5) compare-result 容错：坏输入 buildViewSafe 不抛白屏而返回可读错误，纯 buildView 仍抛（供前置预检/单测）。
'use strict';
var path = require('path');
var fs = require('fs');

var CF = require(path.join(__dirname, '..', '..', 'services', 'caseFile.js'));
var CV = require(path.join(__dirname, '..', '..', 'services', 'caseValidator.js'));
var V = require(path.join(__dirname, '..', '..', 'calculator', 'inputValidator.js'));
var Asm = require(path.join(__dirname, '..', '..', 'calculator', 'planAssembler.js'));
var Eng = require(path.join(__dirname, '..', '..', 'calculator', 'pensionEngine.js'));
var CRM = require(path.join(__dirname, '..', '..', 'calculator', 'compareResultModel.js'));
var P = require(path.join(__dirname, '..', '..', 'constants', 'policyData.js'));
var D = require(path.join(__dirname, '..', '..', 'calculator', 'dateUtil.js'));

var pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } }
function eq(a, b, n) { if (a === b) pass++; else { fail++; console.log('  FAIL: ' + n + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); } }

var MY = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'customer_usecases', 'My-Case.md'), 'utf8');
var WIFE = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'customer_usecases', 'MyWife-Case.md'), 'utf8');

// ============ 1) 权威新夹具：5 列解析 + 起始月/身份透传 ============
var myParsed = CF.parseCaseFile(MY, 'compare');
ok(myParsed.ok, 'My-Case 5列解析无错误：' + JSON.stringify(myParsed.errors));
eq(myParsed.records.length, 27, 'My-Case 解析 27 个年度行');
var my0 = myParsed.records[0];
eq(my0.year, 2000, 'My 首行年份 2000');
eq(my0.startMonth, 11, 'My 2000 起始月=11（旧夹具误为1，本轮纠正）');
eq(my0.months, 2, 'My 2000 年内月数=2');
eq(my0.type, 'enterprise', 'My 2000 身份 单位→enterprise');
ok(myParsed.records.every(function (r) { return r.type === 'enterprise'; }), 'My 历史身份列全为「单位」→enterprise');

var wifeParsed = CF.parseCaseFile(WIFE, 'compare');
ok(wifeParsed.ok, 'MyWife 5列解析无错误：' + JSON.stringify(wifeParsed.errors));
var wifeByYear = {};
wifeParsed.records.forEach(function (r) { wifeByYear[r.year] = r; });
eq(wifeByYear[2003].startMonth, 9, 'Wife 2003 起始月=9');
eq(wifeByYear[2003].months, 4, 'Wife 2003 月数=4');
eq(wifeByYear[2005].startMonth, 1, 'Wife 2005 起始月=1');
eq(wifeByYear[2005].months, 7, 'Wife 2005 月数=7');
eq(wifeByYear[2006].startMonth, 4, 'Wife 2006 起始月=4');
eq(wifeByYear[2006].months, 9, 'Wife 2006 月数=9');

// ============ 1b) 月段展开（mapParsedToPageData -> buildSharedInput -> 段起止） ============
var myPage = CV.mapParsedToPageData(myParsed, {});
var myRowsByYear = {};
myPage.yearRows.forEach(function (r) { myRowsByYear[r.year] = r; });
eq(myRowsByYear['2000'].startMonth, '11', 'yearRows 透传 My 2000 startMonth=11（不再硬编码1）');
eq(myRowsByYear['2000'].type, 'enterprise', 'yearRows 透传 My 2000 type=enterprise');
var myShared = V.buildSharedInput(P, D, myPage);
eq(myShared.segments.length, 27, 'My 展开 27 个历史段');
eq(myShared.segments[0].startYM, '2000-11', 'My 首段起 2000-11');
eq(myShared.segments[0].endYM, '2000-12', 'My 首段止 2000-12（与建账2000-11对齐）');
eq(myShared.segments[0].type, 'enterprise', 'My 首段身份 enterprise');

var wifeShared = V.buildSharedInput(P, D, CV.mapParsedToPageData(wifeParsed, {}));
function segByStart(segs, ym) { return segs.filter(function (s) { return s.startYM.substr(0, 4) === ym.substr(0, 4) && s.startYM === ym; })[0]; }
eq(segByStart(wifeShared.segments, '2003-09').endYM, '2003-12', 'Wife 2003 展开 2003-09~2003-12(k4)');
var w2006 = wifeShared.segments.filter(function (s) { return s.startYM.substr(0, 4) === '2006'; })[0];
eq(w2006.startYM, '2006-04', 'Wife 2006 起 2006-04');
eq(w2006.endYM, '2006-12', 'Wife 2006 止 2006-12(k9)');
var w2005 = wifeShared.segments.filter(function (s) { return s.startYM.substr(0, 4) === '2005'; })[0];
eq(w2005.startYM, '2005-01', 'Wife 2005 起 2005-01');
eq(w2005.endYM, '2005-07', 'Wife 2005 止 2005-07(k7)');

// ============ 2) 身份映射（唯一函数 mapIdentityToType） ============
[['单位', 'enterprise'], ['企业职工', 'enterprise'], ['企业', 'enterprise'],
 ['灵活', 'flexible'], ['灵活就业', 'flexible'], ['失业灵活就业', 'flexible'],
 ['enterprise', 'enterprise'], ['flexible', 'flexible']].forEach(function (pair) {
  eq(CF.mapIdentityToType(pair[0]), pair[1], '身份映射 ' + pair[0] + ' -> ' + pair[1]);
});
eq(CF.mapIdentityToType('个体户'), null, '非法身份「个体户」→null');
eq(CF.mapIdentityToType(''), null, '空身份 →null');
eq(CF.mapIdentityToType(null), null, 'null 身份 →null');

// 2b) 文件内非法/灵活身份：5列行级
var flexFile = [
  '``` My case: common ```',
  '# 生日: 2000-01',
  '# 养老保险目前交到: 2026-08',
  '# 缴费记录',
  '| 年份 | 养老缴纳基数(年) | 年内起始月份(1~12) | 年内缴纳月数 | 缴费身份 |',
  '| 2020 | 12000 | 1 | 12 | 灵活就业 |',
  '| 2021 | 12000 | 1 | 6 | 失业灵活就业 |',
  '``` end ```'
].join('\n');
var flexParsed = CF.parseCaseFile(flexFile, 'compare');
ok(flexParsed.ok, '灵活身份文件解析通过：' + JSON.stringify(flexParsed.errors));
eq(flexParsed.records[0].type, 'flexible', '灵活就业→flexible（record）');
eq(flexParsed.records[1].type, 'flexible', '失业灵活就业→flexible（record）');
var flexSegs = V.buildSharedInput(P, D, CV.mapParsedToPageData(flexParsed, {})).segments;
ok(flexSegs.every(function (s) { return s.type === 'flexible'; }), '灵活身份透传到历史段 type=flexible');

var badIdFile = [
  '``` My case: common ```', '# 生日: 2000-01', '# 养老保险目前交到: 2026-08', '# 缴费记录',
  '| 年份 | 养老缴纳基数(年) | 年内起始月份(1~12) | 年内缴纳月数 | 缴费身份 |',
  '| 2020 | 12000 | 1 | 12 | 个体户 |', '``` end ```'
].join('\n');
var badIdParsed = CF.parseCaseFile(badIdFile, 'compare');
ok(!badIdParsed.ok && badIdParsed.errors.some(function (e) { return /缴费身份无法识别/.test(e.reason); }), '非法身份报清晰错误');

// 2c) 起始月越界
var badMonthFile = [
  '``` My case: common ```', '# 生日: 2000-01', '# 养老保险目前交到: 2026-08', '# 缴费记录',
  '| 年份 | 养老缴纳基数(年) | 年内起始月份(1~12) | 年内缴纳月数 | 缴费身份 |',
  '| 2020 | 12000 | 13 | 1 | 单位 |', '``` end ```'
].join('\n');
var badMonthParsed = CF.parseCaseFile(badMonthFile, 'compare');
ok(!badMonthParsed.ok && badMonthParsed.errors.some(function (e) { return /起始月份须为 1~12/.test(e.reason); }), '起始月13越界报错');

// ============ 3) 旧 3 列向后兼容 ============
var old3 = [
  '``` My case: common ```',
  '# 生日: 1973-07',
  '# 养老保险目前交到: 2026-08',
  '# 缴费记录',
  '| 年份 | 养老缴纳基数(年) | 年内缴纳月数 |',
  '| 2000 | 6142 | 2 |',
  '| 2001 | 41328 | 12 |',
  '``` end ```'
].join('\n');
var oldParsed = CF.parseCaseFile(old3, 'compare');
ok(oldParsed.ok, '旧3列文件解析不报错：' + JSON.stringify(oldParsed.errors));
eq(oldParsed.records[0].startMonth, 1, '旧3列起始月缺省=1');
eq(oldParsed.records[0].type, 'enterprise', '旧3列身份缺省=enterprise');
var oldSegs = V.buildSharedInput(P, D, CV.mapParsedToPageData(oldParsed, {})).segments;
eq(oldSegs[0].startYM, '2000-01', '旧3列 2000 段仍起 2000-01（兼容旧语义）');
eq(oldSegs[0].endYM, '2000-02', '旧3列 2000 k2 止 2000-02');
eq(oldSegs[0].type, 'enterprise', '旧3列段身份 enterprise');

// 3b) 列数既非3也非5
var badColsFile = [
  '``` My case: common ```', '# 生日: 2000-01', '# 养老保险目前交到: 2026-08', '# 缴费记录',
  '| 年份 | 养老缴纳基数(年) | 年内缴纳月数 | 备注 |',
  '| 2020 | 12000 | 12 | x |', '``` end ```'
].join('\n');
var badColsParsed = CF.parseCaseFile(badColsFile, 'compare');
ok(!badColsParsed.ok && badColsParsed.errors.some(function (e) { return /列数应为 3 或 5/.test(e.reason); }), '4列报「应为3或5」清晰错误');

// ============ 4) 文件比较主链路：新 My-Case 27 段身份合法、引擎出结果 ============
(function () {
  var parsed = CF.parseCaseFile(MY, 'compare');
  var validation = CV.validate(parsed, 'compare', {});
  ok(validation.ok && validation.canCalculate, 'My validate ok & canCalculate：' +
    validation.invalidOrMissing.map(function (e) { return e.reason; }).join(';'));
  var shared = V.buildSharedInput(P, D, validation.pageData);
  ok(shared.segments.length === 27 && shared.segments.every(function (s) {
    return s.type === 'enterprise' || s.type === 'flexible';
  }), '共享入参 27 段身份全部合法（无 undefined）');

  var plans = [
    { id: 'a', retireYM: '2033-07', z: 0.6, segType: 'enterprise' },
    { id: 'b', retireYM: '2033-07', z: 3.0, segType: 'enterprise' }
  ];
  var engineErr = null;
  var pMonthlies = plans.map(function (pl) {
    var inp = Asm.assemblePlanInput(shared, pl);
    try {
      var res = Eng.calculate(inp);
      return res.pension.total;
    } catch (e) { engineErr = e.message; return null; }
  });
  ok(engineErr === null, 'Engine.calculate 两方案均不抛「身份类型非法」：' + engineErr);
  ok(isFinite(pMonthlies[0]) && isFinite(pMonthlies[1]) && pMonthlies[0] > 0 && pMonthlies[1] > 0,
    '两方案 P月均为正数：' + JSON.stringify(pMonthlies));
  ok(pMonthlies[1] > pMonthlies[0], 'Z=3.0 方案 P月高于 Z=0.6：' + JSON.stringify(pMonthlies));

  var view = CRM.buildViewSafe(shared, plans, 0);
  ok(view.ok && view.view.columns.length === 2, 'buildViewSafe 主链路产出 2 列');
})();

// ============ 4b) 防御：即便历史段身份缺失，inputValidator/planAssembler 双保险兜底 enterprise ============
(function () {
  var shared = V.buildSharedInput(P, D, CV.mapParsedToPageData(myParsed, {}));
  shared.segments[5].type = undefined; // 模拟上游漏传
  var pl = { id: 'a', retireYM: '2033-07', z: 0.6, segType: 'enterprise' };
  var inp = Asm.assemblePlanInput(shared, pl); // planAssembler 克隆段时兜底
  eq(inp.segments[5].type, 'enterprise', 'planAssembler:125 段身份缺失兜底 enterprise');
  var threw = false;
  try { Eng.calculate(inp); } catch (e) { threw = true; }
  ok(!threw, '兜底后引擎不因身份缺失抛错');
})();

// ============ 5) compare-result 容错：坏输入不白屏，返回可读错误 ============
(function () {
  var shared = V.buildSharedInput(P, D, CV.mapParsedToPageData(myParsed, {}));
  var plans = [
    { id: 'a', retireYM: '2033-07', z: 0.6, segType: 'enterprise' },
    { id: 'b', retireYM: '2033-07', z: 3.0, segType: 'enterprise' }
  ];
  // 构造坏输入：段身份为非法值，且绕过双保险（直接喂引擎层结构）
  var badShared = JSON.parse(JSON.stringify(shared));
  badShared.segments[3].type = 'not-a-type';
  // assemblePlanInput 会兜底，因此直接用 buildView 对坏 shared（模拟历史脏数据/手工破坏）
  var safe = CRM.buildViewSafe(badShared, plans, 0);
  ok(safe.ok === false && typeof safe.error === 'string' && safe.error.length > 0, 'buildViewSafe 坏输入返回 {ok:false,error}');
  ok(/身份类型非法|校验失败/.test(safe.error), '错误信息可读且点出身份非法：' + safe.error);

  var pureThrew = false;
  try { CRM.buildView(badShared, plans, 0); } catch (e) { pureThrew = true; }
  ok(pureThrew, '纯 buildView 对坏输入仍抛错（保持纯函数语义，供 startCompare 前置预检/单测）');

  // 页面 rebuild 行为模拟（无 wx，注入最小 Page 桩取出 rebuild）
  var calls = [];
  var captured = null;
  global.Page = function (def) { captured = def; };
  delete require.cache[require.resolve(path.join(__dirname, '..', '..', 'pages', 'compare-result', 'compare-result.js'))];
  require(path.join(__dirname, '..', '..', 'pages', 'compare-result', 'compare-result.js'));
  ok(typeof captured.rebuild === 'function', 'compare-result 页面暴露 rebuild');
  captured.sharedInput = badShared;
  captured.plans = plans;
  captured.setData = function (obj) { calls.push(obj); };
  captured.rebuild(0);
  var errCall = calls.filter(function (c) { return c.ready === false; })[0];
  ok(!!errCall && /比较计算失败/.test(errCall.loadError) && /返回方案输入页核对/.test(errCall.loadError),
    'rebuild 坏输入置 ready=false 且给可读 loadError，不白屏：' + (errCall && errCall.loadError));
})();

console.log('\nbug02-0010-check: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
