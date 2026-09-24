// tests/run-tests.js
// 阶段3首轮系统测试 —— 计算引擎自动化测试夹具（不修改服务器源码，仅新增 tests/ 目录）
// 运行：node tests/run-tests.js [--json]
// 用例编号与 docs/test-cases.md 对应：TC-F 功能/字段 | TC-C 计算正确性 | TC-I 中间变量
//                              TC-U 界面(自动部分) | TC-X 异常/兼容 | TC-P 政策可追溯
// 判定：AUTO=自动断言；WALK=代码级走查（需微信开发者工具人工验证的在 test-cases.md 标注）
var path = require('path');
var Engine = require(path.join(__dirname, '..', 'calculator', 'pensionEngine.js'));

// 批次1 #8 契约收紧后（accountBalanceManual UI 路径必填），旧套件统一走保留的历史重建逃生口。
var __engineCalculate = Engine.calculate;
Engine.calculate = function (input) {
  if (input && input.accountBalanceManual == null && input.accountReconstruct == null) {
    input.accountReconstruct = true;
  }
  return __engineCalculate(input);
};
var Oracle = require(path.join(__dirname, 'oracle.js')).oracle;
var D = require(path.join(__dirname, '..', 'calculator', 'dateUtil.js'));
var P = require(path.join(__dirname, '..', 'constants', 'policyData.js'));
var REFS = require(path.join(__dirname, '..', 'constants', 'policyRefs.js'));

var results = [];
function rec(id, title, pri, kind, pass, actual, expected, note) {
  results.push({ id: id, title: title, pri: pri, kind: kind, pass: !!pass,
    actual: actual, expected: expected, note: note || '' });
}
function ok(id, title, pri, kind, cond, actual, expected, note) {
  rec(id, title, pri, kind, cond === true || (typeof cond === 'number' && cond === 0), actual, expected, note);
}
function near(id, title, pri, kind, actual, expected, tol, note) {
  var pass = Math.abs(actual - expected) <= tol;
  rec(id, title, pri, kind, pass, actual, expected + ' (±' + tol + ')', note || '');
}
function throws(id, title, pri, kind, fn, re, note) {
  var e = null;
  try { fn(); } catch (err) { e = err; }
  rec(id, title, pri, kind, !!(e && (!re || re.test(e.message))),
    e ? e.message : '未抛错', '抛错' + (re ? re : ''), note || '');
}
function seg(t, a, b, x) { return { type: t, startYM: a, endYM: b, baseMonthly: x }; }
var CUSTOM_GAP = { 1992: 500, 1993: 600, 1994: 700, 1995: 678.67 }; // 1991-1994缺口手录（T-10）
var CUSTOM_GAP2 = { 1995: 678.67 };

// ===========================================================================
// 一、功能/字段输入（TC-F）
// ===========================================================================
// TC-F-001 性别缺失
throws('TC-F-001', '性别缺失阻断', 'P0', 'AUTO',
  function () { Engine.calculate({ birthYM: '1965-10', retireYM: '2025-10', segments: [] }); }, /性别/);

// TC-F-002 女性未选工人/干部（E-11）
throws('TC-F-002', '女性未选身份阻断(E-11)', 'P0', 'AUTO',
  function () { Engine.calculate({ gender: 'female', birthYM: '1980-01', retireYM: '2030-01', segments: [] }); }, /女工人|女干部/);

// TC-F-003 非法出生年月
throws('TC-F-003', '出生年月格式非法阻断', 'P1', 'AUTO',
  function () { Engine.calculate({ gender: 'male', birthYM: '1965-13', retireYM: '2025-10', segments: [] }); }, /非法年月|格式非法/);

// TC-F-004 退休年龄<40
throws('TC-F-004', '退休年龄<40阻断(E-01)', 'P0', 'AUTO',
  function () { Engine.calculate({ gender: 'male', birthYM: '2000-01', retireYM: '2030-01', interestMode: 'fixed', fixedRate: 0.5, segments: [] }); }, /40-70|利率/);

// TC-F-005 退休年龄>70
throws('TC-F-005', '退休年龄>70阻断(E-01)', 'P0', 'AUTO',
  function () { Engine.calculate({ gender: 'male', birthYM: '1940-01', retireYM: '2025-01', segments: [] }); }, /40-70/);

// TC-F-006 出生年月范围 1940-01~2010-12（spec 7.2）——引擎未实现该范围校验
(function () {
  var e = null;
  try { Engine.calculate({ gender: 'male', birthYM: '1899-01', retireYM: '1969-01', segments: [] }); }
  catch (err) { e = err; }
  // 1899 出生退休早于1992区间会抛另一错误；再测 2015 出生（70岁内退休不可能）——仅记录引擎无出生日期范围校验
  rec('TC-F-006', '出生年月限定1940-01~2010-12(spec7.2)', 'P2', 'WALK',
    !!(e && /1940|2010|出生/.test(e.message)), e ? e.message : '无出生日期范围校验',
    '按spec 7.2提示非法出生年月', '引擎仅靠退休年龄/应缴区间间接拦截，未直接校验出生范围');
})();

// TC-F-007 缴费段结束早于开始
throws('TC-F-007', '缴费段结束早于开始阻断', 'P1', 'AUTO',
  function () { Engine.calculate({ gender: 'male', birthYM: '1965-10', retireYM: '2025-10', interestMode: 'none', segments: [seg('enterprise', '2025-09', '2020-01', 8000)] }); }, /结束早于开始/);

// TC-F-008 缴费基数非数字
throws('TC-F-008', '缴费基数非数字阻断', 'P1', 'AUTO',
  function () { Engine.calculate({ gender: 'male', birthYM: '1965-10', retireYM: '2025-10', interestMode: 'none', segments: [{ type: 'enterprise', startYM: '2020-01', endYM: '2025-09', baseMonthly: 'abc' }] }); }, /基数非法/);

// TC-F-009 缴费基数=0（允许，E-10 极端）
(function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-09', workStartYM: '2000-09', retireYM: '2025-09', interestMode: 'none', segments: [seg('enterprise', '2000-09', '2025-08', 0)] });
  ok('TC-F-009', '基数0允许且J账户=0(E-10)', 'P2', 'AUTO',
    r.intermediates.R储 === 0 && r.pension.J账户 === 0, JSON.stringify({ R储: r.intermediates.R储, J账户: r.pension.J账户 }), 'R储=0,J账户=0');
})();

// TC-F-010 基数下限边界：2024年 60%档=7162.2 可录入（越界提示走 TC-X-006）
(function () {
  // 2024年缴费基数上下限按2023年全口径月均11761核定：60%=7056.6，300%=35283（P-06/P-08）
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-09', workStartYM: '2000-09', retireYM: '2025-09', interestMode: 'none', segments: [seg('flexible', '2024-01', '2025-08', 11761 * 0.6)] });
  near('TC-F-010', '灵活就业60%档(7056.6)月指数≈0.6', 'P0', 'AUTO',
    r.monthlyDetails.find(function (d) { return d.ym === '2024-01'; }).z, 0.6, 0.001);
})();

// TC-F-011 基数上限边界：2024年 300%档=35811
(function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-09', workStartYM: '2000-09', retireYM: '2025-09', interestMode: 'none', segments: [seg('enterprise', '2024-01', '2025-08', 11761 * 3)] });
  near('TC-F-011', '300%档基数(35283)月指数≈3.0', 'P1', 'AUTO',
    r.monthlyDetails.find(function (d) { return d.ym === '2024-01'; }).z, 3.0, 0.001);
})();

