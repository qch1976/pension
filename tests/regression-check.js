// regression-check.js —— 阶段5 独立回归脚本（测试方 YDL 自有，不依赖开发者新增断言）
// 逐条回归首轮 22 个缺陷 + 核心场景 oracle 对拍 + 周边回归
// 运行：node regression-check.js [--json]
var fs = require('fs');
var path = require('path');
// 自适应：测试方网关基线目录（…/regression/tests，代码在 …/regression/pension-fixed）或项目 tests/ 目录
var ROOT = fs.existsSync(path.join(__dirname, '..', 'pension-fixed'))
  ? path.join(__dirname, '..', 'pension-fixed')
  : path.join(__dirname, '..');
var Engine = require(path.join(ROOT, 'calculator', 'pensionEngine.js'));

// 批次1 #8 契约收紧后（accountBalanceManual UI 路径必填），旧套件统一走保留的历史重建逃生口。
var __engineCalculate = Engine.calculate;
Engine.calculate = function (input) {
  if (input && input.accountBalanceManual == null && input.accountReconstruct == null) {
    input.accountReconstruct = true;
  }
  return __engineCalculate(input);
};
var Oracle = require(path.join(ROOT, 'tests', 'oracle.js')).oracle;
var Schedule = require(path.join(ROOT, 'calculator', 'retireSchedule.js'));
var REFS = require(path.join(ROOT, 'constants', 'policyRefs.js'));
var D = require(path.join(ROOT, 'calculator', 'dateUtil.js'));

var results = [];
function rec(id, bug, title, pass, actual, expected) {
  results.push({ id: id, bug: bug, title: title, pass: !!pass, actual: String(actual), expected: String(expected) });
}
function near(id, bug, title, actual, expected, tol) {
  rec(id, bug, title, Math.abs(actual - expected) <= tol, actual, expected + ' ±' + tol);
}
function tryCalc(input) { try { return { r: Engine.calculate(input) }; } catch (e) { return { e: e }; } }
function seg(t, a, b, x) { return { type: t, startYM: a, endYM: b, baseMonthly: x }; }

// ---------- 基准场景输入（与首轮 test-cases.md 一致） ----------
var GAP_C = { 1992: 500, 1993: 600, 1994: 700, 1995: 678.67 }; // 旧夹具按缴费年度键；S1 构造直接逐年段
var S1 = {
  gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10',
  interestMode: 'none', segments: [], customCYear: { 1992: 500, 1993: 600, 1994: 700, 1995: 678.67 }
};
(function () {
  var P = require(path.join(ROOT, 'constants', 'policyData.js'));
  [['1992-10', '1992-12', 500], ['1993-01', '1993-12', 600], ['1994-01', '1994-12', 700], ['1995-01', '1995-12', 678.67]]
    .forEach(function (a) { S1.segments.push(seg('enterprise', a[0], a[1], a[2])); });
  Object.keys(P.indexDenominatorMonthly).forEach(function (yy) {
    yy = +yy;
    S1.segments.push(seg('enterprise', yy + '-01', yy === 2025 ? '2025-09' : yy + '-12', P.indexDenominatorMonthly[yy]));
  });
})();

var S2 = {
  gender: 'female', femaleType: 'worker', birthYM: '1975-05', workStartYM: '1995-08', retireYM: '2025-05',
  interestMode: 'fixed', fixedRate: 0.04, customCYear: { 1995: 678.67 },
  segments: [seg('enterprise', '1995-08', '2015-12', 6000), seg('flexible', '2018-01', '2025-04', 4713)]
};
var S3 = {
  gender: 'male', birthYM: '1965-09', workStartYM: '2000-09', retireYM: '2025-09',
  interestMode: 'official', fallbackRate: 0.0262,
  segments: [seg('enterprise', '2000-09', '2025-08', 10000)]
};

