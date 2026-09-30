// components/shared-data/shared-data.js
// Phase-1 三方案共用的「共享历史数据区（≤2026-08，只录一次，裁定 Q1）」组件。
// 关联 REQ-01-SHR-000~003。
// 复用：inputPageModel（初始/重置模型、草稿用户字段挑选）、policyData、dateUtil、retireSchedule、
//       inputValidator（与 Phase-0 buildInput 一致的校验）；不复制任何计发计算路径。
// 草稿：独立 key pension_compare_input_v1，与 Phase-0 pension_input_v1 隔离（REQ-01-SHR-003）。
var P = require('../../constants/policyData.js');
var Schedule = require('../../calculator/retireSchedule.js');
var D = require('../../calculator/dateUtil.js');
var Model = require('../../calculator/inputPageModel.js');
var V = require('../../calculator/inputValidator.js');

var DRAFT_KEY = 'pension_compare_input_v1';

Component({
  options: { styleIsolation: 'apply-shared' },
  data: Model.buildInitialData(P),

  lifetimes: {
    attached: function () {
      var saved = wx.getStorageSync(DRAFT_KEY);
      if (saved) {
        var base = Model.buildInitialData(P);
        var merged = Object.assign({}, base, Model.pickUserData(saved), { errorMsg: '' });
        // storage 迁移：旧草稿无 hasDeemed 时按非空起止派生（与 Phase-0 一致，不凭空改状态）
        if (saved.hasDeemed == null) {
          merged.hasDeemed = !!(saved.deemedStartYM || saved.deemedEndYM);
        }
        if (!merged.hasDeemed) {
          merged.deemedStartYM = '';
          merged.deemedEndYM = '';
        }
        this.setData(merged);
      }
      this.recomputeWarnings();
    }
  },

  methods: {
    // ---- 草稿（独立 key） ----
    saveDraft: function () {
      wx.setStorageSync(DRAFT_KEY, V.pickShared(this.data));
    },

    // ---- ① 基本信息 ----
    setGender: function (e) { this.setData({ gender: e.currentTarget.dataset.v }); },
    setFemaleType: function (e) { this.setData({ femaleType: e.currentTarget.dataset.v }); },
    onBirth: function (e) { this.setData({ birthYM: e.detail.value }); },
    onWorkStart: function (e) { this.setData({ workStartYM: e.detail.value }); },

    // ---- ② 视同 ----
    setHasDeemed: function (e) {
      var has = e.currentTarget.dataset.v === 'yes';
      if (has) this.setData({ hasDeemed: true });
      else this.setData({ hasDeemed: false, deemedStartYM: '', deemedEndYM: '' });
    },
    onDeemedStart: function (e) { this.setData({ deemedStartYM: e.detail.value }); },
    onDeemedEnd: function (e) { this.setData({ deemedEndYM: e.detail.value }); },

    // ---- ③ 缴费记录：模式/月段/年度 ----
    setEntryMode: function (e) {
      this.setData({ entryMode: e.currentTarget.dataset.v }, this.recomputeWarnings);
    },
    setSegType: function (e) {
      var i = e.currentTarget.dataset.i;
      this.setData({ ['segments[' + i + '].type']: e.currentTarget.dataset.v }, this.recomputeWarnings);
    },
    onSegDate: function (e) {
      var i = e.currentTarget.dataset.i, k = e.currentTarget.dataset.k;
      this.setData({ ['segments[' + i + '].' + k]: e.detail.value }, this.recomputeWarnings);
    },
    onSegBase: function (e) {
      var i = e.currentTarget.dataset.i;
      this.setData({ ['segments[' + i + '].baseMonthly']: e.detail.value }, this.recomputeWarnings);
    },
    addSegment: function () {
      var list = this.data.segments.concat([{ type: 'enterprise', startYM: '2000-01', endYM: '2000-12', baseMonthly: '' }]);
      this.setData({ segments: list });
    },
    delSegment: function (e) {
      var list = this.data.segments.slice();
      list.splice(e.currentTarget.dataset.i, 1);
      this.setData({ segments: list }, this.recomputeWarnings);
    },
    copyLastSegment: function () {
      var list = this.data.segments;
      if (!list.length) { this.addSegment(); return; }
      var last = list[list.length - 1];
      var ns = D.toIndex(last.startYM) + 12, ne = D.toIndex(last.endYM) + 12;
      list = list.concat([{ type: last.type, startYM: D.toYM(ns), endYM: D.toYM(ne), baseMonthly: last.baseMonthly }]);
      this.setData({ segments: list }, this.recomputeWarnings);
      wx.showToast({ title: '已复制一段（起止+12个月）', icon: 'none' });
    },

    addYearRow: function () {
      var rows = this.data.yearRows;
      var nextYear = rows.length ? String(+rows[rows.length - 1].year + 1) : String(new Date().getFullYear() - 1);
      rows = rows.concat([{ year: nextYear, startMonth: '1', type: 'enterprise', annualBase: '', months: '12' }]);
      this.setData({ yearRows: rows }, this.recomputeWarnings);
    },
    delYearRow: function (e) {
      var rows = this.data.yearRows.slice();
      rows.splice(e.currentTarget.dataset.i, 1);
      this.setData({ yearRows: rows }, this.recomputeWarnings);
    },
    setYearRowType: function (e) {
      var i = e.currentTarget.dataset.i;
      this.setData({ ['yearRows[' + i + '].type']: e.currentTarget.dataset.v }, this.recomputeWarnings);
    },
    onYearRow: function (e) {
      var i = e.currentTarget.dataset.i, k = e.currentTarget.dataset.k;
      this.setData({ ['yearRows[' + i + '].' + k]: e.detail.value }, this.recomputeWarnings);
    },

    // ---- ④ 账户 / 31号文 ----
    onManualBalance: function (e) { this.setData({ accountBalanceManual: e.detail.value }); },
    onManualBalanceYM: function (e) { this.setData({ manualBalanceYM: e.detail.value }); },
    setDoc31: function (e) { this.setData({ doc31Eligible: e.currentTarget.dataset.v === 'yes' }); },
    onDoc31Transfer: function (e) { this.setData({ doc31TransferYM: e.detail.value }); },
    onEnterpriseInsured: function (e) { this.setData({ enterpriseInsuredYM: e.detail.value }); },
    onSubsidyExcluded: function (e) { this.setData({ subsidyExcludedText: e.detail.value }); },

    // ---- ⑤ C平 / 缺口年度 ----
    onBaseYearChange: function (e) { this.setData({ baseYearIndex: +e.detail.value }); },
    onCPing: function (e) { this.setData({ cPingOverride: e.detail.value }); },
    onCustomCYear: function (e) { this.setData({ customCYearText: e.detail.value }); },

    // ---- E-05 越界提示 ----
    recomputeWarnings: function () {
      try {
        var w = this.data.entryMode === 'year'
          ? V.collectYearRowWarnings(P, this.data.yearRows)
          : V.collectBoundWarnings(P, this.data.segments);
        this.setData({ boundWarnings: w });
      } catch (e) {}
    },

    // ---- 对外：保存草稿 ----
    persist: function () { this.saveDraft(); },

    // ---- 对外：构造并校验共享引擎输入（规则同 Phase-0 buildInput + ≤2026-08 边界） ----
    // 返回 { ok, input } 或 { ok:false, error }，供 compare 页 / D4 调用。
    buildValidatedInput: function () {
      try {
        this.saveDraft();
        var input = V.buildSharedInput(P, D, this.data);
        if (!input.segments.length && input.accountBalanceManual == null) {
          return { ok: false, error: '请至少录入一段实际缴费基数，或直接填写个人账户累计储存额' };
        }
        return { ok: true, input: input };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    // ---- 对外：读取已持久化的共享草稿（独立 key），供三方案一致引用 ----
    readDraft: function () {
      return wx.getStorageSync(DRAFT_KEY);
    },

    // ---- 清空共享录入（只清 compare 草稿，不触碰 Phase-0 pension_input_v1） ----
    clearShared: function () {
      this.setData(Model.buildResetData(P), this.recomputeWarnings);
      try { wx.removeStorageSync(DRAFT_KEY); } catch (e) {}
    }
  }
});