// TC-F-012 固定利率 0% 与 24% 边界
(function () {
  var inp = { gender: 'male', birthYM: '1965-09', workStartYM: '2000-09', retireYM: '2025-09', segments: [seg('enterprise', '2024-01', '2025-08', 10000)] };
  var r0 = Engine.calculate(Object.assign({ interestMode: 'fixed', fixedRate: 0 }, inp));
  var r24 = Engine.calculate(Object.assign({ interestMode: 'fixed', fixedRate: 0.24 }, inp));
  ok('TC-F-012', '固定利率边界0%/24%均可计算', 'P1', 'AUTO',
    r0.intermediates.R储 === 16000 && r24.intermediates.R储 > 16000,
    JSON.stringify({ r0: r0.intermediates.R储, r24: r24.intermediates.R储 }), '0%=本金16000；24%增值');
})();

// TC-F-013 固定利率 24.01% 越界
throws('TC-F-013', '固定利率>24%阻断(spec7.2)', 'P1', 'AUTO',
  function () { Engine.calculate({ gender: 'male', birthYM: '1965-09', retireYM: '2025-09', interestMode: 'fixed', fixedRate: 0.2401, segments: [seg('enterprise', '2024-01', '2025-08', 10000)] }); }, /利率/);

// TC-F-014 固定利率空输入(NaN, UI可达) 应阻断——实际静默按0
(function () {
  var e = null, r = null;
  try { r = Engine.calculate({ gender: 'male', birthYM: '1965-09', workStartYM: '2000-09', retireYM: '2025-09', interestMode: 'fixed', fixedRate: NaN, segments: [seg('enterprise', '2024-01', '2025-08', 10000)] }); }
  catch (err) { e = err; }
  rec('TC-F-014', '固定利率空输入应阻断(spec7.2必填)', 'P1', 'AUTO', !!e,
    e ? e.message : '静默通过，R储=' + r.intermediates.R储 + '（被当作0%计息）', '阻断提示填写利率',
    'BUG: typeof NaN==="number" 绕过 0≤r≤24 校验，r>0 为 false 静默免息');
})();

// TC-F-015 手工视同月数留空(NaN, index.js parseInt("") 真实路径)
(function () {
  var e = null, r = null;
  try {
    r = Engine.calculate({ gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10', deemedMonths: NaN, interestMode: 'none', segments: [seg('enterprise', '1992-10', '2025-09', 8000)], customCYear: CUSTOM_GAP });
  } catch (err) { e = err; }
  rec('TC-F-015', '手工视同月数留空应阻断/回退估算', 'P0', 'AUTO',
    !!e || (r && isFinite(r.pension.total)),
    e ? e.message : ('N同=' + (r ? r.intermediates.N同 : '?') + ' total=' + (r ? r.pension.total : '?')),
    '阻断或回退为按工作时间估算，结果须为有限数',
    'BUG: NaN 透传致 N同/G同/total 全为 NaN、eligible=false（UI手工模式留空可触发）');
})();

// TC-F-016 手工视同月数为负
(function () {
  var e = null, r = null;
  try { r = Engine.calculate({ gender: 'male', birthYM: '1965-10', workStartYM: '2000-01', retireYM: '2025-10', deemedMonths: -5, interestMode: 'none', segments: [seg('enterprise', '2000-01', '2025-09', 8000)] }); }
  catch (err) { e = err; }
  rec('TC-F-016', '手工视同月数为负应拒绝(spec7.2:0~600)', 'P1', 'AUTO',
    !!e || (r && r.intermediates.N同 >= 0),
    e ? e.message : ('N同=' + (r ? r.intermediates.N同 : '?')),
    '阻断并提示月数≥0', 'BUG: 负数透传，N同为负、N实+同虚减、J基础错误');
})();

// TC-F-017 手工视同月数 0~600 正常
(function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10', deemedMonths: 87, interestMode: 'none', segments: [seg('enterprise', '1992-10', '2025-09', 8000)], customCYear: CUSTOM_GAP });
  near('TC-F-017', '手工视同87月→N同=7.25年', 'P1', 'AUTO', r.intermediates.N同, 7.25, 1e-9);
})();

// TC-F-018 视同月数与参加工作时间矛盾（E-08：应截断到1992-09）
(function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-10', workStartYM: '2000-01', retireYM: '2025-10', deemedMonths: 600, interestMode: 'none', segments: [seg('enterprise', '2000-01', '2025-09', 8000)] });
  var capped = Math.round((D.toIndex('1992-09') - D.toIndex('2000-01') + 1) / 12 * 100) / 100; // 工作在1992后→应为0
  rec('TC-F-018', '视同月数与工作时间矛盾须截断/提示(E-08)', 'P0', 'AUTO',
    r.intermediates.N同 === 0 || r.intermediates.N同 === capped,
    'N同=' + r.intermediates.N同 + '年(600月), eligible=' + r.meta.eligible,
    '2000年参加工作者视同月数应为0并提示',
    'BUG: 600月全部采信，N同=50年，G同/J基础虚增，eligible 虚高；无截断无提示');
})();

