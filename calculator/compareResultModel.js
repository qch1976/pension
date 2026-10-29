// calculator/compareResultModel.js
// D8（REQ-01-RES-000~004）：比较结果页纯函数视图模型。
// 数值全部直接取自 D2(共享入参)/D4(自动段)/D5(R续)/D6(回本月数双列)/D7(ROI) 模型输出，
// 本模块只做编排、字段绑定与展示派生（归一化条宽、【预估】角标、灰显、下钻/政策数据装配），
// UI 层不重算任何计发/比较数值。不依赖 wx，可在 node 断言。
'use strict';

var D = require('./dateUtil.js');
var Asm = require('./planAssembler.js');
var Rmod = require('./rContribution.js');
var PB = require('./paybackModel.js');
var ROIm = require('./roiModel.js');
var Refs = require('../constants/policyRefs.js');

var ORIGIN = PB.ORIGIN_YM; // 2026-09（仅回退缺省；BUG-02-0004 后由共享历史末月动态推导）
var FIRST_FUTURE_YM = '2027-01';

var SEG_LABEL = { enterprise: '企业职工', flexible: '灵活就业' };

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// R续 -> payback series。
// originYM：回本现金流的共同时间原点（=共享历史末月+1）；各方案 R续 按自身 windowStartYM 计算，
// 月负担按相对共同原点的偏移入桶（晚于原点的方案前段自然为 0，cashflows 已按缺 0 处理）。
function toSeries(id, plan, pMonthly, rTotal, customCYear, originYM, sharedInput) {
  var origin = originYM || ORIGIN;
  var r = Rmod.computeR(plan, customCYear, Asm.resolveWindowStart(plan, sharedInput));
  var burdens = {};
  r.monthly.forEach(function (mm) {
    burdens[D.toIndex(mm.ym) - D.toIndex(origin)] = mm.burden;
  });
  return {
    id: id,
    originYM: origin,
    T: PB.retireOffset(plan.retireYM, origin),
    burdens: burdens,
    pMonthly: pMonthly,
    rTotal: rTotal
  };
}

// 方案是否跨入 2027+（自动段含 ≥2027-01 的月份）。窗口止于退休前一月。
function planIsEstimated(plan) {
  var endIdx = D.toIndex(plan.retireYM) - 1; // 退休前一月
  return endIdx >= D.toIndex(FIRST_FUTURE_YM);
}

// 回本结果展示文本
function paybackText(res) {
  if (res.branch === 'BASELINE') return { text: '基准方案', sub: '（R续最小）' };
  if (res.branch === 'A') return { text: '退休前抵回', sub: res.ceilMonths + '个月' };
  if (res.branch === 'B') return { text: '退休后抵回', sub: res.ceilMonths + '个月' };
  return { text: '无法抵回', sub: '（该利率下）' };
}

// BUG-02-0012：ROI 计算细节下钻数据。
// 字段全部取自 roiModel.computeROI 已有产出（pMonthly/baselineMonthly/rContinued/roi/roiRounded/
// percentText/status/reason/minRequiredMonths/baselineTotalMonths/eligible/baselineEligible），
// 本函数只做展示派生（月差额、文案），不做任何计发或 ROI 重算；回本与利率属 paybackModel，仅作只读上下文。
function buildRoiDrill(it, contMonths, userRatePercent, pbRes) {
  var ok = it.status === 'ok';
  var delta = null;
  if (typeof it.pMonthly === 'number' && typeof it.baselineMonthly === 'number') {
    delta = Rmod.round2(it.pMonthly - it.baselineMonthly);
  }
  var pb = paybackText(pbRes || {});
  return {
    ok: ok,
    status: it.status || '',
    reason: ok ? '' : (it.reason || ''),
    // 只读上下文（来自 payback 视图，不参与 ROI 公式）
    userRatePercent: userRatePercent,
    paybackText: pb.text,
    paybackSub: pb.sub || '',
    // 分子 / 分母
    pMonthly: it.pMonthly,
    baselineMonthly: it.baselineMonthly,
    deltaMonthly: delta,
    rContinued: it.rContinued,
    contMonths: (contMonths == null ? null : contMonths),
    // 结果
    roiRounded: ok ? it.roiRounded : null,
    percentText: ok ? it.percentText : '',
    // 阻断依据
    minRequiredMonths: (it.minRequiredMonths == null ? null : it.minRequiredMonths),
    baselineTotalMonths: (it.baselineTotalMonths == null ? null : it.baselineTotalMonths),
    eligible: !!it.eligible,
    baselineEligible: !!it.baselineEligible
  };
}

