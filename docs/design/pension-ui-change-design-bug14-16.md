# pension 北京养老金小程序 — Bug14/15/16 架构定稿备忘录

- 日期：2026-09-22（Asia/Shanghai）
- 本轮范围：**仅调研 + 定稿，不改业务代码、不跑 GUI。**
- 项目根（Windows）：`C:\Users\Administrator\Desktop\Wechat projects\pension`
- 上一轮设计：`pension-ui-change-design.md`（Bug5~13，服务器已实施，spec 已合 V1.3）
- 复核方式：经 `win-ssh.sh` 拉取 `docs/specification.md`、`docs/policy-verification-rchu-rbu-2007-21-31.md`、`calculator/pensionEngine.js`、`calculator/inputPageModel.js`、`pages/index/index.{js,wxml,wxss}`、`pages/result/result.{js,wxml,wxss}`、`app.wxss`、`constants/policyData.js`、`autotest/output-assert.js`，并在 Linux node v22.22 下用 My-Case 两案**实跑当前引擎**、再用定稿新口径脚本**独立复算勾稽**取证。本文数值均来自实跑，未编造文号/数字。

---

## 0. 三项速览

| 项 | 现状判定（一句话） | 定稿核心 |
|---|---|---|
| 14 | 年度账 `zYear = Xn ÷ C全年(月分母×12)`：参保首年（2000 仅窗口内 2 月）、退休年（2033 仅 6 月）被 12 个月分母稀释，得 0.4458 / 0.3000（案1），与该年月指数 2.6747 / 0.6000 口径不一致 | 年指数改为 **Σ窗口月z ÷ 当年应缴月数（windowMonths）**，等价 `Xn ÷ (C月 × 应缴月数)`；整年 12 月时与旧式相等；边界年不再稀释；汇总勾稽改为 Σ(Z年×应缴月)÷K = Z实 |
| 15 | `inputPageModel.js` 缺省 `entryMode:'month'`（分段月度录入） | 缺省改为 `'year'`（年度模式/yearRows）；清空后缺省同样是年度；**已存草稿按草稿中的 entryMode 回填，不受影响** |
| 16 | 输入页遮罩在 `navigateTo` 前就被代码关闭，result 页 onLoad→首帧期间无遮罩，用户只见"短转圈→白断档→结果" | 输入页**跳转前不再关遮罩**（失败/返回路径才关）；result 页首帧前显示**同名同款遮罩**；遮罩样式上移 `app.wxss` 保证两页像素级一致，异常路径均有关闭 |

**Bug14 结论速答（用户正确，工程定稿照改）**：北京 21 号文附件一只定义了 `Z实=Σ(X年/C上一年)÷N应缴`、`X年=年度各月缴费工资基数之和`，未逐字规定"窗口边界年"的分母取几个月；但官方体系在 Z补贴（31 号文第二条(三)）中有"不满整年度的按实际工作月数计算"的明确折算原则。当前引擎把参保首年/退休年的非整年指数按全年 12 月分母稀释（2000→0.4458、2033 案1→0.3000），与 Z实总口径 `Σ月z÷应缴月数 K` 不自洽，**属于 bug**。定稿：部分缴费年的年指数 = 该年应缴窗口内月指数之和 ÷ **应缴月数**（缺缴/断缴规则见 §1.4），2000 年 **0.4458→2.6747**，2033 年案1 **0.3000→0.6000**、案2 **1.5000→3.0000**；全部整年行（含 2026 的 2.2000/3.0000）数值不变；新口径独立复算勾稽 **Z实=2.4075 / 2.9095** 保持不变。

---

## 1. Bug14：非整年 Z实指数 Xn/C(n−1) 口径修正

### 1.1 现状（源码核实，`calculator/pensionEngine.js`）

