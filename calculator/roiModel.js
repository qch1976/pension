// calculator/roiModel.js
// D7（REQ-01-CAL-004）：ROI——逐方案「0投入（停保）」基准 + 不足最低缴费年限阻断（Q5）。
// 严格依据 spec §9.4：
//   对每方案 k 按【其自身退休年龄】构造 2026-09 后 0 缴费情形（历史/视同/账户锚点不变），
//   由 Phase-0 引擎算 P月基准_k（不占用户方案名额）。
//   ROI_k = (P月_k − P月基准_k) / R续_k，无量纲、保 4 位、展示百分比。
//   停保基准不满足按月领取条件 => ROI 不计算（blocked），红字提示，不参与排名。
// 纯函数、不依赖 wx。
'use strict';

var Engine = require('./pensionEngine.js');
var Asm = require('./planAssembler.js');
var Rmod = require('./rContribution.js');

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function round4(n) { return Math.round((n + Number.EPSILON) * 10000) / 10000; }

// 深/浅克隆共享入参。引擎入参的 segments 等为数组，需独立复制以免污染。
function cloneSharedInput(sharedInput) {
  var cp = JSON.parse(JSON.stringify(sharedInput));
  return cp;
}

// 构造方案 k 的引擎入参。
// continue=true : 并入自动段（D4）；false : 仅保留 ≤2026-08 历史段（停保），并把 retireYM 设为方案值。
function buildCaseInput(sharedInput, plan, isContinue) {
  var inp = cloneSharedInput(sharedInput);
  inp.retireYM = plan.retireYM;
  if (isContinue) {
    var autoSegs = Asm.buildAutoSegments(plan, inp.customCYear);
    inp.segments = inp.segments.concat(autoSegs);
  }
  // 停保：segments 保持共享历史段（其 endYM≤2026-08），不追加自动段。
  return inp;
}

// 计算单方案 ROI。
// sharedInput: D2 共享区产出的引擎基础入参（含历史 segments/customCYear 等）；
// plan: { retireYM, z, segType }（P月继续情形可外供，否则现场用引擎计算）。
// 返回:
//   正常  { status:'ok', pMonthly, baselineMonthly, rContinued, roi, roiRounded, percentText,
//           eligible, baselineEligible, continueInput, baselineInput, continueResult, baselineResult }
//   阻断  { status:'blocked', reason, baselineMonthly:null, roi:null, ... }
function computeROI(sharedInput, plan) {
  var contIn = buildCaseInput(sharedInput, plan, true);
  var baseIn = buildCaseInput(sharedInput, plan, false);

  var contRes = Engine.calculate(contIn);
  var baseRes = Engine.calculate(baseIn);

  var pMonthly = contRes.pension.total;
  var baselineMonthly = baseRes.pension.total;
  var rCont = Rmod.computeR(plan, sharedInput.customCYear).total;

  var out = {
    plan: plan,
    continueInput: contIn,
    baselineInput: baseIn,
    continueResult: contRes,
    baselineResult: baseRes,
    pMonthly: round2(pMonthly),
    baselineMonthly: round2(baselineMonthly),
    rContinued: round2(rCont),
    eligible: contRes.meta.eligible,
    baselineEligible: baseRes.meta.eligible,
    minRequiredMonths: baseRes.meta.minRequiredMonths,
    baselineTotalMonths: baseRes.meta.totalMonths
  };

  // 阻断：停保基准不满足按月领取条件
  if (!baseRes.meta.eligible) {
    out.status = 'blocked';
    out.roi = null;
    out.roiRounded = null;
    out.percentText = null;
    out.reason = '0投入基准不满足按月领取条件，ROI不可用';
    return out;
  }

  if (!(rCont > 0)) {
    // 无继续缴费（R续=0），ROI 无定义
    out.status = 'blocked';
    out.roi = null;
    out.roiRounded = null;
    out.percentText = null;
    out.reason = '继续缴费为0，ROI不可用';
    return out;
  }

  var roi = (pMonthly - baselineMonthly) / rCont;
  out.status = 'ok';
  out.roi = roi;
  out.roiRounded = round4(roi);
  out.percentText = (roi * 100).toFixed(2) + '%';
  return out;
}

// 批量计算并排名（仅 ok 者参与；按 ROI 降序）。
function computeAll(sharedInput, plans) {
  var items = plans.map(function (p, i) {
    var r = computeROI(sharedInput, p);
    r.id = p.id || ('p' + i);
    return r;
  });
  var ranked = items
    .filter(function (x) { return x.status === 'ok'; })
    .slice()
    .sort(function (a, b) { return b.roi - a.roi; });
  ranked.forEach(function (x, idx) { x.rank = idx + 1; });
  return { items: items, ranking: ranked.map(function (x) { return { id: x.id, rank: x.rank, roi: x.roiRounded }; }) };
}

module.exports = {
  buildCaseInput: buildCaseInput,
  computeROI: computeROI,
  computeAll: computeAll,
  round2: round2,
  round4: round4
};
