// services/reportExport.js
// E5：生成 UTF-8 纯文本 .txt 报告（不依赖 wx）。
//  - buildBasicReport：对应 Phase-0 pages/result（基本计算结果）。
//  - buildCompareReport：对应 Phase-1 pages/compare-result（方案比较结果，入参为 compareResultModel.buildView 的 view）。
// 金额一律两位小数；【预估】角标与结果页同口径（OUT-002）；含报告版本/生成时点（OUT-004）；扩展名固定 txt（Q4）。
'use strict';

var REPORT_VERSION = 'PensionReport-v2.0';
var LINE = '------------------------------------------------------------';
var THICK = '============================================================';

function f2(n) {
  if (n == null || !isFinite(n)) return '--';
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
}

// 与 result.js yearsText 同口径：x年y个月（原值）
function yearsText(v) {
  if (v == null || !isFinite(v)) return '--';
  var y = Math.floor(v);
  var m = Math.round((v - y) * 12);
  return y + '年' + m + '个月（' + v.toFixed(4) + '年）';
}

function padRight(s, n) {
  s = String(s);
  // 中文按两个宽度计，保证列对齐
  var w = 0;
  for (var i = 0; i < s.length; i++) {
    w += s.charCodeAt(i) > 255 ? 2 : 1;
  }
  while (w < n) { s += ' '; w++; }
  return s;
}

function headerLines(title, generatedAt) {
  return [
    THICK,
    title,
    THICK,
    '报告版本：' + REPORT_VERSION + '（OUT-004）',
    '生成时点：' + generatedAt,
    '编码：UTF-8 纯文本（.txt，Q4）',
    '说明：本报告数值与 App 结果页逐值一致，金额保留两位小数；测算结果仅供参考，以北京市社保经办机构核定为准。',
    LINE
  ];
}

