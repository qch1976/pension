# BUG-02-0016 实现规格：回本月数新增「R续=0（停保）」基准两行（REQ-02-CAL-002）

- 性质：**需求变更**（非缺陷）
- 基线：origin/master `bfd8e88`
- 读者：worker3（developer）实现；worker4（tester）独立验收
- 关联：REQ-02-CAL-002；testcase `TST-02-CT-1044`（模型级）/ `TST-02-MT-9006`（项目主手测）
- 依据：项目主原话「『方案比较』输出页 → 『比较结果』 → 回本月数：现在仅以 R续 最小的方案为基准。要求增加以 R续=0 方案（即停保情形）为基准的两行显示，利率分别用 利率=0 和『比较结果』页面里的利率输入值，这样可以算出全部方案的回本时间，与 ROI 的算法基线保持一致。」

---

## 1. 现有算法位置（已复核，行号基于 bfd8e88）

| 关注点 | 位置 |
|---|---|
| 回本核心算法（现金流/三分支/双利率） | `calculator/paybackModel.js`：`cashflows()` L37、`futureValue()` L48、`branchA()` L55、`branchBMonths()` L65、`evaluateOne()` L77、`selectBaseline()` L113、`computeAtRate()` L126、`computeDouble()` L136 |
| 基准选择（现状＝argmin R续） | `paybackModel.selectBaseline()` L113；由 `computeAtRate()` L127 调用 |
| series 组装 + 视图绑定 | `calculator/compareResultModel.js`：`toSeries()` L25、`buildView()` L117 起；`dbl = PB.computeDouble(series, rate)` L130；列字段 `pb0/pbU` L167-171 |
| 结果页行渲染 | `pages/compare-result/compare-result.wxml` L80-95（「回本月数（0%）」「回本月数（{userRatePercent}%）」两行） |
| 停保基准构造（**复用对象**） | `calculator/roiModel.js`：`buildCaseInput(sharedInput, plan, isContinue)` L27-46；`computeROI()` L52-75（产出 `baselineMonthly`、`baselineResult`、`baselineEligible`）；`computeAll()` L107-119 |

> 结论：**不要新写第二套回本逻辑**。停保基准的输入构造与 P月已由 `roiModel` 产出，回本现金流已由 `paybackModel` 提供，二者拼装即可。

## 2. 基准定义（与 ROI 严格同源）

停保基准 = **逐方案** 0 投入情形（不是新增第 4 个方案列）：

```js
// 已有能力，直接调用，勿复制
var stopIn  = ROIm.buildCaseInput(sharedInput, plan, false); // 仅历史段 + futureMonthlyRate=null + retireYM=plan.retireYM
var stopRes = it.baselineResult;      // computeROI 已算好，勿重算
var pStop   = it.baselineMonthly;     // 停保 P月（与 ROI 基线同一数值）
```

- 停保月负担恒 `0`。
- `T_b = T_k`（同一退休年月），因此 spec §9.3 的「并存缴费期」段为空，现金流全部落在「b 退休后冲抵」。

**与 ROI 的勾稽关系（必须写死在实现里）**：
```
ROI_k = (P月_k^继续 − P月_k^停保) / R续_k
新回本行 ΔP_k = P月_k^继续 − P月_k^停保        ← 同一个减数
```
⇒ 实现时必须读取 `it.pMonthly` 与 `it.baselineMonthly`（`computeROI` 的输出），**禁止**另建一次停保引擎调用或复制公式产生可能不一致的第二来源。

## 3. 新增两行定义

| 行 | 基准 | 利率 | 覆盖范围 |
|---|---|---|---|
| 回本月数（停保基准·利率 0%） | 逐方案停保 b₀ | `0` | **全部方案**（含 R续 最大者） |
| 回本月数（停保基准·页面利率 x%） | 逐方案停保 b₀ | 页面利率输入值（`view.userRate`） | 同上 |

原有两行（基准=argmin R续，0% 与 页面利率）**保留不替换**，共 4 行。

## 4. 计算式（沿用 §9.3，仅换基准）