var r1 = Engine.calculate(S1), r2 = Engine.calculate(S2), r3 = Engine.calculate(S3);

// ============================================================================
// A. Blocker / Major / Minor 逐条回归
// ============================================================================

// BUG-001 Blocker：WXML Mustache 配对
(function () {
  var files = ['app', path.join('pages', 'index', 'index'), path.join('pages', 'result', 'result')];
  var bad = [];
  files.forEach(function (f) {
    var p = f === 'app' ? path.join(ROOT, 'app.wxml') : path.join(ROOT, f + '.wxml');
    if (!fs.existsSync(p)) return;
    var t = fs.readFileSync(p, 'utf8');
    var open = (t.match(/{{/g) || []).length, close = (t.match(/}}/g) || []).length;
    if (open !== close) bad.push(f + '(' + open + '/' + close + ')');
  });
  rec('R-BUG-001', 'BUG-001', '结果页WXML Mustache配对(编译阻断解除)', bad.length === 0,
    bad.length ? '不配对:' + bad.join(',') : '3个wxml {{}} 全部配对', '配对，可编译');
})();

// BUG-002：政策溯源 ref 键可解析
(function () {
  var refs = r1.formulaLines.map(function (f) { return f.ref; });
  var allResolvable = refs.every(function (x) { return !!REFS[x]; });
  var noHyphen = refs.every(function (x) { return x.indexOf('-') < 0; });
  rec('R-BUG-002', 'BUG-002', '公式溯源ref与policyRefs键一致且4条可解析',
    allResolvable && noHyphen && refs.length === 4, JSON.stringify(refs), 'P02/P04 无连字符且 REFS 可查');
})();

// BUG-003：手工视同月数留空 NaN 阻断
(function () {
  var x = tryCalc(Object.assign({}, S1, { deemedMonths: NaN }));
  rec('R-BUG-003', 'BUG-003', '手工视同月数NaN阻断(不再输出NaN总额)', !!x.e,
    x.e ? x.e.message : '未阻断 total=' + x.r.pension.total, '抛错');
})();

// BUG-004：负值阻断 + 矛盾值 E-08 截断
(function () {
  var x = tryCalc(Object.assign({}, S1, { deemedMonths: -5 }));
  rec('R-BUG-004a', 'BUG-004', '视同月数负值阻断', !!x.e, x.e ? x.e.message : '未阻断', '抛错');
  var y = tryCalc({ gender: 'male', birthYM: '1980-01', workStartYM: '2000-01', retireYM: '2040-01', interestMode: 'none', deemedMonths: 600,
    segments: [seg('enterprise', '2000-01', '2039-12', 8000)] });
  var capped = !y.e && y.r.intermediates.N同 === 0 && y.r.meta.warnings.some(function (w) { return /截断/.test(w); });
  rec('R-BUG-004b', 'BUG-004', '视同600月与2000年参加工作矛盾→截断为0并提示(E-08)', capped,
    y.e ? ('抛错:' + y.e.message) : ('N同=' + y.r.intermediates.N同 + ' 截断提示=' + capped), 'N同=0 且有截断 warning');
})();

// BUG-005：固定利率 NaN 阻断
(function () {
  var x = tryCalc(Object.assign({}, S3, { interestMode: 'fixed', fixedRate: NaN }));
  rec('R-BUG-005', 'BUG-005', '固定利率空输入NaN阻断(不再静默0%)', !!x.e, x.e ? x.e.message : '未阻断', '抛错');
  var z = tryCalc(Object.assign({}, S3, { interestMode: 'fixed', fixedRate: 0.3 }));
  rec('R-BUG-005b', 'BUG-005', '固定利率30%越界阻断', !!z.e, z.e ? z.e.message : '未阻断', '抛错');
})();

