// pages/index/index.js
// 输入页：采集 spec 第7章全部输入字段，年月精确到月，带校验与默认值。
// 阶段4：接入 P-05 渐进式延迟退休对照表（calculator/retireSchedule.js）、
//        年度录入模式(FR-05)、缴费基数60%-300%越界提示(E-05)、批量填充(FR-04)。
var app = getApp();
var P = require('../../constants/policyData.js');
var Engine = require('../../calculator/pensionEngine.js');
var Schedule = require('../../calculator/retireSchedule.js');
var D = require('../../calculator/dateUtil.js');
var Model = require('../../calculator/inputPageModel.js'); // 批次2 #6/#11 纯函数页面模型
var caseImport = require('../../services/caseImport.js');
var fileStore = require('../../services/fileStore.js');

function addMonthsYM(ym, n) { return D.toYM(D.toIndex(ym) + n); }

// E4：错误项格式化为「字段/行号 + 原因」可显示文本
function fmtErr(e) {
  var loc = e.line ? ('第' + e.line + '行') : (e.field ? ('字段 ' + e.field) : '');
  return (loc ? loc + '：' : '') + e.reason;
}

// P-05：出生年月 + 性别/身份 -> 法定退休年月（FR-02）
function computeStatutoryRetireYM(gender, femaleType, birthYM) {
  if (!birthYM) return null;
  var key = Schedule.keyOf(gender, femaleType);
  return Schedule.statutoryRetireYM(key, birthYM);
}

// 缴费指数分母（上年社平/全口径），用于 60%-300% 越界提示（E-05）
function indexDenomOfYear(yearY) {
  if (P.indexDenominatorMonthly[yearY] != null) return P.indexDenominatorMonthly[yearY];
  var keys = Object.keys(P.indexDenominatorMonthly).map(Number).sort(function (a, b) { return a - b; });
  return P.indexDenominatorMonthly[keys[keys.length - 1]];
}

