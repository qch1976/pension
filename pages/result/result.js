// pages/result/result.js
// 结果页：spec 第8章——总额+三分项+全部中间变量+公式溯源+逐月明细（按年折叠，含当年利息/年末余额/利率来源）
// 第二轮修复（wxml-round2）：微信 wcc 不允许 {{}} 表达式内出现非 ASCII 标识符/字面量，
// 引擎 pensionEngine.js 的中文输出键保持不变（兼容 tests/oracle 与全部既有断言），
// 本页在 onLoad 中为模板构造纯 ASCII 键视图模型 vm / vmYearly / ui，WXML 只绑定 ASCII 键。
// 批次3（#12a/#12b/#13）：
//  - R储 说明改写为 buildRStoreVm（明确本金起算月=锚定月次月；数字与引擎汇总一致）；
//  - 删除挂在 R补 下重复的“本金/利息”行（WXML 已删，rPrincipalText/rInterestText 旧键不再使用）；
//  - Z实指数年度明细账：引擎 result.annualIndex -> vmAnnual（只格式化不另算）。
var app = getApp();
var REFS = require('../../constants/policyRefs.js');
var D = require('../../calculator/dateUtil.js');

// ---------------------------------------------------------------------------
// #12a R储 政策说明视图
//  - 月滚模式（account.manual=true 且 yearly 为 future-monthly）：
//    本金/利息仅指 锚定月次月~退休前一月 的未来段；起算月=锚定月次月（本案2026-09）；
//    锚定余额不拆分历史本金/利息、不重复计算。
//  - 静态锚定（manual=true 无滚动）：R储 即录入余额，不单列本金/利息。
//  - 历史重建（manual=false，node 交叉验证路径，UI 不可达）：本金/利息自最早缴费月起算。
// ---------------------------------------------------------------------------
function rFmt(n) { return n == null ? '—' : String(Math.round(n * 100) / 100); }
function buildRStoreVm(result) {
  var it = result.intermediates;
  var acct = result.account || {};
  var inp = result.inputs || {};
  var isFutureRoll = !!acct.manual && (acct.yearly || []).some(function (a) {
    return a.rateSource === 'future-monthly';
  });
  var vm = {
    total: it.R储,
    principal: it.R储本金,
    interest: it.R储利息,
    principalText: rFmt(it.R储本金),
    interestText: rFmt(it.R储利息),
    kind: '', anchor: '', anchorYM: '', fromYM: '', toYM: '', months: 0,
    ratePct: '', explain: ''
  };
  if (isFutureRoll) {
    var first = acct.yearly[0];
    // 锚定余额 = R储-本金-利息（恒等式反推，避免依赖快照未存字段）
    var anchorVal = it.R储 - it.R储本金 - it.R储利息;
    // 起算月=锚定月次月；inputs 快照无锚点月时由年表起点前一月推
    var anchorIdx;
    if (inp.manualBalanceYM) anchorIdx = D.toIndex(inp.manualBalanceYM);
    else anchorIdx = D.toIndex(first.year + '-01') - 1;
    var fromIdx = anchorIdx + 1;
    var toIdx = D.toIndex(inp.retireYM || result.monthlyDetails[result.monthlyDetails.length - 1].ym) - 1;
    var months = toIdx - fromIdx + 1;
    vm.kind = 'future-roll';
    vm.anchor = rFmt(anchorVal);
    vm.anchorYM = D.toYM(anchorIdx);
    vm.fromYM = D.toYM(fromIdx);
    vm.toYM = D.toYM(toIdx);
    vm.months = months;
    vm.ratePct = first.rate != null ? (first.rate * 100).toFixed(2) : '';
    vm.explain = 'R储 对应官方「个人账户累计储存额」（京劳社养发〔2007〕21号文）。本结果以您录入的真实余额 ' +
      vm.anchor + ' 元（' + vm.anchorYM + ' 末）为起点，不再拆分其中历史本金与利息、也不重复计算；其后 ' +
      vm.fromYM + '~' + vm.toYM + '（' + months + '个月）按月滚动：新增本金（月基数×8%）' + rFmt(it.R储本金) +
      ' 元 + 记账利息（年利率 ' + vm.ratePct + '% 折月复利，工程口径【预估】）' + rFmt(it.R储利息) + ' 元。故 R储 = ' +
      vm.anchor + ' + ' + rFmt(it.R储本金) + ' + ' + rFmt(it.R储利息) + ' = ' + rFmt(it.R储) + ' 元。';
  } else if (acct.manual) {
    vm.kind = 'static';
    vm.explain = 'R储 对应官方「个人账户累计储存额」（京劳社养发〔2007〕21号文）。本次直接采用您录入的账户余额 ' +
      rFmt(it.R储) + ' 元，未做未来段滚动，故不再单列本金与利息。';
  } else {
    vm.kind = 'reconstruct';
    vm.explain = 'R储 对应官方「个人账户累计储存额」（京劳社养发〔2007〕21号文）。本结果由缴费明细按历史记账利率重建：' +
      '累计本金 ' + rFmt(it.R储本金) + ' 元 + 记账利息 ' + rFmt(it.R储利息) + ' 元 = ' + rFmt(it.R储) +
      ' 元（自最早缴费月起算，node 交叉验证路径）。';
  }
  return vm;
}

