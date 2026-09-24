// tests/round1-fixes.js
// 阶段4（首轮测试报告）修复点专项自测——纯 node 可运行：node tests/round1-fixes.js
// 覆盖 GAP-01（P-05延退对照表）、BUG-003~015 中引擎侧全部 Blocker/Major 修复点。
// 与 tests/run-tests.js（全量134条）互补：本文件每个断言直接对应报告缺陷编号。
var assert = require('assert');
var Engine = require('../calculator/pensionEngine.js');

// 批次1 #8 契约收紧后（accountBalanceManual UI 路径必填），旧套件统一走保留的历史重建逃生口。
var __engineCalculate = Engine.calculate;
Engine.calculate = function (input) {
  if (input && input.accountBalanceManual == null && input.accountReconstruct == null) {
    input.accountReconstruct = true;
  }
  return __engineCalculate(input);
};
var Schedule = require('../calculator/retireSchedule.js');
var P = require('../constants/policyData.js');
var D = require('../calculator/dateUtil.js');

var passed = 0, failed = 0;
function t(id, name, fn) {
  try { fn(); passed++; console.log('  PASS ' + id + ' ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + id + ' ' + name + '\n       ' + e.message); }
}
function throws(fn) {
  var r = null;
  try { fn(); } catch (e) { r = e; }
  if (!r) throw new Error('期望抛错但未抛错');
  return r;
}
function seg(type, a, b, base) { return { type: type, startYM: a, endYM: b, baseMonthly: base }; }

console.log('== GAP-01 渐进式延迟法定退休年龄逐月对照表（P-05） ==');

t('GAP-01-M1', '男 1965-01 -> 法定退休 2025-02（60岁1月，官方对照表首行锚点）', function () {
  assert.strictEqual(Schedule.statutoryRetireYM('male', '1965-01'), '2025-02');
  assert.strictEqual(Schedule.delayMonths('male', '1965-01'), 1);
});
t('GAP-01-M2', '男 1964-09 及以前不受影响（1964-09 -> 2024-09，60岁整）', function () {
  assert.strictEqual(Schedule.statutoryRetireYM('male', '1964-09'), '2024-09');
  assert.strictEqual(Schedule.delayMonths('male', '1964-09'), 0);
  assert.strictEqual(Schedule.isAffected('male', '1964-09'), false);
});
t('GAP-01-M3', '男每4个出生月延1月：1965-05->2025-07（延2月）', function () {
  assert.strictEqual(Schedule.statutoryRetireYM('male', '1965-05'), '2025-07');
  assert.strictEqual(Schedule.delayMonths('male', '1965-05'), 2);
});
t('GAP-01-M4', '男 1976-09 起 63 岁封顶（2039-09），之后不再增加', function () {
  assert.strictEqual(Schedule.statutoryRetireYM('male', '1976-09'), '2039-09');
  assert.strictEqual(Schedule.delayMonths('male', '1976-09'), 36);
  assert.strictEqual(Schedule.delayMonths('male', '1980-01'), 36);
});
t('GAP-01-C1', '女干部(原55) 1970-01 -> 2025-02；1981-09 起 58 岁封顶(2039-09)', function () {
  assert.strictEqual(Schedule.statutoryRetireYM('cadre', '1970-01'), '2025-02');
  assert.strictEqual(Schedule.delayMonths('cadre', '1970-01'), 1);
  assert.strictEqual(Schedule.statutoryRetireYM('cadre', '1981-09'), '2039-09');
  assert.strictEqual(Schedule.delayMonths('cadre', '1981-09'), 36);
});
t('GAP-01-W1', '女工人(原50) 1975-01 -> 2025-02；每2个出生月延1月', function () {
  assert.strictEqual(Schedule.statutoryRetireYM('worker', '1975-01'), '2025-02');
  assert.strictEqual(Schedule.delayMonths('worker', '1975-01'), 1);
  assert.strictEqual(Schedule.statutoryRetireYM('worker', '1975-03'), '2025-05'); // 延2月
  assert.strictEqual(Schedule.delayMonths('worker', '1975-03'), 2);
});
t('GAP-01-W2', '女工人 1984-11 起 55 岁封顶（2039-11，延60月）', function () {
  assert.strictEqual(Schedule.delayMonths('worker', '1984-11'), 60);
  assert.strictEqual(Schedule.statutoryRetireYM('worker', '1984-11'), '2039-11');
  assert.strictEqual(Schedule.delayMonths('worker', '1990-01'), 60);
});
t('GAP-01-F1', '弹性区间：男1965-10 法定2026-01，提前下限=原60岁2025-10，上限=2029-01', function () {
  var r = Schedule.flexibleRange('male', '1965-10');
  assert.strictEqual(D.toYM(r.statutory), '2026-01');
  assert.strictEqual(D.toYM(r.min), '2025-10'); // 不低于原法定
  assert.strictEqual(D.toYM(r.max), '2029-01');
});
t('GAP-01-F2', '弹性提前对未进入过渡者不低于原年龄：男1964-09 区间下限=2024-09', function () {
  var r = Schedule.flexibleRange('male', '1964-09');
  assert.strictEqual(D.toYM(r.min), '2024-09');
});
t('GAP-01-E1', '58岁退休计发月数 M=152（女干部延退后）', function () {
  var r = Engine.calculate({ gender: 'female', femaleType: 'cadre', birthYM: '1981-09', retireYM: '2039-09',
    interestMode: 'none', segments: [seg('enterprise', '2003-09', '2039-08', 10000)] });
  assert.strictEqual(r.meta.retireAge, 58);
  assert.strictEqual(r.intermediates.M, 152);
});
t('GAP-01-E2', '选择退休年月与法定不一致时结果含P-05对照元数据与提示', function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-10', retireYM: '2025-10', interestMode: 'none',
    segments: [seg('enterprise', '2020-01', '2025-09', 8000)] });
  assert.ok(r.meta.retireSchedule);
  assert.strictEqual(r.meta.retireSchedule.statutoryYM, '2026-01');
  assert.strictEqual(r.meta.retireSchedule.chosenOffsetMonths, -3);
  assert.ok(r.meta.warnings.some(function (w) { return /P05|对照表/.test(w); }));
});