- `buildAnnualIndexLedger(monthlyDetails, windowStartIdx, lastContribIdx, retireIdx, customCYear)`（现第 263~305 行）：
  - 年内只遍历 `windowStartIdx..lastContribIdx` 范围内的月份，`windowMonths` 按实际落入窗口的月数累计（2000 年=2，2033 年=6，其余=12；1992~1999=0）；
  - 但年指数一律用**全年分母**：
    ```js
    var cAnnual = cMonthly != null ? round2(cMonthly * 12) : null;
    zYear    = round4(xAnnual / cAnnual);          // ← 稀释点
    zMonthAvg = round4(sumMonthZ / 12);            // ← 同为 12 月口径
    ```
  - 2000 年：Xn=6142.00，C1999 年=13778.04（月分母 1148.17×12）→ **zYear=0.4458**；
  - 2033 年：案1 Xn=42973.20 → **zYear=0.3000**；案2 Xn=214866.00 → **zYear=1.5000**。
- Z实主汇总（calculate 主循环，现第 455~550 行）口径是**月口径**：`Z实 = sumZ / K`，K=应缴窗口月总数（本案窗口 2000-11~2033-06，K=392，无窗口内断缴月，paidMonths=392）。
- 不自洽的本质：年表把"2 个月的月 z 之和 5.3494"摊到了 12 个日历月；旧勾稽靠 `Σ(zMonthAvg×12)=Σ月z` 勉强还原（现 output-assert 即如此），但**作为"当年缴费工资指数"展示的 0.4458 在语义上是错的**——这两个月的真实月指数 = 3071 ÷ 1148.17 = **2.6747**。

### 1.2 官方/工程口径判定

**官方原文（已逐字核对，见 `docs/policy-verification-rchu-rbu-2007-21-31.md` §2.1）**
- 京劳社养发〔2007〕21 号附件一指标解释：
  - (3)「Z实指数（实际缴费工资指数，保留四位小数）=（Xn/Cn-1 +……+X1993/C1992 + X1992/C1991）/N应缴」
  - (4)「Xn……X1992 为被保险人退休当年至 1992 年相应年度**各月本人缴费工资基数之和**」
- 即：官方公式是**年项求和 ÷ N应缴**。对"整年连续缴费"，`X年/C上一年`（年工资/年社平）与 `月均基数/月社平` 严格相等。
- 官方 21 号文**没有逐字说明**参保首年、退休年这类"窗口只覆盖全年一部分"时 X年分母取 12 个月还是实际月数。
- **官方折算原则旁证**：京劳社养发〔2007〕31 号第二条(三)（Z补贴/个人账户补贴额）原文：「……上一年本市职工平均工资（**不满整年度的按实际工作月数计算，下同**）为基数……」；31 号附件1 指标解释也有「扣除后非整年度的按本市职工月平均工资累加计算」。证明北京口径体系内"非整年一律按月折算、不用全年分母"是官方原则。

**工程判定**
1. 用户主张正确：把边界年的全年分母改为**实际应缴月数**后，年指数与月口径、与 31 号文折算原则全部自洽：
   `Z年 = Σ窗口月z ÷ windowMonths = Xn ÷ (C月 × windowMonths)`。
2. 本修正是**展示/明细账口径修正**；Z实主汇总（`sumZ/K`）本身算法正确、本轮**不动**，两案 Z实=2.4075/2.9095 不回归。
3. 查不到的部分（见 §6）：21 号文附件一公式图之外**没有**检索到"首保年/退休年缴费指数按月均"的逐字官方问答；本轮依据官方公式自洽性 + 31 号文折算原则作工程定稿，不虚构文号。

### 1.3 精确定义（定稿）

对年度 n（ledger 行，n=1992~退休年）：

```
windowMonths_n = 第 n 年中落入应缴窗口 [windowStartIdx, lastContribIdx] 的月数
                 （参保首年 = 自参保月；退休年 = 至退休前一月；其余年份 = 12；窗口外年份 = 0）
paidMonths_n   = 其中 base > 0 的月数
Σz_n           = 窗口内各月 z 之和（断缴月、分母缺失月 z=0；月 z = b月/c月）
Xn             = 窗口内各月缴费基数之和（= 官方 X年 在窗口内的部分）

Z年(n) =
  C月(n−1) 缺失                       → null（行保留，展示"—"）
  C月 可得 且 windowMonths_n = 0       → 0（窗口未开始的年份，如本案1996~1999）
  C月 可得 且 windowMonths_n > 0       → round4( Σz_n / windowMonths_n )
                                         等价 round4( Xn / (C月 × windowMonths_n) )
```