// ---------------------------------------------------------------------------
// Bug24 O-1：N应缴注释按身份动态生成（严禁写死 2000-11）。
// ---------------------------------------------------------------------------
function buildNShouldNote(result) {
  var it = result.intermediates;
  var inp = result.inputs || {};
  var head = 'N应缴=' + it.N应缴 + '（' + it.K应缴月 + '个月）：Z实指数分母口径（29号文第16条，窗口 ' +
    inp.windowStartYM + '~' + inp.windowEndYM + '，含断缴月）。';
  if (inp.doc31Eligible) {
    return head + '31号文人员自企业批准参保月 ' + inp.windowStartYM + ' 起。';
  }
  return head + '普通参保人员自参加工作月 ' + inp.windowStartYM + ' 起（窗口起点=max(1992-10, 参加工作月)）。';
}

// Bug24 O-2：边界年动态串，如“2003年4个月、2031年6个月”（取 partialYear 行）。
function buildPartialYearsText(result) {
  var parts = (result.annualIndex || []).filter(function (a) { return a.partialYear; })
    .map(function (a) { return a.year + '年' + a.windowMonths + '个月'; });
  return parts.length ? parts.join('、') : '各窗口年均为整年12个月';
}

// Bug24 O-2：年表卡头说明，边界年/窗口年行数动态，12116 为制度值保留。
function buildAnnualHeadNote(result) {
  var yearCount = (result.annualIndex || []).filter(function (a) { return a.windowMonths > 0; }).length;
  return '逐年列出实际缴费工资 Xn、上一年本市职工月平均工资折算的年分母 C(n−1) 及缴费工资指数 Z年。' +
    'Z年 = Xn ÷ C年 = 当年各月（已按300%封顶）缴费指数之和 ÷ 12；窗口外月份为0，故' +
    '非整年（' + buildPartialYearsText(result) + '）按全年12个月分母折算为年值，各窗口年（共 ' + yearCount +
    ' 个）Z年可直接相加。无缴费年指数为0；分母缺失（1992~1995口径缺口）显示“—”，可在首页「缺口年度C年手工录入」补录。' +
    '2026年 C=12116 元/月（官方全口径值），2027年起沿用 12116 为工程假设【待官方核实】。';
}