// ===========================================================================
// 二、计算正确性（TC-C）——期望值全部手工推导，过程见 test-cases.md
// ===========================================================================
// ---- 场景(a) S1：1992年前参加工作男性老人，2025-10退休，不计息 ----
(function () {
  var input = {
    gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10',
    interestMode: 'none', segments: [], customCYear: CUSTOM_GAP
  };
  [['1992-10', '1992-12', 500], ['1993-01', '1993-12', 600], ['1994-01', '1994-12', 700], ['1995-01', '1995-12', 678.67]]
    .forEach(function (a) { input.segments.push(seg('enterprise', a[0], a[1], a[2])); });
  Object.keys(P.indexDenominatorMonthly).forEach(function (yy) {
    yy = +yy;
    input.segments.push(seg('enterprise', yy + '-01', yy === 2025 ? '2025-09' : yy + '-12', P.indexDenominatorMonthly[yy]));
  });
  var r = Engine.calculate(input);
  near('TC-C-101', 'S1 N同=87月=7.25年（1985-07~1992-09）', 'P0', 'AUTO', r.intermediates.N同, 7.25, 1e-9);
  near('TC-C-102', 'S1 N实98=69月=5.75年（1992-10~1998-06）', 'P0', 'AUTO', r.intermediates.N实98, 5.75, 1e-9);
  ok('TC-C-103', 'S1 K应缴=396月（1992-10~2025-09）', 'P0', 'AUTO', r.intermediates.K应缴月 === 396, r.intermediates.K应缴月, 396);
  near('TC-C-104', 'S1 N应缴=33年', 'P0', 'AUTO', r.intermediates.N应缴, 33, 1e-9);
  near('TC-C-105', 'S1 N实+同=(396+87)/12=40.25年', 'P0', 'AUTO', r.intermediates.N实同, 40.25, 1e-9);
  near('TC-C-106', 'S1 Z实指数=1.0000（每年按分母足额）', 'P0', 'AUTO', r.intermediates.Z实指数, 1.0, 1e-6);
  ok('TC-C-107', 'S1 Z同指数=1.0', 'P0', 'AUTO', r.intermediates.Z同指数 === 1, r.intermediates.Z同指数, 1);
  ok('TC-C-108', 'S1 C平=12049（2025年度计发基数）', 'P0', 'AUTO', r.intermediates.C平 === 12049, r.intermediates.C平, 12049);
  ok('TC-C-109', 'S1 M=139（60岁）', 'P0', 'AUTO', r.intermediates.M === 139, r.intermediates.M, 139);
  near('TC-C-110', 'S1 J基础=12049×40.25×1%=4849.72', 'P0', 'AUTO', r.pension.J基础, 4849.72, 0.01);
  near('TC-C-111', 'S1 G同=12049×1×7.25×1%=873.55', 'P0', 'AUTO', r.intermediates.G同, 873.55, 0.01);
  near('TC-C-112', 'S1 G实=12049×1×5.75×1%=692.82', 'P0', 'AUTO', r.intermediates.G实, 692.82, 0.01);
  near('TC-C-113', 'S1 J过渡=G同+G实=1566.37', 'P0', 'AUTO', r.pension.J过渡, 1566.37, 0.02);
  // R储 手算：Σ B×8%，独立在测试内累加（不看引擎结果）
  var manualPrincipal = 0;
  input.segments.forEach(function (s) {
    manualPrincipal += (D.toIndex(s.endYM) - D.toIndex(s.startYM) + 1) * s.baseMonthly * 0.08;
  });
  near('TC-C-114', 'S1 R储=ΣB×8%手算值（不计息）', 'P0', 'AUTO', r.intermediates.R储, manualPrincipal, 0.5,
    '严格不舍入期望=' + manualPrincipal.toFixed(2) + '；逐月round2差异见TC-I-301');
  near('TC-C-115', 'S1 J账户=R储/139', 'P0', 'AUTO', r.pension.J账户, r.intermediates.R储 / 139, 0.01);
  near('TC-C-116', 'S1 合计≈7457.38', 'P0', 'AUTO', r.pension.total, 7457.38, 0.5);
  // V1.2：T-01 已关闭。普通企业职工 R补=0、applicable=false，总额与V1.1零差异（AC-RC-02）
  ok('TC-C-117', 'S1 R补=0（非31号文人员，AC-RC-02）', 'P0', 'AUTO', r.intermediates.R补 === 0, String(r.intermediates.R补), '0');
  ok('TC-C-117A', 'S1 R补 applicable=false', 'P0', 'AUTO', r.accountSubsidy.applicable === false && r.accountSubsidy.reason === 'not-doc31-person', r.accountSubsidy.reason, 'not-doc31-person');
  ok('TC-C-118', 'S1 eligible=true（483月≥180月）', 'P0', 'AUTO', r.meta.eligible === true, String(r.meta.eligible), 'true');
})();

// ---- 场景(a2) 同一人 2024-10 退休：C平=11883，K/N应缴 少12个月 ----
(function () {
  var input = {
    gender: 'male', birthYM: '1964-10', workStartYM: '1985-07', retireYM: '2024-10',
    interestMode: 'none', baseYearOverride: 2024, segments: [], customCYear: CUSTOM_GAP
  };
  [['1992-10', '1992-12', 500], ['1993-01', '1993-12', 600], ['1994-01', '1994-12', 700], ['1995-01', '1995-12', 678.67]]
    .forEach(function (a) { input.segments.push(seg('enterprise', a[0], a[1], a[2])); });
  Object.keys(P.indexDenominatorMonthly).map(Number).filter(function (y) { return y <= 2024; }).forEach(function (yy) {
    input.segments.push(seg('enterprise', yy + '-01', yy === 2024 ? '2024-09' : yy + '-12', P.indexDenominatorMonthly[yy]));
  });
  var r = Engine.calculate(input);
  ok('TC-C-120', '2024退休 C平=11883', 'P1', 'AUTO', r.intermediates.C平 === 11883, r.intermediates.C平, 11883);
  ok('TC-C-121', '2024退休 K=384月(较2025少12)', 'P1', 'AUTO', r.intermediates.K应缴月 === 384, r.intermediates.K应缴月, 384);
  near('TC-C-122', '2024退休 J基础=11883×39.25×1%=4664.08', 'P1', 'AUTO', r.pension.J基础, 11883 * 39.25 * 0.01, 0.01);
})();

// ---- 场景(b) S2：女工人失业转灵活就业，20%缴费/8%入账，固定4% ----
(function () {
  var input = { gender: 'female', femaleType: 'worker', birthYM: '1975-05', workStartYM: '1995-08', retireYM: '2025-05',
    interestMode: 'fixed', fixedRate: 0.04, intraYearMethod: 'monthly', customCYear: CUSTOM_GAP2,
    segments: [seg('enterprise', '1995-08', '2015-12', 6000), seg('flexible', '2018-01', '2025-04', 7855 * 0.6)] };
  var r = Engine.calculate(input);
  ok('TC-C-201', 'S2 50岁退休 M=195（女工人）', 'P0', 'AUTO', r.intermediates.M === 195, r.intermediates.M, 195);
  ok('TC-C-202', 'S2 K应缴=357月（Bug23：窗口自参工月1995-08~2025-04，含24月断缴）', 'P0', 'AUTO', r.intermediates.K应缴月 === 357, r.intermediates.K应缴月, 357);
  near('TC-C-203', 'S2 N应缴=29.75年', 'P1', 'AUTO', r.intermediates.N应缴, 357 / 12, 1e-4);
  ok('TC-C-204', 'S2 实缴=245+88=333月（企业段245月）', 'P0', 'AUTO', r.intermediates.actualPaidMonths === 333, r.intermediates.actualPaidMonths, 333);
  near('TC-C-205', 'S2 N实98=35月=2.9167年（1995-08~1998-06）', 'P0', 'AUTO', r.intermediates.N实98, 35 / 12, 1e-4);
  ok('TC-C-206', 'S2 N同=0（1995参加工作）', 'P1', 'AUTO', r.intermediates.N同 === 0, r.intermediates.N同, 0);
  // 手算 Z：见 test-cases.md TC-C-207 逐年表
  var o = Oracle(input);
  near('TC-C-207', 'S2 Z实指数=独立参照手算值', 'P0', 'AUTO', r.intermediates.Z实指数, o.Z, 1e-3);
  // 灵活段：88月，月入账=4713×8%=377.04；成本=4713×20%×88
  ok('TC-C-208', 'S2 灵活段88月（2018-01~2025-04）', 'P0', 'AUTO', r.flexInfo.months === 88, r.flexInfo.months, 88);
  near('TC-C-209', 'S2 灵活段缴费成本=4713×20%×88=82948.80', 'P1', 'AUTO', r.flexInfo.totalCost, 4713 * 0.2 * 88, 0.01);
  near('TC-C-210', 'S2 灵活段月入账=4713×8%=377.04', 'P1', 'AUTO',
    r.monthlyDetails.find(function (d) { return d.ym === '2018-01'; }).principal8, 377.04, 0.01);
  // R储：引擎 vs 独立参照（精确不舍入）
  near('TC-C-211', 'S2 R储=独立参照逐年复利值', 'P0', 'AUTO', r.intermediates.R储, o.R储, 0.5,
    'oracle=' + o.R储.toFixed(2) + '；差异源于逐月round2(TC-I-301)');
  ok('TC-C-212', 'S2 R储>本金（含利息）', 'P0', 'AUTO', r.intermediates.R储 > r.intermediates.R储本金,
    r.intermediates.R储 + '>' + r.intermediates.R储本金, 'R储>本金');
  near('TC-C-213', 'S2 J账户=R储/195', 'P0', 'AUTO', r.pension.J账户, r.intermediates.R储 / 195, 0.01);
  near('TC-C-214', 'S2 G实=12049×Z×(35/12)×1%', 'P0', 'AUTO', r.intermediates.G实, 12049 * o.Z * 35 / 12 * 0.01, 0.5);
  ok('TC-C-215', 'S2 G同=0', 'P1', 'AUTO', r.intermediates.G同 === 0, r.intermediates.G同, 0);
  near('TC-C-216', 'S2 合计=J基础+J账户+G实（±0.02舍入）', 'P0', 'AUTO',
    r.pension.total, r.pension.J基础 + r.pension.J账户 + r.intermediates.G实, 0.02);
})();