- 整年连续缴费（windowMonths=12）：`Σz/12 = Xn/(C月×12) = Xn/C全年`，与旧式**严格相等**。
- 非整年（2000=2 月、2033=6 月）：分母按应缴月数收敛，不再稀释。
- 汇总勾稽新恒等式：**`Σ_n (Z年_n × windowMonths_n) ÷ K = Z实`**（已用独立脚本复算：案1 得 2.407481…→2.4075；案2 得 2.909522…→2.9095，通过）。
- 舍入：Xn/C年 round2；Z年 round4（展示精度，沿用现状）；**聚合一律用未舍入的原始月 z / base**，不得用 round4 后的 Z年反推汇总。

### 1.4 缺缴月/断缴月如何参与（精确边界，务必区分三种月份）

| 月份情形 | 是否在应缴窗口 | 月 z | 计入 windowMonths（Z年分母） | 计入 K（Z实分母） |
|---|---|---|---|---|
| 参保首年中、参保起始月**之前**（本案 2000 的 1~10 月） | 否 | — | **否** | **否** |
| 退休年中、退休当月及以后（本案 2033 的 7~12 月） | 否 | — | **否** | **否** |
| 窗口内的中断缴费月（应缴未缴） | 是 | 0 | **是**（拉低该年指数） | **是** |
| 分母缺失的窗口月（T-10 情形） | 是 | 0（并给 warning） | 是 | 是 |

- 用户所说"缺缴月不计入分母"，定稿解释为：**非应缴窗口月（参保前/退休后）不计入**——它们本来就不是"缺缴"而是"不在应缴范围"。
- **窗口内断缴月**：维持现行北京口径（21 号文"÷N应缴"的字面推论；spec §4.5 已列 T-05 待 12333/经办复核）：断缴月 z=0 且计入分母。本案窗口内**没有**断缴月（K=paidMonths=392），故该规则在本案无数值影响。
- 若后续用户/团队明确要求把窗口内断缴月也移出分母（即 Z实=Σ月z÷实缴月数），那将改变官方"÷N应缴"总口径，**不属于本 bug 范围**，需政策复核后另立变更，本轮不擅自改。

### 1.5 本案新旧数值对照表（node 实跑 + 独立复算）

月分母依据：C月 来自 `constants/policyData.js indexDenominatorMonthly`；C年=C月×12。

| 年 n | 应缴月 | 实缴月 | Xn(元) | C月(元) | C全年(元) | **旧 Z年** Xn/C全年 | **新 Z年** Σz/应缴月 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1992~1995 | 0 | 0 | 0 | 缺（T-10） | — | null | **null（不变）** |
| 1996~1999 | 0 | 0 | 0 | 官方 | 官方 | 0.0000 | **0.0000（不变）** |
| **2000** | **2** | 2 | 6142.00 | 1148.17 | 13778.04 | **0.4458** | **2.6747** |
| 2001 | 12 | 12 | 41328.00 | 1310.50 | 15726.00 | 2.6280 | 2.6280 |
| 2025 | 12 | 12 | 426564.00 | 11937.00 | 143244.00 | 2.9779 | 2.9779 |
| 2026（案1） | 12 | 12 | 315136.80 | 11937.00 | 143244.00 | 2.2000 | 2.2000 |
| 2026（案2） | 12 | 12 | 429732.00 | 11937.00 | 143244.00 | 3.0000 | 3.0000 |
| 2027~2032（案1/案2） | 12 | 12 | 85946.40 / 429732.00 | 11937.00【assumed】 | 143244.00 | 0.6000 / 3.0000 | 0.6000 / 3.0000 |
| **2033（案1）** | **6** | 6 | 42973.20 | 11937.00 | 143244.00 | **0.3000** | **0.6000** |
| **2033（案2）** | **6** | 6 | 214866.00 | 11937.00 | 143244.00 | **1.5000** | **3.0000** |