// Bug24 O-3：勾稽脚注全动态。
function buildLedgerReconcileNote(result) {
  var it = result.intermediates;
  var sumZ = 0, yearCount = 0;
  (result.annualIndex || []).forEach(function (a) {
    if (a.zYear != null && a.windowMonths > 0) { sumZ += a.zYear; yearCount++; }
  });
  sumZ = Math.round(sumZ * 10000) / 10000;
  return '勾稽（官方字面口径）：Z年=Σ月z/12=Xn/C年（C年=12×C月）；Σ(' + yearCount +
    '个窗口年 Xn/Cn−1) ÷ N应缴(' + it.N应缴 + ') = Z实指数；本案 ' + sumZ + '÷' +
    it.N应缴 + '=' + it.Z实指数 + '。';
}

// Bug24 O-4：封顶脚注按本案 monthlyDetails.zCapped 聚合（无封顶月→明说）。
function buildCapNote(result) {
  var it = result.intermediates;
  var cappedMonths = [];
  var byYear = {};
  result.monthlyDetails.forEach(function (d) {
    if (d.zCapped) {
      cappedMonths.push(d.ym);
      byYear[d.ym.slice(0, 4)] = (byYear[d.ym.slice(0, 4)] || 0) + 1;
    }
  });
  var head = '封顶口径：月指数已按缴费基数300%上限在月指数层封顶 z月=min(3, B月/C月)，' +
    '依据《北京市基本养老保险规定》（政府令183号）第十二条及国办发〔2019〕13号第三条；' +
    '“月指数封顶”为与基数上限对齐的工程口径（官方未逐字写指数封顶），封顶前原值见逐月明细。';
  if (!cappedMonths.length) {
    return head + '本案无触发月层封顶的月份；Z实指数封顶前后均为 ' + it.Z实指数 + '。';
  }
  var sumRaw = 0;
  result.monthlyDetails.forEach(function (d) { sumRaw += d.zRaw || d.z || 0; });
  var preZ = Math.round((sumRaw / it.K应缴月) * 10000) / 10000;
  var yearText = Object.keys(byYear).sort().map(function (y) { return y + '年' + byYear[y] + '个月'; }).join('、');
  return head + '本案 ' + yearText + ' 被封顶；Z实指数 封顶前 ' + preZ + ' → 封顶后 ' + it.Z实指数 + '。';
}

// #13 年度明细账视图：只做格式化，不另算。
function buildAnnualVm(rows) {
  return (rows || []).map(function (r) {
    var sourceText;
    switch (r.denomSource) {
      case 'official': sourceText = '官方'; break;
      case 'assumed': sourceText = '预估'; break;
      case 'custom': sourceText = '手录'; break;
      case 'missing': sourceText = '缺分母'; break;
      case 'mixed': sourceText = '混合'; break;
      default: sourceText = r.denomSource;
    }
    return {
      year: r.year,
      paidMonths: r.paidMonths,
      windowMonths: r.windowMonths,
      xText: r.xAnnual.toFixed(2),
      cText: r.cPrevAnnual == null ? '—' : r.cPrevAnnual.toFixed(2),
      zYearText: r.zYear == null ? '—' : r.zYear.toFixed(4),
      partial: !!r.partialYear, // 边界年标记（数据审计/CSV用；Bug21起页面不再显示“月均”）
      capped: false, // BUG-18：在 onLoad 中按 monthlyDetails.zCapped 精确打标
      source: r.denomSource,
      sourceText: sourceText
    };
  });
}