console.log('== GAP-01 附件4：最低缴费年限 2030 起逐年提高 ==');
t('MIN-Y1', '2025-2029 退休最低180月', function () {
  assert.strictEqual(Engine.minRequiredMonths('2025-05'), 180);
  assert.strictEqual(Engine.minRequiredMonths('2029-12'), 180);
});
t('MIN-Y2', '2030=186月（15年6个月），每年+6个月', function () {
  assert.strictEqual(Engine.minRequiredMonths('2030-06'), 186);
  assert.strictEqual(Engine.minRequiredMonths('2031-01'), 192);
  assert.strictEqual(Engine.minRequiredMonths('2038-12'), 234);
});
t('MIN-Y3', '2039 起 240月（20年）封顶', function () {
  assert.strictEqual(Engine.minRequiredMonths('2039-01'), 240);
  assert.strictEqual(Engine.minRequiredMonths('2045-06'), 240);
});
t('MIN-Y4', '2030年退休缴费13年 eligible=false', function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-10', retireYM: '2030-10', interestMode: 'none',
    segments: [seg('enterprise', '2017-10', '2030-09', 8000)] }); // 恰好13年=156月
  assert.strictEqual(r.meta.minRequiredMonths, 186);
  assert.strictEqual(r.meta.eligible, false);
});

console.log('== BUG-003 / BUG-004 / E-08：视同缴费月数校验与截断 ==');
t('BUG-003', '手工视同月数留空(NaN)阻断（fix+fixed 模式）', function () {
  throws(function () {
    Engine.calculate({ gender: 'male', birthYM: '1965-10', workStartYM: '2000-01', retireYM: '2025-10',
      deemedMonths: NaN, interestMode: 'fixed', fixedRate: 0.04, segments: [seg('enterprise', '2000-01', '2025-09', 8000)] });
  });
});
t('BUG-004', '负数视同月数阻断', function () {
  throws(function () {
    Engine.calculate({ gender: 'male', birthYM: '1965-10', retireYM: '2025-10', deemedMonths: -1,
      interestMode: 'none', segments: [seg('enterprise', '2020-01', '2025-09', 8000)] });
  });
});
t('BUG-004b', '视同月数非整数阻断；超过600阻断', function () {
  throws(function () { Engine.calculate({ gender: 'male', birthYM: '1965-10', retireYM: '2025-10', deemedMonths: 12.5, interestMode: 'none', segments: [] }); });
  throws(function () { Engine.calculate({ gender: 'male', birthYM: '1950-01', retireYM: '2010-01', deemedMonths: 601, interestMode: 'none', segments: [] }); });
});
t('E08', '视同月数与工作时间矛盾时截断到[workStart,1992-09]并提示；2000年参加工作者=0', function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-10', workStartYM: '2000-01', retireYM: '2025-10',
    deemedMonths: 600, interestMode: 'none', segments: [seg('enterprise', '2000-01', '2025-09', 8000)] });
  assert.strictEqual(r.intermediates.N同, 0);
  assert.ok(r.meta.warnings.some(function (w) { return /截断/.test(w); }));
});

