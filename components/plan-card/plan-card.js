// components/plan-card/plan-card.js
// 单张方案卡：仅 3 个差异输入（退休年月 / Z / 缴费性质）+ 实时校验。
// REQ-01-PLN-001~003、REQ-01-LEG-000/001。
var D = require('../../calculator/dateUtil.js');
var PM = require('../../calculator/planModel.js');

Component({
  options: { styleIsolation: 'apply-shared' },

  properties: {
    // 方案对象 { retireYM, z, segType }
    plan: { type: Object, value: {} },
    // 展示序号（1 起）
    index: { type: Number, value: 1 },
    // 共享上下文 { gender, femaleType, birthYM }
    ctx: { type: Object, value: {} },
    // 是否允许删除（由外层按当前张数决定，D3 始终允许删除；保留属性便于提示）
    canDelete: { type: Boolean, value: true }
  },

  data: {
    errors: []
  },

  observers: {
    'plan, ctx': function () {
      // 父层数据变化（如删除重排/上下文补齐）时重算错误
      this.recheck();
    }
  },

  lifetimes: {
    attached: function () { this.recheck(); }
  },

  methods: {
    recheck: function () {
      var errs = PM.planErrors(this.data.plan, this.data.ctx, D);
      this.setData({ errors: errs });
      this.triggerEvent('errorchange', { index: this.data.index, errors: errs });
    },

    // 退休年月
    onRetire: function (e) {
      this.emitChange({ retireYM: e.detail.value, retireTouched: true });
    },
    // Z（数字输入）
    onZ: function (e) {
      this.emitChange({ z: e.detail.value });
    },
    // 缴费性质
    setSegType: function (e) {
      this.emitChange({ segType: e.currentTarget.dataset.v });
    },

    emitChange: function (patch) {
      this.triggerEvent('change', { index: this.data.index, patch: patch });
      // 下一帧由父层回写 plan 后 observers 重算；此处也立即重算一次以保证红字及时
      var merged = Object.assign({}, this.data.plan, patch);
      var errs = PM.planErrors(merged, this.data.ctx, D);
      this.setData({ errors: errs });
      this.triggerEvent('errorchange', { index: this.data.index, errors: errs });
    },

    onDelete: function () {
      this.triggerEvent('delete', { index: this.data.index });
    }
  }
});