// ---------------------------------------------------------------------------
// 基本计算报告（Phase-0 result）
// opts.generatedAt 必填（如 '2026-10-09 23:10:00'）
// ---------------------------------------------------------------------------
function buildBasicReport(result, opts) {
  opts = opts || {};
  var generatedAt = opts.generatedAt || '--';
  var it = result.intermediates || {};
  var pn = result.pension || {};
  var meta = result.meta || {};
  var inp = result.inputs || {};

  var L = headerLines('北京市企业职工养老金测算报告 · 基本计算', generatedAt);

  // 资格
  L.push('【人员与领取资格】');
  L.push('人员类型：' + meta.personType);
  L.push('退休年龄：' + meta.retireAge + ' 岁    计发月数 M：' + it.M);
  L.push('实缴 ' + it.actualPaidMonths + ' 月 + 视同 ' + it.deemedMonths +
    ' 月 = ' + meta.totalMonths + ' 月；最低要求 ' + meta.minRequiredMonths + ' 月');
  L.push(meta.eligible
    ? '符合按月领取条件（具体以经办核定为准）'
    : '⚠ 不满足按月领取最低年限条件，以下仅为数学测算值');
  if (meta.retireSchedule) {
    var rs = meta.retireSchedule;
    L.push('法定退休年月：' + rs.statutoryYM + '    本次拟退休：' + rs.chosenYM);
    L.push('弹性退休允许区间：' + rs.flexibleMinYM + ' ~ ' + rs.flexibleMaxYM);
  }
  L.push(LINE);

  // 总额 + 三分项
  L.push('【退休首月基本养老金】（元/月）');
  L.push('合计 P总：¥' + f2(pn.total));
  L.push('  基础养老金   J基础：¥' + f2(pn.J基础));
  L.push('  个人账户养老金 J账户：¥' + f2(pn.J账户));
  L.push('  过渡性养老金 J过渡：¥' + f2(pn.J过渡) +
    '（= G同 ¥' + f2(it.G同) + ' + G实 ¥' + f2(it.G实) + '，仅中人享有）');
  L.push(LINE);

  // 中间变量
  L.push('【中间变量（精确到月）】');
  L.push('C平（' + inp.baseYear + '年度计发基数）：¥' + f2(it.C平));
  L.push('Z实指数：' + it.Z实指数 + '    Z同指数：' + it.Z同指数 + '（=1.0）');
  L.push('N应缴（Z实分母口径）：' + yearsText(it.N应缴));
  L.push('N实同（基础养老金年限）：' + yearsText(it.N实同));
  L.push('N同（1992-09前视同）：' + yearsText(it.N同));
  L.push('N实98（连续工龄口径）：' + yearsText(it.N实98));

  // R储：与 result.js buildRStoreVm 同口径，未来段月滚利率带【预估】
  var acct = result.account || {};
  var isFutureRoll = !!acct.manual && (acct.yearly || []).some(function (a) {
    return a.rateSource === 'future-monthly';
  });
  L.push('R储（个人账户累计储存额）：¥' + f2(it.R储));
  if (isFutureRoll) {
    L.push('  其中 新增本金：¥' + f2(it.R储本金) +
      '    记账利息【预估】：¥' + f2(it.R储利息) +
      '（未来段记账利率为工程口径，按月复利）');
  }
  L.push('R补（Z补贴·虚拟计发额）：¥' + f2(it.R补));
  L.push('G同：¥' + f2(it.G同) + '    G实：¥' + f2(it.G实));
  L.push(LINE);

  // 个人账户按年记账
  var yearly = acct.yearly || [];
  if (yearly.length) {
    L.push('【个人账户按年记账】');
    L.push(padRight('年度', 8) + padRight('当年利息', 14) +
      padRight('年末本息余额', 16) + '记账利率/来源');
    yearly.forEach(function (a) {
      var rateTxt = a.rate == null ? '不计息' : (a.rate * 100).toFixed(2) + '%';
      rateTxt += ' ' + rateSourceTag(a.rateSource);
      L.push(padRight(a.year, 8) + padRight(f2(a.interest), 14) +
        padRight(f2(a.endBalance), 16) + rateTxt);
    });
    L.push(LINE);
  }

  // Z实指数年度明细账（全部窗口年）
  var annual = result.annualIndex || [];
  if (annual.length) {
    L.push('【Z实指数 年度明细账】');
    annual.forEach(function (a) {
      var c = a.cPrevAnnual == null ? '--' : f2(a.cPrevAnnual);
      var z = a.zYear == null ? '--' : a.zYear.toFixed(4);
      var est = a.denomSource === 'assumed' ? '【预估】' : '';
      L.push(a.year + '：应缴' + a.windowMonths + '月/实缴' + a.paidMonths +
        '月  X=' + f2(a.xAnnual) + '  C=' + c + '  Z年=' + z +
        '  [' + denomLabel(a.denomSource) + ']' + est);
    });
    L.push(LINE);
  }

  // 灵活就业成本
  var flex = result.flexInfo || {};
  if (flex.months > 0) {
    L.push('【灵活就业段成本提示】');
    L.push('灵活就业月数：' + flex.months + ' 月    累计缴费成本（20%）：¥' + f2(flex.totalCost));
    L.push('其中 8% 入个人账户。');
    L.push(LINE);
  }

  // 假设/警告
  var warns = meta.warnings || [];
  if (warns.length) {
    L.push('【数据提示与假设说明】');
    warns.forEach(function (w) { L.push('· ' + w); });
    L.push(LINE);
  }

  L.push('政策参数版本：' + (meta.policyDataVersion || '--') +
    '；数据来源按 官方/工程假设/待确认 三级标注。');
  L.push('本报告由本地计算生成，不采集姓名与身份证号；以北京市社保经办机构核定为准。');
  L.push(THICK);

  return L.join('\r\n');
}