// BUG-006：C平/账户余额负值阻断
(function () {
  var x = tryCalc(Object.assign({}, S1, { cPingOverride: -1 }));
  rec('R-BUG-006a', 'BUG-006', 'C平覆盖值为负阻断', !!x.e, x.e ? x.e.message : '未阻断', '抛错');
  var y = tryCalc(Object.assign({}, S1, { accountBalanceManual: -100 }));
  rec('R-BUG-006b', 'BUG-006', '手工账户余额为负阻断', !!y.e, y.e ? y.e.message : '未阻断', '抛错');
})();

// BUG-007：half 口径退休当年缴费按月折算（2025利息应=10609.69）
(function () {
  var x = Engine.calculate(Object.assign({}, S3, { interestMode: 'fixed', fixedRate: 0.04, intraYearMethod: 'half' }));
  var y2025 = x.account.yearly.find(function (a) { return a.year === 2025; });
  near('R-BUG-007', 'BUG-007', 'half口径退休当年(2025)利息按月折算', y2025.interest, 10609.69, 0.5);
})();

// BUG-008：月入账精确累加 20月×564.528=11290.56
(function () {
  var x = Engine.calculate({ gender: 'male', birthYM: '1965-09', workStartYM: '2000-09', retireYM: '2025-09', interestMode: 'none',
    segments: [seg('flexible', '2024-01', '2025-08', 7056.6)] });
  near('R-BUG-008', 'BUG-008', '月入账精确累加不舍入(spec4.7)', x.intermediates.R储, 11290.56, 0.01);
})();

// BUG-009：缺口年度按 UI 的 C 年度口径录入（1991~1994），1992-10 z=1.2 且无1995缺口
(function () {
  var x = Engine.calculate({
    gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10', interestMode: 'none',
    customCYear: { 1991: 500, 1992: 600, 1993: 700, 1994: 678.67 },
    segments: [seg('enterprise', '1992-10', '2025-09', 10000)]
  });
  var oct92 = x.monthlyDetails.find(function (m) { return m.ym === '1992-10'; });
  var jun95 = x.monthlyDetails.find(function (m) { return m.ym === '1995-06'; });
  var noGap = !x.meta.warnings.some(function (w) { return /缺少官方月平均工资/.test(w); });
  rec('R-BUG-009', 'BUG-009', '缺口年度按C年口径录入：1992-10取C1991=500(z=2.0)、1995取C1994(z=1.4735)、无缺口警告',
    Math.abs(oct92.z - 20) < 0.001 && Math.abs(jun95.z - 10000 / 678.67) < 0.001 && noGap,
    'z92=' + oct92.z.toFixed(4) + ', z95=' + jun95.z.toFixed(4) + ', 缺口警告=' + !noGap,
    'z92=20, z95=14.7347, 无缺口警告');
  // 旧口径（缴费年度键）兼容性
  var y = Engine.calculate({
    gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10', interestMode: 'none',
    customCYear: { 1992: 500, 1993: 600, 1994: 700, 1995: 678.67 },
    segments: [seg('enterprise', '1992-10', '2025-09', 10000)]
  });
  var oct92b = y.monthlyDetails.find(function (m) { return m.ym === '1992-10'; });
  rec('R-BUG-009b', 'BUG-009', '旧按缴费年度键录入仍兼容(1992-10取custom1992=500)', Math.abs(oct92b.z - 20) < 0.001,
    'z92=' + oct92b.z.toFixed(4), 'z92=20');
})();

// BUG-010：退休早于参加工作阻断
(function () {
  var x = tryCalc({ gender: 'male', birthYM: '1970-01', workStartYM: '2020-01', retireYM: '2010-10', interestMode: 'none',
    segments: [seg('enterprise', '2005-01', '2009-12', 8000)] });
  rec('R-BUG-010', 'BUG-010', '退休早于参加工作阻断', !!x.e, x.e ? x.e.message : '未阻断', '抛错');
})();

