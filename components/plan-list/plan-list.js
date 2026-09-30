// components/plan-list/plan-list.js
// 方案卡容器：默认 2 张、可添加至最多 3、可删除；方案卡独立草稿 pension_plans_v1。
// REQ-01-PLN-000~004。方案差异仅退休年月/Z/缴费性质。
var PM = require('../../calculator/planModel.js');

var DRAFT_KEY = 'pension_plans_v1';

Component({
  options: { styleIsolation: 'apply-shared' },

  properties: {
    // 共享上下文 { gender, femaleType, birthYM }
    ctx: { type: Object, value: {} }
  },

  data: {
    plans: [],
    addDisabled: false,
    removeHint: ''
  },

  lifetimes: {
    attached: function () {
      var saved = wx.getStorageSync(DRAFT_KEY);
      var plans;
      if (saved && Array.isArray(saved.plans) && saved.plans.length) {
        plans = saved.plans.slice(0, PM.MAX_PLANS);
      } else {
        plans = PM.initialPlans(this.data.ctx);
      }
      this.applyPlans(plans, true);
    }
  },

  observers: {
    // 共享上下文补齐/变化：对未手改过退休年月的卡补默认法定退休年月
    ctx: function (ctx) {
      if (!PM.hasContext(ctx)) return;
      var changed = false;
      var plans = this.data.plans.map(function (p) {
        if (!p.retireTouched && !p.retireYM) {
          changed = true;
          return Object.assign({}, p, { retireYM: PM.defaultRetireYM(ctx) });
        }
        return p;
      });
      if (changed) this.applyPlans(plans);
    }
  },

  methods: {
    applyPlans: function (plans, silent) {
      var addDisabled = !PM.canAdd(plans.length);
      this.setData({ plans: plans, addDisabled: addDisabled });
      this.broadcastValidity();
      if (!silent) this.persist(plans);
    },

    persist: function (plans) {
      wx.setStorageSync(DRAFT_KEY, { plans: plans });
    },

    // 子卡录入变更
    onCardChange: function (e) {
      var idx = e.detail.index;
      var patch = e.detail.patch;
      var plans = this.data.plans.slice();
      // index 为 1-based 展示序号
      plans[idx - 1] = Object.assign({}, plans[idx - 1], patch);
      this.applyPlans(plans);
    },

    onCardError: function () {
      this.broadcastValidity();
    },

    // 添加方案
    addPlan: function () {
      if (!PM.canAdd(this.data.plans.length)) return;
      var plans = this.data.plans.concat([PM.emptyPlan(this.data.ctx)]);
      this.applyPlans(plans);
      wx.showToast({ title: '已添加方案 ' + plans.length, icon: 'none' });
    },

    // 删除方案
    removePlan: function (e) {
      var idx = e.detail.index;
      var plans = this.data.plans.slice();
      var willHint = PM.belowCompareAfterRemove(plans.length);
      plans.splice(idx - 1, 1);
      this.applyPlans(plans);
      if (willHint) {
        wx.showToast({ title: '仅剩 ' + plans.length + ' 张，比较至少需 2 个不同方案', icon: 'none' });
      }
    },

    // 汇总卡级有效性并上报（D3 仅暴露；去重/开始比较在后续任务接入）
    broadcastValidity: function () {
      this.triggerEvent('validitychange', { count: this.data.plans.length });
    },

    // 对外：读取当前方案卡（供 D4+ 使用）
    getPlans: function () {
      return this.data.plans;
    }
  }
});