Page({
  data: Object.assign({
    inputMode: 'manual',     // 手工 / 文件（默认手工，手工流程零差异）
    fileName: '',
    fileErrors: [],
    fileNotices: []
  }, Model.buildInitialData(P)),

  onLoad: function () {
    var saved = wx.getStorageSync('pension_input_v1');
    // 以最新页面模型为底合并旧草稿：自动补齐新字段（#5/#11），并强制遮罩关闭。
    if (saved) {
      var base = Model.buildInitialData(P);
      // BUG-27：旧草稿只回填用户录入字段；政策静态字段（version/计发基数等）始终取最新代码，
      // 避免存储里的旧 policyVersion 覆盖 policyData.js 的新版本号。
      var merged = Object.assign({}, base, Model.pickUserData(saved),
        { calculating: false, errorMsg: '' });
      // Bug22 storage 迁移：旧草稿无 hasDeemed 字段时，按“是否有非空起止”派生，
      // 不凭空改变用户旧状态（旧值非空推定“有”，真实草稿不丢）。
      if (saved.hasDeemed == null) {
        merged.hasDeemed = !!(saved.deemedStartYM || saved.deemedEndYM);
      }
      // Bug22 核心：hasDeemed=false 时强制视同起止不残留（清掉上一案旧值）。
      if (!merged.hasDeemed) {
        merged.deemedStartYM = '';
        merged.deemedEndYM = '';
      }
      this.setData(merged);
    }
    this.refreshDefaultRetire();
  },

  // BUG-16：从结果页返回（或 navigateTo 失败后再次 onShow）时复位遮罩，避免残留转圈
  onShow: function () {
    if (this.data.calculating) this.setData({ calculating: false });
  },

  // BUG-27：草稿仅持久化用户录入/选择，不落政策静态字段（避免旧版本号/旧计发基数被回写）。
  saveDraft: function () { wx.setStorageSync('pension_input_v1', Model.pickUserData(this.data)); },

  // ---- E4：输入模式切换（手工/文件） ----
  setInputMode: function (e) {
    this.setData({ inputMode: e.currentTarget.dataset.v });
  },

  // 选择会话 Case 文件并串联：保存->解析->校验->回填/错误列表
  onChooseCaseFile: function () {
    var self = this;
    var store = fileStore.getDefault();
    wx.showLoading({ title: '读取中', mask: true });
    caseImport.importFromConversation('basic', store).then(function (r) {
      wx.hideLoading();
      if (r.cancelled) return; // 取消安静返回
      self.applyImportResult(r, 'basic');
    }).catch(function () {
      wx.hideLoading();
      wx.showToast({ title: '导入失败，请重试', icon: 'none' });
    });
  },

  applyImportResult: function (r, mode) {
    var v = r.validation || {};
    var patch = {
      fileName: r.savedName || '',
      fileErrors: (v.invalidOrMissing || []).map(fmtErr),
      fileNotices: ((r.parsed && r.parsed.notices) || []).map(function (n) { return n.reason; })
    };
    // Q3：正确字段直接回填同一套表单（pageData 已映射）。
    if (v.pageData) {
      var pd = v.pageData;
      if (pd.yearRows) {
        patch.yearRows = pd.yearRows.map(function (yr) {
          return { year: yr.year, startMonth: yr.startMonth, annualBase: yr.annualBase,
            months: yr.months, type: 'enterprise' };
        });
      }
      ['gender', 'femaleType', 'birthYM', 'workStartYM', 'retireYM', 'hasDeemed',
       'deemedStartYM', 'deemedEndYM', 'accountBalanceManual', 'manualBalanceYM',
       'futureMonthlyRatePct', 'entryMode', 'enterpriseInsuredYM'].forEach(function (k) {
        if (pd[k] !== undefined) patch[k] = pd[k];
      });
    }
    this.setData(patch, this.refreshRetireHint);
    try { this.saveDraft(); } catch (e) {}
    if (v.ok) wx.showToast({ title: v.summary || '导入成功', icon: 'none' });
  },

  setGender: function (e) {
    this.setData({ gender: e.currentTarget.dataset.v }, this.refreshDefaultRetire);
  },
  setFemaleType: function (e) {
    this.setData({ femaleType: e.currentTarget.dataset.v }, this.refreshDefaultRetire);
  },
  onBirth: function (e) {
    this.setData({ birthYM: e.detail.value }, this.refreshDefaultRetire);
  },
  onWorkStart: function (e) { this.setData({ workStartYM: e.detail.value }); },
  onRetire: function (e) {
    this.setData({ retireYM: e.detail.value }, this.refreshRetireHint);
  },

  // FR-02 / P-05：按出生年月与性别身份，经渐进式延迟退休对照表自动给出法定退休年月（手工可改）
  refreshDefaultRetire: function () {
    var d = this.data;
    if (!d.birthYM) return;
    var stat = computeStatutoryRetireYM(d.gender, d.femaleType, d.birthYM);
    this.setData({ retireYM: stat }, this.refreshRetireHint);
  },
  refreshRetireHint: function () {
    var d = this.data;
    var key = Schedule.keyOf(d.gender, d.femaleType);
    var stat = Schedule.statutoryRetireYM(key, d.birthYM);
    var delay = Schedule.delayMonths(key, d.birthYM);
    var range = Schedule.flexibleRange(key, d.birthYM);
    var hint = '按P-05对照表，您的法定退休年月为 ' + stat +
      (delay > 0 ? '（较原法定年龄延迟 ' + delay + ' 个月）' : '（未进入延迟退休过渡区间）');
    var chosen = D.toIndex(d.retireYM);
    if (chosen !== D.toIndex(stat)) {
      var okFlex = chosen >= range.min && chosen <= range.max;
      hint += '；当前选择 ' + d.retireYM + (okFlex ? '，属弹性提前/延迟范围（各不超过3年、提前不低于原法定年龄，且须满足最低缴费年限）'
        : '，超出弹性范围（' + D.toYM(range.min) + '~' + D.toYM(range.max) + '），请核对');
    }
    this.setData({ retireHint: hint });
  },

  // Bug22：视同“有/无”状态切换。关（无视同）→ 起止立即清空；开 → 保留已录值待选。
  setHasDeemed: function (e) {
    var has = e.currentTarget.dataset.v === 'yes';
    if (has) this.setData({ hasDeemed: true });
    else this.setData({ hasDeemed: false, deemedStartYM: '', deemedEndYM: '' });
  },
  onDeemedStart: function (e) { this.setData({ deemedStartYM: e.detail.value }); },
  onDeemedEnd: function (e) { this.setData({ deemedEndYM: e.detail.value }); },

  setEntryMode: function (e) {
    this.setData({ entryMode: e.currentTarget.dataset.v });
    if (e.currentTarget.dataset.v === 'year') this.checkYearBounds();
    else this.checkMonthBounds();
  },

  setSegType: function (e) {
    var i = e.currentTarget.dataset.i, v = e.currentTarget.dataset.v;
    this.setData({ ['segments[' + i + '].type']: v }, this.checkMonthBounds);
  },
  onSegDate: function (e) {
    var i = e.currentTarget.dataset.i, k = e.currentTarget.dataset.k;
    this.setData({ ['segments[' + i + '].' + k]: e.detail.value }, this.checkMonthBounds);
  },
  onSegBase: function (e) {
    var i = e.currentTarget.dataset.i;
    this.setData({ ['segments[' + i + '].baseMonthly']: e.detail.value }, this.checkMonthBounds);
  },
  addSegment: function () {
    var list = this.data.segments.concat([{ type: 'enterprise', startYM: '2000-01', endYM: '2000-12', baseMonthly: '' }]);
    this.setData({ segments: list });
  },
  delSegment: function (e) {
    var i = e.currentTarget.dataset.i;
    var list = this.data.segments.slice();
    list.splice(i, 1);
    this.setData({ segments: list }, this.checkMonthBounds);
  },
  // FR-04：复制最后一段起止（基数沿用上一段），减少长年限重复录入
  copyLastSegment: function () {
    var list = this.data.segments;
    if (!list.length) { this.addSegment(); return; }
    var last = list[list.length - 1];
    var ns = D.toIndex(last.startYM) + 12, ne = D.toIndex(last.endYM) + 12;
    list = list.concat([{ type: last.type, startYM: D.toYM(ns), endYM: D.toYM(ne), baseMonthly: last.baseMonthly }]);
    this.setData({ segments: list }, this.checkMonthBounds);
    wx.showToast({ title: '已复制一段（起止+12个月）', icon: 'none' });
  },

  // ---- 年度录入（FR-05） ----
  addYearRow: function () {
    var rows = this.data.yearRows;
    var nextYear = rows.length ? String(+rows[rows.length - 1].year + 1) : String(new Date().getFullYear() - 1);
    rows = rows.concat([{ year: nextYear, startMonth: '1', type: 'enterprise', annualBase: '', months: '12' }]);
    this.setData({ yearRows: rows }, this.checkYearBounds);
  },
  delYearRow: function (e) {
    var i = e.currentTarget.dataset.i;
    var rows = this.data.yearRows.slice();
    rows.splice(i, 1);
    this.setData({ yearRows: rows }, this.checkYearBounds);
  },
  setYearRowType: function (e) {
    var i = e.currentTarget.dataset.i;
    this.setData({ ['yearRows[' + i + '].type']: e.currentTarget.dataset.v }, this.checkYearBounds);
  },
  onYearRow: function (e) {
    var i = e.currentTarget.dataset.i, k = e.currentTarget.dataset.k;
    this.setData({ ['yearRows[' + i + '].' + k]: e.detail.value }, this.checkYearBounds);
  },
  // 年度行 -> 月段：年缴费基数 annualBase ÷ 缴费月数 months = 月基数 baseMonthly；
  // 月段由该年起始月 startMonth 起连续排 months 个月推导（可跨年，退休截断仍由引擎统一处理）。
  expandYearRows: function (rows) {
    var segs = [];
    rows.forEach(function (r) {
      var y = parseInt(r.year, 10);
      var k = Math.max(1, Math.min(12, parseInt(r.months, 10) || 0));
      var sm = Math.max(1, Math.min(12, parseInt(r.startMonth, 10) || 1));
      var annualBase = parseFloat(r.annualBase);
      if (!y || !k || !isFinite(annualBase) || annualBase <= 0) return;
      var baseMonthly = annualBase / k; // 年缴费基数均摊到缴费月，指数/8% 入账仍按月基数进引擎
      var startIdx = y * 12 + (sm - 1);
      segs.push({
        type: r.type,
        startYM: D.toYM(startIdx),
        endYM: D.toYM(startIdx + k - 1),
        baseMonthly: baseMonthly
      });
    });
    return segs;
  },

  onManualBalance: function (e) { this.setData({ accountBalanceManual: e.detail.value }); },
  onManualBalanceYM: function (e) { this.setData({ manualBalanceYM: e.detail.value }); },
  onFutureMonthlyRate: function (e) { this.setData({ futureMonthlyRatePct: e.detail.value }); },

  // ---- 31号文人员身份与时间（R补=Z补贴，spec 2.2.1） ----
  setDoc31: function (e) { this.setData({ doc31Eligible: e.currentTarget.dataset.v === 'yes' }); },
  onDoc31Transfer: function (e) { this.setData({ doc31TransferYM: e.detail.value }); },
  onEnterpriseInsured: function (e) { this.setData({ enterpriseInsuredYM: e.detail.value }); },
  onSubsidyExcluded: function (e) { this.setData({ subsidyExcludedText: e.detail.value }); },
  parseSubsidyExcludedRanges: function () {
    var ranges = [];
    (this.data.subsidyExcludedText || '').split(/\n|;|；/).forEach(function (line) {
      var m = line.replace(/\s/g, '').match(/^(\d{4}-\d{2})[~\-至到]+(\d{4}-\d{2})$/);
      if (m) ranges.push({ startYM: m[1], endYM: m[2] });
    });
    return ranges;
  },
  onBaseYearChange: function (e) { this.setData({ baseYearIndex: +e.detail.value }); },
  onCPing: function (e) { this.setData({ cPingOverride: e.detail.value }); },
  onCustomCYear: function (e) { this.setData({ customCYearText: e.detail.value }); },

  parseCustomCYear: function (text) {
    var out = {};
    (text || '').split(/\n|;|；/).forEach(function (line) {
      var m = line.replace(/\s/g, '').match(/^(\d{4})=(\d+(\.\d+)?)$/);
      if (m) out[m[1]] = +m[2];
    });
    return out;
  },

  // E-05：缴费基数按年与上年社平 60%-300% 核定区间比对，越界给黄字（允许录入）
  collectBoundWarnings: function (segs) {
    var warns = [];
    var seen = {};
    segs.forEach(function (s) {
      var base = parseFloat(s.baseMonthly);
      if (!isFinite(base) || base <= 0) return;
      var y0 = parseInt(s.startYM.slice(0, 4), 10), y1 = parseInt(s.endYM.slice(0, 4), 10);
      for (var y = y0; y <= y1; y++) {
        var denom = indexDenomOfYear(y);
        if (!denom) continue;
        var minBase = round1(denom * 0.6), maxBase = round1(denom * 3);
        var key = y + '|' + (base < minBase ? 'low' : base > maxBase ? 'high' : '');
        if (!key.endsWith('|') && !seen[key]) {
          seen[key] = true;
          warns.push((base < minBase ? '低于' : '高于') + y + '年度核定区间' +
            (base < minBase ? '下限' : '上限') + '（' + minBase + '~' + maxBase + ' 元/月）：' +
            base + ' 元/月，允许录入但实际申报通常按核定基数征收，请核对（E-05/P08）');
        }
      }
    });
    return warns;
  },
  checkMonthBounds: function () {
    try { this.setData({ boundWarnings: this.collectBoundWarnings(this.data.segments) }); } catch (e) {}
  },
  // 年度模式校验提示：针对年缴费基数（合理范围）与月数/起始月（1-12），不按月基数提示
  collectYearRowWarnings: function (rows) {
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
      // 年基数合理范围 = 月核定区间(60%~300%上年社平) × 缴费月数
      var y = parseInt(r.year, 10);
      var denom = indexDenomOfYear(y);
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
  },
  validateYearRows: function (rows) {
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
  },
  checkYearBounds: function () {
    try { this.setData({ boundWarnings: this.collectYearRowWarnings(this.data.yearRows) }); } catch (e) {}
  },

  buildInput: function () {
    var d = this.data;
    if (d.entryMode === 'year') this.validateYearRows(d.yearRows);
    var rawSegs = d.entryMode === 'year' ? this.expandYearRows(d.yearRows) : d.segments;
    var segs = rawSegs.map(function (s) {
      return { type: s.type, startYM: s.startYM, endYM: s.endYM, baseMonthly: parseFloat(s.baseMonthly) };
    }).filter(function (s) { return s.startYM && s.endYM && !isNaN(s.baseMonthly); });

    var input = {
      gender: d.gender,
      femaleType: d.gender === 'female' ? d.femaleType : null,
      birthYM: d.birthYM,
      workStartYM: d.workStartYM || null,
      retireYM: d.retireYM,
      // Bug22：无视同（开关关）→ 起止一律 null，引擎 N同/deemedMonths 保持 0（计算逻辑零改动）
      deemedStartYM: d.hasDeemed ? (d.deemedStartYM || null) : null,
      deemedEndYM: d.hasDeemed ? (d.deemedEndYM || null) : null,
      segments: segs,
      accountBalanceManual: d.accountBalanceManual === '' ? null : parseFloat(d.accountBalanceManual),
      accountBalanceManualYM: d.manualBalanceYM || null,
      futureMonthlyRate: d.futureMonthlyRatePct === '' ? null : parseFloat(d.futureMonthlyRatePct) / 100,
      baseYearOverride: +d.baseYearOptions[d.baseYearIndex],
      cPingOverride: d.cPingOverride === '' ? null : parseFloat(d.cPingOverride),
      customCYear: this.parseCustomCYear(d.customCYearText),
      // 31号文 Z补贴（R补）输入；普通职工 doc31Eligible=false，引擎默认 R补=0（AC-RC-02）
      doc31Eligible: !!d.doc31Eligible,
      doc31TransferYM: d.doc31TransferYM || null,
      enterpriseInsuredYM: d.enterpriseInsuredYM || null,
      subsidyExcludedRanges: d.doc31Eligible ? this.parseSubsidyExcludedRanges() : []
    };
    if (d.doc31Eligible) {
      // Bug24 I-10：错误文案删“本案…”，只讲规则。
      if (!/^\d{4}-\d{2}$/.test(d.workStartYM || '')) {
        throw new Error('31号文人员必须填写参加工作年月（供N实98连续工龄与N同1992-09截断使用）');
      }
      // Bug22：doc31 人员要求开关置“有”且起止合法；不自动替用户拨开关。
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
  },

  // #11/BUG-16 开始测算：先开遮罩并让出一帧（setData 回调 + setTimeout 双保险），再跑同步重运算；
  // 成功时【不在本页关遮罩】——以 calculating 状态直接跳转，输入页遮罩随系统转场自然 hide，
  // 由结果页同款遮罩接棒至首帧内容可见；校验失败/catch/navigateTo fail 路径才关闭遮罩。
  onCalculate: function () {
    if (this.data.calculating) return; // 防重复点击
    this.setData({ errorMsg: '' });
    try { this.saveDraft(); } catch (e) {}
    this.setData(Model.enterCalculating(this.data), () => {
      setTimeout(() => {
        var input, result;
        try {
          input = this.buildInput();
          if (!input.segments.length && input.accountBalanceManual == null) {
            throw new Error('请至少录入一段实际缴费基数，或直接填写个人账户累计储存额');
          }
          result = Engine.calculate(input);
        } catch (e) {
          this.setData(Object.assign(Model.exitCalculating(this.data), { errorMsg: e.message }));
          wx.showToast({ title: '请检查输入', icon: 'none' });
          return;
        }
        app.globalData.lastInput = input;
        app.globalData.lastResult = result;
        // BUG-16：跳转前不再关遮罩；仅在 navigateTo 失败时复位，防止遮罩卡死
        wx.navigateTo({
          url: '/pages/result/result',
          fail: () => {
            this.setData(Model.exitCalculating(this.data));
            wx.showToast({ title: '页面跳转失败，请重试', icon: 'none' });
          }
        });
      }, 30);
    });
  },

  // #6 清空本地录入数据：全部用户录入字段归空（含批次1新改的起止年月/账户累计额/未来年利率/年度记录），
  // 清 Storage；随后按出生/性别给出默认退休年月与P-05提示。
  onReset: function () {
    this.setData(Model.buildResetData(P));
    try { wx.removeStorageSync('pension_input_v1'); } catch (e) {}
    this.refreshDefaultRetire();
    wx.showToast({ title: '已清空本地录入', icon: 'none' });
  },

  // 快捷：用“当年全口径平均工资 × 比例”批量生成/替换一段（帮助录入）
  fillAtCaliber: function () {
    var d = this.data;
    wx.showActionSheet({
      itemList: ['按60%档（灵活就业常见）', '按100%档', '按300%档'],
      success: function (res) {
        var ratio = [0.6, 1, 3][res.tapIndex];
        var list = d.segments.map(function (s) {
          var y = parseInt(s.startYM.slice(0, 4), 10);
          var caliber = P.fullCaliberMonthly[y - 1]; // 缴费指数分母取上年
          if (caliber) s.baseMonthly = String(Math.round(caliber * ratio * 100) / 100);
          return s;
        });
        this.setData({ segments: list }, this.checkMonthBounds);
        wx.showToast({ title: '已按上年全口径填充可匹配年度', icon: 'none' });
      }.bind(this)
    });
  }
});

function round1(n) { return Math.round(n * 10) / 10; }