console.log('== BUG-005：固定利率空值/越界阻断 ==');
t('BUG-005', 'fixed 模式 fixedRate 为空阻断，不给错误0%结果', function () {
  throws(function () {
    Engine.calculate({ gender: 'male', birthYM: '1965-09', retireYM: '2025-09', workStartYM: '2000-09',
      interestMode: 'fixed', fixedRate: NaN, segments: [seg('enterprise', '2000-09', '2025-08', 10000)] });
  });
});
t('BUG-005b', '利率>24%/负值阻断；合法4%通过且计息>本金', function () {
  throws(function () { Engine.calculate({ gender: 'male', birthYM: '1965-09', retireYM: '2025-09', interestMode: 'fixed', fixedRate: 0.3, segments: [seg('enterprise', '2020-01', '2025-08', 8000)] }); });
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-09', retireYM: '2025-09', interestMode: 'fixed', fixedRate: 0.04, segments: [seg('enterprise', '2020-01', '2025-08', 8000)] });
  assert.ok(r.intermediates.R储 > r.intermediates.R储本金);
});

console.log('== BUG-006：手工负值参数阻断（spec 7.2） ==');
t('BUG-006a', 'cPingOverride 负值阻断', function () {
  throws(function () { Engine.calculate({ gender: 'male', birthYM: '1965-09', retireYM: '2025-09', interestMode: 'none', cPingOverride: -1, segments: [seg('enterprise', '2020-01', '2025-08', 8000)] }); });
});
t('BUG-006b', '手工账户储存额负值阻断；0合法', function () {
  throws(function () { Engine.calculate({ gender: 'male', birthYM: '1965-09', retireYM: '2025-09', interestMode: 'none', accountBalanceManual: -100, segments: [] }); });
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-09', retireYM: '2025-09', interestMode: 'none', accountBalanceManual: 0, segments: [] });
  assert.strictEqual(r.intermediates.R储, 0);
});

console.log('== BUG-007：半年口径退休当年缴费按月折算（spec 4.6） ==');
t('BUG-007', 'half 口径退休当年(2025,1-8月)缴费利息=按月折算而非固定0.5', function () {
  var base = { gender: 'male', birthYM: '1965-09', workStartYM: '2000-09', retireYM: '2025-09', segments: [seg('enterprise', '2000-09', '2025-08', 10000)] };
  var rh = Engine.calculate(Object.assign({ interestMode: 'fixed', fixedRate: 0.04, intraYearMethod: 'half' }, base));
  var hy = rh.account.yearly.find(function (y) { return y.year === 2025; });
  var expected = hy.startBalance * 0.04 * 8 / 12 + 800 * 0.04 * 68 / 12;
  assert.ok(Math.abs(hy.interest - expected) <= 0.02, '实际 ' + hy.interest + ' 期望 ' + expected);
});

console.log('== BUG-008：月计入额中间计算不舍入（spec 4.7） ==');
t('BUG-008', '7056.6×8%=564.528/月×20 全程精确累加（容差0.01）', function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-09', workStartYM: '2000-09', retireYM: '2025-09',
    interestMode: 'none', segments: [seg('flexible', '2024-01', '2025-08', 7056.6)] });
  assert.ok(Math.abs(r.intermediates.R储 - 20 * 564.528) <= 0.01, 'R储=' + r.intermediates.R储);
});

