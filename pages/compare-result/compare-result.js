// pages/compare-result/compare-result.js
// Phase-1 比较结果页（D8）。
// 数值全部绑定 compareResultModel.buildView（内部直接取自 D2-D7 模型输出），UI 层不重算。
var CRM = require('../../calculator/compareResultModel.js');
var reportShare = require('../../services/reportShare.js');

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
    policyOpen: false,
    reportBusy: false,
    toggleTexts: {}
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
    var tt = {};
    (view.columns || []).forEach(function (c) { tt[c.id] = '分项'; });
    this.setData({
      ready: true,
      loadError: '',
      view: view,
      rateInput: (annualRate * 100).toString(),
      toggleTexts: tt
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
    var tt = Object.assign({}, this.data.toggleTexts);
    tt[id] = sc[id] ? '收起' : '分项';
    this.setData({ showComponents: sc, toggleTexts: tt });
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
  },

  // E6：生成比较报告 txt → 写沙箱 → 分享（OUT-003）
  onShareReport: function () {
    var self = this;
    if (this.data.reportBusy || !this.data.view) return;
    this.setData({ reportBusy: true });
    reportShare.exportAndShare('compare', this.data.view, {}).then(function (st) {
      self.setData({ reportBusy: false });
      var title;
      if (st.shared) title = '已分享，报告也已存沙箱';
      else if (st.shareCancelled) title = '已取消分享，报告已存沙箱';
      else title = '报告已存沙箱';
      wx.showToast({ title: title, icon: 'none', duration: 2200 });
    }).catch(function () {
      self.setData({ reportBusy: false });
      wx.showToast({ title: '报告生成失败，请重试', icon: 'none' });
    });
  },

  // E6/NFR-003：保存到电脑（仅 PC/开发工具可用，缺失安静降级）
  onSaveReportToDisk: function () {
    var self = this;
    if (this.data.reportBusy || !this.data.view) return;
    this.setData({ reportBusy: true });
    reportShare.exportAndShare('compare', this.data.view, { share: false, askSaveToDisk: true })
      .then(function (st) {
        self.setData({ reportBusy: false });
        if (st.savedToDisk) wx.showToast({ title: '已保存到电脑', icon: 'none' });
        else if (!st.diskAvailable) wx.showToast({ title: '当前环境不支持存电脑，已存沙箱', icon: 'none' });
        else wx.showToast({ title: '已取消，报告仍存沙箱', icon: 'none' });
      }).catch(function () {
        self.setData({ reportBusy: false });
        wx.showToast({ title: '报告生成失败，请重试', icon: 'none' });
      });
  }
});
