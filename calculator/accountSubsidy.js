// calculator/accountSubsidy.js
// R补（用户符号）= 官方「个人账户补贴额」Z补贴（spec V1.2 §2.2.1）
// 政策依据：京劳社养发〔2007〕31号 第二条(三) 及附件1（首都之窗 t20250929_4213600）
// 注意：「R储/R补」是用户/工程口径符号，官方原文未使用该字母符号；
//       R储=21号文「个人账户累计储存额」，R补=31号文「个人账户补贴额 Z补贴」。
//
// 官方公式（31号文附件1，C 为年口径本市职工平均工资，元/年）：
//   Z补贴 = { [(C1992/12×3) + C1993] × 2%
//           + [C1994 + C1995 + C1996 + C1997 + (C1998/2)] × 5%
//           + [(C1998/2) + C1999 + C2000 + …… + C2005] × 11%
//           + [C2006 + C2007 + …… + Cn] × 8% } × Z实指数
//
// 月度建模（与官方年公式严格等价，且天然支持年中参保/扣除月折算，AC-RC-05）：
//   对未建账期间 [max(1992-10, 参加工作月), 企业实际参保前一月] 的每个月 m（公历年 y）：
//     月模拟额 = C年表[y] / 12，按 m 所在时期的账户记账规模比例分档累加：
//       1992-10 ~ 1993-12 → 2%；1994-01 ~ 1998-06 → 5%；
//       1998-07 ~ 2005-12 → 11%；2006-01 起       → 8%。
//   等价性：1992年10-12月=3×C1992/12=C1992/12×3；1993全年=C1993；
//           1998年1-6月计5%档=C1998/2、7-12月计11%档=C1998/2。
//
// 关键边界（spec §2.2.1）：
//   - 仅适用31号文第一条三类人员，且调动/入伍/转制时间 ≥ 1998-01-01（AC-RC-09）；
//   - n = 企业实际参保缴费前一年；Z实指数 仅统计企业实际参保后缴费段（AC-RC-06）；
//   - Z补贴 是虚拟计发额度，不计入个人账户实际储存额 R储（AC-RC-07）；
//   - 已按京劳社养发〔2002〕27号/后联字〔2002〕3号领取一次性个人账户补贴的年限扣除（AC-RC-08）；
//   - 中间分档不舍入，最终四舍五入保留2位小数（AC-RC-11，21号文附件一）。

var D = require('./dateUtil.js');
var P = require('../constants/policyData.js');

var SCHEME_START_IDX = D.toIndex('1992-10'); // 北京企业职工建账/个人缴费起始月
var TRANSFER_MIN_IDX = D.toIndex('1998-01'); // 31号文第一条：1998-01-01 以后调动/入伍/转制

// 账户记账规模分档（21号文附件二「应计入个人账户比例」，AC-RC-10 表驱动于 policyData）
function tierRateAt(idx) {
  var tiers = P.accountSubsidy.tiers;
  for (var i = 0; i < tiers.length; i++) {
    var t = tiers[i];
    if (idx >= D.toIndex(t.startYM) && (t.endYM === null || idx <= D.toIndex(t.endYM))) return t.rate;
  }
  return 0;
}

// 下标口径（政策核验报告§实现建议2）：31号附件1 的「C1992」实取 1991 年社平 2877
// （原文「相应年度上一年本市职工平均工资」），与21号文 Z实指数 的 C1991 同值不同名。
// 故公历年 y 的月模拟额 = 上一年(y-1)社平/12；用户覆盖（customAnnualWage 或首页 customCYear）
// 均按 C 年度（上一年）键录入，与缴费指数分母口径一致：y 年取 custom[y-1]。
// 返回 { cLabel, value }：cLabel 为公式下标（如 C1992），缺失返回 value=null（阻断，不猜测）。
function annualWageForYear(year, customAnnualWage) {
  customAnnualWage = customAnnualWage || {};
  var cLabel = 'C' + year;      // 31号公式下标
  var wageYear = year - 1;      // 实际取数的社平年度
  var value = null;
  if (customAnnualWage[wageYear] != null) value = customAnnualWage[wageYear];
  else if (P.avgWageLegacyAnnual[wageYear] != null) value = P.avgWageLegacyAnnual[wageYear];
  return { cLabel: cLabel, wageYear: wageYear, value: value };
}