// ---- 场景(c) S3：1998-07后参加工作新人，无过渡性养老金，官方历年利率 ----
(function () {
  var input = { gender: 'male', birthYM: '1965-09', workStartYM: '2000-09', retireYM: '2025-09',
    interestMode: 'official', fallbackRate: 0.0262, segments: [seg('enterprise', '2000-09', '2025-08', 10000)] };
  var r = Engine.calculate(input);
  ok('TC-C-301', 'S3 人员类型=新人', 'P0', 'AUTO', /新人/.test(r.meta.personType), r.meta.personType, '新人');
  ok('TC-C-302', 'S3 G同=0', 'P0', 'AUTO', r.intermediates.G同 === 0, r.intermediates.G同, 0);
  ok('TC-C-303', 'S3 G实=0（N实98=0）', 'P0', 'AUTO', r.intermediates.G实 === 0 && r.intermediates.N实98 === 0,
    JSON.stringify({ G实: r.intermediates.G实, N实98: r.intermediates.N实98 }), '0/0');
  ok('TC-C-304', 'S3 J过渡=0', 'P0', 'AUTO', r.pension.J过渡 === 0, r.pension.J过渡, 0);
  near('TC-C-305', 'S3 本金=300月×800=240000', 'P0', 'AUTO', r.intermediates.R储本金, 240000, 0.01);
  // 利息手算抽查（完整逐年表见 test-cases.md）：
  // 2000年(assumed2.62%)：本金3200，当年缴费利息=800×0.0262×(4+3+2+1)/12=17.47
  var y2000 = r.account.yearly.find(function (y) { return y.year === 2000; });
  near('TC-C-306', 'S3 2000年利息手算=17.47（9月入职，4个缴费月折算）', 'P1', 'AUTO', y2000.interest, 17.47, 0.02);
  // 2024全年官方利率2.62%：缴费利息=800×0.0262×(12+..+1)/12=800×0.0262×6.5=136.24
  var y2024 = r.account.yearly.find(function (y) { return y.year === 2024; });
  var expInt2024 = y2024.startBalance * 0.0262 + 136.24;
  near('TC-C-307', 'S3 2024年利息=年初余额×2.62%+136.24', 'P1', 'AUTO', y2024.interest, expInt2024, 0.02);
  // 退休当年2025仅1-8月：年初余额×2.62%×8/12；缴费权重(12+..+5)/12=68/12
  var y2025 = r.account.yearly.find(function (y) { return y.year === 2025; });
  var expInt2025 = y2025.startBalance * 0.0262 * 8 / 12 + 800 * 0.0262 * 68 / 12;
  near('TC-C-308', 'S3 2025退休当年利息按8个月折算', 'P0', 'AUTO', y2025.interest, expInt2025, 0.02);
  var o = Oracle(input);
  near('TC-C-309', 'S3 R储=独立参照值', 'P0', 'AUTO', r.intermediates.R储, o.R储, 0.5);
  near('TC-C-310', 'S3 合计=J基础+J账户', 'P0', 'AUTO', r.pension.total, r.pension.J基础 + r.pension.J账户, 0.02);
})();

// ---- 场景(d) 不计息 vs 固定4% vs 官方利率；monthly vs half ----
(function () {
  var base = { gender: 'male', birthYM: '1965-09', workStartYM: '2000-09', retireYM: '2025-09', segments: [seg('enterprise', '2000-09', '2025-08', 10000)] };
  var rn = Engine.calculate(Object.assign({ interestMode: 'none' }, base));
  var r0 = Engine.calculate(Object.assign({ interestMode: 'fixed', fixedRate: 0 }, base));
  var rm = Engine.calculate(Object.assign({ interestMode: 'fixed', fixedRate: 0.04, intraYearMethod: 'monthly' }, base));
  var rh = Engine.calculate(Object.assign({ interestMode: 'fixed', fixedRate: 0.04, intraYearMethod: 'half' }, base));
  ok('TC-C-401', '不计息R储=固定0%R储=本金240000', 'P0', 'AUTO',
    rn.intermediates.R储 === 240000 && r0.intermediates.R储 === 240000,
    JSON.stringify({ none: rn.intermediates.R储, fixed0: r0.intermediates.R储 }), '240000/240000');
  ok('TC-C-402', '4%计息R储>不计息R储', 'P0', 'AUTO', rm.intermediates.R储 > 240000,
    '4%=' + rm.intermediates.R储 + ' vs 240000', '4%增值');
  // monthly 与 half 差异：全年缴费 Σw 6.5(monthly) vs 0.5(half)=6.0，每月800×4%×(6.5-6)=16元/年（仅当年缴费部分），另退休年规则见TC-C-404
  ok('TC-C-403', 'monthly口径利息>half口径利息（全年折算权重6.5>6.0）', 'P1', 'AUTO',
    rm.intermediates.R储利息 > rh.intermediates.R储利息,
    'monthly利息=' + rm.intermediates.R储利息 + ' half利息=' + rh.intermediates.R储利息, 'monthly>half');
  // half 口径退休当年（S3 2025 1-8月）：spec 4.6「退休当年只计到退休前一月，同规则按月折算」
  var hy = rh.account.yearly.find(function (y) { return y.year === 2025; });
  var expectHalf2025 = hy.startBalance * 0.04 * 8 / 12 + 800 * 0.04 * 68 / 12; // 年初余额折算8月+缴费按月折算
  rec('TC-C-404', 'half口径退休当年缴费仍应按月折算(spec4.6)', 'P1', 'AUTO',
    Math.abs(hy.interest - expectHalf2025) <= 0.02,
    '实际2025利息=' + hy.interest.toFixed(2) + '（缴费按固定0.5权重）',
    '期望=' + expectHalf2025.toFixed(2),
    'BUG: half模式退休当年缴费仍×0.5全年权重，多/少计利息；年初余额已正确折算但缴费部分未折算');
})();

