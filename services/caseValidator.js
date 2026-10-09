// services/caseValidator.js
// E3（REQ-02-VAL-000~006）：Case 字段校验 + 复用 Phase-0 buildInput 业务交叉规则；纯逻辑、不依赖 wx。
//
// 两阶段：
//   A. 字段/取值校验（VAL-001~004）：必填、日期格式、范围、重复年份、时间先后——错误带 field/line/reason。
//   B. 业务交叉校验（VAL-005）：把文件数据映射成 Phase-0 页面 data，调用与 pages/index.buildInput
//      完全一致的规则；文件通道不比手工通道宽松。
// Q3（VAL-000）：输出两类——validFields（可直接回填）与 invalidOrMissing（界面手工补齐）；
//   手工补齐后再次调用本模块（仍走 buildInput），不绕过。
'use strict';

// ---------- 基础工具 ----------
function isYM(s) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || '')); }
function isDate(s) {
  if (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(s || ''))) return true;
  return isYM(s);
}
function ymOfDate(s) { return String(s).slice(0, 7); } // YYYY-MM-DD -> YYYY-MM
function pad2(n) { return (n < 10 ? '0' : '') + n; }

// 年度行 -> 月段（与 pages/index.expandYearRows / inputValidator.expandYearRows 同逻辑）
function expandYearRows(rows) {
  var segs = [];
  rows.forEach(function (r) {
    var y = parseInt(r.year, 10);
    var k = Math.max(1, Math.min(12, parseInt(r.months, 10) || 0));
    var sm = Math.max(1, Math.min(12, parseInt(r.startMonth, 10) || 1));
    var annualBase = parseFloat(r.annualBase);
    if (!y || !k || !isFinite(annualBase) || annualBase <= 0) return;
    var baseMonthly = annualBase / k;
    var startIdx = y * 12 + (sm - 1);
    var toYM = function (idx) {
      var yr = Math.floor(idx / 12);
      var mo = idx % 12 + 1;
      return yr + '-' + pad2(mo);
    };
    segs.push({ startYM: toYM(startIdx), endYM: toYM(startIdx + k - 1), baseMonthly: baseMonthly });
  });
  return segs;
}

// =====================================================================
// 映射：caseFile 解析结果（fields + records）-> Phase-0 页面 data（同名字段）
//  - 生日(YYYY-MM-DD/YM) -> birthYM(YYYY-MM)
//  - records[{year,base,months}] -> yearRows[{year, annualBase:base, months, startMonth:1}]
//  - 文件无性别：默认 male（界面可改）；hasDeemed 由是否给出视同起止判定。
// =====================================================================
function mapParsedToPageData(parsed, options) {
  options = options || {};
  var f = parsed.fields || {};
  var yearRows = (parsed.records || []).map(function (r) {
    return { year: String(r.year), startMonth: '1', annualBase: String(r.base), months: String(r.months) };
  });

  var hasDeemed = !!(f.deemedStartYM || f.deemedEndYM);

  var d = {
    gender: options.gender || 'male',
    femaleType: options.femaleType || 'worker',
    birthYM: f.birthday ? ymOfDate(f.birthday) : '',
    workStartYM: f.workStartYM || '',
    retireYM: f.retireYM || options.retireYM || '',
    hasDeemed: hasDeemed,
    deemedStartYM: f.deemedStartYM || '',
    deemedEndYM: f.deemedEndYM || '',
    entryMode: 'year',
    yearRows: yearRows,
    accountBalanceManual: f.accountBalance != null ? String(f.accountBalance) : '',
    manualBalanceYM: f.paidToYM || '',
    futureMonthlyRatePct: f.accountRate != null ? String(f.accountRate) : '',
    baseYearOptions: ['2025', '2024', '2023', '2022', '2021', '2020'],
    baseYearIndex: 0,
    cPingOverride: '',
    customCYearText: '',
    doc31Eligible: false,
    doc31TransferYM: '',
    enterpriseInsuredYM: f.accountStartYM || '',
    subsidyExcludedText: ''
  };
  return d;
}

