// calculator/inputValidator.js
// Phase-1 共享历史数据（≤2026-08）纯函数构造与校验模块：不依赖 wx，node 可直接断言。
//  - 校验规则与 Phase-0 pages/index 的 buildInput 完全一致（含 31号文 hasDeemed/视同起止校验），
//    并新增「共享窗口截止 2026-08」边界校验（REQ-01-SHR-001/000；裁定 Q1）。
//  - 本模块只构造/校验引擎输入，不复制任何养老金计发计算路径（REQ-01-NFR-002）。
'use strict';

var SHARED_CUTOFF_YM = '2026-08'; // 共享历史数据截止月；2026-09 起为方案差异化窗口

function round1(n) { return Math.round(n * 10) / 10; }

// 缴费指数分母（上年社平/全口径），用于 60%-300% 越界提示
function indexDenomOfYear(P, yearY) {
  if (P.indexDenominatorMonthly[yearY] != null) return P.indexDenominatorMonthly[yearY];
  var keys = Object.keys(P.indexDenominatorMonthly).map(Number).sort(function (a, b) { return a - b; });
  return P.indexDenominatorMonthly[keys[keys.length - 1]];
}

// 年度行 -> 月段（与 Phase-0 index.expandYearRows 同逻辑）
function expandYearRows(D, rows) {
  var segs = [];
  rows.forEach(function (r) {
    var y = parseInt(r.year, 10);
    var k = Math.max(1, Math.min(12, parseInt(r.months, 10) || 0));
    var sm = Math.max(1, Math.min(12, parseInt(r.startMonth, 10) || 1));
    var annualBase = parseFloat(r.annualBase);
    if (!y || !k || !isFinite(annualBase) || annualBase <= 0) return;
    var baseMonthly = annualBase / k;
    var startIdx = y * 12 + (sm - 1);
    segs.push({
      type: r.type,
      startYM: D.toYM(startIdx),
      endYM: D.toYM(startIdx + k - 1),
      baseMonthly: baseMonthly
    });
  });
  return segs;
}

function validateYearRows(rows) {
  rows.forEach(function (r, i) {
    var k = parseInt(r.months, 10), sm = parseInt(r.startMonth, 10);
    if (!/^\d+$/.test(String(r.months == null ? '' : r.months).trim()) || k < 1 || k > 12) {
      throw new Error('年度模式第' + (i + 1) + '行：年内缴费月数须为 1~12 的整数');
    }
    if (!/^\d+$/.test(String(r.startMonth == null ? '' : r.startMonth).trim()) || sm < 1 || sm > 12) {
      throw new Error('年度模式第' + (i + 1) + '行：区间起始月须为 1~12 的整数');
    }
    var b = parseFloat(r.annualBase);
    if (r.annualBase === '' || r.annualBase == null || !isFinite(b) || b <= 0) {
      throw new Error('年度模式第' + (i + 1) + '行：请填写年缴费基数（大于 0）');
    }
  });
}

function parseCustomCYear(text) {
  var out = {};
  (text || '').split(/\n|;|；/).forEach(function (line) {
    var m = line.replace(/\s/g, '').match(/^(\d{4})=(\d+(\.\d+)?)$/);
    if (m) out[m[1]] = +m[2];
  });
  return out;
}

function parseSubsidyExcludedRanges(text) {
  var ranges = [];
  (text || '').split(/\n|;|；/).forEach(function (line) {
    var m = line.replace(/\s/g, '').match(/^(\d{4}-\d{2})[~\-至到]+(\d{4}-\d{2})$/);
    if (m) ranges.push({ startYM: m[1], endYM: m[2] });
  });
  return ranges;
}