// R补（Z补贴）结果视图：所有中文文案在 JS 侧生成，WXML 仅绑定 ASCII 键（wcc 表达式禁非 ASCII）
function buildSubsidyVm(result) {
  var info = result.accountSubsidy || {};
  var subsidy = result.intermediates.R补 || 0;
  var claimed = result.inputs && result.inputs.doc31Eligible;
  var tiers = (info.tiers || []).map(function (t) {
    return { ratePct: (t.rate * 100) + '%', months: t.months, sumCWage: t.sumCWage, bracket: t.bracket };
  });
  var vm = {
    claimed: !!claimed,
    applicable: !!info.applicable,
    amount: subsidy,
    tiers: tiers,
    zReal: info.zRealUsed == null ? null : (Math.round(info.zRealUsed * 10000) / 10000),
    bracketSum: info.bracketSumRaw == null ? null : (Math.round(info.bracketSumRaw * 100) / 100),
    periodText: info.periodStartYM && info.periodEndYM ? (info.periodStartYM + '~' + info.periodEndYM) : null,
    monthCount: info.monthCount || 0,
    excludedMonths: info.excludedMonths || 0,
    missingYears: (info.missingYears || []).join('、'),
    statusText: '',
    detailText: '',
    notIncludedNote: 'Z补贴 为虚拟计发额度，只用于 J账户=(R储+R补)÷M，不计入个人账户实际储存额、继承额与账户冲抵（31号文第二条(三)）。',
    showFormula: false
  };
  if (!claimed) {
    vm.statusText = '不适用（非京劳社养发〔2007〕31号第一条人员），R补=0，J账户=R储÷M';
  } else if (info.applicable) {
    vm.statusText = '适用，已计入 J账户：J账户=（R储 ' + result.intermediates.R储 + ' + R补 ' + subsidy + '）÷ M(' + result.intermediates.M + ')';
    vm.detailText = '未建账模拟期间 ' + vm.periodText + ' 共 ' + vm.monthCount + ' 个月' +
      (vm.excludedMonths ? '（已扣除一次性补贴年限 ' + vm.excludedMonths + ' 个月）' : '') +
      '，分档模拟额合计 ' + vm.bracketSum + ' 元 × 参保后Z实指数 ' + vm.zReal + ' = ' + subsidy + ' 元';
    vm.showFormula = true;
  } else {
    vm.statusText = '已申报31号文人员身份，但本次 R补=0：' + (info.ineligibleReason || info.warning || info.reason || '不满足计发条件');
  }
  return vm;
}

function yearsText(v) {
  if (v == null) return '—';
  var y = Math.floor(v);
  var m = Math.round((v - y) * 12);
  return y + '年' + m + '个月（' + v.toFixed(4) + '年）';
}

