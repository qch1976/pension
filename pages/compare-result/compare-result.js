// pages/compare-result/compare-result.js
// Phase-1 比较结果页（D1 仅占位；比较表/CSS 条形/下钻由 D8 实现）
Page({
  data: {},

  backCompare: function () {
    wx.navigateBack({
      fail: function () {
        wx.redirectTo({ url: '/pages/compare/compare' });
      }
    });
  }
});