// E-05 月度越界提示
function collectBoundWarnings(P, segs) {
  var warns = [];
  var seen = {};
  segs.forEach(function (s) {
    var base = parseFloat(s.baseMonthly);
    if (!isFinite(base) || base <= 0) return;
    var y0 = parseInt(s.startYM.slice(0, 4), 10), y1 = parseInt(s.endYM.slice(0, 4), 10);
    for (var y = y0; y <= y1; y++) {
      var denom = indexDenomOfYear(P, y);
      if (!denom) continue;
      var minBase = round1(denom * 0.6), maxBase = round1(denom * 3);
      var side = base < minBase ? 'low' : (base > maxBase ? 'high' : '');
      var key = y + '|' + side;
      if (side && !seen[key]) {
        seen[key] = true;
        warns.push((base < minBase ? '低于' : '高于') + y + '年度核定区间' +
          (base < minBase ? '下限' : '上限') + '（' + minBase + '~' + maxBase + ' 元/月）：' +
          base + ' 元/月，允许录入但实际申报通常按核定基数征收，请核对（E-05/P08）');
      }
    }
  });
  return warns;
}

// E-05 年度越界提示
function collectYearRowWarnings(P, rows) {
  var warns = [];
  rows.forEach(function (r, i) {
    var label = (r.year || ('第' + (i + 1) + '行')) + '年度';
    var k = parseInt(r.months, 10);
    var sm = parseInt(r.startMonth, 10);
    if (r.months === '' || r.months == null) return;
    if (!/^\d+$/.test(String(r.months).trim()) || k < 1 || k > 12) {
      warns.push(label + '：年内缴费月数须为 1~12 的整数，请核对');
      return;
    }
    if (r.startMonth !== '' && r.startMonth != null &&
      (!/^\d+$/.test(String(r.startMonth).trim()) || sm < 1 || sm > 12)) {
      warns.push(label + '：区间起始月须为 1~12 的整数，请核对');
      return;
    }
    var annualBase = parseFloat(r.annualBase);
    if (r.annualBase === '' || r.annualBase == null) return;
    if (!isFinite(annualBase) || annualBase <= 0) {
      warns.push(label + '：年缴费基数须为大于 0 的数字，请核对');
      return;
    }
    var y = parseInt(r.year, 10);
    var denom = indexDenomOfYear(P, y);
    if (denom) {
      var minAnnual = round1(denom * 0.6 * k), maxAnnual = round1(denom * 3 * k);
      if (annualBase < minAnnual || annualBase > maxAnnual) {
        warns.push(label + '年缴费基数 ' + annualBase + ' 元' +
          (annualBase < minAnnual ? '低于' : '高于') + '该年合理范围（' +
          minAnnual + '~' + maxAnnual + ' 元，按' + k + '个月×核定基数' +
          (annualBase < minAnnual ? '下限' : '上限') + '），允许录入但请核对（E-05/P08）');
      }
    }
  });
  return warns;
}