Page({
  data: {
    ready: false,
    pageLoading: true, // BUG-16：onLoad→首帧渲染完成前显示连续遮罩，就绪后同帧关闭
    r: null,
    vm: null,          // 纯 ASCII 键视图模型（pension / intermediates / yearsText / 文案）
    vmYearly: [],      // 个人账户按年表视图（rateText 等中文字面量在 JS 侧预置）
    vmAnnual: [],      // #13 Z实指数年度明细账视图
    monthlyGroups: [],
    expandedYear: null,
    refDetail: null,
    formulaRefs: {},
    totalDisplay: 0,
    showIneligible: false,
    ui: { collapse: '收起 ▲', expand: '展开 ▼' } // 模板内三元文案外置，保证 {{}} 内无中文
  },

  onLoad: function () {
    var result = app.globalData.lastResult;
    if (!result) {
      // BUG-16：异常路径必须先关遮罩，避免遮罩卡死
      this.setData({ pageLoading: false });
      wx.showToast({ title: '未找到测算结果，请返回重新测算', icon: 'none' });
      return;
    }
    var it = result.intermediates;
    var pn = result.pension;

    var vm = {
      pension: {
        basic: pn.J基础,        // J基础 基础养老金
        account: pn.J账户,      // J账户 个人账户养老金
        transitional: pn.J过渡  // J过渡 过渡性养老金
      },
      it: {
        m: it.M,
        cPing: it.C平,          // C平 计发基数
        zReal: it.Z实指数,      // Z实指数
        zDeemed: it.Z同指数,    // Z同指数
        nShould: it.N应缴,      // N应缴
        kShouldMonths: it.K应缴月,
        nRealDeemed: it.N实同,  // N实+同
        nDeemed: it.N同,        // N同
        n98: it.N实98,          // N实98
        gDeemed: it.G同,        // G同
        gReal: it.G实           // G实
      },
      rStore: buildRStoreVm(result), // #12a R储 说明（起算口径+数字）
      subsidy: buildSubsidyVm(result),
      yearsText: {
        nShould: yearsText(it.N应缴),
        nRealDeemed: yearsText(it.N实同),
        nDeemed: yearsText(it.N同),
        n98: yearsText(it.N实98)
      },
      // 分区口径说明（Bug24：全部动态绑定当前 case，无案号/他案数值）
      notes: {
        // O-1：按身份分支；窗口起止取 inputs.windowStartYM/windowEndYM（引擎当前案实算）
        nShould: buildNShouldNote(result),
        // O-2/O-3/O-4：年表卡头/勾稽/封顶全动态
        annualHead: buildAnnualHeadNote(result),
        ledgerReconcile: buildLedgerReconcileNote(result),
        cap: buildCapNote(result),
        nRealDeemed: 'N实同=' + it.N实同 + '：基础养老金计发年限（实缴' + it.actualPaidMonths + '月+认定视同' + it.deemedMonths + '月），与N应缴是两个并存口径。',
        // O-6：baseYear/C平/退休年均绑当前案
        cPing: 'C平=' + it.C平 + '：按' + (result.inputs.baseYear) + '年度计发口径，当事人' +
          (result.inputs.retireYM.slice(0, 4)) + '年退休，实际计发基数以官方公布为准。',
        rBu: 'R补=Z补贴为虚拟计发额，不计入账户实际余额（31号文第二条(三)）。',
        // O-7：按身份分支（31号文人员 vs 无视同普通/新人）
        gTongZero: result.inputs.doc31Eligible
          ? 'G同=0：无1992-09（含）以前连续工龄；认定的视同月均为1992-10后连续工龄，按31号文进G实/R补。'
          : 'G同=0：无视同缴费年限（N同=0）。',
        n98: 'N实98=' + it.N实98 + '：1992-10~1998-06连续工龄（含视同/实际缴费，31号口径），进G实。'
      },
      eligibleText: result.meta.eligible
        ? '符合按月领取条件（具体以经办核定为准）'
        : '⚠ 不满足按月领取最低年限条件，以下仅为数学测算值'
    };

    // 延退对照表：延迟/提前方向文案在 JS 侧预置（offsetWord 为 ASCII 键）
    var sched = result.meta.retireSchedule;
    if (sched) {
      sched.offsetWord = sched.chosenOffsetMonths >= 0 ? '延迟' : '提前';
    }

    // 账户按年数据：利息/年末余额/利率及来源（FR-11 / BUG-012 / GAP-02）
    var accountByYear = {};
    var vmYearly = (result.account.yearly || []).map(function (a) {
      var view = {
        year: a.year,
        interest: a.interest,
        endBalance: a.endBalance,
        rateText: a.rate == null ? '不计息' : a.rate,
        rateSource: a.rateSource
      };
      accountByYear[a.year] = {
        interest: a.interest,
        endBalance: a.endBalance,
        rateText: a.rate == null ? '不计息' : (a.rate * 100).toFixed(2) + '%',
        rateSource: a.rateSource
      };
      return view;
    });

    // #13 Z实指数年度明细账（引擎产出，本层只格式化）；
    // BUG-18：用 monthlyDetails 的封顶事实给年表行打 capped 标记（精确到月）
    var cappedYearMap = {};
    result.monthlyDetails.forEach(function (d) {
      if (d.zCapped) cappedYearMap[d.ym.slice(0, 4)] = true;
    });
    var vmAnnual = buildAnnualVm(result.annualIndex);
    vmAnnual.forEach(function (row) {
      if (cappedYearMap[String(row.year)]) row.capped = true;
    });

    // 逐月明细按年分组（默认折叠，保证性能 spec NFR-05）
    var groupMap = {};
    result.monthlyDetails.forEach(function (d) {
      var y = d.ym.slice(0, 4);
      if (!groupMap[y]) groupMap[y] = { year: y, items: [], principalSum: 0 };
      groupMap[y].items.push({
        ym: d.ym,
        typeText: d.type === 'enterprise' ? '单位' : (d.type === 'flexible' ? '灵活' : '断缴'),
        base: d.base || 0,
        c: d.cDenominator == null ? '缺' : d.cDenominator,
        cSource: d.denomSource,
        z: d.z ? d.z.toFixed(4) : '0.0000',
        zRawText: d.zRaw ? d.zRaw.toFixed(4) : '0.0000', // BUG-18：封顶前原值（供审计）
        capped: !!d.zCapped,                              // BUG-18：月指数封顶标记
        p8: d.principal8
      });
      groupMap[y].principalSum += d.principal8;
    });
    var groups = Object.keys(groupMap).sort().map(function (k) {
      var g = groupMap[k];
      g.principalSum = Math.round(g.principalSum * 100) / 100;
      g.account = accountByYear[k] || null;
      return g;
    });

    // 公式溯源（BUG-002：引擎 ref 已与 policyRefs 键统一为 P02/P04）
    var refMap = {};
    result.formulaLines.forEach(function (f) { refMap[f.key] = REFS[f.ref] || REFS[f.ref.replace('-', '')]; });

    var totalDisplay = result.pension.total;

    this.setData({
      ready: true,
      r: result,
      vm: vm,
      vmYearly: vmYearly,
      vmAnnual: vmAnnual,
      monthlyGroups: groups,
      formulaRefs: refMap,
      totalDisplay: totalDisplay,
      showIneligible: result.meta.eligible === false,
      pageLoading: false // BUG-16：与业务数据同一次提交，遮罩在内容首帧同帧关闭
    });
  },

  toggleYear: function (e) {
    var y = e.currentTarget.dataset.y;
    this.setData({ expandedYear: this.data.expandedYear === y ? null : y });
  },

  showRef: function (e) {
    var id = e.currentTarget.dataset.id;
    var ref = REFS[id] || REFS[String(id).replace('-', '')];
    if (ref) this.setData({ refDetail: ref });
  },
  closeRef: function () { this.setData({ refDetail: null }); },
  noop: function () {},

  back: function () { wx.navigateBack(); },

  // FR-11 / GAP-06：导出逐月/按年明细 + #13 年度指数 CSV（写入剪贴板）
  exportCsv: function () {
    var r = this.data.r;
    if (!r) return;
    var lines = ['年月,身份,月缴费基数,指数分母C年,分母来源,月缴费指数,个人账户8%入账'];
    r.monthlyDetails.forEach(function (d) {
      lines.push([d.ym,
        d.type === 'enterprise' ? '单位' : (d.type === 'flexible' ? '灵活就业' : '断缴'),
        d.base || 0,
        d.cDenominator == null ? '' : d.cDenominator,
        d.denomSource,
        d.z.toFixed(6),
        d.principal8].join(','));
    });
    lines.push('');
    lines.push('年度,当年本金,当年利息,年末本息余额,记账利率,利率来源');
    (r.account.yearly || []).forEach(function (a) {
      lines.push([a.year, a.principal, a.interest, a.endBalance,
        a.rate == null ? '' : a.rate, a.rateSource].join(','));
    });
    lines.push('');
    lines.push('年份n,应缴月数,实缴月数,Xn年工资,C(n-1)年分母,Z年=Σ月z/12(年值法),非整年口径,分母来源');
    (r.annualIndex || []).forEach(function (a) {
      lines.push([a.year, a.windowMonths, a.paidMonths, a.xAnnual,
        a.cPrevAnnual == null ? '' : a.cPrevAnnual,
        a.zYear == null ? '' : a.zYear,
        a.partialYear ? '是（分子仅窗口月，分母12）' : '否',
        a.denomSource].join(','));
    });
    var csv = '﻿' + lines.join('\n');
    wx.setClipboardData({
      data: csv,
      success: function () { wx.showToast({ title: 'CSV已复制，可粘贴到Excel/微信', icon: 'none', duration: 2500 }); }
    });
  },

  onShareAppMessage: function () {
    return { title: '北京市企业职工养老金测算器', path: '/pages/index/index' };
  }
});