逐月取证（2000，两案相同）：2000-11、2000-12 各 base=3071.00、c=1148.17、z=2.67469103… → round4=2.6747。
2033 逐月（案1）：base=7162.20、c=11937、z=0.6000；（案2）：base=35811、z=3.0000。

勾稽复算（独立脚本，窗口月数加权）：
- 案1：Σ(Z年×windowMonths)/392 = **2.407481… → 2.4075** ✅
- 案2：Σ(Z年×windowMonths)/392 = **2.909522… → 2.9095** ✅

---

## 2. Bug15：缺省录入模式改为年度模式

### 2.1 现状（源码核实）

- `calculator/inputPageModel.js → userEntryPart(withDefaults)`：`entryMode: 'month'`（无论首次进入的带默认值版本，还是 #6 清空版本，共用同一字面量）。
- 首次进入：月模式带 1 段示例 `{type:'enterprise', startYM:'1992-10', endYM:'2025-09', baseMonthly:''}`；年度模式带 1 行示例 `{year:'2024', startMonth:'1', annualBase:'', months:'12'}`。
- `pages/index/index.js`：
  - `onLoad`：`Object.assign(Model.buildInitialData(P), saved, {calculating:false, errorMsg:''})` 合并草稿——**saved 中的 entryMode 会覆盖默认值**；
  - `setEntryMode`：切换并触发对应模式的 bounds 检查；
  - `buildInput`：按 `entryMode` 选择 `expandYearRows(yearRows)` 或直接用 `segments`。

### 2.2 修改规则（定稿）

1. `inputPageModel.js`：`entryMode: 'month'` → **`entryMode: 'year'`**（一处字面量，首次进入与清空后缺省同时生效）。
2. 默认行（年度模式）维持：`{year:'2024', startMonth:'1', annualBase:'', months:'12'}`；月模式示例段 `segments` 原样保留（用户切回月模式时仍有默认段，不删）。
3. 切换逻辑不动：`setEntryMode` 已支持双向切换；切到年度时 `checkYearBounds()`、切到月度时 `checkMonthBounds()` 维持现状。
4. **已存草稿不受影响**：onLoad 的合并顺序是"新默认值为底，saved 覆盖"，旧草稿 `entryMode:'month'`（或 null 之外的任意值）照常回填为月模式；仅当草稿无 entryMode 键（理论上不会，data 一直有该字段）才落到新默认 'year'。本条作为测试验收点显式验证。
5. 不改 storage 键名（仍 `pension_input_v1`）、不做草稿迁移。

---

## 3. Bug16：等待遮罩持续到结果页真正弹出

### 3.1 现状（源码核实）

- 输入页：`pages/index/index.wxml` 末尾已有遮罩块（`wx:if="{{calculating}}"` 的 `.calc-mask/.calc-box`，含 `.calc-spinner`+「计算中…」+「正在本地测算，请稍候」）；样式在 `pages/index/index.wxss`（第 61 行起）。
- `index.js onCalculate`：`setData(enterCalculating)` → setTimeout 30ms → buildInput/Engine.calculate → **成功时先 `this.setData(Model.exitCalculating(this.data))`（遮罩关闭）再 `wx.navigateTo`**；catch 路径 exit + toast。
- result 页：`onLoad` 同步构造 vm/vmYearly/vmAnnual/groups 后一次 setData；页面 data 无 loading 字段，**onLoad→首帧渲染期间页面空白，无遮罩**。
- 用户感知：输入页转圈（约 30ms+计算耗时）→ 遮罩提前消失 → 转场 + result 白屏 → 结果出现。计算本身虽快，但"遮罩在跳转前就没了"正是用户反馈的断档。

### 3.2 定稿方案：输入页遮罩保持 + 结果页同名遮罩接棒（视觉连续）

