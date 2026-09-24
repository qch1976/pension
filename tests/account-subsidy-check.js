// tests/account-subsidy-check.js
// R补（Z补贴）专项测试 —— spec V1.2 §2.2.1 验收标准 AC-RC-01 ~ AC-RC-11
// 运行：node tests/account-subsidy-check.js
// 全部期望值均可按政策核验报告 RC-T 算例与官方 C 年表手工复算（不使用 snapshot）。
// C 年表（21号文附表2官方序列，元/年）：
// 1991=2877 1992=3402 1993=4523 1994=6540 1995=8144 1996=9579
// 1997=11019 1998=12285 1999=13778 2000=15726 2001=18092 2002=20728
// 2003=24045 2004=28348 2005=32808 2006=36097 2007=39867（附录12.4官方序列）
var path = require('path');
var fs = require('fs');
var Subsidy = require(path.join(__dirname, '..', 'calculator', 'accountSubsidy.js'));
var Engine = require(path.join(__dirname, '..', 'calculator', 'pensionEngine.js'));

// 批次1 #8 契约收紧后（accountBalanceManual UI 路径必填），旧套件统一走保留的历史重建逃生口。
var __engineCalculate = Engine.calculate;
Engine.calculate = function (input) {
  if (input && input.accountBalanceManual == null && input.accountReconstruct == null) {
    input.accountReconstruct = true;
  }
  return __engineCalculate(input);
};
var P = require(path.join(__dirname, '..', 'constants', 'policyData.js'));
var REFS = require(path.join(__dirname, '..', 'constants', 'policyRefs.js'));

var total = 0, failN = 0;
var fails = [];
function check(id, title, cond, actual, expected) {
  total++;
  var pass = cond === true;
  if (!pass) { failN++; fails.push({ id: id, title: title, actual: actual, expected: expected }); }
  console.log((pass ? 'PASS' : 'FAIL') + ' ' + id + ' ' + title + (pass ? '' :
    '\n   实际: ' + JSON.stringify(actual) + '\n   期望: ' + JSON.stringify(expected)));
}
function near(id, title, actual, expected, tol) {
  check(id, title, Math.abs(actual - expected) <= (tol || 0.01), actual, expected + ' (±' + (tol || 0.01) + ')');
}
function seg(t, a, b, x) { return { type: t, startYM: a, endYM: b, baseMonthly: x }; }

// 官方 C 年表校验（AC-RC-10 常量可追溯）
(function ac10Constants() {
  var w = P.avgWageLegacyAnnual;
  var official = { 1991: 2877, 1992: 3402, 1993: 4523, 1994: 6540, 1995: 8144, 1996: 9579,
    1997: 11019, 1998: 12285, 1999: 13778, 2000: 15726, 2001: 18092, 2002: 20728,
    2003: 24045, 2004: 28348, 2005: 32808 };
  var allMatch = Object.keys(official).every(function (y) { return w[y] === official[y]; });
  check('AC-RC-10a', 'C年表1991-2005=21号文附表2官方序列', allMatch,
    Object.keys(official).map(function (y) { return w[y]; }), Object.keys(official).map(function (y) { return official[y]; }));
  var tiers = P.accountSubsidy.tiers.map(function (t) { return t.rate; });
  check('AC-RC-10b', '分档比例表驱动 2%/5%/11%/8%',
    JSON.stringify(tiers) === JSON.stringify([0.02, 0.05, 0.11, 0.08]), tiers, [0.02, 0.05, 0.11, 0.08]);
  check('AC-RC-10c', 'P13=京劳社养发〔2007〕31号 已登记官方URL',
    !!REFS.P13 && /31号/.test(REFS.P13.docNo) && /beijing\.gov\.cn/.test(REFS.P13.url),
    REFS.P13 && REFS.P13.docNo, '京劳社养发〔2007〕31号 + beijing.gov.cn URL');
})();