// BUG-011：1992-10 前缴费段专项提示
(function () {
  var x = Engine.calculate({ gender: 'male', birthYM: '1960-01', workStartYM: '1980-01', retireYM: '2020-01', interestMode: 'none',
    segments: [seg('enterprise', '1985-01', '1991-12', 1000), seg('enterprise', '1992-10', '2019-12', 1000)] });
  var hasWarn = x.meta.warnings.some(function (w) { return /早于1992-10/.test(w); });
  rec('R-BUG-011', 'BUG-011', '1992前缴费段专项提示(E-02)', hasWarn, hasWarn ? '有专项提示' : '无', '含"早于1992-10"提示');
})();

// BUG-012：预估利率界面标注（静态）+ 引擎 warning
(function () {
  var wxml = fs.readFileSync(path.join(ROOT, 'pages', 'result', 'result.wxml'), 'utf8');
  var ui = /待官方核实/.test(wxml);
  var engWarn = r3.meta.warnings.some(function (w) { return /预估|待官方|沿用/.test(w); });
  rec('R-BUG-012', 'BUG-012', '预估利率界面角标+引擎warning(NFR-04)', ui && engWarn,
    'UI=' + ui + ' engine=' + engWarn, '两者均有');
})();

// GAP-01：延退对照表锚点 + 最低年限动态
(function () {
  var cases = [
    ['male', '1965-01', '2025-02'], ['male', '1976-09', '2039-09'],
    ['cadre', '1970-01', '2025-02'], ['cadre', '1981-09', '2039-09'],
    ['worker', '1975-01', '2025-02'], ['worker', '1984-11', '2039-11']
  ];
  var ok = cases.filter(function (c) { return Schedule.statutoryRetireYM(c[0], c[1]) === c[2]; });
  rec('R-GAP-01a', 'GAP-01', '延退对照表6锚点(男/女干/女工 起始与封顶)', ok.length === cases.length,
    ok.length + '/6', '6/6 与官方对照表一致');
  // 不受影响人群
  var pre = Schedule.statutoryRetireYM('male', '1964-12');
  rec('R-GAP-01b', 'GAP-01', '1964-12出生男性不延迟(2024-12退休)', pre === '2024-12', pre, '2024-12');
  // 最低缴费年限 2030=186, 2039=240
  var e2030 = Engine.calculate({ gender: 'male', birthYM: '1969-06', workStartYM: '2010-01', retireYM: '2030-06', interestMode: 'none',
    segments: [seg('enterprise', '2010-01', '2030-05', 8000)] });
  var req2030 = e2030.meta.minRequiredMonths || e2030.meta.requiredMonths || (e2030.meta.eligibility && e2030.meta.eligibility.requiredMonths);
  var keys2030 = JSON.stringify(Object.keys(e2030.meta));
  rec('R-GAP-01c', 'GAP-01', '2030-06退休最低缴费186月(附件4)', req2030 === 186, 'req=' + req2030 + ' meta keys=' + keys2030, '186');
})();

// GAP-02：结果页含当年利息/年末余额列
(function () {
  var wxml = fs.readFileSync(path.join(ROOT, 'pages', 'result', 'result.wxml'), 'utf8');
  rec('R-GAP-02', 'GAP-02', '结果页含当年利息+年末余额+利率来源(FR-11)',
    /当年利息/.test(wxml) && /年末本息余额|年末余额/.test(wxml) && /rateSource/.test(wxml), '静态检查', '三者均在');
})();

// BUG-013：总额=分项展示值之和（S1/S2/S3）
(function () {
  [['S1', r1], ['S2', r2], ['S3', r3]].forEach(function (p) {
    var pn = p[1].pension;
    var sum = Math.round((pn.J基础 + pn.J账户 + pn.J过渡) * 100) / 100;
    rec('R-BUG-013-' + p[0], 'BUG-013', p[0] + ' 总额=三分项展示值之和', sum === pn.total,
      pn.J基础 + '+' + pn.J账户 + '+' + pn.J过渡 + '=' + sum + ' vs total=' + pn.total, '严格相等');
  });
})();