// ---- 场景(e) 跨月/不足月/闰年 ----
(function () {
  // 不足月退休：2025-10退休，缴至2025-09；退休当年账户与指数均不含退休当月
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10', interestMode: 'none', segments: [seg('enterprise', '2025-01', '2025-12', 10000)], customCYear: {} });
  ok('TC-C-501', '退休当月缴费被截断（最后明细=2025-09）(E-03/4.6)', 'P0', 'AUTO',
    r.monthlyDetails[r.monthlyDetails.length - 1].ym === '2025-09',
    r.monthlyDetails[r.monthlyDetails.length - 1].ym, '2025-09');
  near('TC-C-502', '退休当年仅9个月入账=9×800=7200', 'P1', 'AUTO',
    r.account.yearly.find(function (y) { return y.year === 2025; }).principal, 7200, 0.01);
  // 闰年：月粒度下 2024-02 与 2023-02 入账相同（各=B×8%），指数按年分母不同
  var r2 = Engine.calculate({ gender: 'male', birthYM: '1964-12', workStartYM: '2023-01', retireYM: '2024-12', interestMode: 'none', segments: [seg('enterprise', '2023-01', '2024-11', 10000)] });
  var f23 = r2.monthlyDetails.find(function (d) { return d.ym === '2023-02'; });
  var f24 = r2.monthlyDetails.find(function (d) { return d.ym === '2024-02'; });
  ok('TC-C-503', '闰年2024-02与2023-02入账额相同（月粒度，无日权重）', 'P2', 'AUTO',
    f23.principal8 === f24.principal8 && f23.principal8 === 800,
    f23.principal8 + '/' + f24.principal8, '800/800');
  // 跨年段：一段 2024-11~2025-03 共5月，指数分别取两年分母
  var r3 = Engine.calculate({ gender: 'male', birthYM: '1965-03', workStartYM: '1990-01', retireYM: '2025-03', interestMode: 'none', segments: [seg('enterprise', '2024-11', '2025-02', 10000)], customCYear: CUSTOM_GAP });
  var nov = r3.monthlyDetails.find(function (d) { return d.ym === '2024-11'; });
  var jan = r3.monthlyDetails.find(function (d) { return d.ym === '2025-01'; });
  ok('TC-C-504', '跨年段月指数自动切换分母（2024→11761,2025→11937）', 'P1', 'AUTO',
    Math.abs(nov.z - 10000 / 11761) < 1e-9 && Math.abs(jan.z - 10000 / 11937) < 1e-9,
    'z(2024-11)=' + nov.z.toFixed(4) + ' z(2025-01)=' + jan.z.toFixed(4),
    (10000 / 11761).toFixed(4) + '/' + (10000 / 11937).toFixed(4));
})();

// ---- 中人边界 1998-06/1998-07（E-12） ----
(function () {
  var mk = function (ws) { return Engine.calculate({ gender: 'male', birthYM: '1960-01', workStartYM: ws, retireYM: '2020-01', interestMode: 'none', segments: [seg('enterprise', '1992-10', '2019-12', 5000)], customCYear: CUSTOM_GAP }); };
  var a = mk('1998-06'), b = mk('1998-07');
  ok('TC-C-601', '1998-06参加工作=中人（有过渡性养老金）', 'P0', 'AUTO', /中人/.test(a.meta.personType) && a.pension.J过渡 >= 0, a.meta.personType, '中人');
  ok('TC-C-602', '1998-07参加工作=新人（J过渡=0）(E-12)', 'P0', 'AUTO', /新人/.test(b.meta.personType) && b.pension.J过渡 === 0, b.meta.personType + '/J过渡=' + b.pension.J过渡, '新人/0');
})();

// ===========================================================================
// 三、中间变量断言（TC-I）
// ===========================================================================
(function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10', interestMode: 'none', segments: [seg('enterprise', '1992-10', '2025-09', 8000)], customCYear: CUSTOM_GAP });
  // 月入账 round2：7162.2 类非整基数
  var r2 = Engine.calculate({ gender: 'male', birthYM: '1965-09', workStartYM: '2000-09', retireYM: '2025-09', interestMode: 'none', segments: [seg('flexible', '2024-01', '2025-08', 7056.6)] });
  // 7056.6×8%=564.528/月×20=11290.56（精确不舍入）；引擎逐月round2=564.53×20=11290.60
  rec('TC-I-301', '月计入额中间计算不舍入(spec4.7/NFR-03容差0.01)', 'P0', 'AUTO',
    Math.abs(r2.intermediates.R储 - 20 * 564.528) <= 0.01,
    'R储=' + r2.intermediates.R储,
    '精确值=11290.56（20×564.528）',
    'BUG: 引擎逐月 round2(564.53) 后累加=11290.60，偏差0.04；长年限/计息场景偏差放大');
  // C平 手工覆盖
  var r3 = Engine.calculate({ gender: 'male', birthYM: '1965-10', retireYM: '2025-10', interestMode: 'none', cPingOverride: 12000, segments: [seg('enterprise', '2020-01', '2025-09', 8000)] });
  ok('TC-I-302', 'C平手工覆盖生效', 'P1', 'AUTO', r3.intermediates.C平 === 12000, r3.intermediates.C平, 12000);
  // C平 覆盖为负（spec 7.2 要求 >0）
  var e = null;
  try { Engine.calculate({ gender: 'male', birthYM: '1965-09', retireYM: '2025-09', interestMode: 'none', cPingOverride: -1, segments: [seg('enterprise', '2020-01', '2025-08', 8000)] }); }
  catch (err) { e = err; }
  rec('TC-I-303', 'C平覆盖值须>0(spec7.2)', 'P1', 'AUTO', !!e,
    e ? e.message : '负值通过，J基础为负', '阻断提示',
    'BUG: cPingOverride 无正数校验');
  // 手工R储负值
  var e2 = null;
  try { Engine.calculate({ gender: 'male', birthYM: '1965-10', retireYM: '2025-10', accountBalanceManual: -100, segments: [] }); }
  catch (err) { e2 = err; }
  rec('TC-I-304', '手工账户储存额须≥0', 'P2', 'AUTO', !!e2,
    e2 ? e2.message : '负值通过，J账户=-0.72', '阻断提示', 'BUG: accountBalanceManual 无校验');
  // 总额=三分项之和（界面一致性）
  var sum = r.pension.J基础 + r.pension.J账户 + r.pension.J过渡;
  rec('TC-I-305', '界面总额=三分项显示值之和（任务要求）', 'P1', 'AUTO',
    Math.abs(r.pension.total - sum) <= 0.01,
    'total=' + r.pension.total + ' 分项和=' + sum.toFixed(2),
    '差≤0.01',
    'BUG(Minor): total 由未舍入值相加，展示分项已舍入，存在分级舍入差0.01（本数据差' + (r.pension.total - sum).toFixed(2) + '）');
  // 手工R储优先于明细推导
  var r4 = Engine.calculate({ gender: 'male', birthYM: '1965-10', retireYM: '2025-10', accountBalanceManual: 139000, segments: [seg('enterprise', '2020-01', '2025-09', 8000)] });
  ok('TC-I-306', '手工R储优先（J账户=139000/139=1000）', 'P1', 'AUTO',
    r4.intermediates.R储 === 139000 && r4.pension.J账户 === 1000,
    JSON.stringify({ R储: r4.intermediates.R储, J账户: r4.pension.J账户 }), '139000/1000');
  // M 表全表抽查 40/50/55/60/65/70
  [[40, 233], [50, 195], [55, 170], [60, 139], [65, 101], [70, 56]].forEach(function (p) {
    ok('TC-I-307/M' + p[0], 'M表 ' + p[0] + '岁=' + p[1], 'P0', 'AUTO', Engine.getM(p[0]) === p[1], Engine.getM(p[0]), p[1]);
  });
  // 非整数岁向下取整（T-14）：1965-09生 2025-10退=60岁1月→满整岁60
  var r5 = Engine.calculate({ gender: 'male', birthYM: '1965-09', retireYM: '2025-10', interestMode: 'none', segments: [seg('enterprise', '2020-01', '2025-09', 8000)] });
  ok('TC-I-308', '非整数岁60岁1月按满整岁60取M=139（T-14）', 'P1', 'AUTO',
    r5.meta.retireAge === 60 && r5.intermediates.M === 139, r5.meta.retireAge + '/' + r5.intermediates.M, '60/139');
  // 女干部55
  var r6 = Engine.calculate({ gender: 'female', femaleType: 'cadre', birthYM: '1970-05', retireYM: '2025-05', interestMode: 'none', segments: [seg('enterprise', '1995-08', '2025-04', 6000)] });
  ok('TC-I-309', '女干部55岁 M=170', 'P0', 'AUTO', r6.meta.retireAge === 55 && r6.intermediates.M === 170, r6.meta.retireAge + '/' + r6.intermediates.M, '55/170');
})();