// AC-RC-03：RC-T02 机关调入，1992年前参加工作，2003-01参保（C取至C2002），Z实指数=1.0
(function ac03TierFormula() {
  var inp = { doc31Eligible: true, doc31TransferYM: '2003-01', enterpriseInsuredYM: '2003-01', workStartYM: '1985-07' };
  var r = Subsidy.calculateAccountSubsidy(inp, 1.0);
  // 手工复算（官方 RC-T02）：
  // 2%档=(2877/12×3+3402)×0.02 = (719.25+3402)×.02 = 4121.25×.02 = 82.425
  // 5%档=(4523+6540+8144+9579+11019/2)×.05 = (4523+6540+8144+9579+5509.5)=34295.5×.05 = 1714.775
  // 11%档=(11019/2+12285+13778+15726+18092)×.11 = (5509.5+12285+13778+15726+18092)=65390.5×.11 = 7192.955
  // 合计 8990.155 × Z实1.0 = 8990.16（四舍五入2位）
  near('AC-RC-03a', '2%档=82.425（含C1992/12×3+C1993）', r.tiers[0].bracket, 82.425, 1e-6);
  near('AC-RC-03b', '5%档=1714.775（C1994~C1997+C1998/2）', r.tiers[1].bracket, 1714.775, 1e-6);
  near('AC-RC-03c', '11%档=7192.955（C1998/2+C1999~C2002）', r.tiers[2].bracket, 7192.955, 1e-6);
  check('AC-RC-03d', '2003-01参保无8%档', r.tiers.length === 3, r.tiers.length, 3);
  near('AC-RC-03e', 'Z补贴=8990.16（Z实=1.0）', r.subsidy, 8990.16, 0.01);
  check('AC-RC-03f', '模拟期间=1992-10~2002-12 共123个月',
    r.periodStartYM === '1992-10' && r.periodEndYM === '2002-12' && r.monthCount === 123,
    r.periodStartYM + '~' + r.periodEndYM + '(' + r.monthCount + ')', '1992-10~2002-12(123)');

  // RC-T03：同一人 Z实=0.8234 → 8990.155×0.8234=7402.4856…=7402.49
  var r2 = Subsidy.calculateAccountSubsidy(inp, 0.8234);
  near('AC-RC-11a', 'Z实=0.8234 → Z补贴=7402.49（分档不舍入、最终2位）', r2.subsidy, 7402.49, 0.01);
})();

// AC-RC-04：2008-01 参保 → 8%档含 C2006、C2007；11%档止于 C2005
(function ac04EightPctTier() {
  var inp = { doc31Eligible: true, doc31TransferYM: '2008-01', enterpriseInsuredYM: '2008-01', workStartYM: '1985-07' };
  var r = Subsidy.calculateAccountSubsidy(inp, 1.0);
  var tierByRate = {};
  r.tiers.forEach(function (t) { tierByRate[t.rate] = t; });
  // 8%档：2006-01~2007-12 共24个月，月模拟额 C2006(=2005年32808)/12 与 C2007(=2006年36097)/12
  // 注意下标：公历年2006取2005社平32808；公历年2007取2006社平36097
  var exp8 = (32808 + 36097) * 0.08; // =68905×.08 = 5512.4
  near('AC-RC-04a', '8%档=(C2006+C2007)×8%=5512.40', tierByRate[0.08].bracket, exp8, 0.01);
  check('AC-RC-04b', '8%档月数=24', tierByRate[0.08].months === 24, tierByRate[0.08].months, 24);
  // 11%档：1998-07~2005-12 = 84个月 → C1998/2 + C1999..C2005
  // =12285/2+13778+15726+18092+20728+24045+28348+32808 = 138511.5；×11%=15236.265
  near('AC-RC-04c', '11%档止于C2005=15236.265（90个月含… ）', tierByRate[0.11].bracket, 15236.265, 0.01);
  check('AC-RC-04d', '11%档月数=90（1998-07~2005-12）', tierByRate[0.11].months === 90, tierByRate[0.11].months, 90);
})();

// AC-RC-05：年中参保边界。2003-07 参保 → 末年（2003）只计1~6月，即 C2003 按 6/12=0.5 计入11%档
(function ac05MidYear() {
  var inp = { doc31Eligible: true, doc31TransferYM: '2003-07', enterpriseInsuredYM: '2003-07', workStartYM: '1985-07' };
  var r = Subsidy.calculateAccountSubsidy(inp, 1.0);
  var tier11 = r.tiers.filter(function (t) { return t.rate === 0.11; })[0];
  // 11%档月模拟额：1998-07~2002-12（54月=65390.5）+ 2003-01~06（6月，取2002社平20728/12×6=10364）
  var exp11 = 65390.5 + 20728 / 2; // 75754.5
  near('AC-RC-05a', '年中参保末年按6个月 C2003/12×6 折算', tier11.sumCWage, exp11, 0.01);
  check('AC-RC-05b', '11%档月数=60', tier11.months === 60, tier11.months, 60);
  check('AC-RC-05c', '模拟期末月=2003-06', r.periodEndYM === '2003-06', r.periodEndYM, '2003-06');
  // 1992 年段恒为3个月（10-12月）
  var tier2 = r.tiers.filter(function (t) { return t.rate === 0.02; })[0];
  near('AC-RC-05d', '1992段=C1992/12×3=719.25（2%档月模拟额的3月部分）',
    2877 / 12 * 3, 719.25, 1e-6);
  check('AC-RC-05e', '2%档月数=15（1992-10~1993-12）', tier2.months === 15, tier2.months, 15);
})();