// BUG-014：缴费晚于退休截断提示
(function () {
  var x = Engine.calculate({ gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10', interestMode: 'none',
    segments: [seg('enterprise', '2020-01', '2026-06', 8000)] });
  var hasWarn = x.meta.warnings.some(function (w) { return /截断|退休当月不缴费/.test(w); });
  var last = x.monthlyDetails[x.monthlyDetails.length - 1];
  rec('R-BUG-014', 'BUG-014', '晚于退休缴费截断+提示(E-03)', hasWarn && last.ym === '2025-09',
    '提示=' + hasWarn + ' 末月=' + last.ym, '提示且末月2025-09');
})();

// BUG-015：出生年月范围
(function () {
  var x = tryCalc(Object.assign({}, S1, { birthYM: '1899-01', retireYM: '1969-01' }));
  rec('R-BUG-015', 'BUG-015', '出生1899阻断且文案对症(spec7.2)', !!x.e && x.e && /1940|2010/.test(x.e.message),
    x.e ? x.e.message : '未阻断', '抛错含1940/2010');
})();

// BUG-016：Z实/N应缴 官方角标
(function () {
  var wxml = fs.readFileSync(path.join(ROOT, 'pages', 'result', 'result.wxml'), 'utf8');
  var zLine = wxml.split('\n').filter(function (l) { return /Z实指数/.test(l); })[0] || '';
  var nLine = wxml.split('\n').filter(function (l) { return /N应缴/.test(l); })[0] || '';
  rec('R-BUG-016', 'BUG-016', 'Z实指数/N应缴 使用tag-official',
    /tag-official/.test(zLine) && /tag-official/.test(nLine),
    'Z行' + (/tag-official/.test(zLine) ? '✓' : '✗') + ' N行' + (/tag-official/.test(nLine) ? '✓' : '✗'), '均官方角标');
})();

// GAP-03/04/05/06：年度模式/越界提示/复制上一段/CSV
(function () {
  var iwxml = fs.readFileSync(path.join(ROOT, 'pages', 'index', 'index.wxml'), 'utf8');
  var ijs = fs.readFileSync(path.join(ROOT, 'pages', 'index', 'index.js'), 'utf8');
  var rwxml = fs.readFileSync(path.join(ROOT, 'pages', 'result', 'result.wxml'), 'utf8');
  var rjs = fs.readFileSync(path.join(ROOT, 'pages', 'result', 'result.js'), 'utf8');
  rec('R-GAP-03', 'GAP-03', '年度录入模式(FR-05)', /年度模式|addYearRow|entryMode/.test(iwxml) && /addYearRow|expandYearRows/.test(ijs), '静态', '存在');
  rec('R-GAP-04', 'GAP-04', '基数60%-300%越界黄字提示(E-05)', /collectBoundWarnings|越界|核定区间/.test(ijs) && /越界|核定/.test(iwxml), '静态', '存在');
  rec('R-GAP-05', 'GAP-05', '复制上一段/批量填充(FR-04)', /copyLastSegment/.test(ijs) && /复制上一段/.test(iwxml), '静态', '存在');
  rec('R-GAP-06', 'GAP-06', '明细导出CSV(FR-11)', /exportCsv/.test(rjs) && /CSV/.test(rwxml), '静态', '存在');
})();