// 下钻：候选 k 相对基准 b 的三段现金流
function drillCashflows(bSeries, kSeries) {
  var d = PB.cashflows(bSeries, kSeries);
  var origin = bSeries.originYM || ORIGIN;
  var rows = [];
  var sum1 = 0, sum2 = 0;
  for (var m = 0; m <= kSeries.T; m++) {
    var stage;
    if (m <= bSeries.T) { stage = 1; sum1 += d[m]; }
    else { stage = 2; sum2 += d[m]; }
    rows.push({
      ym: D.toYM(D.toIndex(origin) + m),
      d: Rmod.round2(d[m]),
      stage: stage
    });
  }
  return {
    monthly: rows,
    sumConcurrent: Rmod.round2(sum1),  // 并存缴费期合计
    sumOffset: Rmod.round2(sum2),      // b 退休后冲抵期合计
    deltaMonthly: Rmod.round2(kSeries.pMonthly - bSeries.pMonthly) // k 退休后月差
  };
}

// 主入口：由共享引擎入参 + 方案数组 + 用户年利率，构建整页视图。
function buildView(sharedInput, plans, userAnnualRate) {
  var rate = typeof userAnnualRate === 'number' ? userAnnualRate : 0;
  // BUG-02-0004：共同时间原点＝共享历史末月+1（无历史段回退 2026-09）。
  var originYM = Asm.defaultWindowStart(sharedInput);

  // 1) ROI（内含继续/停保两情形引擎结果、eligible、R续）
  var roiAll = ROIm.computeAll(sharedInput, plans);
  var items = roiAll.items; // 已带 id

  // 2) 组装 series 并跑回本双列
  var series = items.map(function (it) {
    return toSeries(it.id, it.plan, it.pMonthly, it.rContinued, sharedInput.customCYear, originYM, sharedInput);
  });
  var dbl = PB.computeDouble(series, rate);

  // 3) 逐方案列
  var columns = items.map(function (it, i) {
    var s = series[i];
    var rinfo = Rmod.computeR(it.plan, sharedInput.customCYear, Asm.resolveWindowStart(it.plan, sharedInput));
    var contRes = it.continueResult;

    var pb0 = dbl.at0.byId[it.id];
    var pbU = dbl.atUser.byId[it.id];

    var col = {
      id: it.id,
      name: '方案' + (i + 1),
      eligible: !!it.eligible,
      grey: !it.eligible,
      estimated: planIsEstimated(it.plan),

      retireYM: it.plan.retireYM,
      segType: it.plan.segType,
      segLabel: SEG_LABEL[it.plan.segType] || it.plan.segType,
      z: it.plan.z,

      // 缴费月数（继续缴费窗口）
      contMonths: rinfo.months,

      // P月 + 三分项（直接绑定引擎结果，UI 不重算）
      pMonthly: it.pMonthly,
      jBasic: contRes.pension.J基础,
      jAccount: contRes.pension.J账户,
      jTransit: contRes.pension.J过渡,

      // R续
      rContinued: it.rContinued,
      monthlyBurden: rinfo.monthlyBurden,

      // 回本月数双列
      pb0: paybackText(pb0),
      pb0Branch: pb0.branch,
      pbU: paybackText(pbU),
      pbUBranch: pbU.branch,

      // ROI
      roiStatus: it.status,
      roiText: it.status === 'ok' ? it.percentText : '不可用',
      roiBlocked: it.status !== 'ok',
      rank: it.rank || null
    };
    return col;
  });

  // 4) 归一化条宽（仅以合格方案为基准，不错位；宽度%数据归一化，无硬编码）
  var eligCols = columns.filter(function (c) { return c.eligible; });
  var maxP = Math.max.apply(null, columns.map(function (c) { return c.pMonthly; }).concat([1]));
  var okRois = columns.filter(function (c) { return c.roiStatus === 'ok' && c.roiText !== '不可用'; });
  var maxRoi = Math.max.apply(null, items
    .filter(function (it) { return it.status === 'ok'; })
    .map(function (it) { return it.roi; })
    .concat([1e-9]));

  columns.forEach(function (c, i) {
    c.barP = clamp(c.pMonthly / maxP * 100, 0, 100);
    var it = items[i];
    if (it.status === 'ok') c.barRoi = clamp(it.roi / maxRoi * 100, 0, 100);
    else c.barRoi = 0;
  });

  // 5) 下钻数据（每方案：历史段/视同/账户/customCYear/J三分项/三段现金流）
  var baselineSeries = series.filter(function (s) { return s.id === dbl.baselineId; })[0];
  var drills = items.map(function (it, i) {
    var contRes = it.continueResult;
    var s = series[i];
    var col = columns[i];
    var cf = s.id === baselineSeries.id ? null : drillCashflows(baselineSeries, s);
    return {
      id: it.id,
      history: it.continueInput.segments.filter(function (g) {
          return D.toIndex(g.endYM) < D.toIndex(originYM);
        })
        .map(function (g) {
          return {
            type: g.type,
            typeLabel: g.type === 'enterprise' ? '企业' : '灵活',
            startYM: g.startYM, endYM: g.endYM, baseMonthly: g.baseMonthly
          };
        }),
      deemed: { start: it.continueInput.deemedStartYM, end: it.continueInput.deemedEndYM,
                text: it.continueInput.deemedStartYM
                  ? it.continueInput.deemedStartYM + ' 至 ' + it.continueInput.deemedEndYM
                  : '无' },
      account: {
        balance: it.continueInput.accountBalanceManual,
        balanceYM: it.continueInput.accountBalanceManualYM
      },
      customCYear: Object.keys(it.continueInput.customCYear || {}).map(function (k) {
        return { year: k, value: it.continueInput.customCYear[k] };
      }),
      pension: {
        total: it.pMonthly,
        jBasic: contRes.pension.J基础,
        jAccount: contRes.pension.J账户,
        jTransition: contRes.pension.J过渡
      },
      cashflow: cf,
      // BUG-02-0012：ROI 计算细节（字段源自 roiModel 实际产出，UI 不重算）
      roi: buildRoiDrill(it, col ? col.contMonths : null, (rate * 100).toFixed(2), dbl.atUser.byId[it.id])
    };
  });

  // 6) 政策弹窗清单（取自 constants/policyRefs）
  var policyKeys = ['P01', 'P04', 'P05', 'P12'];
  var policies = policyKeys.map(function (k) {
    var r = Refs[k];
    return { id: r.id || k, name: r.name, docNo: r.docNo, clause: r.clause, url: r.url };
  });

  return {
    baselineId: dbl.baselineId,
    userAnnualRate: rate,
    userRatePercent: (rate * 100).toFixed(2),
    columns: columns,
    drills: drills,
    policies: policies,
    allEligible: columns.every(function (c) { return c.eligible; })
  };
}

// BUG-02-0010：结果页容错边界。buildView 仍为纯函数（坏输入直接抛错，供单测/前置校验复用）；
// buildViewSafe 捕获引擎/组装异常，返回 { ok:false, error } 供页面展示可读文案，避免整页白屏。
function buildViewSafe(sharedInput, plans, userAnnualRate) {
  try {
    return { ok: true, view: buildView(sharedInput, plans, userAnnualRate) };
  } catch (e) {
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  }
}

module.exports = {
  buildView: buildView,
  buildViewSafe: buildViewSafe,
  planIsEstimated: planIsEstimated,
  toSeries: toSeries,
  drillCashflows: drillCashflows,
  buildRoiDrill: buildRoiDrill,
  SEG_LABEL: SEG_LABEL,
  ORIGIN: ORIGIN
};
