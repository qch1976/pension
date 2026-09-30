// pages/compare/compare.js
// Phase-1 方案输入页。D2：承载共享历史数据区组件（≤2026-08，三方案共用、只录一次）。
// 关联 REQ-01-SHR-000~003；方案卡（D3）、开始比较（D4~D8）后续接入。
Page({
  data: {},

  // redirectTo 进入后无返回栈：返回选项页
  backEntry: function () {
    wx.redirectTo({ url: '/pages/entry/entry' });
  }
});