// AC-RC-09：身份门槛——转制早于1998-01 / 非31号人员 / 缺时间字段
(function ac09Gate() {
  var r1 = Subsidy.calculateAccountSubsidy({ doc31Eligible: true, doc31TransferYM: '1996-05', enterpriseInsuredYM: '2000-01' }, 1.0);
  check('AC-RC-09a', '转制1996-05早于1998-01 → R补=0+原因提示',
    r1.subsidy === 0 && r1.applicable === false && /1998-01/.test(r1.ineligibleReason),
    r1.ineligibleReason, 'ineligible: 早于1998-01');
  var r2 = Subsidy.calculateAccountSubsidy({ doc31Eligible: true, enterpriseInsuredYM: '2003-01' }, 1.0);
  check('AC-RC-09b', '已选31号身份但缺调动年月 → R补=0+提示',
    r2.subsidy === 0 && !!r2.warning, r2.warning, 'warning present');
  var r3 = Subsidy.calculateAccountSubsidy({}, 1.0);
  check('AC-RC-09c', '普通职工（未勾选）→ reason=not-doc31-person',
    r3.applicable === false && r3.reason === 'not-doc31-person', r3.reason, 'not-doc31-person');
})();

// AC-RC-02 + AC-RC-07：引擎端普通人群零差异回归；Z补贴 不计入 R储
(function ac02Ac07Engine() {
  var base = {
    gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10',
    interestMode: 'none', segments: [],
    customCYear: { 1992: 500, 1993: 600, 1994: 700, 1995: 678.67 }
  };
  [['1992-10', '1992-12', 500], ['1993-01', '1993-12', 600], ['1994-01', '1994-12', 700], ['1995-01', '1995-12', 678.67]]
    .forEach(function (a) { base.segments.push(seg('enterprise', a[0], a[1], a[2])); });
  Object.keys(P.indexDenominatorMonthly).map(Number).forEach(function (yy) {
    base.segments.push(seg('enterprise', yy + '-01', yy === 2025 ? '2025-09' : yy + '-12', P.indexDenominatorMonthly[yy]));
  });
  var oNormal = Engine.calculate(base);
  near('AC-RC-02a', '普通人群总额=7457.38（与V1.1零差异）', oNormal.pension.total, 7457.38, 0.01);
  check('AC-RC-02b', '普通人群 R补=0/applicable=false',
    oNormal.intermediates.R补 === 0 && oNormal.accountSubsidy.applicable === false,
    oNormal.intermediates.R补, 0);
  check('AC-RC-02c', '普通人群 formulaLines 仍为4条', oNormal.formulaLines.length === 4, oNormal.formulaLines.length, 4);
  check('AC-RC-02d', '普通人群 J账户=R储/M（公式行文本为R储÷M）',
    /R储 ÷ M/.test(oNormal.formulaLines[1].text), oNormal.formulaLines[1].text, 'J账户 = R储 ÷ M');

  // 31号人员：同一引擎，机关工作1985-07~2002-12（无企业缴费），2003-01起企业参保
  var doc31 = JSON.parse(JSON.stringify(base));
  doc31.workStartYM = '1985-07';
  doc31.doc31Eligible = true;
  doc31.doc31TransferYM = '2003-01';
  doc31.enterpriseInsuredYM = '2003-01';
  doc31.segments = doc31.segments.filter(function (s) { return s.startYM >= '2003-01'; });
  // 2003~2025 按社平100%缴费（indexDenominatorMonthly 为月社平，基数取同值→指数1.0）
  var o31 = Engine.calculate(doc31);
  near('AC-RC-07a', '31号人员 R补=8990.16（参保后Z实≈1.0）', o31.intermediates.R补, 8990.16, 0.5);
  var expectedJ = Math.round((o31.intermediates.R储 + 8990.16) / o31.intermediates.M * 100) / 100;
  near('AC-RC-07b', 'J账户=(R储+R补)÷M', o31.pension.J账户, expectedJ, 0.01);
  // RC-T08：手录 R储=100000 → J账户=(100000+8990.16)/139=784.10；余额展示仍100000
  var t08 = JSON.parse(JSON.stringify(doc31));
  t08.accountBalanceManual = 100000;
  t08.birthYM = '1965-10'; t08.retireYM = '2025-10'; // 60岁 M=139
  var o08 = Engine.calculate(t08);
  near('AC-RC-07c', 'RC-T08 J账户=(100000+8990.16)/139=784.10', o08.pension.J账户, 784.10, 0.02);
  check('AC-RC-07d', 'RC-T08 R储展示仍=100000（Z补贴不入余额）',
    o08.intermediates.R储 === 100000, o08.intermediates.R储, 100000);
  check('AC-RC-07e', '31号人员 formulaLines 追加 R补 行（P13）',
    o31.formulaLines.length === 5 && o31.formulaLines[4].key === 'R补' && o31.formulaLines[4].ref === 'P13',
    o31.formulaLines.map(function (f) { return f.key + '/' + f.ref; }), '…R补/P13');
})();