// 计算 Z补贴。
// input 相关字段：
//   doc31Eligible       Boolean  是否申报为31号文第一条三类人员（默认 false=普通企业职工）
//   doc31TransferYM     String   调动/入伍/转制到企业的年月（YYYY-MM，须≥1998-01）
//   enterpriseInsuredYM String   企业实际参保缴费起始年月（YYYY-MM）
//   workStartYM         String   参加工作年月（1992-10后参加工作者自参加工作月起算）
//   subsidyExcludedRanges [{startYM,endYM}] 已享27号文/后联字3号一次性补贴、须扣除的年限区间
//   customAnnualWage    Object   缺口年度 C年 手工覆盖（按公历年，元/年）
// zRealAfterInsured: 企业实际参保后缴费段的 Z实指数（全精度，由引擎另行计算，AC-RC-06）
// 返回：
//   { applicable, subsidy, zRealUsed, insuredStartYM, transferYM, monthCount, excludedMonths,
//     tiers:[{rate,months,sumCWage}], missingYears:[], warning, reason, ineligibleReason }
function calculateAccountSubsidy(input, zRealAfterInsured) {
  var res = {
    applicable: false, subsidy: 0, zRealUsed: null, insuredStartYM: null, transferYM: null,
    periodStartYM: null, periodEndYM: null, monthCount: 0, excludedMonths: 0,
    tiers: [], missingYears: [], warning: null, reason: 'not-applicable', ineligibleReason: null
  };

  // 普通企业职工（默认）：R补=0、不适用（AC-RC-02）
  if (!input || !input.doc31Eligible) {
    res.reason = 'not-doc31-person';
    return res;
  }

  // ---- AC-RC-09 身份与时间门槛 ----
  var transferYM = input.doc31TransferYM;
  if (!transferYM || !/^\d{4}-\d{2}$/.test(transferYM)) {
    res.reason = 'ineligible';
    res.ineligibleReason = '已选择31号文人员身份，但未填写调动/入伍/转制到企业的年月';
    res.warning = res.ineligibleReason + '；按京劳社养发〔2007〕31号第一条，R补（Z补贴）暂按0计。';
    return res;
  }
  var tIdx = D.toIndex(transferYM);
  res.transferYM = transferYM;
  if (tIdx < TRANSFER_MIN_IDX) {
    res.reason = 'ineligible';
    res.ineligibleReason = '调动/入伍/转制时间 ' + transferYM + ' 早于1998-01-01，不属于31号文第一条范围';
    res.warning = res.ineligibleReason + '，R补（Z补贴）=0（AC-RC-09）。';
    return res;
  }

  var insuredYM = input.enterpriseInsuredYM;
  if (!insuredYM || !/^\d{4}-\d{2}$/.test(insuredYM)) {
    res.reason = 'ineligible';
    res.ineligibleReason = '已选择31号文人员身份，但未填写企业实际参保缴费起始年月';
    res.warning = res.ineligibleReason + '；R补（Z补贴）暂按0计。';
    return res;
  }
  var insuredIdx = D.toIndex(insuredYM);
  res.insuredStartYM = insuredYM;

  // ---- 未建账模拟期间：[max(1992-10, 参加工作月), 参保前一月] ----
  var startIdx = SCHEME_START_IDX;
  if (input.workStartYM && /^\d{4}-\d{2}$/.test(input.workStartYM)) {
    startIdx = Math.max(startIdx, D.toIndex(input.workStartYM));
  }
  var endIdx = insuredIdx - 1; // 参保前一月（n=参保前一年；年中参保时末年按月折算 AC-RC-05）
  if (endIdx < startIdx) {
    res.reason = 'no-gap-period'; // 参保时间不晚于建账/参加工作时间 → 无未建账期间
    res.warning = '企业参保起始时间 ' + insuredYM + ' 不晚于参加工作/建账起始，无「应建账未建账」期间，R补（Z补贴）=0。';
    return res;
  }

  // ---- AC-RC-08 已享一次性补贴年限扣除（按月集合） ----
  var excluded = {};
  (input.subsidyExcludedRanges || []).forEach(function (rg) {
    if (!rg || !rg.startYM || !rg.endYM) return;
    var a = Math.max(D.toIndex(rg.startYM), startIdx);
    var b = Math.min(D.toIndex(rg.endYM), endIdx);
    for (var i = a; i <= b; i++) excluded[i] = true;
  });
  var excludedMonths = Object.keys(excluded).length;

  // ---- 逐月分档累加 ----
  var tierAgg = {}; // rate -> { rate, months, sumCWage }
  var missingYears = {};
  var usedMonths = 0;
  for (var idx = startIdx; idx <= endIdx; idx++) {
    if (excluded[idx]) continue;
    var y = D.yearOf(idx);
    var wageInfo = annualWageForYear(y, input.customAnnualWage);
    if (wageInfo.value == null) { missingYears[wageInfo.wageYear] = true; continue; }
    var cYear = wageInfo.value;
    var rate = tierRateAt(idx);
    if (!tierAgg[rate]) tierAgg[rate] = { rate: rate, months: 0, sumCWage: 0 };
    tierAgg[rate].months += 1;
    tierAgg[rate].sumCWage += cYear / 12; // 月模拟额（AC-RC-05：不满整年按 C年/12×月数）
    usedMonths++;
  }

  // 分档原始值全程不舍入（AC-RC-11）；仅输出展示时舍入
  var tiersRaw = Object.keys(tierAgg).map(Number).sort(function (a, b) { return a - b; }).map(function (r) {
    var a0 = tierAgg[r];
    return { rate: r, months: a0.months, sumCWage: a0.sumCWage, bracket: a0.sumCWage * r };
  });

  res.periodStartYM = D.toYM(startIdx);
  res.periodEndYM = D.toYM(endIdx);
  res.monthCount = usedMonths;
  res.excludedMonths = excludedMonths;
  res.tiers = tiersRaw.map(function (t) {
    return { rate: t.rate, months: t.months, sumCWage: Math.round(t.sumCWage * 10000) / 10000, bracket: Math.round(t.bracket * 10000) / 10000 };
  });
  res.missingYears = Object.keys(missingYears).map(Number).sort(function (a, b) { return a - b; });

  if (res.missingYears.length) {
    res.reason = 'missing-annual-wage';
    res.warning = '以下年度缺少官方本市职工年平均工资（C年），无法计算 Z补贴：' +
      res.missingYears.join('、') + '；请在「缺口年度C年手工录入」补录后重算。R补暂按0计。';
    return res;
  }
  if (usedMonths === 0) {
    res.reason = 'fully-excluded';
    res.warning = '未建账期间全部为已享受一次性个人账户补贴的年限（京劳社养发〔2002〕27号/后联字〔2002〕3号），不得重复计算，R补=0（AC-RC-08）。';
    return res;
  }

  var z = (typeof zRealAfterInsured === 'number' && Number.isFinite(zRealAfterInsured)) ? zRealAfterInsured : 0;
  res.zRealUsed = z;
  var bracketSum = tiersRaw.reduce(function (s, t) { return s + t.bracket; }, 0); // 全精度分档和
  res.bracketSumRaw = bracketSum;
  var raw = bracketSum * z;
  // AC-RC-11：中间分档不舍入，最终以元为单位四舍五入保留2位小数（21号文附件一）。
  // 月模拟额 C年/12 的浮点累加误差（约1e-10元量级）远小于0.5分，用1e-9容差保证数学上的 half-up。
  res.subsidy = Math.round((raw + 1e-9) * 100) / 100;
  res.applicable = res.subsidy > 0;
  res.reason = res.applicable ? 'eligible' : 'zero-subsidy';
  if (!res.applicable) {
    res.warning = '31号文人员身份与未建账期间成立，但企业参保后缴费指数 Z实指数=' + z +
      '，Z补贴 按公式计算为0；请核对参保后缴费记录。';
  }
  return res;
}

module.exports = {
  SCHEME_START_YM: '1992-10',
  TRANSFER_MIN_YM: '1998-01',
  tierRateAt: tierRateAt,
  annualWageForYear: annualWageForYear,
  calculateAccountSubsidy: calculateAccountSubsidy
};
