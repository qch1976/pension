// pages/compare/compare.js
// Phase-1 方案输入页。
//  D2：共享历史数据区组件（≤2026-08，三方案共用、只录一次）。
//  D3：方案卡组件（1~3 个方案，3 项差异 + 增删 + Z/区间校验）。
//  D8：开始比较 -> 组装共享引擎入参 + 有效方案，进入比较结果页。
var PM = require('../../calculator/planModel.js');
var D = require('../../calculator/dateUtil.js');
var P = require('../../constants/policyData.js');
var caseImport = require('../../services/caseImport.js');
var fileStore = require('../../services/fileStore.js');

function fmtErr(e) {
  var loc = e.line ? ('第' + e.line + '行') : (e.field ? ('字段 ' + e.field) : '');
  return (loc ? loc + '：' : '') + e.reason;
}

var PAYLOAD_KEY = 'pension_compare_payload_v1';

Page({
  data: {
    ctx: { gender: '', femaleType: '', birthYM: '' },
    inputMode: 'manual',
    policyVersion: P.version,
    fileName: '',
    fileErrors: [],
    fileNotices: []
  },

  onReady: function () {
    this.syncCtx();
  },

  onShow: function () {
    // 从结果页返回或重进时同步最新共享上下文
    if (this.selectComponent('#sharedData')) this.syncCtx();
  },

  // 从共享数据区读取上下文，供方案卡确定法定退休年月与合法区间
  syncCtx: function () {
    var shared = this.selectComponent('#sharedData');
    if (!shared) return;
    var ctx = typeof shared.getContext === 'function'
      ? shared.getContext()
      : { gender: '', femaleType: '', birthYM: '' };
    this.setData({ ctx: ctx });
  },

  // D8：开始比较
  startCompare: function () {
    var shared = this.selectComponent('#sharedData');
    var planList = this.selectComponent('#planList');
    if (!shared || !planList) return;

    // 共享入参（内部已保存草稿并做 ≤2026-08 校验）
    var built = shared.buildValidatedInput();
    if (!built.ok) {
      wx.showToast({ title: built.error || '共享历史数据校验未通过', icon: 'none', duration: 2600 });
      return;
    }

    // 取有效、非空、填全的方案
    var ctx = this.data.ctx;
    var plans = planList.getPlans().filter(function (p) {
      return PM.isValidPlan(p, ctx, D);
    });

    if (plans.length < PM.MIN_PLANS_TO_COMPARE) {
      wx.showToast({
        title: '请至少填全 ' + PM.MIN_PLANS_TO_COMPARE + ' 个不同方案（退休年月/Z/缴费性质）',
        icon: 'none', duration: 2600
      });
      return;
    }

    // 去重（同退休/Z/性质视为同方案）——复用 planModel 纯函数，便于单测（REQ-01-DUP-000~002）
    var dedup = PM.dedupPlans(plans);
    var distinct = dedup.distinct;
    if (distinct.length < PM.MIN_PLANS_TO_COMPARE) {
      wx.showToast({ title: '方案内容相同，比较至少需 2 个不同方案', icon: 'none', duration: 2600 });
      return;
    }

    // 载荷走 storage（结果页直接读，不依赖页面栈传参）
    wx.setStorageSync(PAYLOAD_KEY, { sharedInput: built.input, plans: distinct });
    wx.navigateTo({
      url: '/pages/compare-result/compare-result',
      fail: function () {
        wx.showToast({ title: '打开结果页失败，请重试', icon: 'none' });
      }
    });
  },

  // redirectTo 进入后无返回栈：返回选项页
  backEntry: function () {
    wx.redirectTo({ url: '/pages/entry/entry' });
  },

  // ---- E4：手工/文件输入切换 ----
  setInputMode: function (e) {
    this.setData({ inputMode: e.currentTarget.dataset.v });
  },

  onChooseCaseFile: function () {
    var self = this;
    var store = fileStore.getDefault();
    wx.showLoading({ title: '读取中', mask: true });
    caseImport.importFromConversation('compare', store).then(function (r) {
      wx.hideLoading();
      if (r.cancelled) return;
      var v = r.validation || {};
      var shared = self.selectComponent('#sharedData');
      if (shared && v.pageData && v.ok) {
        shared.applyPrefill(v.pageData); // common 预置共享区
      } else if (shared && v.pageData) {
        // 部分导入：正确部分仍回填，错误项列出待手工补齐
        shared.applyPrefill(v.pageData);
      }
      self.setData({
        fileName: r.savedName || '',
        fileErrors: (v.invalidOrMissing || []).map(fmtErr),
        fileNotices: ((r.parsed && r.parsed.notices) || []).map(function (n) { return n.reason; })
      });
      self.syncCtx();
      if (v.ok) wx.showToast({ title: '共用数据已导入，请添加方案', icon: 'none' });
    }).catch(function () {
      wx.hideLoading();
      wx.showToast({ title: '导入失败，请重试', icon: 'none' });
    });
  }
});