// =====================================================================
// buildInput 适配（与 pages/index.buildInput 规则完全一致；REQ-02-VAL-005）
// 成功返回引擎 input；失败 throw Error（消息与手工通道一致）。
// =====================================================================
function buildInputLike(d) {
  if (d.entryMode === 'year') validateYearRows(d.yearRows);
  var rawSegs = d.entryMode === 'year' ? expandYearRows(d.yearRows) : d.segments;
  var segs = rawSegs.map(function (s) {
    return { type: s.type || 'enterprise', startYM: s.startYM, endYM: s.endYM, baseMonthly: parseFloat(s.baseMonthly) };
  }).filter(function (s) { return s.startYM && s.endYM && !isNaN(s.baseMonthly); });

  var input = {
    gender: d.gender,
    femaleType: d.gender === 'female' ? d.femaleType : null,
    birthYM: d.birthYM,
    workStartYM: d.workStartYM || null,
    retireYM: d.retireYM,
    deemedStartYM: d.hasDeemed ? (d.deemedStartYM || null) : null,
    deemedEndYM: d.hasDeemed ? (d.deemedEndYM || null) : null,
    segments: segs,
    accountBalanceManual: d.accountBalanceManual === '' ? null : parseFloat(d.accountBalanceManual),
    accountBalanceManualYM: d.manualBalanceYM || null,
    futureMonthlyRate: d.futureMonthlyRatePct === '' ? null : parseFloat(d.futureMonthlyRatePct) / 100,
    baseYearOverride: +d.baseYearOptions[d.baseYearIndex],
    cPingOverride: d.cPingOverride === '' ? null : parseFloat(d.cPingOverride),
    customCYear: {},
    doc31Eligible: !!d.doc31Eligible,
    doc31TransferYM: d.doc31TransferYM || null,
    enterpriseInsuredYM: d.enterpriseInsuredYM || null,
    subsidyExcludedRanges: []
  };

  if (d.doc31Eligible) {
    if (!/^\d{4}-\d{2}$/.test(d.workStartYM || '')) {
      throw new Error('31号文人员必须填写参加工作年月（供N实98连续工龄与N同1992-09截断使用）');
    }
    if (!d.hasDeemed ||
      !/^\d{4}-\d{2}$/.test(d.deemedStartYM || '') || !/^\d{4}-\d{2}$/.test(d.deemedEndYM || '')) {
      throw new Error('31号文人员须将视同缴费年限开关置为「有」，并按档案认定填写起止年月');
    }
    if (!/^\d{4}-\d{2}$/.test(d.doc31TransferYM || '') || d.doc31TransferYM < '1998-01') {
      throw new Error('31号文人员须填写调动/入伍/转制到企业年月（不早于1998-01，京劳社养发〔2007〕31号第一条）');
    }
    if (!/^\d{4}-\d{2}$/.test(d.enterpriseInsuredYM || '')) {
      throw new Error('31号文人员须填写企业实际参保缴费起始年月（用于确定 Z补贴 截止年与参保后Z实指数）');
    }
  }
  return input;
}

function validateYearRows(rows) {
  (rows || []).forEach(function (r, i) {
    var k = parseInt(r.months, 10);
    if (!/^\d+$/.test(String(r.months == null ? '' : r.months).trim()) || k < 1 || k > 12) {
      throw new Error('年度模式第' + (i + 1) + '行：年内缴费月数须为 1~12 的整数');
    }
    var b = parseFloat(r.annualBase);
    if (r.annualBase === '' || r.annualBase == null || !isFinite(b) || b <= 0) {
      throw new Error('年度模式第' + (i + 1) + '行：请填写年缴费基数（大于 0）');
    }
  });
}

