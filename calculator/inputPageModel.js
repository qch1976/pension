// calculator/inputPageModel.js
// 输入页数据模型纯函数（批次2 #6/#11）：不依赖 wx，可在 node 直接断言。
//  - buildInitialData：首次进入页面的默认数据（带示例默认值）；
//  - buildResetData：点击「清空本地录入数据」后的空数据（全部用户录入项归空，静态选项/占位文案保留）；
//  - enterCalculating / exitCalculating：计算遮罩开关（#11）。
'use strict';

function emptySegment() {
  return { type: '', startYM: '', endYM: '', baseMonthly: '' };
}
function emptyYearRow() {
  return { year: '', startMonth: '1', annualBase: '', months: '12', zValue: '' };
}

function staticPart(P) {
  return {
    // 非用户录入：选项/字典/占位文案，重置后仍保留
    // Bug24 I-2：占位文案删具体案例月份（1995-07/2000-10 是旧案数据）
    deemedStartPh: '请选择起始年月（含当月）',
    deemedEndPh: '请选择终止年月（含当月）',
    // Bug24 I-3：删“本案 2026-08”
    manualBalancePh: '请选择余额所在年月',
    doc31TransferPh: '请选择（不早于1998-01）',
    enterpriseInsuredPh: '请选择参保起始年月',
    baseYearOptions: ['2025', '2024', '2023', '2022', '2021', '2020'],
    baseYearIndex: 0,
    pensionBase: P.pensionBaseByYear,
    policyVersion: P.version
  };
}

function userEntryPart(withDefaults) {
  // withDefaults=true（首次进入）：带示例默认值；false（#6 清空）：全部用户录入项归空
  return {
    gender: withDefaults ? 'male' : '',
    femaleType: withDefaults ? 'worker' : '',
    birthYM: withDefaults ? '1965-10' : '',
    workStartYM: withDefaults ? '1985-07' : '',
    retireYM: withDefaults ? '2025-10' : '',
    retireHint: '',
    // Bug22：是否有经档案认定的视同缴费年限（显式有/无状态，默认无）；
    // 仅 hasDeemed=true 时起止可录；切回 false 时起止立即清空。
    hasDeemed: false,
    deemedStartYM: '',
    deemedEndYM: '',
    entryMode: 'year', // BUG-15：缺省改为年度模式录入（已存 storage 草稿中的 entryMode 仍按草稿回填）
    segments: withDefaults
      ? [{ type: 'enterprise', startYM: '1992-10', endYM: '2025-09', baseMonthly: '' }]
      : [emptySegment()],
    yearRows: withDefaults
      ? [{ year: '2024', startMonth: '1', annualBase: '', months: '12', zValue: '' }]
      : [emptyYearRow()],
    // #8 账户三项
    accountBalanceManual: '',
    manualBalanceYM: '',
    futureMonthlyRatePct: withDefaults ? '1.5' : '',
    // #10 / 31号文
    doc31Eligible: false,
    doc31TransferYM: '',
    // Bug26/V1.8：通用基本信息（section ①，所有人员可填）——企业（制度内）首次实际参保缴费年月；
    // 非 doc31 人员填写时作为 N应缴窗口优先锚点，留空回退参工月；doc31 人员继续用于窗口与 Z补贴。
    enterpriseInsuredYM: '',
    subsidyExcludedText: '',
    cPingOverride: '',
    customCYearText: '',
    boundWarnings: [],
    errorMsg: '',
    // #11 计算遮罩
    calculating: false
  };
}

function buildInitialData(P) {
  return Object.assign(userEntryPart(true), staticPart(P));
}

// #6 清空：全部用户录入字段为空（含批次1新改的起止年月/账户累计额/未来年利率/年度记录），
// 静态选项与占位文案保留。
function buildResetData(P) {
  return Object.assign(userEntryPart(false), staticPart(P));
}

// #11 遮罩开关（纯函数；真正的重运算在页面 setTimeout 让出一帧后执行）
function enterCalculating(data) {
  return Object.assign({}, data, { calculating: true, errorMsg: '' });
}
function exitCalculating(data) {
  return Object.assign({}, data, { calculating: false });
}

// ---------------------------------------------------------------------------
// BUG-02-0017（方案乙）：基本计算页 Z值 ↔ 月缴费基数 双向转换。
// 严格与方案比较页同源：
//   - C（缴费指数分母）统一走 planAssembler.denominatorForYear（内部即引擎同源），禁魔法数；
//   - 基数取整统一走 planAssembler.roundLowestToYuan（仅最低档 Z=0.6 到元，其余裸值不取整）；
//   - Z 保留 4 位小数。
// 纯函数、不依赖 wx，node 可直接断言。
// ---------------------------------------------------------------------------
var AsmRef = require('./planAssembler.js');
var Z_DECIMALS = 4;