```
i    = r / 12
FV_k = Σ_{m=0..T_k} (B_m^k × rate_k) × (1+i)^(T_k−m)     // 停保侧月负担=0，故 d_m = B_m^k×rate_k
ΔP_k = P月_k^继续 − P月_k^停保
r = 0 : n = FV_k / ΔP_k
r > 0 : n = −ln(1 − FV_k·i/ΔP_k) / ln(1+i)
展示   : 向上取整到整月；ΔP_k ≤ 0 或 1 − FV_k·i/ΔP_k ≤ 0 → 「该利率下无法抵回」
```

> 因 `T_b = T_k`，分支 A（退休前已抵回）在本口径下**不会触发**；实现可只走分支 B/C，但建议复用 `branchBMonths()` 以免除零/负值分支分叉。

## 5. 建议改动（最小面）

1. `calculator/paybackModel.js`：新增 `computeStopBaseline(series, annualRate)`
   - 入参 series 每项需带 `pStop`（= `it.baselineMonthly`）与 `stopEligible`（= `it.baselineEligible`）。
   - 复用 `futureValue/branchBMonths`；输出结构对齐 `computeAtRate`：`{ mode:'stop', annualRate, byId:{ [id]: {branch, months, ceilMonths, FV, dP} } }`。
   - **不得改动** `selectBaseline/computeAtRate/computeDouble` 现有语义（数值冻结）。
2. `calculator/compareResultModel.js`：`buildView` 内
   - series 增加 `pStop: it.baselineMonthly`、`stopEligible: it.baselineEligible`；
   - 计算 `stopDbl = { at0: PB.computeStopBaseline(series, 0), atUser: PB.computeStopBaseline(series, rate) }`；
   - 列字段新增 `pbS0/pbSU`（复用 `paybackText()` 文案函数，新增 `mode:'stop'` 文案分支）。
3. `pages/compare-result/compare-result.wxml`：在现有两行后追加两行（结构照抄 L80-95），标签为
   `回本月数（停保基准·0%）` 与 `回本月数（停保基准·{{view.userRatePercent}}%）`。
4. `pages/compare-result/compare-result.js`：仅透传，无需新逻辑。

**不改**：`pensionEngine`、`planAssembler`、`rContribution`、`roiModel` 的计算口径（`buildCaseInput` 保持原样，仅被读取）。

## 6. 边界处理（必须实现）

| # | 场景 | 期望显示 |
|---|---|---|
| 1 | 方案 R续 = 0（该方案本身就是停保） | 该列两行显示 **「—（即停保基准）」**，不参与排名 |
| 2 | 永不回本（ΔP_k ≤ 0 或年金现值不足） | **「该利率下无法抵回」**（分支 C） |
| 3 | 停保基准不满足最低缴费年限（`baselineEligible=false`） | 该列两行 **「不可用（停保基准不足最低缴费年限）」**，与 ROI blocked 文案口径一致 |
| 4 | 页面利率 = 0 | 新两行同值，**仍显示两行**（不合并，与既有双列行为一致） |
| 5 | 页面利率为空/null | 按 `0` 处理（沿用 `buildView` 现有 `typeof rate === 'number' ? rate : 0`） |
| 6 | 方案灰显（`grey`/不可按月领） | 新两行同步灰显，文案同边界 3 |

## 7. 数值口径硬约束

- **不得改动** 现有 ROI 与既有两行回本月数的任何结果（`computeDouble` 语义冻结，回归必须 ±0）。
- 本次仅**新增两行视图**，旧「基准」徽标仍标识 argmin R续 方案；停保基准**不占列、不加徽标**。

## 8. 需补测试

- 模型级：`developer_test/TST-02-CT-1044/stop-baseline-payback-check.js`（已建占位，断言 A1~A10 见 `docs/testcase_design/TST-02-CT-1044-stop-baseline-payback.md`）。
- 项目主手测：`TST-02-MT-9006`（GUI 目视两行呈现与数值），与本规格并行存在。

## 9. 给 tester 的独立验收要点

1. 两行新行出现且标签正确；覆盖全部方案列。
2. 数值与独立复算一致（按 §4 公式，脚本自实现，不读被测中间量）。
3. 勾稽：新行基准 P月 === `computeROI().baselineMonthly`。
4. 边界 1/2/3/4 显示正确。
5. 回归：原有两行与改动前完全一致。