// =====================================================================
// 阶段 A：字段/取值校验。errors 累积（不一次性中断），每条 {field,line,reason}
// =====================================================================
function fieldChecks(parsed, mode) {
  var f = parsed.fields || {};
  var errs = [];
  var badFields = {};
  function mark(field, line, reason) {
    errs.push({ field: field, line: line || 0, reason: reason });
    if (field) badFields[field] = true;
  }

  // VAL-001：读取/编码/空（parseCaseFile 已置语法错误；这里兜底）
  if (parsed.readError) mark(null, 0, parsed.readError);

  // 透传解析期语法错误（VAL-002，已带行号），并记录关联字段
  (parsed.errors || []).forEach(function (e) {
    errs.push({ field: e.field || null, line: e.line || 0, reason: e.reason });
  });

  // ---- 必填（VAL-003）----
  if (!f.birthday) mark('birthday', 0, '缺少必填字段：生日');
  if (!f.paidToYM) mark('paidToYM', 0, '缺少必填字段：养老保险目前交到');
  if (mode === 'basic' && !f.retireYM) mark('retireYM', 0, '基本计算缺少必填字段：预计退休时间');
  // compare 模式退休为界面方案项，不要求文件提供
  if ((f.deemedStartYM || f.deemedEndYM)) {
    if (!f.deemedStartYM) mark('deemedStartYM', 0, '已填视同结束时间，缺少视同起始时间');
    if (!f.deemedEndYM) mark('deemedEndYM', 0, '已填视同起始时间，缺少视同结束时间');
  }

  // ---- 日期格式（VAL-004）----
  if (f.birthday && !isDate(f.birthday)) mark('birthday', 0, '生日须为 YYYY-MM-DD 或 YYYY-MM：' + f.birthday);
  [['workStartYM', '参加工作时间'], ['accountStartYM', '首次建立养老账号'],
   ['deemedStartYM', '视同起始'], ['deemedEndYM', '视同结束'],
   ['paidToYM', '养老保险目前交到'], ['retireYM', '预计退休时间']].forEach(function (pair) {
    if (f[pair[0]] && !isYM(f[pair[0]])) mark(pair[0], 0, pair[1] + '须为 YYYY-MM：' + f[pair[0]]);
  });

  // ---- 数值范围（VAL-004）----
  if (f.accountRate != null && (f.accountRate < 0 || f.accountRate > 20)) {
    mark('accountRate', 0, '个人账户利率超出合理范围(0~20%)：' + f.accountRate);
  }
  if (f.accountBalance != null && f.accountBalance < 0) {
    mark('accountBalance', 0, '个人账户金额不能为负：' + f.accountBalance);
  }
  if (mode === 'basic' && f.zValue != null && (f.zValue < 0.6 || f.zValue > 3)) {
    mark('zValue', 0, '每月缴费 Z 值须在 0.60~3.00：' + f.zValue);
  }
  if (f.contributionNature && !/企业职工|失业灵活就业|灵活就业|失业/.test(f.contributionNature)) {
    mark('contributionNature', 0, '缴费性质须为「企业职工」或「失业灵活就业」：' + f.contributionNature);
  }

  // ---- 缴费表：月数 1~12、基数>0、年份不重复（VAL-004）----
  var yearSeen = {};
  (parsed.records || []).forEach(function (r, i) {
    var ln = (parsed.recordLines && parsed.recordLines[i]) || 0;
    if (r.months < 1 || r.months > 12) mark('records', ln, '第' + r.year + '年 年内缴纳月数须在 1~12：' + r.months);
    if (!(r.base > 0)) mark('records', ln, '第' + r.year + '年 缴费基数须大于 0：' + r.base);
    if (yearSeen[r.year]) mark('records', ln, '缴费年份重复：' + r.year);
    yearSeen[r.year] = true;
  });

  // ---- 时间先后（VAL-005 中可按字段定位的部分）----
  var YM = {};
  ['workStartYM', 'accountStartYM', 'paidToYM', 'retireYM'].forEach(function (k) {
    if (isYM(f[k])) YM[k] = f[k];
  });
  var order = [['workStartYM', 'accountStartYM'], ['accountStartYM', 'paidToYM'], ['paidToYM', 'retireYM']];
  order.forEach(function (pair) {
    var a = YM[pair[0]], b = YM[pair[1]];
    if (a && b && a > b) mark(pair[1], 0, '时间先后错误：' + pair[0] + '(' + a + ') 晚于 ' + pair[1] + '(' + b + ')');
  });
  if (isYM(f.deemedStartYM) && isYM(f.deemedEndYM) && f.deemedStartYM > f.deemedEndYM) {
    mark('deemedEndYM', 0, '视同起始晚于结束：' + f.deemedStartYM + ' > ' + f.deemedEndYM);
  }
  if (isYM(f.birthday ? ymOfDate(f.birthday) : '') && isYM(f.workStartYM) &&
      ymOfDate(f.birthday) > f.workStartYM) {
    mark('workStartYM', 0, '参加工作时间早于出生年月，请核对');
  }

  return { errors: errs, badFields: badFields };
}