// ===========================================================================
// 四、界面/集成（TC-U，自动可测部分；其余 WALK 标注人工）
// ===========================================================================
(function () {
  var fs = require('fs');
  var wxml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'result', 'result.wxml'), 'utf8');
  // mustache 配对
  var lines = wxml.split('\n'), bad = [];
  lines.forEach(function (ln, i) {
    var o = (ln.match(/{{/g) || []).length, c = (ln.match(/}}/g) || []).length;
    if (o !== c) bad.push((i + 1) + ':' + ln.trim());
  });
  rec('TC-U-001', '结果页WXML模板语法正确（{{}}配对）', 'P0', 'WALK+编译',
    bad.length === 0, bad.join(' | ') || '配对正确', '全部配对',
    'BUG: 第29行 {{r.intermediates.G实}) 缺少}}，WXML编译将报错，结果页无法渲染（Blocker）');
  // 政策引用键
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10', interestMode: 'none', accountBalanceManual: 10000, segments: [] });
  var miss = r.formulaLines.filter(function (f) { return !REFS[f.ref.replace('-', '')] && !REFS[f.ref]; }).map(function (f) { return f.key + ':' + f.ref; });
  var resolvable = r.formulaLines.filter(function (f) { return !!REFS[f.ref]; }).length;
  rec('TC-U-002', '公式政策引用标签可解析(FR-12)', 'P0', 'WALK',
    resolvable === r.formulaLines.length,
    resolvable + '/' + r.formulaLines.length + ' 可解析；缺失=' + miss.join(','),
    '4/4 均可弹窗',
    'BUG: 引擎ref="P-02"/"P-04"，policyRefs键为P02/P04，result.js REFS[f.ref] 全 undefined，点击标签无弹窗');
  // 逐月明细列完整性 FR-11
  ['年月', '身份', '基数', 'C年', '月指数', '8%入账'].forEach(function (h) {
    ok('TC-U-003/' + h, '逐月明细表含列：' + h + '(FR-11)', 'P1', 'WALK', wxml.indexOf(h) >= 0, h, '存在');
  });
  ['当年利息', '年末', '余额'].forEach(function (h) {
    rec('TC-U-004/' + h, '逐月明细表含利息/年末本息余额列(FR-11)', 'P1', 'WALK',
      wxml.indexOf(h) >= 0, (wxml.indexOf(h) >= 0 ? '存在' : '缺失：' + h), '存在',
      h === '当年利息' ? 'BUG: 月表仅6列，account.yearly 已有利息/余额数据但未渲染' : '（按年分组可接受补充展示）');
  });
  // 免责声明 FR-15
  var idxWxml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'index', 'index.wxml'), 'utf8');
  ok('TC-U-005', '首页含免责声明(FR-15/NFR-01)', 'P1', 'WALK', /仅供参考|核定为准/.test(idxWxml), '免责声明', '存在');
  ok('TC-U-006', '不采集身份证/姓名声明(NFR-01/08)', 'P2', 'WALK', /不采集姓名|身份证号/.test(idxWxml), '隐私声明', '存在');
  // FR-02 渐进式延迟退休逐月对照表
  var idxJsForUI = fs.readFileSync(path.join(__dirname, '..', 'pages', 'index', 'index.js'), 'utf8');
  // 真实功能判定：须存在按出生年月逐月推算的延退函数（非注释），且默认退休年月不再固定旧年龄
  var hasDelayFn = /function\s+\w*(delay|retireTable|statutory)\w*/i.test(idxJsForUI.replace(/\/\/[^\n]*/g, ''));
  rec('TC-U-009', '内置延迟退休对照表自动推算退休年月(FR-02 P1)', 'P1', 'WALK', hasDelayFn,
    hasDelayFn ? '存在延退推算函数' : 'refreshDefaultRetire 固定按男60/女工50/女干55推算，无出生年月对照表函数',
    '按P-05自动给出法定退休年月（手工可改）',
    '未实现（开发报告D1已声明）：2025年后默认退休年月错误，依赖用户手改，结果页有M展示但无法定年龄提示，spec FR-02 P0 级功能缺口（本用例按P1追踪）');
  // FR-04 录入效率：阶段4已实现“复制上一段（起止顺延12个月）”与按档次批量填充
  var idxWxmlForUI = fs.readFileSync(path.join(__dirname, '..', 'pages', 'index', 'index.wxml'), 'utf8');
  var hasCopyOrBatch = /copyLastSegment|复制上一段/.test(idxJsForUI) && /复制上一段|批量填充/.test(idxWxmlForUI);
  rec('TC-U-010', '缴费录入支持复制上月/批量填充/导入(FR-04 P0)', 'P2', 'WALK', hasCopyOrBatch,
    hasCopyOrBatch ? '已实现“复制上一段（起止顺延12个月，基数沿用）”+ 全口径60%/100%/300%批量填充' : '仅支持手工分段+全口径快捷填充', '复制上月/批量/导入至少一项', '便捷录入缺失（长年限录入成本高）');
  // FR-11 逐月明细导出
  rec('TC-U-011', '逐月明细支持导出CSV/图片(FR-11 P0)', 'P2', 'WALK',
    /导出|export/.test(wxml), /导出/.test(wxml) ? '有导出入口' : '无导出入口', '支持导出', '未实现导出入口（数据已在monthlyDetails中，二期成本低）');
  // 年度录入模式 FR-05
  // 真实功能判定：WXML 存在年度录入控件（视同缴费月数字样不算）
  var hasYearMode = /年度模式|年度录入|年缴\s*月数|monthsInYear/.test(idxWxml);
  rec('TC-U-007', '年度模式录入（月均基数+缴费月数）(FR-05 P1)', 'P1', 'WALK', hasYearMode,
    hasYearMode ? '存在年度录入入口' : '未提供年度录入入口（仅“经认定视同缴费月数”字样）', '提供年度录入',
    '未实现：仅支持分段月度录入；年内部分月缴费需手工切多段（S7场景不便）');
  // 60%/300%越界提示 E-05
  // 真实功能判定：须存在按年度60%/300%阈值比较并提示的逻辑（快捷档菜单项不算）
  var idxJsNoComment = idxJsForUI.replace(/\/\/[^\n]*/g, '');
  var hasBoundCheck = /基数.*(超|越界|上限|下限)|(?:upper|lower|minBase|maxBase)\s*[:=]/.test(idxJsNoComment);
  rec('TC-U-008', '缴费基数超60%/300%区间黄字提示(E-05)', 'P1', 'WALK', hasBoundCheck,
    hasBoundCheck ? '存在越界校验提示' : 'fillAtCaliber 仅做快捷填充，无任何越界校验提示逻辑', '超区间黄字提示',
    '缺陷: 引擎/UI 均无基数上下限校验提示（允许录入本身符合E-05，但黄字提示缺失）');
})();

