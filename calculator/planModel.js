// calculator/planModel.js
// Phase-1 方案卡纯函数模型与校验：不依赖 wx，node 可断言。
// 关联 REQ-01-PLN-000~004（输入部分）、REQ-01-LEG-000/001。
// 方案差异仅 3 项：退休年月、2026-09 起 Z 值、缴费性质（spec §3 SCOPE-002 / §6 PLN）。
'use strict';

var Schedule = require('./retireSchedule.js');

var MAX_PLANS = 3;
var MIN_PLANS_TO_COMPARE = 2;
var WINDOW_START_YM = '2026-09'; // 比较窗口起点（退休年月不得早于此）
var Z_MIN = 0.60;
var Z_MAX = 3.00;

// 共享上下文是否足以确定退休合法区间（需性别/出生年月；女性还需身份）
function hasContext(ctx) {
  if (!ctx || !ctx.gender || !ctx.birthYM) return false;
  if (ctx.gender === 'female' && !ctx.femaleType) return false;
  return true;
}

// 法定退休年月（方案卡默认值）；上下文不足返回 ''
function defaultRetireYM(ctx) {
  if (!hasContext(ctx)) return '';
  var key = Schedule.keyOf(ctx.gender, ctx.femaleType);
  return Schedule.statutoryRetireYM(key, ctx.birthYM);
}

// 退休年月合法区间（年月字符串）；下限 = flexibleRange.min 与比较窗口起点 2026-09 取严。
// 返回 { minYM, maxYM, statutoryYM } 或 null（上下文不足）。
function legalRange(ctx, D) {
  if (!hasContext(ctx)) return null;
  var key = Schedule.keyOf(ctx.gender, ctx.femaleType);
  var range = Schedule.flexibleRange(key, ctx.birthYM);
  var minIdx = Math.max(range.min, D.toIndex(WINDOW_START_YM));
  return {
    minIdx: minIdx,
    maxIdx: range.max,
    minYM: D.toYM(minIdx),
    maxYM: D.toYM(range.max),
    statutoryYM: D.toYM(range.statutory)
  };
}

// 一张空白方案卡（retireYM 预填法定退休年月；Z/性质留空）
function emptyPlan(ctx) {
  return {
    retireYM: defaultRetireYM(ctx),
    z: '',
    segType: '',
    retireTouched: false // UI 态：用户是否手改过退休年月（避免上下文刷新覆盖）
  };
}

// 默认方案卡列表（2 张）
function initialPlans(ctx) {
  return [emptyPlan(ctx), emptyPlan(ctx)];
}

// 空卡判定：3 项录入全部为空（PLN-004：不计入方案数）。
// 注：retireYM 在上下文充足时会预填法定值，故仅当 retireYM 也为空才算全空。
function isEmptyPlan(plan) {
  plan = plan || {};
  return !plan.retireYM && (plan.z === '' || plan.z == null) && !plan.segType;
}

// 校验 Z：允许空（空由“未填全/空卡”处理）；非空则须数字、有限、0.60~3.00（PLN-002）。
// 返回错误文案或 null。
function validateZ(z) {
  if (z === '' || z == null) return null;
  var n = Number(z);
  if (String(z).trim() === '' || !isFinite(n)) {
    return 'Z 值须为数字（目标月缴费指数）';
  }
  // 规范化比较：0.60 与 0.6 等价；保留两位口径
  if (n < Z_MIN - 1e-9 || n > Z_MAX + 1e-9) {
    return 'Z 值须在 0.60~3.00 之间（当前 ' + n + '），越界不能比较';
  }
  return null;
}

// 校验缴费性质：空合法（空卡/未填全）；非空须 enterprise|flexible（PLN-003）。
function validateSegType(segType) {
  if (!segType) return null;
  if (segType !== 'enterprise' && segType !== 'flexible') {
    return '缴费性质取值非法';
  }
  return null;
}

// 校验退休年月：
//  - 空：返回 null（由“未填全”处理）
//  - 非空：格式合法、在 flexibleRange 内（与政策区间一致）、不早于 2026-09（LEG-000/001）。
function validateRetireYM(retireYM, ctx, D) {
  if (!retireYM) return null;
  if (!/^\d{4}-\d{2}$/.test(retireYM)) return '退休年月格式应为 YYYY-MM';
  var range = legalRange(ctx, D);
  if (!range) return '请先在共享数据区填写性别、出生年月（女性含身份），以确定退休区间';
  var idx = D.toIndex(retireYM);
  if (idx < range.minIdx) {
    return '退休年月 ' + retireYM + ' 早于合法下限 ' + range.minYM +
      '（弹性提前不低于原法定年龄且不早于 ' + WINDOW_START_YM + '），不能比较';
  }
  if (idx > range.maxIdx) {
    return '退休年月 ' + retireYM + ' 晚于合法上限 ' + range.maxYM + '（弹性延迟最多 3 年），不能比较';
  }
  return null;
}

// 单卡完整校验：返回错误文案数组（[]=无错误）。空卡返回 []（其“不计入方案数”由调用方判断）。
function planErrors(plan, ctx, D) {
  var errors = [];
  var e;
  if ((e = validateZ(plan.z))) errors.push(e);
  if ((e = validateSegType(plan.segType))) errors.push(e);
  if ((e = validateRetireYM(plan.retireYM, ctx, D))) errors.push(e);
  return errors;
}

// 非空但未填全判定（PLN-004 反面：有任意一项但 3 项未齐）。
function isPartialPlan(plan) {
  plan = plan || {};
  if (isEmptyPlan(plan)) return false;
  var zOk = !(validateZ(plan.z));
  var hasZ = plan.z !== '' && plan.z != null && zOk;
  return !plan.retireYM || !hasZ || !plan.segType;
}

// 一张卡是否“有效可比较”：非空 + 三项合法填全。
function isValidPlan(plan, ctx, D) {
  plan = plan || {};
  if (isEmptyPlan(plan)) return false;
  if (planErrors(plan, ctx, D).length) return false;
  // 三项须填全：z 非空且合法（validateZ 对空不报错，需在此显式要求）、退休年月/性质齐全
  var zFilled = plan.z !== '' && plan.z != null && validateZ(plan.z) === null;
  return !!plan.retireYM && zFilled && !!plan.segType;
}

// 方案区：是否可再添加（未达 3 张）
function canAdd(count) { return count < MAX_PLANS; }

// 删除后是否低于比较所需数量（用于提示，不阻止删除）
function belowCompareAfterRemove(count) {
  return (count - 1) < MIN_PLANS_TO_COMPARE;
}

module.exports = {
  MAX_PLANS: MAX_PLANS,
  MIN_PLANS_TO_COMPARE: MIN_PLANS_TO_COMPARE,
  WINDOW_START_YM: WINDOW_START_YM,
  Z_MIN: Z_MIN,
  Z_MAX: Z_MAX,
  hasContext: hasContext,
  defaultRetireYM: defaultRetireYM,
  legalRange: legalRange,
  emptyPlan: emptyPlan,
  initialPlans: initialPlans,
  isEmptyPlan: isEmptyPlan,
  isPartialPlan: isPartialPlan,
  isValidPlan: isValidPlan,
  validateZ: validateZ,
  validateSegType: validateSegType,
  validateRetireYM: validateRetireYM,
  planErrors: planErrors,
  canAdd: canAdd,
  belowCompareAfterRemove: belowCompareAfterRemove
};