// 四位小数归一（去掉浮点尾巴，返回 number）。
function normZ(z) {
  var n = Number(z);
  if (!isFinite(n)) return NaN;
  return Math.round(n * Math.pow(10, Z_DECIMALS)) / Math.pow(10, Z_DECIMALS);
}

// Z -> 月缴费基数（与方案比较页 buildAutoSegments 完全同源）。
// yearY：用于取当年 C 的缴费年度；customCYear：自定义 C 年（页面「缺口年度C年手工录入」）。
function baseFromZ(z, yearY, customCYear) {
  var zz = normZ(z);
  if (!isFinite(zz) || zz <= 0) return null;
  var c = AsmRef.denominatorForYear(yearY, customCYear);
  if (!(typeof c === 'number' && isFinite(c) && c > 0)) return null;
  return AsmRef.roundLowestToYuan(zz * c, zz);
}

// 月缴费基数 -> Z（保留 4 位小数）。
function zFromBase(base, yearY, customCYear) {
  var b = Number(base);
  if (!isFinite(b) || b <= 0) return null;
  var c = AsmRef.denominatorForYear(yearY, customCYear);
  if (!(typeof c === 'number' && isFinite(c) && c > 0)) return null;
  return normZ(b / c);
}

// ---------------------------------------------------------------------------
// BUG-02-0022（REQ-02-IN-008）：年度录入模式缴费基数 ↔ Z 值双向转换。
// 口径与月度模式/方案比较页严格同源：
//   月基数 = 年缴费基数 annualBase ÷ 年内缴费月数 months；
//   Z = 月基数 / C_year（C 走 denominatorForYear，当前年 C2026=12116）；
//   Z → 月基数走 baseFromZ（最低档 Z=0.6 经 roundLowestToYuan 取整到元）；
//   年缴费基数 = 月基数 × months。
// 纯函数、不依赖 wx，node 可直接断言。
// ---------------------------------------------------------------------------

// 年度行月基数（裸值，未取整）；年份/年基数/月数不合法时返回 null。
function yearRowMonthly(yr) {
  var annual = Number(yr.annualBase);
  var months = parseInt(yr.months, 10);
  if (!isFinite(annual) || annual <= 0 || !(months >= 1 && months <= 12)) return null;
  return annual / months;
}

// 年缴费基数 → Z（4 位小数）；不可算时返回 null。
function yearZFromAnnual(yr, customCYear) {
  var monthly = yearRowMonthly(yr);
  if (monthly == null) return null;
  var yearY = parseInt(yr.year, 10);
  if (!yearY) return null;
  return zFromBase(monthly, yearY, customCYear);
}

// Z → { monthly, annual }：月基数（按 Z 档位取整规则）+ 年缴费基数；不可算返回 null。
function yearAnnualFromZ(z, yr, customCYear) {
  var months = parseInt(yr.months, 10);
  var yearY = parseInt(yr.year, 10);
  if (!(months >= 1 && months <= 12) || !yearY) return null;
  var monthly = baseFromZ(z, yearY, customCYear);
  if (monthly == null) return null;
  return { monthly: monthly, annual: monthly * months };
}

// BUG-27：政策静态字段随代码/政策文件发布而变，必须始终取 constants/policyData.js 的最新值，
// 绝不能被 storage 旧草稿回填覆盖（否则改 version/计发基数后模拟器仍显示旧值）。
var STATIC_KEYS = [
  'policyVersion', 'pensionBase', 'baseYearOptions',
  'deemedStartPh', 'deemedEndPh', 'manualBalancePh', 'doc31TransferPh', 'enterpriseInsuredPh'
];

// 从页面 data / 已存草稿中剔除静态政策字段，仅保留用户录入与选择，用于 storage 读写。
function pickUserData(data) {
  var out = {};
  Object.keys(data || {}).forEach(function (k) {
    if (STATIC_KEYS.indexOf(k) === -1) out[k] = data[k];
  });
  return out;
}

module.exports = {
  buildInitialData: buildInitialData,
  buildResetData: buildResetData,
  enterCalculating: enterCalculating,
  exitCalculating: exitCalculating,
  pickUserData: pickUserData,
  Z_DECIMALS: Z_DECIMALS,
  baseFromZ: baseFromZ,
  zFromBase: zFromBase,
  yearRowMonthly: yearRowMonthly,
  yearZFromAnnual: yearZFromAnnual,
  yearAnnualFromZ: yearAnnualFromZ
};
