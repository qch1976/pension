// pages/compare/compare.js
// Phase-1 方案输入页（D1 仅提供页面占位与返回出口；共享数据区/方案卡由 D2/D3 实现）
Page({
  data: {},

  // redirectTo 进入后无返回栈，提供显式返回选项页出口
  backEntry: function () {
    wx.redirectTo({ url: '/pages/entry/entry' });
  },

  // D1 占位：跳转比较结果页（后续 D4~D8 接入真实数据，届时改为 globalData 传参）
  goResult: function () {
    wx.navigateTo({ url: '/pages/compare-result/compare-result' });
  }
});