// ===========================================================================
// 五、异常/兼容（TC-X）
// ===========================================================================
// TC-X-001 未选择计发基数年度（默认2025，内置）；模拟年度无数据
throws('TC-X-001', '计发基数年度无内置数据时报错', 'P1', 'AUTO',
  function () { Engine.calculate({ gender: 'male', birthYM: '1965-10', retireYM: '2025-10', baseYearOverride: 2019, interestMode: 'none', segments: [seg('enterprise', '2010-01', '2025-09', 8000)] }); }, /无内置数据|手工录入/);

// TC-X-002 矛盾时间段：缴费段重叠（后段覆盖+warning）
(function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-10', retireYM: '2025-10', interestMode: 'none',
    segments: [seg('enterprise', '2024-01', '2026-06', 10000), seg('flexible', '2025-01', '2025-09', 5000)] });
  ok('TC-X-002', '重叠缴费段后段覆盖并告警', 'P1', 'AUTO',
    r.meta.warnings.some(function (w) { return /2025-06/.test(w) && /重叠/.test(w); }) &&
    r.monthlyDetails.find(function (d) { return d.ym === '2025-06'; }).type === 'flexible',
    'warning数=' + r.meta.warnings.filter(function (w) { return /重叠/.test(w); }).length, '9个重叠月告警+后段覆盖');
})();

// TC-X-003 缴费晚于退休月静默截断（E-03：应阻断/截断提示）
(function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-10', retireYM: '2025-10', interestMode: 'none',
    segments: [seg('enterprise', '2025-01', '2026-12', 10000)] });
  var hasWarn = r.meta.warnings.some(function (w) { return /退休|截断|2026/.test(w); });
  rec('TC-X-003', '缴费晚于退休月须提示(E-03)', 'P2', 'AUTO', hasWarn,
    hasWarn ? '有提示' : '静默截断至2025-09，无提示', '黄字提示或阻断', '静默截断（Minor）');
})();

// TC-X-004 1992-10前缴费段（E-02：黄字提示并自动归类）
(function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1960-01', workStartYM: '1980-01', retireYM: '2020-01', interestMode: 'none',
    segments: [seg('enterprise', '1985-01', '1991-12', 1000), seg('enterprise', '1992-10', '2019-12', 1000)] });
  // 仅“视同按工作时间估算”不构成对“1992前缴费行被排除”的专项提示；须出现“早于/不计入/1992-09/视同”针对性文案
  var hasWarn = r.meta.warnings.some(function (w) { return /早于|不计入|1992-09|1992年10月前/.test(w); });
  rec('TC-X-004', '1992-10前缴费行提示并归类(E-02)', 'P0', 'AUTO', hasWarn,
    hasWarn ? '有针对性提示' : '该段84月被静默排除（指数/本金均不计），仅有通用“视同按工作时间估算”提示',
    '黄字提示：1992-09前缴费不参与指数/账户，请检查视同年限',
    'BUG: 对“1992前缴费行被排除”无针对性提示；用户漏填workStart或工作时间不准时1985-1991工龄可能静默丢失');
  ok('TC-X-004b', '1992前段不计入月入账（建账时点1992-10）', 'P1', 'AUTO',
    r.intermediates.actualPaidMonths === 327, r.intermediates.actualPaidMonths, 327);
})();

// TC-X-005 超大年限（1992-10起算上限~70岁退休）
(function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1955-01', workStartYM: '1980-01', retireYM: '2025-01', interestMode: 'none',
    segments: [seg('enterprise', '1992-10', '2024-12', 9000)], customCYear: CUSTOM_GAP });
  ok('TC-X-005', '70岁退休长序列可计算且性能正常', 'P2', 'AUTO',
    isFinite(r.pension.total) && r.monthlyDetails.length === 387,
    r.monthlyDetails.length + '月/' + r.pension.total, '387月有限值');
})();

// TC-X-006 缺口年度未补录 → 指数计0+warning（T-10/E-06）
(function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10', interestMode: 'none',
    segments: [seg('enterprise', '1993-01', '2025-09', 5000)] });
  var gapWarn = r.meta.warnings.filter(function (w) { return /缺少官方月平均工资/.test(w); }).length;
  ok('TC-X-006', '1992-1995缺口年度给补录警告(T-10/E-06)', 'P1', 'AUTO', gapWarn >= 4, gapWarn + '条警告', '≥4条（1992-1995）');
  var m = r.monthlyDetails.find(function (d) { return d.ym === '1993-01'; });
  ok('TC-X-006b', '缺口未补录时该年z=0（不臆造数据）', 'P1', 'AUTO', m.z === 0 && m.denomSource === 'missing', JSON.stringify({ z: m.z, s: m.denomSource }), 'z=0/missing');
})();

// TC-X-007 2026退休：分母assumed沿用 + warning（C平 年度不匹配）
(function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1966-03', workStartYM: '1990-01', retireYM: '2026-03', interestMode: 'none',
    segments: [seg('enterprise', '1992-10', '2026-02', 10000)], customCYear: CUSTOM_GAP });
  ok('TC-X-007', '2026退休给出计发基数年度不一致警告', 'P2', 'AUTO',
    r.meta.warnings.some(function (w) { return /不一致/.test(w); }), 'C平默认沿用12049', '警告存在');
  var m = r.monthlyDetails.find(function (d) { return d.ym === '2026-01'; });
  ok('TC-X-007b', '2026+分母标记assumed（月明细）', 'P2', 'AUTO', m.denomSource === 'assumed', m.denomSource, 'assumed');
})();

// TC-X-008 不足最低年限（E-09）
(function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-10', retireYM: '2025-10', interestMode: 'none',
    segments: [seg('enterprise', '2020-01', '2025-09', 8000)] });
  ok('TC-X-008', '缴费不足15年 eligible=false 但仍给测算值(E-09)', 'P0', 'AUTO',
    r.meta.eligible === false && isFinite(r.pension.total) && r.pension.total > 0,
    JSON.stringify({ e: r.meta.eligible, t: r.pension.total, min: r.meta.minRequiredMonths }),
    'false+有限测算值');
})();

// TC-X-009 最低年限 2030 起递增（P-05）
(function () {
  ok('TC-X-009a', '2029退休最低180月', 'P1', 'AUTO', Engine.minRequiredMonths('2029-12') === 180, Engine.minRequiredMonths('2029-12'), 180);
  ok('TC-X-009b', '2030退休186月(15.5年)', 'P1', 'AUTO', Engine.minRequiredMonths('2030-06') === 186, Engine.minRequiredMonths('2030-06'), 186);
  ok('TC-X-009c', '2039起240月(20年)封顶', 'P1', 'AUTO', Engine.minRequiredMonths('2039-01') === 240 && Engine.minRequiredMonths('2045-06') === 240,
    Engine.minRequiredMonths('2039-01') + '/' + Engine.minRequiredMonths('2045-06'), '240/240');
})();

