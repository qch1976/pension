// calculator/pensionEngine.js
// 北京市企业职工基本养老金测算引擎（纯 JS，与小程序运行时解耦，可直接在 node 下 require 自测）
// 公式严格依据 docs/specification.md V1.1 第4章；条款引用以 Pxx 标注（见 constants/policyRefs.js）
// 政策标注（spec 第12章）：P-01 京政府令183号 / P-02 京劳社养发〔2007〕21号 / P-04 国发〔2005〕38号 / P-12 灵活就业20%（8%入账）
// 所有年限/指数计算精确到月（spec 4.7）；中间计算不舍入，仅展示层保留指定位数。
// 阶段4缺陷修复：BUG-003~011/013/014/015、GAP-01（对照表层在 calculator/retireSchedule.js）。
// 2026-09-21 Bug2/3/4 修复（架构备忘录 pension-architect-memo §5.1）：
//   - 新增 insuredWindowStart(input)：31号文晚参保人员 N应缴/Z实窗口自批准参保月起（29号文第16条）；
//   - N实98：31号文人员按连续工龄（含视同/实际缴费）计月，普通人员维持仅实缴；
//   - N同 严格按1992-09截断：手工视同月不再借 cap=600 漏入 G同；
//   - R储 支持手工锚定余额 + 未来段月复利滚动（1.5%/年工程口径）。
// 2026-09-21 批次1 输入页数据模型简化（pension-ui-change-design §1）：
//   - #5 视同改 deemedStartYM/deemedEndYM 起止年月，deemedRecognized/N同 由区间与有效窗口求交集；
//   - #8 accountBalanceManual 为 UI 路径必填（accountReconstruct:true 保留历史重建逃生口）；
//   - #9 N实98 取消手工：= [1992-10,1998-06] 内实缴月 ∪ 视同区间月 的并集。

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      require('./dateUtil'),
      require('../constants/policyData'),
      require('./retireSchedule'),
      require('./accountSubsidy'));
  } else {
    root.PensionEngine = factory(root.DateUtil, root.POLICY_DATA, root.RetireSchedule, root.AccountSubsidy);
  }
})(typeof self !== 'undefined' ? self : this, function (D, P, Schedule, Subsidy) {
  'use strict';

  var ACCOUNT_RATE = P.contributionRate.personalAccount; // 0.08
  var DEEMED_END_IDX = D.toIndex('1992-09');              // 视同截止月（P-01 第35条）
  var PHYS_BUILD_START_IDX = D.toIndex(P.deemedContributionStart); // 物理建账起点 1992-10（恒定）

  // ---------------------------------------------------------------------------
  // 应缴窗口起点 insuredWindowStart（Bug26 / V1.8；29号文第16条）
  //   ① doc31Eligible=true（31号文人员）：enterpriseInsuredYM 合法且 ≥1992-10 时
  //      取企业批准参保月（本产品 MY1/2=2000-11）；否则回退 1992-10（由既有校验提示）。
  //   ② doc31Eligible≠true（普通企业职工/灵活就业/新人）：
  //      anchor = enterpriseInsuredYM 合法 ? enterpriseInsuredYM : workStartYM
  //      窗口起点 = max(1992-10, anchor)。
  //      即企业实际参保缴费起始优先；缺失/非法时严格回退参工月（V1.7 口径B 为空值退化情形）；
  //      二者均缺失/非法时兜底 1992-10，不新增硬错误。
  //   窗口内断缴月处理不变：断缴月 z=0 仍计入 K（windowMonths）。
  //   与 PHYS_BUILD_START_IDX（物理建账起点，buildMonthMap 截断用）是两个参数，勿混用。
  // ---------------------------------------------------------------------------
  function insuredWindowStart(input) {
    var def = PHYS_BUILD_START_IDX;
    if (input.doc31Eligible === true && input.enterpriseInsuredYM &&
        /^\d{4}-\d{2}$/.test(input.enterpriseInsuredYM)) {
      var idx = D.toIndex(input.enterpriseInsuredYM);
      if (idx >= def) return idx; // 29号16条第二句：以批准确定的参保时间为起点
    }
    if (input.doc31Eligible !== true) {
      // Bug26/V1.8：窗口锚点优先取企业实际参保缴费起始，缺失回退参加工作月
      var ei = input.enterpriseInsuredYM;
      var anchor = ei && /^\d{4}-\d{2}$/.test(ei) ? ei : input.workStartYM;
      if (anchor && /^\d{4}-\d{2}$/.test(anchor)) {
        var aIdx = D.toIndex(anchor);
        if (aIdx > def) return aIdx;
      }
    }
    return def;
  }

  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function round4(n) { return Math.round((n + Number.EPSILON) * 10000) / 10000; }
  function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }

  // ---------------------------------------------------------------------------
  // 输入校验（硬错误直接 throw；软问题收集到 warnings）
  // segments: [{ type:'enterprise'|'flexible', startYM, endYM, baseMonthly }]
  // ---------------------------------------------------------------------------
  function validate(input) {
    var errors = [];
    if (!input.gender || ['male', 'female'].indexOf(input.gender) < 0) errors.push('性别缺失');
    if (input.gender === 'female' && ['worker', 'cadre'].indexOf(input.femaleType) < 0) {
      errors.push('女性须选择女工人/女干部身份');
    }
    // 出生年月（spec 7.2：1940-01 ~ 2010-12；BUG-015）
    if (!input.birthYM) errors.push('出生年月缺失');
    else {
      try {
        var bIdx = D.toIndex(input.birthYM);
        if (bIdx < D.toIndex('1940-01') || bIdx > D.toIndex('2010-12')) {
          errors.push('出生年月须在1940-01~2010-12之间');
        }
      } catch (e) { errors.push('出生年月格式非法（应为YYYY-MM）'); }
    }
    if (!input.retireYM) errors.push('退休年月缺失');
    else {
      try { D.toIndex(input.retireYM); } catch (e) { errors.push('退休年月格式非法（应为YYYY-MM）'); }
    }
    if (input.birthYM && input.retireYM && /^\d{4}-\d{2}$/.test(input.birthYM) && /^\d{4}-\d{2}$/.test(input.retireYM)) {
      var age = D.wholeYearsBetween(input.birthYM, input.retireYM);
      if (age < 40 || age > 70) errors.push('退休年龄须在40-70岁之间（计发月数表范围，P04）');
    }
    // 参加工作时间格式与先后一致性（BUG-010）
    if (input.workStartYM != null && input.workStartYM !== '') {
      try {
        D.toIndex(input.workStartYM);
        if (input.retireYM && /^\d{4}-\d{2}$/.test(input.retireYM) &&
            D.toIndex(input.workStartYM) > D.toIndex(input.retireYM)) {
          errors.push('退休年月不得早于参加工作年月，请检查参加工作时间/退休年月');
        }
      } catch (e) { errors.push('参加工作时间格式非法（应为YYYY-MM）'); }
    }
    // 利率（BUG-005）：固定利率必填且为 0~24% 有限数；official 兜底利率若给则须合法
    if (input.interestMode === 'fixed') {
      if (!isNum(input.fixedRate) || input.fixedRate < 0 || input.fixedRate > 0.24) {
        errors.push('固定年利率必填，且须为0~24%之间的数字（如0.04；留空请改选不计息/官方历年利率）');
      }
    }
    if (input.fallbackRate != null && (!isNum(input.fallbackRate) || input.fallbackRate < 0 || input.fallbackRate > 0.24)) {
      errors.push('预估（兜底）记账利率须为0~24%之间的数字');
    }
    // 视同起止年月（#5 新契约；与 deemedMonths 旧手工月数二选一，UI 只产生新字段）
    var hasRangeStart = input.deemedStartYM != null && input.deemedStartYM !== '';
    var hasRangeEnd = input.deemedEndYM != null && input.deemedEndYM !== '';
    if (hasRangeStart || hasRangeEnd) {
      if (!hasRangeStart || !hasRangeEnd) {
        errors.push('视同缴费起止年月须同时填写（或全部留空表示无视同缴费年限）');
      } else {
        if (!/^\d{4}-\d{2}$/.test(input.deemedStartYM) || !/^\d{4}-\d{2}$/.test(input.deemedEndYM)) {
          errors.push('视同缴费起止年月格式非法（应为YYYY-MM）');
        } else {
          var dS = D.toIndex(input.deemedStartYM), dE = D.toIndex(input.deemedEndYM);
          if (dS > dE) errors.push('视同缴费起始年月不得晚于终止年月（两端均含当月）');
          if (input.workStartYM && /^\d{4}-\d{2}$/.test(input.workStartYM) && dS < D.toIndex(input.workStartYM)) {
            errors.push('视同缴费起始年月不得早于参加工作年月，请核对档案认定起止年月');
          }
          if (input.retireYM && /^\d{4}-\d{2}$/.test(input.retireYM) && dE > D.toIndex(input.retireYM)) {
            errors.push('视同缴费终止年月不得晚于退休年月');
          }
          if (input.doc31Eligible === true && input.enterpriseInsuredYM &&
              /^\d{4}-\d{2}$/.test(input.enterpriseInsuredYM) &&
              dE > D.toIndex(input.enterpriseInsuredYM) - 1) {
            errors.push('31号文人员视同终止年月须不晚于企业实际参保起始月的前一月，请核对视同起止与参保起始年月');
          }
        }
      }
    }
    // 手工视同月数（旧契约兼容；BUG-003/004：空值(NaN)、负数、非整数、>600 一律阻断；与工龄矛盾在 calculate 内截断(E-08)）
    if (input.deemedMonths != null) {
      if (!isNum(input.deemedMonths) || input.deemedMonths < 0) {
        errors.push('视同缴费月数必填且为非负整数（留空请选择“按参加工作时间估算”）');
      } else if (!Number.isInteger(input.deemedMonths)) {
        errors.push('视同缴费月数须为整月（整数）');
      } else if (input.deemedMonths > 600) {
        errors.push('视同缴费月数不得超过600个月（spec 7.2）');
      }
    }
    // C平覆盖值（BUG-006）
    if (input.cPingOverride != null && (!isNum(input.cPingOverride) || input.cPingOverride <= 0)) {
      errors.push('手工录入的计发基数C平须为大于0的数字');
    }
    // 手工账户储存额（BUG-006；#8 起 UI 路径必填，允许0）。
    // accountReconstruct===true 为 node/oracle 等显式选择历史重建路径的逃生口（该分支代码保留，UI 不可达）。
    if (input.accountBalanceManual == null) {
      if (input.accountReconstruct !== true) {
        errors.push('请填写个人账户累计储存额（如672920，锚定实际余额；填0允许）');
      }
    } else if (!isNum(input.accountBalanceManual) || input.accountBalanceManual < 0) {
      errors.push('录入的个人账户累计储存额须为不小于0的数字');
    }
    // 锚定余额所在月末年月（月滚利息起点，YYYY-MM）与未来月滚年利率（Bug2/3/4 修复，工程口径）
    if (input.accountBalanceManualYM != null && input.accountBalanceManualYM !== '' &&
        !/^\d{4}-\d{2}$/.test(input.accountBalanceManualYM)) {
      errors.push('手工账户储存额所在年月格式非法（应为YYYY-MM）');
    }
    if (input.futureMonthlyRate != null && (!isNum(input.futureMonthlyRate) ||
        input.futureMonthlyRate < 0 || input.futureMonthlyRate > 0.24)) {
      errors.push('未来段月滚记账（年）利率须为0~24%之间的数字（如0.015）');
    }
    // N实98 连续工龄认定月数（31号文口径，由档案/经办认定承载，引擎不臆断）
    if (input.n98DeemedMonths != null && (!isNum(input.n98DeemedMonths) ||
        input.n98DeemedMonths < 0 || !Number.isInteger(input.n98DeemedMonths) ||
        input.n98DeemedMonths > 600)) {
      errors.push('N实98连续工龄认定月数须为0~600之间的非负整数');
    }
    // 31号文 Z补贴 输入（spec 2.2.1）：开关为布尔；时间字段格式校验，门槛/适用性在补贴模块内判定
    if (input.doc31Eligible != null && typeof input.doc31Eligible !== 'boolean') {
      errors.push('31号文人员身份标记须为布尔值');
    }
    [['doc31TransferYM', '调动/入伍/转制到企业年月'], ['enterpriseInsuredYM', '企业实际参保缴费起始年月']].forEach(function (pair) {
      var v = input[pair[0]];
      if (v != null && v !== '' && !/^\d{4}-\d{2}$/.test(v)) {
        errors.push(pair[1] + '格式非法（应为YYYY-MM）');
      }
    });
    (input.subsidyExcludedRanges || []).forEach(function (rg, i) {
      if (!rg || !/^\d{4}-\d{2}$/.test(rg.startYM) || !/^\d{4}-\d{2}$/.test(rg.endYM) ||
          D.toIndex(rg.endYM) < D.toIndex(rg.startYM)) {
        errors.push('已享一次性补贴扣除区间' + (i + 1) + '非法（需 YYYY-MM~YYYY-MM）');
      }
    });
    (input.segments || []).forEach(function (s, i) {
      if (!s.startYM || !s.endYM) { errors.push('缴费段' + (i + 1) + '起止年月缺失'); return; }
      if (D.toIndex(s.endYM) < D.toIndex(s.startYM)) errors.push('缴费段' + (i + 1) + '结束早于开始');
      if (!isNum(s.baseMonthly) || s.baseMonthly < 0) errors.push('缴费段' + (i + 1) + '基数非法（须为≥0的数字）');
      if (['enterprise', 'flexible'].indexOf(s.type) < 0) errors.push('缴费段' + (i + 1) + '身份类型非法');
    });
    if (errors.length) throw new Error('输入校验失败：' + errors.join('；'));
  }

  // 退休年龄（满整岁，spec T-14：非整数岁按满整岁取 M）
  function retireAge(input) {
    return D.wholeYearsBetween(input.birthYM, input.retireYM);
  }

  function getM(age) {
    var m = P.monthsTable[age];
    if (!m) throw new Error('退休年龄 ' + age + ' 超出计发月数表范围(40-70)');
    return m;
  }

  // 最低缴费月数（P05 附件4：2025-2029=15年；2030=15年6个月起每年+6个月；2039年起20年）
  function minRequiredMonths(retireYM) {
    var y = D.yearOf(D.toIndex(retireYM));
    var table = P.minContributionMonthsByYear || {};
    if (table[y] != null) return table[y];
    if (y <= 2029) return 180;
    return Math.min(180 + (y - 2029) * 6, 240);
  }

  // 当月缴费基数（取缴费段；重叠段按后段覆盖并在 warnings 标注；记录区间外被排除的月数）
  // BUG-011：早于1992-10的段不建账不计指数，给专项提示；BUG-014：晚于退休前一月的段截断提示。
  function buildMonthMap(input, startIdx, endIdx, warnings) {
    var map = {};
    var preMonths = 0, postMonths = 0;
    var preRanges = [], postRanges = [];
    (input.segments || []).forEach(function (s) {
      var sa = D.toIndex(s.startYM), sb = D.toIndex(s.endYM);
      if (sb < startIdx) { preMonths += (sb - sa + 1); preRanges.push(D.toYM(sa) + '~' + D.toYM(sb)); }
      else if (sa < startIdx) { preMonths += (startIdx - sa); preRanges.push(D.toYM(sa) + '~' + D.toYM(startIdx - 1)); }
      if (sa > endIdx) { postMonths += (sb - sa + 1); postRanges.push(D.toYM(sa) + '~' + D.toYM(sb)); }
      else if (sb > endIdx) { postMonths += (sb - endIdx); postRanges.push(D.toYM(endIdx + 1) + '~' + D.toYM(sb)); }
      var a = Math.max(sa, startIdx);
      var b = Math.min(sb, endIdx);
      for (var i = a; i <= b; i++) {
        if (map[i]) warnings.push('缴费段在 ' + D.toYM(i) + ' 存在重叠，已按后段覆盖');
        map[i] = { base: s.baseMonthly, type: s.type };
      }
    });
    if (preMonths > 0) {
      warnings.push('有 ' + preMonths + ' 个月的缴费记录早于1992-10（' + preRanges.join('、') +
        '）：北京企业职工1992-10建账，该段不参与个人账户与缴费指数计算；其1992-09前工龄应按视同缴费年限申报，请核对“参加工作时间/视同缴费月数”（P01，E-02）');
    }
    if (postMonths > 0) {
      warnings.push('有 ' + postMonths + ' 个月的缴费记录晚于退休前一月（' + postRanges.join('、') +
        '）：已按退休当月不缴费截断处理，请核对退休年月与缴费段（E-03）');
    }
    return map;
  }

  // 指数分母：返回 {c, source} source='official'|'custom'|'assumed'|'missing'
  // customCYear 两种键位（BUG-009 修复，兼容旧数据）：
  //   新口径（UI/spec，推荐）：按 C 的年度录（含 C1991 等建账前年度键），缴费年 y 取 custom[y-1]；
  //   旧口径：按缴费年度录 custom[y]。
  // 约定探测：录入键中出现 1992 年以前的年度键（如1991），即认定为 C 年度口径；否则按缴费年度口径。
  function usesCaliberYearKeys(customCYear) {
    return Object.keys(customCYear).some(function (k) { return (+k) <= 1991; });
  }
  function denominatorFor(yearY, customCYear) {
    customCYear = customCYear || {};
    var key = usesCaliberYearKeys(customCYear) ? yearY - 1 : yearY;
    if (customCYear[key] != null) return { c: customCYear[key], source: 'custom' };
    if (P.indexDenominatorMonthly[yearY] != null) {
      return { c: P.indexDenominatorMonthly[yearY], source: 'official' };
    }
    var keys = Object.keys(P.indexDenominatorMonthly).map(Number).sort(function (a, b) { return a - b; });
    var last = keys[keys.length - 1];
    if (yearY > last) return { c: P.indexDenominatorMonthly[last], source: 'assumed' };
    return { c: null, source: 'missing' }; // 1992-1995 缺口（T-10）
  }

  // #13 Z实指数年度明细账：n=1992~退休年（本案1992~2033）逐行
  //  Xn=窗口内Σ月缴费基数；windowMonths=当年落入应缴窗口的月数（参保首年自参保月起、
  //  退休年至退休前一月止、其余年份12；窗口外年份0）；
  //  Bug21（官方字面年值法，推翻 BUG-14 月均法）：
  //  Z年 = Σ窗口月(已封顶)z ÷ 12 = Xn ÷ (12 × C月)；
  //  整年 windowMonths=12 时与月均值相同；边界年（2000年2月、2033年6月）分子仅含窗口月、
  //  分母仍为全年12个月，被稀释回年值；故 Σ34行 Z年 ÷ N应缴 = 主汇总 Z实。
  //  窗口内断缴月 z=0（窗口内月才在 monthlyDetails 中）。
  // 展示用 C(n-1) 年分母按 C月×12 标注。
  // 数据源 monthlyDetails（窗口内月序列）；窗口外年份补零行。聚合用原始未舍入值。
  function buildAnnualIndexLedger(monthlyDetails, windowStartIdx, lastContribIdx, retireIdx, customCYear) {
    var firstYear = 1992;
    var endYear = D.yearOf(retireIdx);
    var ledger = [];
    var byYM = {};
    monthlyDetails.forEach(function (d) { byYM[d.ym] = d; });
    for (var y = firstYear; y <= endYear; y++) {
      var xAnnual = 0, paidMonths = 0, sumMonthZ = 0, windowMonths = 0;
      var sources = {};
      for (var mo = 1; mo <= 12; mo++) {
        var mIdx = y * 12 + (mo - 1);
        if (mIdx < windowStartIdx || mIdx > lastContribIdx) continue;
        windowMonths++;
        var d = monthlyDetails[mIdx - windowStartIdx];
        if (d) {
          xAnnual += d.base || 0;
          sumMonthZ += d.z || 0;
          if ((d.base || 0) > 0) paidMonths++;
          sources[d.denomSource] = true;
        }
      }
      var den = denominatorFor(y, customCYear);
      var cMonthly = den.c;
      var srcKeys = Object.keys(sources);
      var denomSource = srcKeys.length === 1 ? srcKeys[0]
        : (srcKeys.length > 1 ? 'mixed' : den.source);
      var cAnnual = cMonthly != null ? round2(cMonthly * 12) : null;
      // Bug21：年值法 Z年 = Σ(已封顶月 z) ÷ 12 = Xn ÷ (12×C月)；窗口外月不在 sumMonthZ 中
      var zYear = null;
      if (cMonthly != null) {
        zYear = round4(sumMonthZ / 12);
      }
      ledger.push({
        year: y,
        paidMonths: paidMonths,
        windowMonths: windowMonths,
        xAnnual: round2(xAnnual),
        cPrevMonthly: cMonthly,
        cPrevAnnual: cAnnual,
        zYear: zYear,
        partialYear: windowMonths > 0 && windowMonths < 12, // 边界年标记（数据审计/CSV用，页面不再据此显示月均）
        denomSource: denomSource
      });
    }
    return ledger;
  }

  // ---------------------------------------------------------------------------
  // 个人账户储存额（spec 4.3 / 4.6）
  // 月计入额全程用精确值 B月×8% 累加，不逐月 round2（spec 4.7，BUG-008）；展示字段才舍入。
  // 当年缴费计息（spec 4.6）：入账月 0-based 序号 m0，权重 (12-m0)/12；半年简化=0.5。
  // 退休当年：年初余额按退休前月数折算；缴费部分无论 monthly/half 一律按月折算（BUG-007）。
  // ---------------------------------------------------------------------------
  function calcAccount(input, monthMap, paidMonthIdxs, warnings) {
    if (input.accountBalanceManual != null) {
      // 动态1：仅给余额 → 静态锚定（维持原语义，不滚动）
      var anchorYM = input.accountBalanceManualYM;
      var hasRoll = !!anchorYM && /^\d{4}-\d{2}$/.test(anchorYM) && isNum(input.futureMonthlyRate);
      if (!hasRoll) {
        return {
          R储: round2(input.accountBalanceManual),
          principal: null,
          interest: null,
          rateUsed: {},
          assumedRateYears: [],
          yearly: [],
          manual: true
        };
      }
      // 动态2：月滚工程模型（备忘录 §4.1）。锚定余额 = anchorYM 月末余额；
      // 自 anchorYM+1 至退休前一月，每月末 余额 = 余额×(1+r/12) + 月基数×8%；断缴/无基数月 add=0 仍计息。
      var anchorIdx = D.toIndex(anchorYM);
      var retireIdxAc = D.toIndex(input.retireYM);
      var endIdxAc = retireIdxAc - 1;
      var rAnnual = input.futureMonthlyRate, rMonthly = rAnnual / 12;
      var balance = input.accountBalanceManual;
      var yearly = [], totalPrincipal = 0, totalInterest = 0;
      var rollStart = anchorIdx + 1;
      for (var y = D.yearOf(rollStart); y <= D.yearOf(endIdxAc); y++) {
        var yearStartBalance = balance, yearPrincipal = 0, yearInterest = 0;
        var ma = (y === D.yearOf(rollStart)) ? rollStart : (y * 12);
        var mb = Math.min(y * 12 + 11, endIdxAc);
        for (var mi = ma; mi <= mb; mi++) {
          var info = monthMap[mi];
          var add = (info && info.base > 0) ? info.base * ACCOUNT_RATE : 0;
          var interest = balance * rMonthly;
          balance = balance + interest + add;
          yearPrincipal += add;
          yearInterest += interest;
        }
        totalPrincipal += yearPrincipal;
        totalInterest += yearInterest;
        yearly.push({ year: y, startBalance: round2(yearStartBalance), principal: round2(yearPrincipal),
          interest: round2(yearInterest), endBalance: round2(balance),
          rate: round4(rAnnual), rateSource: 'future-monthly' });
      }
      warnings.push('未来段个人账户按月滚动计息：记账（年）利率 ' + (rAnnual * 100).toFixed(2) +
        '%（按 ' + rAnnual + '/12 折月复利，工程假设，待官方核实）；R储 以手工锚定余额 ' +
        round2(input.accountBalanceManual) + ' 元（' + anchorYM + ' 末）为起点');
      return {
        R储: round2(balance),
        principal: round2(totalPrincipal),
        interest: round2(totalInterest),
        rateUsed: {},
        assumedRateYears: [],
        yearly: yearly,
        manual: true
      };
    }
    var mode = input.interestMode || 'official';
    var startY = D.yearOf(Math.min.apply(null, paidMonthIdxs.length ? paidMonthIdxs : [D.toIndex(P.deemedContributionStart)]));
    var retireIdx = D.toIndex(input.retireYM);
    var endY = D.yearOf(retireIdx);
    var balance = 0, totalPrincipal = 0, totalInterest = 0;
    var rateUsed = {}, assumedYears = [], yearly = [];

    for (var y = startY; y <= endY; y++) {
      var yearStartBalance = balance;
      var yearPrincipal = 0;
      var monthContrib = [];
      var yearStart = y * 12; // 1月序号
      var yearEnd = y * 12 + 11;
      var lastMonthIdx = (y === endY) ? (retireIdx - 1) : yearEnd; // 退休当年只计到退休前一月
      for (var i = yearStart; i <= Math.min(yearEnd, lastMonthIdx); i++) {
        var m = monthMap[i];
        if (m) {
          var add = m.base * ACCOUNT_RATE; // 精确值，不舍入（P01第19条；灵活就业同样8%入账 P12）
          yearPrincipal += add;
          monthContrib.push({ idx: i, add: add });
        }
      }
      // 利率
      var r = 0, rateSource = 'none';
      if (mode === 'fixed') { r = input.fixedRate || 0; rateSource = 'fixed'; }
      else if (mode === 'official') {
        if (P.accountInterestRate[y] != null) { r = P.accountInterestRate[y]; rateSource = 'official'; }
        else { r = input.fallbackRate != null ? input.fallbackRate : 0.0262; rateSource = 'assumed'; assumedYears.push(y); }
      }
      rateUsed[y] = { rate: r, source: rateSource };

      var interest = 0;
      if (r > 0) {
        var isRetireYear = (y === endY);
        var balanceFactor = isRetireYear ? (D.monthOf(retireIdx) - 1) / 12 : 1; // 年初余额退休年折算
        interest += yearStartBalance * r * balanceFactor;
        monthContrib.forEach(function (mc) {
          var m0 = mc.idx - yearStart; // 0-based
          // BUG-007：退休当年缴费一律按月权重折算；half(0.5) 仅作用于完整历史年度
          var w = (isRetireYear) ? (12 - m0) / 12
            : ((input.intraYearMethod === 'half') ? 0.5 : (12 - m0) / 12);
          interest += mc.add * r * w;
        });
      }
      balance = yearStartBalance + yearPrincipal + interest;
      totalPrincipal += yearPrincipal;
      totalInterest += interest;
      yearly.push({ year: y, startBalance: round2(yearStartBalance), principal: round2(yearPrincipal),
        interest: round2(interest), endBalance: round2(balance),
        rate: rateSource === 'none' ? null : round4(r), rateSource: rateSource });
    }
    if (assumedYears.length) {
      warnings.push('以下年度人社部尚未公布当年记账利率，采用了预估利率 ' +
        (input.fallbackRate != null ? (input.fallbackRate * 100).toFixed(2) + '%' : '2.62%') +
        '（工程假设，待官方核实）：' + assumedYears.join('、') + '；可在首页改用固定利率或不计息');
    }
    return {
      R储: round2(balance),
      principal: round2(totalPrincipal),
      interest: round2(totalInterest),
      rateUsed: rateUsed,
      assumedRateYears: assumedYears,
      yearly: yearly,
      manual: false
    };
  }

  // ---------------------------------------------------------------------------
  // 主入口：calculate(input) -> 完整结果（总额、三分项、全部中间变量、逐月明细）
  // ---------------------------------------------------------------------------
  function calculate(input) {
    validate(input);
    var warnings = [];

    var windowStartIdx = insuredWindowStart(input);      // 应缴窗口起点（Bug2：31号文晚参保本案=2000-11）
    var retireIdx = D.toIndex(input.retireYM);
    var lastContribIdx = retireIdx - 1; // 缴费计到退休前一月
    // buildMonthMap 的物理截断仍恒为 1992-10（“物理建账起点”），早于窗口段给 E-02 提示，不建账。
    var monthMap = buildMonthMap(input, PHYS_BUILD_START_IDX, lastContribIdx, warnings);

    // 1) 月序列：应缴窗口起点 至退休前一月（应缴月 K应缴，断缴月 z=0 仍计分母——29号文第17条，T-05）
    var K = lastContribIdx - windowStartIdx + 1;
    if (K <= 0) throw new Error('退休年月不得早于应缴窗口起点之后的应缴区间');
    var sumZ = 0, paidMonths = 0;
    var monthlyDetails = [];
    var missingDenomYears = {}, assumedDenomYears = {};
    for (var i = windowStartIdx; i <= lastContribIdx; i++) {
      var ym = D.toYM(i), yearY = D.yearOf(i);
      var info = monthMap[i] || { base: 0, type: 'gap' };
      var den = denominatorFor(yearY, input.customCYear);
      if (den.source === 'missing') missingDenomYears[yearY] = true;
      if (den.source === 'assumed') assumedDenomYears[yearY] = true;
      var c = den.c;
      // 【Bug18 定稿】封顶在月指数层（不在最终 Z实 层）：z月=min(3, B月/C月)，
      // 与缴费基数 300% 上限语义对齐（183号令第十二条；国办发〔2019〕13号第三条）。
      // 官方未逐字规定“月指数封顶”，此为工程兜底假设；保留 zRaw 供核对。
      // zRaw 恒≥0：segments.baseMonthly 已在 validate 中校验为非负数。
      var zRaw = (c && info.base > 0) ? info.base / c : 0;
      var zCapped = zRaw > 3;
      var z = zCapped ? 3 : zRaw;
      if (info.base > 0) { sumZ += z; paidMonths++; }
      monthlyDetails.push({
        ym: ym, type: info.type, base: info.base, cDenominator: c,
        denomSource: den.source, z: z, zRaw: zRaw, zCapped: zCapped,
        principal8: round2(info.base * ACCOUNT_RATE)
      });
    }
    Object.keys(missingDenomYears).sort().forEach(function (y) {
      warnings.push('年度 ' + y + ' 缺少官方月平均工资（T-10），该年缴费指数暂按0计；请在“缺口年度C年手工录入”补录 C' +
        (y - 1) + ' 后重算');
    });
    Object.keys(assumedDenomYears).sort().forEach(function (y) {
      warnings.push('年度 ' + y + ' 官方社平工资尚未发布，缴费指数分母沿用最近官方值（工程假设，待官方核实）');
    });

    // 2) 视同缴费月数（#5 新契约：起/止年月；两个口径严格区分）
    //    deemedRecognized：档案/经办认定的视同月数总量，进 N实同（基础养老金年限）与资格校验；
    //      - 31号文人员：可含 1992-10 后、企业参保前的连续工龄（本案 1995-07→2000-10=64）；
    //        有效窗口 = [workStartYM, enterpriseInsuredYM-1月]；
    //      - 普通人员：只认可至 1992-09，有效窗口 = [workStartYM, 1992-09]。
    //    nTongMonths（=N同）：严格 1992-09（含）前部分，仅用于 G同。
    //    旧 deemedMonths 手工月数契约保留兼容（UI 不再产生）。
    var doc31Gap = input.doc31Eligible === true && input.enterpriseInsuredYM &&
        /^\d{4}-\d{2}$/.test(input.enterpriseInsuredYM);
    var insuredIdxForCap = doc31Gap ? D.toIndex(input.enterpriseInsuredYM) : null;
    var deemedRecognized = 0;
    var deemedCapped = false;
    var hasDeemedRange = input.deemedStartYM && input.deemedEndYM;
    if (hasDeemedRange) {
      var dStart = D.toIndex(input.deemedStartYM), dEnd = D.toIndex(input.deemedEndYM);
      // 有效工龄窗口
      var winStart = (input.workStartYM && /^\d{4}-\d{2}$/.test(input.workStartYM))
        ? D.toIndex(input.workStartYM) : dStart;
      var winEnd = doc31Gap ? (insuredIdxForCap - 1) : DEEMED_END_IDX;
      var recS = Math.max(dStart, winStart), recE = Math.min(dEnd, winEnd);
      deemedRecognized = recE >= recS ? (recE - recS + 1) : 0;
      var rawRangeMonths = dEnd - dStart + 1;
      if (deemedRecognized < rawRangeMonths) {
        var dropMonths = rawRangeMonths - deemedRecognized;
        warnings.push('视同区间 ' + input.deemedStartYM + '~' + input.deemedEndYM + ' 中，有 ' + dropMonths +
          ' 个月落在有效工龄窗口外（' + (doc31Gap
            ? D.toYM(winStart) + '~' + D.toYM(winEnd) + '，即参加工作至企业参保前一月'
            : D.toYM(winStart) + '~1992-09') + '），该部分不计入视同缴费年限，请核对档案认定起止年月');
      }
      if (deemedRecognized > 0) {
        warnings.push('视同缴费月数由起止年月 ' + input.deemedStartYM + '~' + input.deemedEndYM +
          ' 推导为 ' + deemedRecognized + ' 个月（两端均含当月），最终以社保经办机构档案认定为准');
      }
    } else if (input.deemedMonths != null) {
      var capRecognized;
      if (input.workStartYM) {
        var wsCap = D.toIndex(input.workStartYM);
        var recEnd = doc31Gap ? (insuredIdxForCap - 1) : DEEMED_END_IDX; // 31号文：参保前一月
        capRecognized = Math.max(0, recEnd - wsCap + 1);
      } else {
        // 无 workStart：31号文且参保月已知时，至多认可 1992-10→参保前一月；否则不得凭空认可视同
        capRecognized = doc31Gap ? Math.max(0, insuredIdxForCap - PHYS_BUILD_START_IDX) : 0;
      }
      if (input.deemedMonths > capRecognized) { deemedRecognized = capRecognized; deemedCapped = true; }
      else deemedRecognized = input.deemedMonths;
    } else if (input.workStartYM) {
      var ws = D.toIndex(input.workStartYM);
      var estEnd = doc31Gap ? (insuredIdxForCap - 1) : DEEMED_END_IDX;
      deemedRecognized = Math.max(0, estEnd - ws + 1);
      if (deemedRecognized > 0) warnings.push('视同缴费月数按参加工作时间估算（' + deemedRecognized +
        '个月' + (doc31Gap ? '，含1992-10后连续工龄' : '') + '），最终以社保经办机构档案认定为准');
    }
    // N同：视同月中落在 1992-09（含）以前的月数（优先由认定区间直接求交集）
    var nTongMonths = 0;
    if (hasDeemedRange) {
      var tS = Math.max(dStart, (input.workStartYM ? D.toIndex(input.workStartYM) : dStart));
      var tE = Math.min(dEnd, DEEMED_END_IDX);
      nTongMonths = tE >= tS ? (tE - tS + 1) : 0;
    } else if (input.workStartYM) {
      var wsTong = D.toIndex(input.workStartYM);
      nTongMonths = Math.min(deemedRecognized, Math.max(0, DEEMED_END_IDX - wsTong + 1));
    }
    var deemedMonths = deemedRecognized; // 供 N实同/资格/meta 使用
    if (deemedCapped) {
      warnings.push('手工视同缴费月数 ' + input.deemedMonths + ' 中，' + (deemedRecognized - nTongMonths) +
        ' 个月为1992-10后连续工龄，不进G同（N同严格按1992-09截断，已为' + nTongMonths +
        '个月）；该段按31号文进G实/R补，N实同仍计全部认定视同月，请核对档案认定月数');
    }

    // 3) 核心中间变量
    var Z实 = sumZ / K;                                    // Z实指数（spec 4.5，官方公式）
    var Z同 = P.deemedIndex;                               // Z同指数=1.0（P02）
    var N应缴 = K / 12;                                    // 应缴年限（含断缴月，Z实分母口径）
    var N实同 = (paidMonths + deemedRecognized) / 12;      // N实同：实缴+认定视同（基础养老金年限）
    var N同 = nTongMonths / 12;

    // N实98：#9 取消手工输入，由视同起止年月自动计算。
    //  n98Window = [1992-10, 1998-06]（31号文第二条(二)：连续工龄含视同/实际缴费）；
    //  n98Months = 窗口内有实缴(monthMap) ∪ 落在经认定视同区间内 的月份并集（不重复计）；
    //  普通人员同一公式（窗口内实缴 + 区间内认定视同月）。
    var n98End = Math.min(D.toIndex('1998-06'), lastContribIdx);
    var n98Months = 0;
    for (var n9 = PHYS_BUILD_START_IDX; n9 <= n98End; n9++) {
      var inPaid = !!monthMap[n9];
      var inDeemed = hasDeemedRange && n9 >= dStart && n9 <= dEnd;
      if (inPaid || inDeemed) n98Months++;
    }
    if (n98Months > 0) {
      warnings.push('N实98 由视同起止年月与 1992-10~1998-06 区间自动推导为 ' + n98Months +
        ' 个月（连续工龄含视同/实际缴费，31号文口径），进G实');
    } else if (!hasDeemedRange) {
      warnings.push('1992-10~1998-06 间无经认定视同区间亦无实际缴费记录，N实98=0');
    }
    var N实98 = n98Months / 12;

    // Bug4：31号文人员 N同=0 但有认定视同月时，明确口径提示
    if (doc31Gap && nTongMonths === 0 && deemedRecognized > 0) {
      warnings.push('该 ' + deemedRecognized + ' 个视同月均为1992-10后连续工龄，不进G同（无1992-09前工龄），按31号文进G实/R补');
    }

    // 4) C平：退休年度养老金计发基数（P10/P11，可用用户选择/覆盖值）
    var retireYear = D.yearOf(retireIdx);
    var baseYear = input.baseYearOverride || P.pensionBaseDefaultYear;
    var C平 = P.pensionBaseByYear[baseYear];
    if (input.cPingOverride != null) C平 = input.cPingOverride;
    if (C平 == null) throw new Error('计发基数年度 ' + baseYear + ' 无内置数据，请手工录入C平');
    if (input.cPingOverride == null && baseYear !== retireYear) {
      warnings.push('所选计发基数年度(' + baseYear + ')与退休年度(' + retireYear + ')不一致，C平暂按 ' +
        baseYear + ' 年度 ' + C平 + ' 元计发，请以退休当年官方公布基数为准');
    }

    // 5) 养老金三分项（spec 4.2~4.4）
    var J基础_raw = (C平 + C平 * Z实) / 2 * N实同 * 0.01;
    var age = retireAge(input);
    var M = getM(age);

    var account = calcAccount(input, monthMap, Object.keys(monthMap).map(Number), warnings);

    // 5.1) R补（用户符号）= 官方「个人账户补贴额」Z补贴（spec 2.2.1 V1.2；31号文第二条(三)+附件1）
    //   仅31号文第一条三类人员适用；Z补贴 为虚拟计发额度，不计入个人账户实际储存额 R储（AC-RC-07），
    //   只在 J账户 分子与 R储 相加：J账户=(R储+R补)÷M。
    //   Z补贴 所用 Z实指数 仅统计企业实际参保后缴费段（AC-RC-06；含断缴月，断缴计0，同T-05口径）。
    var zRealSubsidy = Z实;
    if (input.doc31Eligible && input.enterpriseInsuredYM && /^\d{4}-\d{2}$/.test(input.enterpriseInsuredYM)) {
      var insIdx = Math.max(D.toIndex(input.enterpriseInsuredYM), windowStartIdx);
      var sumZSub = 0, kSub = 0;
      for (var si = insIdx; si <= lastContribIdx; si++) {
        kSub++;
        var mdSub = monthlyDetails[si - windowStartIdx]; // monthlyDetails 以应缴窗口起点为 0
        if (mdSub) sumZSub += mdSub.z;
      }
      zRealSubsidy = kSub > 0 ? sumZSub / kSub : 0;
    }
    var subsidyInfo = Subsidy.calculateAccountSubsidy(input, zRealSubsidy);
    if (subsidyInfo.warning) warnings.push(subsidyInfo.warning);
    var R补 = subsidyInfo.applicable ? subsidyInfo.subsidy : 0;
    var J账户_raw = (account.R储 + R补) / M; // 31号文人员 J账户=(R储+R补)÷M；普通人员 R补=0，与V1.1一致

    // 中人判定：参加工作时间 < 1998-07（P01 第23条）；无 workStart 时按是否存在1998-06前缴费/视同推断
    var isZhong = input.workStartYM ? (D.toIndex(input.workStartYM) < D.toIndex(P.personBoundary))
      : (deemedMonths > 0 || n98Months > 0);
    var G同_raw = isZhong ? C平 * Z同 * N同 * 0.01 : 0;
    var G实_raw = isZhong ? C平 * Z实 * N实98 * 0.01 : 0;

    // BUG-013：分项先各自舍入到分，总额=三个【展示值】之和（保证界面三分项之和恒等于总额）
    var J基础 = round2(J基础_raw);
    var J账户 = round2(J账户_raw);
    var G同 = round2(G同_raw);
    var G实 = round2(G实_raw);
    var J过渡 = round2(G同_raw + G实_raw);
    var P_total = round2(J基础 + J账户 + J过渡);

    // 6) 资格校验（P05 附件4 最低缴费年限随退休年度提高）
    var minMonths = minRequiredMonths(input.retireYM);
    var eligible = (paidMonths + deemedMonths) >= minMonths;

    // 7) 渐进式延迟法定退休年龄（P05 / GAP-01）
    var sched = null;
    try {
      var key = Schedule.keyOf(input.gender, input.femaleType);
      var statYM = Schedule.statutoryRetireYM(key, input.birthYM);
      var delay = Schedule.delayMonths(key, input.birthYM);
      var affected = Schedule.isAffected(key, input.birthYM);
      var range = Schedule.flexibleRange(key, input.birthYM);
      sched = {
        key: key,
        statutoryYM: statYM,
        delayMonths: delay,
        affected: affected,
        chosenYM: input.retireYM,
        chosenOffsetMonths: retireIdx - D.toIndex(statYM),
        withinFlexible: retireIdx >= range.min && retireIdx <= range.max,
        flexibleMinYM: D.toYM(range.min),
        flexibleMaxYM: D.toYM(range.max),
        ref: 'P05'
      };
      if (retireIdx !== D.toIndex(statYM)) {
        warnings.push('所选退休年月 ' + input.retireYM + ' 与按P05对照表推算的法定退休年月 ' + statYM +
          ' 相差 ' + (retireIdx - D.toIndex(statYM)) + ' 个月；弹性提前/延迟均须≥最低缴费年限、提前不低于原法定年龄、提前或延迟各不超过3年');
      }
    } catch (e) { sched = null; }

    // 8) 灵活就业成本（附加信息，不参与计发）
    var flexMonths = 0, flexCost = 0;
    (input.segments || []).forEach(function (s) {
      if (s.type !== 'flexible') return;
      var a = Math.max(D.toIndex(s.startYM), windowStartIdx);
      var b = Math.min(D.toIndex(s.endYM), lastContribIdx);
      var cnt = Math.max(0, b - a + 1);
      flexMonths += cnt;
      flexCost += cnt * s.baseMonthly * P.contributionRate.flexibleTotal; // 20%
    });

    return {
      meta: {
        policyDataVersion: P.version,
        retireAge: age,
        personType: isZhong ? '中人（1998-07前参加工作）' : '新人（1998-07后参加工作）',
        eligible: eligible,
        minRequiredMonths: minMonths,
        totalMonths: paidMonths + deemedMonths,
        warnings: warnings,
        retireSchedule: sched
      },
      inputs: {
        gender: input.gender, femaleType: input.femaleType || null,
        birthYM: input.birthYM, workStartYM: input.workStartYM || null,
        retireYM: input.retireYM, baseYear: baseYear, interestMode: input.interestMode || 'official',
        deemedStartYM: input.deemedStartYM || null,
        deemedEndYM: input.deemedEndYM || null,
        manualBalanceYM: input.accountBalanceManualYM || null,
        doc31Eligible: !!input.doc31Eligible, // 是否申报31号文第一条人员（R补=Z补贴）
        doc31TransferYM: input.doc31TransferYM || null,
        enterpriseInsuredYM: input.enterpriseInsuredYM || null,
        // Bug23：当前 case 的应缴窗口实际起止（动态注释绑定用，勿写死）
        windowStartYM: D.toYM(windowStartIdx),
        windowEndYM: D.toYM(lastContribIdx)
      },
      // 用户点名的全部中间变量
      intermediates: {
        C平: round2(C平),
        Z实指数: round4(Z实),
        Z同指数: round4(Z同),
        N应缴: round4(N应缴),
        K应缴月: K,
        N实同: round4(N实同),
        N同: round4(N同),
        N实98: round4(N实98),
        actualPaidMonths: paidMonths,
        deemedMonths: deemedMonths,
        M: M,
        R储: account.R储,
        R储本金: account.principal,
        R储利息: account.interest,
        // R补=官方「个人账户补贴额」Z补贴（31号文第二条(三)，用户符号；普通企业职工=0）。
        // 虚拟计发额度，不计入 R储 账户余额（AC-RC-07）；适用身份/分档明细见 accountSubsidy。
        R补: R补,
        G同: G同,
        G实: G实
      },
      pension: {
        J基础: J基础,
        J账户: J账户,
        J过渡: J过渡,
        total: P_total
      },
      // R补（Z补贴）计发明细：适用状态、分档累加值、参保后Z实指数、未建账期间、扣除月数、缺失年度等
      accountSubsidy: subsidyInfo,
      account: account,
      flexInfo: { months: flexMonths, totalCost: round2(flexCost), rate: P.contributionRate.flexibleTotal },
      monthlyDetails: monthlyDetails,
      annualIndex: buildAnnualIndexLedger(monthlyDetails, windowStartIdx, lastContribIdx, retireIdx, input.customCYear),
      // 供结果页展示完整代入算式（ref 键与 constants/policyRefs.js 完全一致，BUG-002）
      formulaLines: [
        { key: 'J基础', ref: 'P02', text: 'J基础 =（C平 + C平×Z实指数）÷2 × N实+同 × 1%',
          expr: '(' + round2(C平) + ' + ' + round2(C平) + '×' + round4(Z实) + ') ÷ 2 × ' + round4(N实同) + ' × 1% = ' + J基础 },
        { key: 'J账户', ref: 'P04',
          text: R补 > 0 ? 'J账户 =（R储 + R补）÷ M（R补=Z补贴，31号文人员）' : 'J账户 = R储 ÷ M（R储=个人账户累计储存额）',
          expr: R补 > 0
            ? '(' + round2(account.R储) + ' + ' + R补 + ') ÷ ' + M + ' = ' + J账户
            : round2(account.R储) + ' ÷ ' + M + ' = ' + J账户 },
        { key: 'G同', ref: 'P02', text: 'G同 = C平 × Z同指数 × N同 × 1%',
          expr: round2(C平) + ' × ' + round4(Z同) + ' × ' + round4(N同) + ' × 1% = ' + G同 },
        { key: 'G实', ref: 'P02', text: 'G实 = C平 × Z实指数 × N实98 × 1%',
          expr: round2(C平) + ' × ' + round4(Z实) + ' × ' + round4(N实98) + ' × 1% = ' + G实 }
      ]
      // 31号文人员追加 Z补贴 公式行（普通人群保持原4条，结果页 R补 显示「不适用」）
      .concat(R补 > 0 ? [{
        key: 'R补', ref: 'P13',
        text: 'R补=Z补贴 = 分档模拟额(2%/5%/11%/8%) × 参保后Z实指数（不计入账户实际储存额）',
        expr: (Math.round(subsidyInfo.bracketSumRaw * 1000000) / 1000000) + ' × ' + (Math.round(zRealSubsidy * 10000) / 10000) + ' = ' + R补
      }] : [])
    };
  }

  return {
    calculate: calculate,
    validate: validate,
    retireAge: retireAge,
    getM: getM,
    minRequiredMonths: minRequiredMonths,
    denominatorFor: denominatorFor,
    round2: round2,
    round4: round4
  };
});