// 共享历史数据 -> 引擎输入（retireYM/futureMonthlyRate 为方案级，占位 null，D4 按方案合并）
function buildSharedInput(P, D, data, cutoff) {
  cutoff = cutoff || SHARED_CUTOFF_YM;
  if (data.entryMode === 'year') validateYearRows(data.yearRows);
  var rawSegs = data.entryMode === 'year' ? expandYearRows(D, data.yearRows) : data.segments;

  // 共享窗口边界：所有缴费段起止不得晚于 2026-08（REQ-01-SHR-000）
  rawSegs.forEach(function (s, i) {
    if (!s.startYM || !s.endYM) return;
    if (s.startYM > cutoff) {
      throw new Error('共享历史数据截止 ' + cutoff + '：第' + (i + 1) +
        '段起始 ' + s.startYM + ' 已在窗口之后，2026-09 起请在方案卡中设置');
    }
    if (s.endYM > cutoff) {
      throw new Error('共享历史数据截止 ' + cutoff + '：第' + (i + 1) +
        '段结束 ' + s.endYM + ' 超出截止月，请只录至 ' + cutoff + '，2026-09 起在方案卡中设置');
    }
  });

  var segs = rawSegs.map(function (s) {
    return { type: s.type, startYM: s.startYM, endYM: s.endYM, baseMonthly: parseFloat(s.baseMonthly) };
  }).filter(function (s) { return s.startYM && s.endYM && !isNaN(s.baseMonthly); });

  var input = {
    gender: data.gender,
    femaleType: data.gender === 'female' ? data.femaleType : null,
    birthYM: data.birthYM,
    workStartYM: data.workStartYM || null,
    retireYM: null, // 方案级，D4 合并
    deemedStartYM: data.hasDeemed ? (data.deemedStartYM || null) : null,
    deemedEndYM: data.hasDeemed ? (data.deemedEndYM || null) : null,
    segments: segs,
    accountBalanceManual: data.accountBalanceManual === '' ? null : parseFloat(data.accountBalanceManual),
    accountBalanceManualYM: data.manualBalanceYM || null,
    futureMonthlyRate: null, // 方案退休窗口相关，D4/D5 处理
    baseYearOverride: +data.baseYearOptions[data.baseYearIndex],
    cPingOverride: data.cPingOverride === '' ? null : parseFloat(data.cPingOverride),
    customCYear: parseCustomCYear(data.customCYearText),
    doc31Eligible: !!data.doc31Eligible,
    doc31TransferYM: data.doc31TransferYM || null,
    enterpriseInsuredYM: data.enterpriseInsuredYM || null,
    subsidyExcludedRanges: data.doc31Eligible ? parseSubsidyExcludedRanges(data.subsidyExcludedText) : []
  };

  // 31号文人员校验（与 Phase-0 buildInput 完全一致）
  if (data.doc31Eligible) {
    if (!/^\d{4}-\d{2}$/.test(data.workStartYM || '')) {
      throw new Error('31号文人员必须填写参加工作年月（供N实98连续工龄与N同1992-09截断使用）');
    }
    if (!data.hasDeemed ||
      !/^\d{4}-\d{2}$/.test(data.deemedStartYM || '') || !/^\d{4}-\d{2}$/.test(data.deemedEndYM || '')) {
      throw new Error('31号文人员须将视同缴费年限开关置为「有」，并按档案认定填写起止年月');
    }
    if (!/^\d{4}-\d{2}$/.test(data.doc31TransferYM || '') || data.doc31TransferYM < '1998-01') {
      throw new Error('31号文人员须填写调动/入伍/转制到企业年月（不早于1998-01，京劳社养发〔2007〕31号第一条）');
    }
    if (!/^\d{4}-\d{2}$/.test(data.enterpriseInsuredYM || '')) {
      throw new Error('31号文人员须填写企业实际参保缴费起始年月（用于确定 Z补贴 截止年与参保后Z实指数）');
    }
  }
  return input;
}

// 共享组件允许的字段（相对 inputPageModel 剔除方案级/运行态字段）
var SHARED_KEYS = [
  'gender', 'femaleType', 'birthYM', 'workStartYM',
  'hasDeemed', 'deemedStartYM', 'deemedEndYM',
  'entryMode', 'segments', 'yearRows',
  'accountBalanceManual', 'manualBalanceYM',
  'doc31Eligible', 'doc31TransferYM', 'enterpriseInsuredYM', 'subsidyExcludedText',
  'cPingOverride', 'customCYearText', 'boundWarnings',
  'deemedStartPh', 'deemedEndPh', 'manualBalancePh', 'doc31TransferPh', 'enterpriseInsuredPh',
  'baseYearOptions', 'baseYearIndex', 'pensionBase', 'policyVersion'
];

function pickShared(data) {
  var out = {};
  SHARED_KEYS.forEach(function (k) {
    if (data[k] !== undefined) out[k] = data[k];
  });
  return out;
}

module.exports = {
  CUTOFF: SHARED_CUTOFF_YM,
  SHARED_KEYS: SHARED_KEYS,
  pickShared: pickShared,
  indexDenomOfYear: indexDenomOfYear,
  expandYearRows: expandYearRows,
  validateYearRows: validateYearRows,
  parseCustomCYear: parseCustomCYear,
  parseSubsidyExcludedRanges: parseSubsidyExcludedRanges,
  collectBoundWarnings: collectBoundWarnings,
  collectYearRowWarnings: collectYearRowWarnings,
  buildSharedInput: buildSharedInput
};