1. **输入页 `index.js onCalculate`**
   - 成功路径：**删除** `this.setData(Model.exitCalculating(this.data))`，以 `calculating:true` 状态直接 `wx.navigateTo`；输入页随系统转场自然 hide，遮罩不需手动关。
   - `wx.navigateTo` 增加 `fail`：fail 中 `this.setData(Model.exitCalculating(this.data))` 并 toast（如页面栈满等异常，必须能关闭遮罩）。
   - catch（buildInput/Engine 抛错）路径维持现状：exit + errorMsg + toast。
   - 新增 **`onShow`**：`this.setData({ calculating: false })`——覆盖两条返回路径：①用户从 result 页 navigateBack 回到输入页（此时 calculating 仍为 true，不复位会永久转圈）；②navigateTo fail 后系统可能再次触发 onShow。
2. **结果页 `pages/result/result.js`**
   - `data` 增加 `pageLoading: true`。
   - `onLoad`：vm 构造等同步工作完成后，**与业务数据同一次** `setData({ ready:true, r, vm, vmYearly, vmAnnual, monthlyGroups, formulaRefs, totalDisplay, showIneligible, pageLoading:false })`。
     - 效果：result 首帧以 `pageLoading=true` 渲染遮罩，第二帧（同批数据提交后）渲染真实内容 → 覆盖"onLoad 执行 + 首帧绘制"全段。
   - 无结果异常分支（`!app.globalData.lastResult`）：改为先 `this.setData({ pageLoading:false })` 再 toast/return（否则遮罩卡死）。
3. **结果页 `pages/result/result.wxml`**：页面根部加与输入页**同结构**遮罩：
   ```xml
   <view class="calc-mask" wx:if="{{pageLoading}}">
     <view class="calc-box">
       <view class="calc-spinner"></view>
       <view class="calc-text">计算中…</view>
       <view class="calc-sub">正在本地测算，请稍候</view>
     </view>
   </view>
   ```
   （文案沿用输入页现有中文字面量；模板内直接写中文与本页其他静态文案同理。）
4. **样式上移保证像素级一致**：把 `pages/index/index.wxss` 中的 `.calc-mask/.calc-box/.calc-spinner/.calc-text/.calc-sub` 及 `@keyframes` 整组**移动到 `app.wxss`**（输入页样式删除，避免重复定义）；两页遮罩同类名同样式，转场前后无大小/色差跳变。
   - 转场动画本身（约数百 ms 的系统切页）期间用户看到系统转场帧，属平台固有过渡，无法也无需遮罩；定稿标准为"点击之后到结果页首帧内容可见，除系统转场外面始终有同款转圈，无白屏断档"。
5. `calculator/inputPageModel.js`：`enterCalculating/exitCalculating` 纯函数不动（index 侧继续使用）；result 侧的 `pageLoading` 为本页 data 字段，不经 Model。

### 3.3 异常路径关闭核对表

| 路径 | 遮罩状态处理 |
|---|---|
| buildInput 校验抛错 / Engine.calculate 抛错 | catch 内 exitCalculating + errorMsg/toast（现状已具备） |
| navigateTo fail | fail 回调 exitCalculating + toast（新增） |
| result 页无 lastResult | setData pageLoading:false 后 toast 返回（新增） |
| 正常返回输入页（navigateBack） | onShow 复位 calculating:false（新增） |
| 计算成功 | 输入页遮罩随 hide 消失；result 遮罩在内容首帧同批关闭 |

---

## 4. 逐文件改动清单（函数名 / 锚点）

