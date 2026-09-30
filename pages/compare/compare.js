// pages/compare/compare.js
// Phase-1 方案输入页。
//  D2：共享历史数据区组件（≤2026-08，三方案共用、只录一次）。
//  D3：方案卡组件（1~3 个方案，3 项差异 + 增删 + Z/区间校验）。
Page({
  data: {
    ctx: { gender: '', femaleType: '', birthYM: '' }
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

  // redirectTo 进入后无返回栈：返回选项页
  backEntry: function () {
    wx.redirectTo({ url: '/pages/entry/entry' });
  }
});