function rateSourceTag(src) {
  switch (src) {
    case 'official': return '[官方]';
    case 'fixed': return '[固定]';
    case 'assumed': return '[待官方核实·预估]';
    case 'future-monthly': return '[月滚工程·预估]';
    default: return src ? '[' + src + ']' : '';
  }
}

function denomLabel(src) {
  switch (src) {
    case 'official': return '官方';
    case 'assumed': return '预估';
    case 'custom': return '手录';
    case 'missing': return '缺分母';
    case 'mixed': return '混合';
    default: return src || '';
  }
}

// ---------------------------------------------------------------------------
// 方案比较报告（Phase-1 compare-result）
// view = compareResultModel.buildView(sharedInput, plans, rate)
// ---------------------------------------------------------------------------
function buildCompareReport(view, opts) {
  opts = opts || {};
  var generatedAt = opts.generatedAt || '--';
  var cols = view.columns || [];

  var L = headerLines('北京市企业职工养老金测算报告 · 方案比较', generatedAt);
  L.push('回本年利率口径：0% 与 ' + view.userRatePercent + '% 两档；金额单位：元（两位小数）。');
  L.push('');

  cols.forEach(function (c, i) {
    var est = c.estimated ? '【预估】' : '';
    var base = c.id === view.baselineId ? '（基准）' : '';
    var grey = c.grey ? '（不可按月领）' : '';
    L.push(THICK);
    L.push('方案' + (i + 1) + '  ' + base + est + grey);
    L.push(THICK);
    L.push('退休年月：' + c.retireYM);
    L.push('缴费性质：' + c.segLabel);
    L.push('Z（月缴费指数）：' + c.z);
    L.push('缴费月数：' + c.contMonths + ' 月');
    L.push('月养老金 P月：¥' + f2(c.pMonthly) + ' ' + est);
    L.push('  ├ 基础 J基础：¥' + f2(c.jBasic));
    L.push('  ├ 账户 J账户：¥' + f2(c.jAccount));
    L.push('  └ 过渡 J过渡：¥' + f2(c.jTransit));
    L.push('继续缴费 R续：¥' + f2(c.rContinued) + '（月均 ¥' + f2(c.monthlyBurden) + '）');
    L.push('回本月数（0%）：' + c.pb0.text +
      (c.pb0.sub && c.pb0.sub !== c.pb0.text ? ' ' + c.pb0.sub : ''));
    L.push('回本月数（' + view.userRatePercent + '%）：' + c.pbU.text +
      (c.pbU.sub && c.pbU.sub !== c.pbU.text ? ' ' + c.pbU.sub : ''));
    L.push('ROI：' + c.roiText);
    L.push('');
  });

  // 纯文本条形对比（P月）
  L.push(LINE);
  L.push('【月养老金 P月 对比】');
  cols.forEach(function (c, i) {
    var filled = Math.round((c.barP || 0) / 4); // 每格约4%
    var bar = '';
    for (var k = 0; k < 25; k++) bar += k < filled ? '█' : '·';
    L.push('方案' + (i + 1) + ' |' + bar + '| ¥' + f2(c.pMonthly) +
      (c.estimated ? '【预估】' : ''));
  });

  L.push('');
  L.push('【ROI 对比】');
  cols.forEach(function (c, i) {
    var filled = Math.round((c.barRoi || 0) / 4);
    var bar = '';
    for (var k = 0; k < 25; k++) bar += k < filled ? '█' : '·';
    L.push('方案' + (i + 1) + ' |' + bar + '| ' + c.roiText);
  });

  L.push(LINE);
  L.push('标【预估】方案含 2027 年及以后的自动缴费段，该段记账利率/计发基数为工程假设（OUT-002）。');
  L.push('本报告由本地计算生成；以北京市社保经办机构核定为准。');
  L.push(THICK);

  return L.join('\r\n');
}

module.exports = {
  REPORT_VERSION: REPORT_VERSION,
  buildBasicReport: buildBasicReport,
  buildCompareReport: buildCompareReport
};