| 文件 | 改动点（锚点 / 函数） |
|---|---|
| `calculator/pensionEngine.js` | ① `buildAnnualIndexLedger`（现 263 行）：保留 xAnnual/sumMonthZ/windowMonths/paidMonths 累计；**删除 `zMonthAvg` 变量与行键**；`zYear` 三分支规则改为 §1.3（cAnnual==null→null；windowMonths==0→0；否则 round4(sumMonthZ/windowMonths)）；ledger 行删除 `zMonthAvg` 键。②函数头注释（现 261~262 行）按新口径改写。③calculate 主循环与 `Z实=sumZ/K` **不动** |
| `pages/result/result.js` | ① `data` 加 `pageLoading:true`。② `buildAnnualVm`（现约 74 行）：删除 `zMonthText` 映射。③ `onLoad`：末尾 setData 追加 `pageLoading:false`；无结果分支先 setData false 再 return |
| `pages/result/result.wxml` | ① 年度明细账表删除「月均Σz/12」表头与对应单元格（锚点：`vmAnnual` 表卡）。② 页面根部加 `pageLoading` 遮罩块（§3.2-3） |
| `pages/result/result.wxss` | 无需新增（遮罩样式上移 app.wxss 后此类由全局提供） |
| `pages/index/index.js` | ① `onCalculate`：删除成功路径的 `setData(Model.exitCalculating(...))`；`wx.navigateTo` 加 `fail` 复位+toast。② 新增 `onShow`（复位 calculating:false）。其余不动 |
| `pages/index/index.wxml` | 不动（遮罩结构已存在且与 result 同名同类） |
| `pages/index/index.wxss` | 删除 `.calc-mask/.calc-box/.calc-spinner/.calc-text/.calc-sub/@keyframes`（移至 app.wxss） |
| `app.wxss` | 追加上述遮罩整组样式（从 index.wxss 原样移动，选择器/数值不改） |
| `calculator/inputPageModel.js` | `userEntryPart`：`entryMode:'month'` → **`'year'`**（一处；withDefaults 与 reset 共用）；其余字段不动 |
| `constants/policyData.js` | `version` 递增（如 2026.09.22-bug1416）；无参数变化 |
| `autotest/output-assert.js` | ① 2000 断言：`zYear 0.4458→2.6747`；删除"月均=0.4458"行。② 2033 断言：`0.3/1.5→0.6/3.0`；删除月均行。③ 2026/2027~2032 的 zYear 断言数值不变；其"月均"绑定改为删除。④ 勾稽段：`Σ(zMonthAvg*12)/K` → **`Σ(zYear*windowMonths)/K`**，容差维持 0.0002。⑤ 1996~1999 `zYear=0`、1992~1995 `zYear=null` 断言保留 |
| `docs/specification.md`（实施时升 **V1.4**，本轮不代改） | ① 修订记录加 V1.4 行：Bug14 年指数边界年按月数折算、Bug15 缺省年度模式、Bug16 遮罩跨页延续。② §4.5："年度录入模式……分母仍计12个月"段补"应缴窗口边界年（参保首年/退休年）分母按应缴月数；窗口内断缴月仍计分母"；年度公式说明同步。③ FR-10b/交互段：遮罩改为"持续至结果页首帧内容可见"。④ FR-05 相关行补"缺省年度模式" |

> 说明：任务要求本轮只定稿、不改业务代码；`specification.md` 的 V1.4 合并与 `output-assert.js` 断言更新由后续开发/测试节点按上表执行。本文档（设计备忘录）按用户 BTW 要求合并到开发服务器 `docs\pension-ui-change-design-bug14-16.md`。

---

## 5. 给测试的验收点

### 5.1 Bug14
- 结果页年度明细账：**2000 行 Z年=2.6747**（不再出现 0.4458）；**2033 行案1=0.6000、案2=3.0000**（不再出现 0.3/1.5）。
- 所有满 12 月应缴年数值不回归：2001=2.6280、2025=2.9779、2026 案1=2.2000/案2=3.0000、2027~2032=0.6000/3.0000。
- 1992~1995 仍为"—/缺分母"，1996~1999 仍为 0.0000；行数仍 42（1992~2033）。
- 勾稽：`Σ(Z年×应缴月)÷392 = 2.4075 / 2.9095`（node 断言容差 ≤0.0002）。
- 两案三分项与合计不回归：14468.81 / 17238.88（±0.01）；Z实指数展示仍 2.4075/2.9095。
- 建议补构造用例（后续测试节点）：①窗口内含 1~2 个断缴月的年份，Z年=Σ缴月z/12（断缴月在分母、拉低指数）；②参保起始月改为 2000-03 时，2000 行应缴月=10、Z年按 10 月分母重算；③退休年前移/后移时末年应缴月联动。