console.log('== BUG-009：缺口年度双口径键位兼容 ==');
t('BUG-009a', 'UI/新口径：按C年度录1991~1994，缴费年1992取C1991', function () {
  var asUI = { 1991: 500, 1992: 600, 1993: 700, 1994: 678.67 };
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10',
    interestMode: 'none', customCYear: asUI, segments: [seg('enterprise', '1992-10', '2025-09', 600)] });
  var m92 = r.monthlyDetails.find(function (d) { return d.ym === '1992-10'; });
  assert.ok(Math.abs(m92.z - 600 / 500) < 1e-9);
  assert.strictEqual(r.meta.warnings.filter(function (w) { return /缺少官方/.test(w); }).length, 0);
});
t('BUG-009b', '旧口径：按缴费年度录1992~1995 仍正确（兼容）', function () {
  var oldKey = { 1992: 500, 1993: 600, 1994: 700, 1995: 678.67 };
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10',
    interestMode: 'none', customCYear: oldKey, segments: [seg('enterprise', '1992-10', '1993-12', 600)] });
  var m92 = r.monthlyDetails.find(function (d) { return d.ym === '1992-10'; });
  assert.ok(Math.abs(m92.z - 600 / 500) < 1e-9);
});

console.log('== BUG-010：退休年月早于参加工作时间阻断 ==');
t('BUG-010', '退休年月 < 参加工作年月 抛错', function () {
  throws(function () {
    Engine.calculate({ gender: 'male', birthYM: '1960-01', workStartYM: '2000-01', retireYM: '1995-01',
      interestMode: 'none', segments: [seg('enterprise', '1992-10', '1994-12', 5000)] });
  });
});

console.log('== BUG-011 / E-02：1992-10 前缴费段专项提示 ==');
t('BUG-011', '1985-1991缴费段被排除时给针对性提示且不入账', function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1960-01', workStartYM: '1980-01', retireYM: '2020-01',
    interestMode: 'none', segments: [seg('enterprise', '1985-01', '1991-12', 1000), seg('enterprise', '1992-10', '2019-12', 1000)] });
  assert.ok(r.meta.warnings.some(function (w) { return /早于1992-10|视同/.test(w); }));
  assert.strictEqual(r.intermediates.actualPaidMonths, 327);
});

console.log('== BUG-013：三分项展示值之和恒等于总额 ==');
t('BUG-013', 'total = round(J基础)+round(J账户)+round(J过渡)', function () {
  var inputs = [
    { gender: 'male', birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10', interestMode: 'fixed', fixedRate: 0.04, segments: [seg('enterprise', '1992-10', '2025-09', 8000)] },
    { gender: 'female', femaleType: 'worker', birthYM: '1975-05', workStartYM: '1995-08', retireYM: '2025-05', interestMode: 'official', segments: [seg('flexible', '2018-01', '2025-04', 5000)] }
  ];
  inputs.forEach(function (inp) {
    var r = Engine.calculate(inp);
    var sum = Math.round((r.pension.J基础 + r.pension.J账户 + r.pension.J过渡) * 100) / 100;
    assert.strictEqual(r.pension.total, sum, 'total ' + r.pension.total + ' != sum ' + sum);
  });
});

console.log('== BUG-014 / E-03：缴费晚于退休前一月截断并提示 ==');
t('BUG-014', '2026年缴费段在2025-10退休下截断且有提示', function () {
  var r = Engine.calculate({ gender: 'male', birthYM: '1965-10', retireYM: '2025-10', interestMode: 'none',
    segments: [seg('enterprise', '2025-01', '2026-12', 10000)] });
  assert.strictEqual(r.monthlyDetails[r.monthlyDetails.length - 1].ym, '2025-09');
  assert.ok(r.meta.warnings.some(function (w) { return /晚于退休前一月|截断/.test(w); }));
});

console.log('== BUG-015：出生年月越界阻断（spec 7.2） ==');
t('BUG-015', '出生1930-01、2020-01 均阻断', function () {
  throws(function () { Engine.calculate({ gender: 'male', birthYM: '1930-01', retireYM: '1990-01', interestMode: 'none', segments: [] }); });
  throws(function () { Engine.calculate({ gender: 'male', birthYM: '2020-01', retireYM: '2080-01', interestMode: 'none', segments: [] }); });
});
t('BUG-015b', '退休年龄超计发月数表(40-70)阻断', function () {
  throws(function () { Engine.calculate({ gender: 'male', birthYM: '1920-01', retireYM: '2005-01', interestMode: 'none', segments: [] }); }); // 85岁
});

console.log('\n========================================');
console.log('阶段4修复点专项自测：' + passed + ' 通过，' + failed + ' 失败');
process.exit(failed ? 1 : 0);