// =====================================================================
// 主入口：validate(parsed, mode, options)
// 返回 {
//   ok, canCalculate,
//   validFields:[...], invalidOrMissing:[{field,line,reason}],
//   missingFields:[...], engineInput, pageData,
//   parsedYears, summary
// }
// =====================================================================
function validate(parsed, mode, options) {
  mode = mode === 'compare' ? 'compare' : 'basic';
  parsed = parsed || { fields: {}, records: [] };

  var a = fieldChecks(parsed, mode);
  var pageData = mapParsedToPageData(parsed, options || {});

  // 阶段 B：buildInput 交叉校验（仅在字段级没有会导致 buildInput 误判的错误时仍尝试，
  // 以保证“错误全部显示”；buildInput 自身抛错也收集）
  var engineInput = null;
  try {
    engineInput = buildInputLike(pageData);
    // buildInput 之外的最低数据要求（与 onCalculate 一致）
    if (!engineInput.segments.length && engineInput.accountBalanceManual == null) {
      a.errors.push({ field: 'records', line: 0, reason: '请至少录入一段实际缴费基数，或直接填写个人账户累计储存额' });
      a.badFields.records = true;
    }
  } catch (e) {
    a.errors.push({ field: null, line: 0, reason: e.message });
  }

  // ---- Q3 分类 ----
  var candidateFields = ['birthday', 'workStartYM', 'accountStartYM', 'paidToYM',
    'retireYM', 'deemedStartYM', 'deemedEndYM', 'accountBalance', 'accountRate',
    'zValue', 'contributionNature'];
  var f = parsed.fields || {};
  var validFields = candidateFields.filter(function (k) {
    return f[k] != null && !a.badFields[k];
  });
  if (!a.badFields.records && (parsed.records || []).length) validFields.push('records');

  var missingFields = [];
  ['birthday', 'paidToYM'].forEach(function (k) { if (f[k] == null) missingFields.push(k); });
  if (mode === 'basic' && f.retireYM == null) missingFields.push('retireYM');

  var ok = a.errors.length === 0;
  var parsedYears = (parsed.records || []).length;
  var summary = ok
    ? ('校验通过，共解析 ' + parsedYears + ' 条缴费年度/月')
    : ('校验通过，共解析 ' + parsedYears + ' 条缴费年度/月；另有 ' + a.errors.length + ' 项待补充');

  return {
    ok: ok,
    canCalculate: !!engineInput && a.errors.length === 0,
    validFields: validFields,
    invalidOrMissing: a.errors,
    missingFields: missingFields,
    engineInput: engineInput,
    pageData: pageData,
    parsedYears: parsedYears,
    summary: summary
  };
}

module.exports = {
  validate: validate,
  mapParsedToPageData: mapParsedToPageData,
  buildInputLike: buildInputLike,
  expandYearRows: expandYearRows
};