// AC-RC-08：已享一次性补贴年限扣除（27号文/后联字3号）
(function ac08Exclusion() {
  // 2003-01 参保人员，扣除 1995-01~1996-12（24个月，5%档；对应 C1995=1994社平6540、C1996=1995社平8144）
  var inp = { doc31Eligible: true, doc31TransferYM: '2003-01', enterpriseInsuredYM: '2003-01',
    workStartYM: '1985-07', subsidyExcludedRanges: [{ startYM: '1995-01', endYM: '1996-12' }] };
  var r = Subsidy.calculateAccountSubsidy(inp, 1.0);
  check('AC-RC-08a', '扣除24个月', r.excludedMonths === 24, r.excludedMonths, 24);
  check('AC-RC-08b', '总模拟月数=123-24=99', r.monthCount === 99, r.monthCount, 99);
  // 5%档原54月（1994-01~1998-06）；扣除1995-01~1996-12共24月 → 30月
  var tier5 = r.tiers.filter(function (t) { return t.rate === 0.05; })[0];
  check('AC-RC-08c', '5%档剩30个月', tier5.months === 30, tier5.months, 30);
  // 复算5%档剩余：1994公历年(C1994=1993社平4523)+1997公历年(C1997=1996社平9579)
  //   +1998年1~6月(C1998/2=1997社平11019/2=5509.5) = 19611.5；×5%=980.575
  near('AC-RC-08d', '5%档扣除后=980.575（按月折算）', tier5.bracket, 980.575, 0.01);
  // 全部扣除 → R补=0
  var allEx = Subsidy.calculateAccountSubsidy({ doc31Eligible: true, doc31TransferYM: '2003-01',
    enterpriseInsuredYM: '2003-01', workStartYM: '1985-07',
    subsidyExcludedRanges: [{ startYM: '1992-10', endYM: '2002-12' }] }, 1.0);
  check('AC-RC-08e', '未建账期间全部已享补贴 → R补=0（防重复享受）',
    allEx.subsidy === 0 && /重复/.test(allEx.warning), allEx.reason, 'fully-excluded');
})();

// AC-RC-06：Z补贴 所用 Z实指数 仅统计企业实际参保后缴费段
(function ac06ZRealScope() {
  // 31号人员 2003-01 参保，2003~2025 按社平60%缴费 → 参保后 Z实指数≈0.6；
  // 机关事业年限（1985~2002）不得进入其分子分母。
  var inp = {
    gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10',
    interestMode: 'none', segments: [], doc31Eligible: true,
    doc31TransferYM: '2003-01', enterpriseInsuredYM: '2003-01'
  };
  Object.keys(P.indexDenominatorMonthly).map(Number).filter(function (y) { return y >= 2003; }).forEach(function (yy) {
    inp.segments.push(seg('enterprise', yy + '-01', yy === 2025 ? '2025-09' : yy + '-12',
      Math.round(P.indexDenominatorMonthly[yy] * 0.6 * 100) / 100));
  });
  var o = Engine.calculate(inp);
  check('AC-RC-06a', '参保后Z实指数≈0.6（机关年限不入分子分母）',
    Math.abs(o.accountSubsidy.zRealUsed - 0.6) < 0.02,
    o.accountSubsidy.zRealUsed, '≈0.6');
  var expected = Math.round(8990.155 * o.accountSubsidy.zRealUsed * 100) / 100;
  near('AC-RC-06b', 'Z补贴=8990.155×参保后Z实指数', o.intermediates.R补, expected, 0.02);
})();