// TC-X-011 缺口年度 UI 录入语义一致性（index.wxml placeholder 1991=…~1994=… vs 引擎按缴费年取键）
(function () {
  // 用户按界面文案/说明录入 C1991~C1994（官方社平序列的年度口径）
  var asUI = { 1991: 500, 1992: 600, 1993: 700, 1994: 678.67 };
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10', interestMode: 'none', customCYear: asUI,
    segments: [seg('enterprise', '1992-10', '1995-12', 600), seg('enterprise', '1996-01', '2025-09', 8000)] });
  var m92 = r.monthlyDetails.find(function (d) { return d.ym === '1992-10'; });
  var m95 = r.monthlyDetails.find(function (d) { return d.ym === '1995-06'; });
  var noGapWarn = r.meta.warnings.filter(function (w) { return /缺少官方/.test(w); }).length === 0;
  rec('TC-X-011', '缺口年度按UI文案(1991~1994)录入后指数正确且无缺口警告(T-10/E-06)', 'P0', 'AUTO',
    noGapWarn && m92.cDenominator === 500 && m95.cDenominator === 678.67,
    '1992-10分母=' + m92.cDenominator + '(应500=C1991)；1995-06分母=' + m95.cDenominator + '(应678.67=C1994)；剩余缺口警告=' + r.meta.warnings.filter(function (w) { return /缺少官方/.test(w); }).length,
    '1992-10取C1991=500；全部缺口消除',
    'BUG: 引擎 customCYear 按“缴费年度”取键（1992缴费→custom[1992]），UI placeholder 要用户录 C年（1991=…~1994=…），错位一年：用户值500闲置、1992指数误用600、1995仍判缺口计0');
})();

// TC-X-012 矛盾时间段：退休早于参加工作
(function () {
  var e = null, r = null;
  try { r = Engine.calculate({ gender: 'male', birthYM: '1970-01', workStartYM: '2020-01', retireYM: '2010-10', interestMode: 'none', segments: [seg('enterprise', '2005-01', '2009-12', 8000)] }); }
  catch (err) { e = err; }
  rec('TC-X-012', '退休年月早于参加工作时间须阻断', 'P1', 'AUTO', !!e,
    e ? e.message : ('静默通过并输出 total=' + r.pension.total + '（应缴区间1992-10~2010-09与2020参加工作矛盾）'),
    '阻断并提示检查参加工作/退休年月',
    'BUG: 引擎不校验 workStart 与 retireYM 的先后关系，workStart 仅用于视同估算，矛盾时间产生无意义测算值');
})();

// TC-X-010 幂等：同输入重复计算一致（NFR-03）
(function () {
  var inp = { gender: 'female', femaleType: 'worker', birthYM: '1975-05', workStartYM: '1995-08', retireYM: '2025-05', interestMode: 'fixed', fixedRate: 0.04,
    segments: [seg('enterprise', '1995-08', '2015-12', 6000), seg('flexible', '2018-01', '2025-04', 4713)] };
  var a = Engine.calculate(inp).pension.total, b = Engine.calculate(inp).pension.total;
  ok('TC-X-010', '同输入重复计算结果一致(NFR-03)', 'P1', 'AUTO', a === b, a + '/' + b, '一致');
})();

// ===========================================================================
// 六、政策可追溯性（TC-P）
// ===========================================================================
(function () {
  ok('TC-P-001', '政策引用 P-01~P-12 齐备', 'P1', 'WALK',
    ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10', 'P11', 'P12'].every(function (k) { return !!REFS[k]; }),
    '12条', '12条齐备');
  var p01 = REFS.P01;
  ok('TC-P-002', 'P-01 含全称/文号/条款/URL/生效', 'P1', 'WALK',
    !!(p01.name && p01.docNo && p01.clause && /^https/.test(p01.url) && p01.effective), JSON.stringify(p01).slice(0, 80) + '...', '字段完整');
  ok('TC-P-003', 'P-04 计发月数表官方URL可核', 'P1', 'WALK', /gov.cn/.test(REFS.P04.url), REFS.P04.url, 'gov.cn');
  // 引擎公式注释政策标注
  var fs = require('fs');
  var eng = fs.readFileSync(path.join(__dirname, '..', 'calculator', 'pensionEngine.js'), 'utf8');
  ['P-01', 'P-02', 'P-04', 'P-12'].forEach(function (p) {
    ok('TC-P-004/' + p, '引擎源码标注政策 ' + p, 'P2', 'WALK', eng.indexOf(p) >= 0, p, '存在');
  });
  // 角标体系：官方/假设/待确认 三类样式存在
  var wxss = fs.readFileSync(path.join(__dirname, '..', 'app.wxss'), 'utf8');
  ok('TC-P-005', '官方/假设/待确认三类角标样式存在(NFR-04)', 'P2', 'WALK',
    /tag-official/.test(wxss) && /tag-assume/.test(wxss) && /tag-pending/.test(wxss), '三类样式', '齐备');
  // 利率假设/待确认在结果页标注（T-03/T-04/12.3：2016前为预估2.62%、2022年4.12%存争议、2025利率待官方公布）
  // 注意：须独立读取文件变量，避免与同 IIFE 后续 var wxml 的变量提升相互遮蔽
  var resultWxmlForRate = fs.readFileSync(path.join(__dirname, '..', 'pages', 'result', 'result.wxml'), 'utf8');
  rec('TC-P-011', '结果页对预估/待确认利率标注“待官方核实”(12.3/NFR-04)', 'P1', 'WALK',
    /预估|待确认|待官方|assumed/.test(resultWxmlForRate),
    /待官方核实/.test(resultWxmlForRate) ? '按年利率表带“待官方核实”角标，并附 T-03/T-04 说明' : 'result.wxml 无任何利率来源/待确认文案',
    '利率明细展示来源角标，2016前/2025预估利率标“待官方核实”',
    '缺陷: official 模式 2000-2015 静默套用2.62%且结果页无“工程假设”提示，违背信息分级要求（用户可能误读为官方口径）');
  // Z实指数 应用官方角标而非假设角标
  var wxml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'result', 'result.wxml'), 'utf8');
  var zRow = wxml.split('\n').filter(function (l) { return /Z实指数/.test(l); })[0] || '';
  rec('TC-P-006', 'Z实指数/N应缴 使用官方角标(P-02官方公式)', 'P2', 'WALK',
    /tag-official/.test(zRow), (zRow.match(/tag-\w+/) || [''])[0], 'tag-official',
    'BUG(Minor): Z实指数行误用 tag-assume 橙色假设角标，Z实指数 为21号文官方公式');
})();

// ===========================================================================
// 汇总输出
// ===========================================================================
var pass = results.filter(function (r) { return r.pass; }).length;
var fail = results.length - pass;
var byPri = {}, byMod = {}, failList = [];
results.forEach(function (r) {
  byPri[r.pri] = byPri[r.pri] || { pass: 0, fail: 0 };
  byPri[r.pri][r.pass ? 'pass' : 'fail']++;
  var mod = r.id.split('-')[0] + '-' + r.id.split('-')[1][0];
  mod = r.id.slice(0, 4);
  byMod[mod] = byMod[mod] || { pass: 0, fail: 0 };
  byMod[mod][r.pass ? 'pass' : 'fail']++;
  if (!r.pass) failList.push(r);
});
if (process.argv.indexOf('--json') >= 0) {
  console.log(JSON.stringify({ total: results.length, pass: pass, fail: fail, byPri: byPri, byMod: byMod, results: results }, null, 1));
} else {
  console.log('\n================ 测试结果汇总 ================');
  console.log('用例总数: ' + results.length + '  通过: ' + pass + '  失败: ' + fail);
  console.log('按优先级:', JSON.stringify(byPri));
  console.log('按模块:', JSON.stringify(byMod));
  console.log('\n---- 失败用例 ----');
  failList.forEach(function (r) {
    console.log('[' + r.id + '][' + r.pri + '] ' + r.title);
    console.log('   实际: ' + String(r.actual).slice(0, 160));
    console.log('   期望: ' + String(r.expected).slice(0, 160));
    if (r.note) console.log('   备注: ' + r.note.slice(0, 200));
  });
}
process.exitCode = fail > 0 ? 1 : 0;
