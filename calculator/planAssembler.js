// calculator/planAssembler.js
// D4（REQ-01-PLN-006）：把方案输入组装为 Phase-0 引擎入参，并调用引擎计算 P月。
// 规则：
//   - 自动缴费段区间 [2026-09, 退休前一月]；逐月 B_m = Z_k × C_m；
//     C_m 与引擎完全同源：pensionEngine.denominatorFor(yearY, customCYear).c
//       （2026=官方12116；2027+ 未公布 -> assumed 沿用12116，裁定 Q7；customCYear 若有亦同口径）
//     => 保证引擎月指数 min(3, B/C) 恰为用户 Z（Z 已在方案卡限定 0.60~3.00，不触发封顶）。
//   - 段类型：企业职工 enterprise / 灵活就业 flexible。
//   - 历史段（≤2026-08，来自共享区，已强制边界）与自动段首尾相接、无重叠。
//   - 直接调用 pensionEngine.calculate()，不新增/不改写任何计发公式。
// 纯函数、不依赖 wx，可在 node 直接断言。
'use strict';

var D = require('./dateUtil.js');
var P = require('../constants/policyData.js');
var Engine = require('./pensionEngine.js');

// 比较窗口起点：2026-09（含当月）；与 spec PLN-006 / Q9 一致。
var WINDOW_START_YM = '2026-09';

// 取某年缴费指数分母 C（与引擎同源），customCYear 透传以保证 B/C=Z 恒等。
function denominatorForYear(yearY, customCYear) {
  var info = Engine.denominatorFor(yearY, customCYear || {});
  return info.c;
}

// 生成自动缴费段：遍历 [2026-09, 退休前一月]，逐月 B=Z×C，连续相同 B 合并为一段。
// 返回引擎 segments 片段数组 [{ type, startYM, endYM, baseMonthly }]；区间为空时返回 []。
function buildAutoSegments(plan, customCYear) {
  var z = parseFloat(plan.z);
  if (!(z >= 0.60 && z <= 3.00)) {
    throw new Error('方案 Z 值非法（须为 0.60~3.00 的数字）');
  }
  if (plan.segType !== 'enterprise' && plan.segType !== 'flexible') {
    throw new Error('方案缴费性质非法（须为 enterprise/flexible）');
  }
  if (!/^\d{4}-\d{2}$/.test(plan.retireYM || '')) {
    throw new Error('方案退休年月缺失或格式非法（YYYY-MM）');
  }

  var startIdx = D.toIndex(WINDOW_START_YM);
  var endIdx = D.toIndex(plan.retireYM) - 1; // 缴到退休前一月
  if (endIdx < startIdx) return [];

  var segs = [];
  var cur = null; // { startIdx, endIdx, base }
  for (var i = startIdx; i <= endIdx; i++) {
    var yearY = D.yearOf(i);
    var c = denominatorForYear(yearY, customCYear);
    if (!(typeof c === 'number' && isFinite(c) && c > 0)) {
      throw new Error('年度 ' + yearY + ' 的缴费指数分母 C 缺失/非正，无法生成 B=Z×C');
    }
    // 中间不四舍五入，保留精确基数；展示/引擎均按此计算。
    var base = z * c;
    if (cur && cur.base === base) {
      cur.endIdx = i;
    } else {
      if (cur) {
        segs.push({
          type: plan.segType,
          startYM: D.toYM(cur.startIdx),
          endYM: D.toYM(cur.endIdx),
          baseMonthly: cur.base
        });
      }
      cur = { startIdx: i, endIdx: i, base: base };
    }
  }
  if (cur) {
    segs.push({
      type: plan.segType,
      startYM: D.toYM(cur.startIdx),
      endYM: D.toYM(cur.endIdx),
      baseMonthly: cur.base
    });
  }
  return segs;
}

// 浅克隆共享入参（segments 单独复制），供单方案覆盖，避免污染共享对象。
function cloneSharedInput(sharedInput) {
  var input = {};
  Object.keys(sharedInput).forEach(function (k) { input[k] = sharedInput[k]; });
  input.segments = (sharedInput.segments || []).map(function (s) {
    return { type: s.type, startYM: s.startYM, endYM: s.endYM, baseMonthly: s.baseMonthly };
  });
  return input;
}

// 组装单个方案的完整引擎入参 = 共享历史入参（退休无关字段）+ 本方案退休年月 + 自动缴费段。
function assemblePlanInput(sharedInput, plan) {
  if (!sharedInput) throw new Error('缺少共享数据区入参');
  var input = cloneSharedInput(sharedInput);

  // 自动段与历史段拼接（历史段截至 2026-08，自动段 2026-09 起，无重叠）。
  var autoSegs = buildAutoSegments(plan, sharedInput.customCYear);
  input.segments = input.segments.concat(autoSegs);

  // 方案级退休年月覆盖共享（共享区本不含方案退休年月）。
  input.retireYM = plan.retireYM;
  return input;
}

// 组装并调用引擎，返回完整引擎结果（pension.total 即 P月，三分项 J基础/J账户/J过渡 保留下钻）。
function computePlan(sharedInput, plan) {
  var input = assemblePlanInput(sharedInput, plan);
  return Engine.calculate(input);
}

module.exports = {
  WINDOW_START_YM: WINDOW_START_YM,
  denominatorForYear: denominatorForYear,
  buildAutoSegments: buildAutoSegments,
  assemblePlanInput: assemblePlanInput,
  computePlan: computePlan
};