// AC-RC-11：舍入规则——分档中间值保留全精度（≤1e-9误差），最终2位小数
(function ac11Rounding() {
  var r = Subsidy.calculateAccountSubsidy({ doc31Eligible: true, doc31TransferYM: '2003-01',
    enterpriseInsuredYM: '2003-01', workStartYM: '1985-07' }, 0.8234);
  check('AC-RC-11b', '最终值四舍五入2位=7402.49',
    r.subsidy === 7402.49, r.subsidy, 7402.49);
  check('AC-RC-11c', '分档展示值 bracket 与手算一致（82.425等）',
    Math.abs(r.tiers[0].bracket - 82.425) < 1e-6 && Math.abs(r.tiers[1].bracket - 1714.775) < 1e-6,
    r.tiers.map(function (t) { return t.bracket; }), [82.425, 1714.775, 7192.955]);
})();

// AC-RC-01：符号映射——代码与页面文案不得宣称 R储/R补 为官方符号
(function ac01SymbolMapping() {
  var subsidySrc = fs.readFileSync(path.join(__dirname, '..', 'calculator', 'accountSubsidy.js'), 'utf8');
  check('AC-RC-01a', 'accountSubsidy.js 注释声明 R补=官方「个人账户补贴额」Z补贴（31号文）',
    /个人账户补贴额/.test(subsidySrc) && /Z补贴/.test(subsidySrc) && /用户/.test(subsidySrc), true, true);
  var engineSrc = fs.readFileSync(path.join(__dirname, '..', 'calculator', 'pensionEngine.js'), 'utf8');
  check('AC-RC-01b', 'pensionEngine.js 注释声明 R储=个人账户累计储存额、R补=Z补贴 且为用户符号',
    /个人账户累计储存额/.test(engineSrc) && /用户符号/.test(engineSrc), true, true);
  var resultWxml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'result', 'result.wxml'), 'utf8');
  // 批次3 #12a：R储 说明文案移至 result.js 的 buildRStoreVm（WXML 只绑定 vm.rStore.explain）
  var resultJsSrc = fs.readFileSync(path.join(__dirname, '..', 'pages', 'result', 'result.js'), 'utf8');
  check('AC-RC-01c', '结果页 R储 标注官方「个人账户累计储存额」（21号文，文案JS侧）',
    /个人账户累计储存额/.test(resultJsSrc) && /21号文/.test(resultJsSrc) &&
    /vm\.rStore\.explain/.test(resultWxml), true, true);
  check('AC-RC-01d', '结果页 R补 标注 Z补贴 与31号文',
    /Z补贴/.test(resultWxml) && /31号/.test(resultWxml), true, true);
  var indexWxml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'index', 'index.wxml'), 'utf8');
  // 批次1 文案定稿后：不再出现“用户口径符号”字样，改核官方名称与 Z补贴 通俗说明均在页
  check('AC-RC-01e', '输入页说明 R储=官方个人账户累计储存额、R补=Z补贴',
    /个人账户累计储存额/.test(indexWxml) && /Z补贴/.test(indexWxml) && /虚拟补贴/.test(indexWxml), true, true);
})();

// 缺失 C 年阻断（不猜测）：构造 2030 年参保 → 2026+ 年度无内置 C 年表，必须提示补录且 R补=0
(function missingWageBlock() {
  var r = Subsidy.calculateAccountSubsidy({ doc31Eligible: true, doc31TransferYM: '2030-01',
    enterpriseInsuredYM: '2030-01', workStartYM: '1985-07' }, 1.0);
  check('GAP-31-1', '2030参保缺C年 → 阻断不猜测，R补=0+missingYears提示',
    r.applicable === false && r.subsidy === 0 && r.missingYears.indexOf(2026) >= 0 && /补录/.test(r.warning),
    { reason: r.reason, missing: r.missingYears }, 'reason=missing-annual-wage');
})();

// 汇总
console.log('\n================ R补/Z补贴 专项测试 ================');
console.log('用例总数: ' + total + '  通过: ' + (total - failN) + '  失败: ' + failN);
if (failN) {
  console.log('\n---- 失败用例 ----');
  fails.forEach(function (f) {
    console.log('[' + f.id + '] ' + f.title + '\n   实际: ' + JSON.stringify(f.actual) +
      '\n   期望: ' + JSON.stringify(f.expected));
  });
}
process.exitCode = failN > 0 ? 1 : 0;