// ============================================================================
// B. 核心场景手工/独立 oracle 对拍（周边回归，防修复引入公式偏差）
// ============================================================================
(function () {
  var o1 = Oracle(S1), o2 = Oracle(S2), o3 = Oracle(S3);
  // S1
  near('R-S1-Z', '-', 'S1 Z实指数', r1.intermediates.Z实指数, 1.0, 1e-6);
  near('R-S1-N实同', '-', 'S1 N实+同=40.25', r1.intermediates.N实同, 40.25, 0.001);
  near('R-S1-J基础', '-', 'S1 J基础=4849.72', r1.pension.J基础, 4849.72, 0.02);
  near('R-S1-G同', '-', 'S1 G同=873.55', r1.pension && r1.intermediates.G同, 873.55, 0.02);
  near('R-S1-G实', '-', 'S1 G实=692.82', r1.intermediates.G实, 692.82, 0.02);
  near('R-S1-总', '-', 'S1 合计=7457.38', r1.pension.total, 7457.38, 0.5);
  near('R-S1-oracle', '-', 'S1 R储 对独立oracle', r1.intermediates.R储, o1.R储, 0.5);
  // S2
  near('R-S2-Z', '-', 'S2 Z实指数=2.2627', r2.intermediates.Z实指数, 2.2627, 0.001);
  near('R-S2-N实同', '-', 'S2 N实+同=27.75(333月)', r2.intermediates.N实同, 27.75, 0.001);
  near('R-S2-R储', '-', 'S2 R储=298962.05', r2.intermediates.R储, 298962.05, 1);
  near('R-S2-oracle', '-', 'S2 R储 对独立oracle', r2.intermediates.R储, o2.R储, 1);
  near('R-S2-J账户', '-', 'S2 J账户=1533.14', r2.pension.J账户, 1533.14, 0.02);
  near('R-S2-G实', '-', 'S2 G实=795.19', r2.intermediates.G实, 795.19, 0.5);
  near('R-S2-总', '-', 'S2 合计=7782.98', r2.pension.total, 7782.98, 0.5);
  // S3
  near('R-S3-R储', '-', 'S3 新人R储=430669.96(官方利率)', r3.intermediates.R储, 430669.96, 1);
  near('R-S3-oracle', '-', 'S3 R储 对独立oracle', r3.intermediates.R储, o3.R储, 1);
  near('R-S3-G', '-', 'S3 新人无过渡性养老金', r3.pension.J过渡, 0, 0.001);
  // 计息/不计息对比（S3 输入）
  var r3none = Engine.calculate(Object.assign({}, S3, { interestMode: 'none' }));
  near('R-CMP-principal', '-', 'S3不计息R储=本金240000', r3none.intermediates.R储, 240000, 0.01);
  rec('R-CMP-gt', '-', '官方计息R储>不计息本金', r3.intermediates.R储 > 240000, r3.intermediates.R储, '>240000');
  // 跨月/退休当月不缴
  var cross = Engine.calculate({ gender: 'male', birthYM: '1965-10', workStartYM: '2000-01', retireYM: '2025-10', interestMode: 'none',
    segments: [seg('enterprise', '2024-11', '2025-12', 10000)] });
  var lastM = cross.monthlyDetails[cross.monthlyDetails.length - 1];
  rec('R-CROSS', '-', '退休当月不缴费(末月2025-09)+跨年分母切换', lastM.ym === '2025-09', lastM.ym, '2025-09');
})();

// ============================================================================
// C. 输出
// ============================================================================
var pass = results.filter(function (r) { return r.pass; }).length;
var fail = results.length - pass;
if (process.argv.indexOf('--json') >= 0) {
  console.log(JSON.stringify({ total: results.length, pass: pass, fail: fail, results: results }, null, 1));
} else {
  console.log('========== 阶段5 独立回归结果 ==========');
  console.log('总计 ' + results.length + ' 通过 ' + pass + ' 失败 ' + fail);
  results.filter(function (r) { return !r.pass; }).forEach(function (r) {
    console.log('[FAIL] ' + r.id + ' (' + r.bug + ') ' + r.title + '\n   实际: ' + r.actual + '\n   期望: ' + r.expected);
  });
  console.log(fail === 0 ? '全部通过 ✅' : ('存在 ' + fail + ' 条失败 ❌'));
}
process.exit(fail === 0 ? 0 : 1);
