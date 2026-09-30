// pages/compare-result/compare-result.js
// Phase-1 比较结果页（D8）。
// 数值全部绑定 compareResultModel.buildView（内部直接取自 D2-D7 模型输出），UI 层不重算。
var CRM = require('../../calculator/compareResultModel.js');

var PAYLOAD_KEY = 'pension_compare_payload_v1';

Page({
  data: {
    ready: false,
    loadError: '',
    view: null,
    rateInput: '0',            // 用户年利率输入（百分比数字，如 6 表示 6%）
    showComponents: {},        // 每列三分项是否展开
    drillId: '',               // 当前下钻列 id（''=关闭）
    drill: null,
    policyOpen: false
  },

  onLoad: function () {
    var payload;
    try { payload = wx.getStorageSync(PAYLOAD_KEY); } catch (e) { payload = null; }
    if (!payload || !payload.sharedInput || !Array.isArray(payload.plans)) {
      this.setData({ ready: false, loadError: '未找到比较输入，请返回方案输入页重新开始比较' });
      return;
    }
    this.sharedInput = payload.sharedInput;
    this.plans = payload.plans;
    this.rebuild(0);
  },

  // 以给定年利率重建视图
  rebuild: function (annualRate) {
    var view = CRM.buildView(this.sharedInput, this.plans, annualRate);
    this.setData({
      ready: true,
      loadError: '',
      view: view,
      rateInput: (annualRate * 100).toString()
    });
  },

  // 用户利率输入
  onRateInput: function (e) {
    this.setData({ rateInput: e.detail.value });
  },
  applyRate: function () {
    var v = parseFloat(this.data.rateInput);
    if (!isFinite(v) || v < 0) {
      wx.showToast({ title: '请输入不小于0的年利率（%）', icon: 'none' });
      return;
    }
    this.rebuild(v / 100);
  },

  // 三分项展开/收起
  toggleComponents: function (e) {
    var id = e.currentTarget.dataset.id;
    var sc = Object.assign({}, this.data.showComponents);
    sc[id] = !sc[id];
    this.setData({ showComponents: sc });
  },

  // 下钻
  openDrill: function (e) {
    var id = e.currentTarget.dataset.id;
    var drill = this.data.view.drills.filter(function (d) { return d.id === id; })[0] || null;
    this.setData({ drillId: id, drill: drill });
  },
  closeDrill: function () {
    this.setData({ drillId: '', drill: null });
  },

  // 政策弹窗
  openPolicy: function () { this.setData({ policyOpen: true }); },
  closePolicy: function () { this.setData({ policyOpen: false }); },

  backCompare: function () {
    wx.navigateBack({
      fail: function () {
        wx.redirectTo({ url: '/pages/compare/compare' });
      }
    });
  }
});
