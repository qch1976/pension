// pages/entry/entry.js
// Phase-1 选项页：基本计算 / 方案比较（REQ-01-OPT-000/002；REQ-01-NAV-001）
Page({
  data: {},

  // 基本计算：单方案测算，进入 Phase-0 输入页（redirectTo，避免返回回选项页干扰 Phase-0 栈）
  goBasic: function () {
    wx.redirectTo({
      url: '/pages/index/index',
      fail: function () {
        wx.showToast({ title: '打开失败，请重试', icon: 'none' });
      }
    });
  },

  // 方案比较：进入方案输入页
  goCompare: function () {
    wx.redirectTo({
      url: '/pages/compare/compare',
      fail: function () {
        wx.showToast({ title: '打开失败，请重试', icon: 'none' });
      }
    });
  }
});