### 5.2 Bug15
- 冷启动（清空 storage 后）进入输入页：「③ 实际缴费记录」**默认高亮"年度模式录入"**，页面显示年度行（年份/起始月/月数/年基数），月模式段不显示。
- 在年度模式下可正常切回"分段月度录入"，再切回年度，两种模式数据各自保留（现有行为，回归确认）。
- **草稿兼容**：先用旧版本/手动写入 `entryMode:'month'` 的 `pension_input_v1` 草稿再进页面——仍回填月模式；草稿中年Rows/segments 数据不丢失。
- 点"清空本地录入数据"后：缺省仍为年度模式，年度行恢复单行默认值。

### 5.3 Bug16
- 点"开始测算"起：输入页遮罩（半透明底+旋转圈+"计算中…/正在本地测算，请稍候"）持续可见，**跳转过程中不提前消失**；结果页首帧即为同款遮罩（与输入页遮罩位置、底色、圆圈、文字目测一致、无跳变），结果内容出现时遮罩同帧消失，全程无白屏断档。
- 制造校验错误（空年基数/月数非法）：遮罩能关闭、错误文案展示、不卡死。
- 结果页异常（清空 globalData 后直接进入 result）：toast 提示且无遮罩残留。
- 从结果页返回输入页：输入页无遮罩残留，可再次测算；连点"开始测算"不产生两次计算（防重复点击现状保留）。

---

## 6. 官方口径 / 工程假设 / 不确定项

**官方口径（有原文/文号）**
- Z实指数年项公式、X年=年度各月缴费工资基数之和、÷N应缴：京劳社养发〔2007〕21 号附件一(3)(4)（官方公式图，已逐字转录于 policy-verification 文档）。
- "不满整年度按实际工作月数计算""非整年度按月社平累加"：京劳社养发〔2007〕31 号第二条(三)及附件1 指标解释（首都之窗官方页）。
- Z实总口径月化与"断缴计 0、计入 N应缴"：21 号文"÷N应缴"字面推论 + spec §4.5 现有解释（T-05 状态不变）。

**工程假设（页面/文案须标注或代码注释写明）**
- 以 `Σ月z/windowMonths` 作为边界年"年指数"的工程定稿，依据是官方公式自洽性 + 31 号文折算原则；2026 起分母沿用 11937 元/月（assumed，沿用现状）。
- 遮罩跨页"同结构同名类 + 样式上移 app.wxss"实现视觉连续；系统转场动画期间不做处理。

**不确定 / 待官方确认（不编造）**
1. 21 号文**没有**逐字表述"参保首年/退休年指数分母按实际月数"；未检索到 12333/北京人社局官方问答明文。本轮定稿为工程正确解（§1.2），建议测试/实施方向经办口头复核，但不影响本轮定稿与数值。
2. 京劳社养发〔2007〕29 号全文官方直链本轮未取得（站内检索页已撤稿样式 404）；31 号附件1 仅转引"N应缴按 29 号文计算"。29 号文逐字条款沿用上轮不确定状态。
3. 窗口内断缴月计入分母（T-05）仍待经办复核；本案无断缴月，无数值影响。
4. 未来段分母 assumed、记账利率 1.5% 等既有工程假设沿用上轮，不新增承诺。

---

## 附：本轮取证记录
- 拉文件：`win-ssh.sh` + PowerShell `-EncodedCommand`（UTF-16LE/base64）+ `[Convert]::ToBase64String([IO.File]::ReadAllBytes())`，12 个源/文档文件完整拉取；未用 RDP、未动 IDE、未改服务器业务代码。
- 引擎实跑：node v22.22.0，My-Case 两案：当前引擎输出 2000=0.4458、2033=0.3/1.5、Z实=2.4075/2.9095。
- 新口径独立复算：窗口月数加权脚本输出 2000=2.6747、2033=0.6/3.0，勾稽 2.407481…/2.909522…，与 Z实 基准一致。
