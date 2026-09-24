# pension 北京养老金小程序 — UI修改架构定稿（Bug 5~13）

- 日期：2026-09-21（Asia/Shanghai）
- 本轮范围：**仅调研 + 定稿，不改业务代码、不跑 GUI。**
- 上一轮依据：`pension-architect-memo.md`（Bug2/3/4 引擎修复）、`pension-engine-fix-change.md`、案例输入 `My-Case.md`。
- 项目根（Windows）：`C:\Users\Administrator\Desktop\Wechat projects\pension`
- 复核方式：经 `win-ssh.sh` 拉取全部关键源文件（index/result 的 js/wxml/wxss、pensionEngine.js、accountSubsidy.js、policyData.js、policyRefs.js、app.wxss、dateUtil.js、retireSchedule.js、tests/oracle.js），并在 Linux node v22 下用 My-Case 两案**实跑引擎**取证；本文所有数值均来自实跑或源码原文，未编造文号/数字。

---

## 0. 三批次速览

| 批次 | 项 | 现状判定（一句话） | 定稿核心 |
|---|---|---|---|
| 1 输入页数据模型 | 5 | 视同年限只有"自动估算/手工月数"，无起止年月 | 改为起/止两个 month picker，月数由区间推导 |
| | 8 | 账户 Section 含利息模式/固定利率/兜底利率/计息口径等 6+ 字段 | 只留：账户累计额 + 余额所在年月 + 未来段记账年利率 |
| | 9 | N实98 有手工输入框 `n98DeemedMonths` | 取消输入，= 视同区间 ∩ [1992-10, 1998-06]，本案 36 月 |
| | 10 | "一次性个人账户补贴"字样仅出现在扣除区间标签，含义不清 | 给通俗说明文案 + 改名建议；并厘清与 R补/Z补贴 的关系 |
| 2 输入页交互 | 6 | `onReset` 只删 storage + toast，**从未 setData** | 改为重建默认数据 + setData + 清缓存 |
| | 7 | `app.wxss` 全局 `input { text-align: right }` | 新增统一样式类 `.num-input` 居中，替换全局右对齐 |
| | 11 | 测算同步执行，期间无反馈 | 叠加旋转圆圈遮罩；setData 后 `setTimeout` 让出一帧再算 |
| 3 输出页 | 12a | 锚定模式下本金/利息口径未在文案写明起算时点 | 本金/利息**仅指 2026-09→2033-06 未来段**；文案重写（见 §4） |
| | 12b | R补 区块下方多出一行"└ 本金 / 利息"，与 R储 说明重复 | 删除该行 |
| | 13 | 引擎无年度指数汇总，只有逐月 z | 引擎新增 `annualIndex` 明细账（1992~2033），结果页加表（见 §5） |

**12a 结论速答**：引擎实跑证实，"锚定实际余额 672920（2026-08 末）"模式下，R储 = 672920 + **未来段（2026-09→2033-06，82个月）**本金 + 未来段利息；本金**起算时点就是 2026-09**（用户假设正确）。案1：本金 46984.03 + 利息 75045.30 → R储 794949.33；案2：本金 234920.16 + 利息 84884.69 → R储 992724.85。用户感觉"差挺多"来自利息按月复利且对不断增长的余额计息，而非 672920×1.5% 的简单利息（单利近似 68974 vs 实际 75045，差约 6071 元）。锚定余额未与历史重建的本金/利息重复计算（引擎手工余额分支提前 return，不跑历史模拟，已核实）。

---

## 1. 批次1：输入页数据模型（#5 / #8 / #9 / #10）

### 1.1 #5 视同缴费年限 → 起止年月录入

**现状（源码核实）**
- `pages/index/index.wxml` Section ②（标题"视同缴费年限（1992年9月及以前）"）：
  - 一组模式切换 `deemedMode`（`setDeemedMode`）："按参加工作时间估算 / 手工录入认定月数"；
  - 手工模式下单个输入框 `<input value="{{deemedMonths}}">`（`onDeemedMonths`）；
- `pages/index/index.js` data：`deemedMode:'auto'`、`deemedMonths:''`；
- `buildInput()` 仅在手工模式传 `deemedMonths: parseInt(...)`，否则 null；
- 引擎 `pensionEngine.js` calculate 内以 `input.deemedMonths`（手工）或 `workStartYM`（估算）推导 `deemedRecognized`。

**问题**：My-Case 的真实口径是"视同 1995-07 → 2000-10"（事业单位期间，区间终点在 1992-09 之后），与 Section 标题"1992年9月及以前"本身存在文案矛盾；直接录月数无法承载区间信息，#9 也无从推导。

**修改规则（定稿）**
1. 删除 `deemedMode` 切换与 `deemedMonths` 输入；Section ② 改为两个 month picker：
   - `deemedStartYM`（视同缴费起始年月，placeholder「如 1995-07」）；
   - `deemedEndYM`（视同缴费终止年月，含当月，placeholder「如 2000-10」）；
   - 控件形式与 `birthYM`/`workStartYM` 一致：`<picker mode="date" fields="month">`。
2. Section 标题改为「② 视同缴费年限（按档案认定起止年月）」；下方 muted 说明：
   > "视同缴费年限指实行个人缴费前按国家规定计算的连续工龄，按人事档案/社保经办认定的起止年月填写；两端均含当月。北京企业职工个人缴费自 1992-10 起；其中 1992-09（含）以前部分进 G同（N同），1992-10~1998-06 部分进 G实（N实98），1998-07 后的部分不进过渡性养老金（31号文人员由 R补 补偿）。"
3. 区间规则（精确到边界）：
   - 格式 `/^\d{4}-\d{2}$/`；`deemedStartYM ≤ deemedEndYM`；
   - `deemedStartYM ≥ workStartYM`（不得早于参加工作年月；违反给错误，不静默截断）；
   - doc31 人员：`deemedEndYM ≤ enterpriseInsuredYM 前一月`；
   - 认可月数 `deemedRecognized = 月交集([deemedStartYM, deemedEndYM], 有效工龄窗口)`：
     - doc31 人员有效窗口 = `[workStartYM, enterpriseInsuredYM-1月]`（本案交集 = 1995-07~2000-10 = **64 月**）；
     - 普通人员有效窗口 = `[workStartYM, 1992-09]`（超出部分不认可并提示）；
   - 月数一律闭区间 `endIdx - startIdx + 1`（dateUtil 口径），只舍入规则：月数为整数，年数展示 = 月数/12，保留 4 位。
4. 引擎输入契约变更：`input.deemedStartYM` / `input.deemedEndYM` 为新字段；`input.deemedMonths` 取消（引擎可保留一轮兼容读取，但 buildInput 不再产生）。

### 1.2 #8 个人账户 Section 简化

**现状（源码核实，Section ④，index.wxml）** 现有字段/控件：
| 字段 | 控件 | 处理函数 |
|---|---|---|
| `interestMode`（official/fixed/none） | 三选一 | `setInterestMode` |
| `fixedRatePct`（仅 fixed） | input | `onFixedRate` |
| `fallbackRatePct`（仅 official） | input | `onFallbackRate` |
| `intraYearMethod`（monthly/half） | 二选一 | `setIntraYear` |
| `accountBalanceManual` | input「或直接录入账户累计储存额」 | `onManualBalance` |
| `manualBalanceYM` | picker「该余额所在年月」 | `onManualBalanceYM` |
| `futureMonthlyRatePct` | input「未来段记账年利率」 | `onFutureMonthlyRate` |

**修改规则（定稿）**
1. **保留 3 项**：
   - 账户累计储存额 `accountBalanceManual`（label 去掉"或直接"，改为「个人账户累计储存额(元)」，必填，允许 0；placeholder「如 672920」）；
   - 余额所在年月 `manualBalanceYM`（**架构判定保留**：它不是"利息模式/计息口径"，而是未来段滚动的锚点月；没有它引擎只能静态锚定、无法产出 2026-09 后的本息；label「该余额所在年月」，本案 2026-08）；
   - 未来段记账年利率 `futureMonthlyRatePct`（label「未来段记账年利率(%)」，本案 1.5）。
2. **删除**：`interestMode`、`fixedRatePct`、`fallbackRatePct`、`intraYearMethod` 及其全部控件/处理函数/data 字段/buildInput 字段。
3. 文案：只保留滚动说明一条 muted：
   > "自余额所在次月起至退休前一月按月滚动：每月末 余额 = 余额×(1+年利率/12) + 月缴费基数×8%；记账利率为工程假设，结果标【预估】，实际以社保经办与官方公布利率为准。R储=官方『个人账户累计储存额』（京劳社养发〔2007〕21号）。"
   删除关于人社部历年利率（2016:8.31%…）与半年简化的两条 muted。
4. 引擎侧：`pensionEngine.js` 的"非手工余额"历史重建分支（calcAccount 后半段）在 UI 路径变为不可达——**代码不删**（node 测试/oracle/兼容性仍用），但 `validate` 增加规则：`accountBalanceManual` 为必填（null/缺失 → 硬错误「请填写个人账户累计储存额」）；`buildInput` 不再传 interestMode/fixedRate/fallbackRate/intraYearMethod（或传引擎默认值，二选一，建议直接不传，由引擎默认）。
5. 滚动模型不变：年利率/12 折月复利；锚定月当月不滚动，次月起息（边界已在引擎实现，见 §4）。

### 1.3 #9 N实98 取消手工，由视同区间推导

**现状（源码核实）**
- index.wxml ④-2 区块内：`<input value="{{n98DeemedMonths}}">`（label「N实98认定月数(可选)」），`onN98Deemed`；
- buildInput 传 `n98DeemedMonths`；引擎 doc31 分支：区间 `[max(1992-10, workStartYM), 1998-06]` 的连续月数，手工认定值优先且 cap。

**修改规则（定稿）**
1. 删除输入框与 `n98DeemedMonths` data/handler/buildInput 字段。
2. 引擎推导（精确边界，含端点）：
   - `n98Window = [1992-10, 1998-06]`（31号文第二条(二)："1992年10月1日至1998年6月30日期间……连续工龄，含实际缴费年限"）；
   - `n98Months = { j ∈ n98Window | monthMap[j] 有实缴  或  j 落在经认定视同区间 [deemedStartYM, deemedEndYM] 内 }` 的月数（按月并集，不重复计）；
   - 等价实现：`overlap([deemedStartYM,deemedEndYM], n98Window)` 的月数 ∪ 窗口内实缴月；
   - **本案**：视同 1995-07~2000-10 与窗口交集 = 1995-07~1998-06 = **36 月 → N实98 = 3.00 年**（与上轮引擎修复值一致，数值不回归）。
3. 普通人员同一公式：实缴月 + 1992-10~1998-06 间经认定视同月（替代现引擎"只数 monthMap"分支，口径更贴合 31号文"连续工龄含视同"，同时不影响无视同的普通用户）。
4. 引擎不再读取 `input.n98DeemedMonths`（可保留兼容但 buildInput 不传）；warning 文案改为"N实98 由视同起止年月与 1992-10~1998-06 区间自动推导为 36 个月"。

### 1.4 #10 「一次性个人账户补贴」解释 / 改名

**现状（全仓 grep 核实）**
- 中文字面"一次性个人账户补贴"在输入页**只出现 1 处**：index.wxml ④-2 区块 textarea 的 label「已享一次性个人账户补贴的扣除区间（可选，每行一段）」；
- 其 placeholder 与代码注释指向 **京劳社养发〔2002〕27号 / 后联字〔2002〕3号**已领取的一次性补贴（引擎 AC-RC-08 扣除规则）；
- 另有概念 **R补 = 31号文「个人账户补贴额」Z补贴**（Section ④-2 主题），名称相近但**不是同一个东西**。

**两个概念的通俗解释（定稿文案）**
1. **R补（31号文「个人账户补贴额 Z补贴」）**：
   > "给 1998 年后从机关事业单位调入（或转制、军转）到企业的人员的一项**虚拟补贴**：因为您在原单位期间没建企业个人账户，退休时按当时社会平均工资和历年账户记账比例模拟出一笔金额，再乘您参保后的实际缴费指数，**只用来增加每月个人账户养老金（J账户=(R储+R补)÷M），不打进您真实的个人账户、不能提取或继承**。"
2. **扣除区间所指「一次性个人账户补贴」（2002年 27号文/后联字3号）**：
   > "如果您早年（按 2002 年相关文件）已经**现金领取过**一次性个人账户补贴，那么对应年限不能再重复算进 Z补贴；这个框只用来登记已领取的年月区间做扣除，大多数人留空即可。"

**改名/标注建议（定稿）**
- Section ④-2 标题维持「人员身份与 R补」，在 R补 字样后固定加括注：`R补（31号文·个人账户补贴额 Z补贴）`；
- textarea label 改为「**已领取的一次性补贴扣除区间（京劳社养发〔2002〕27号等，非必填）**」，避免"个人账户补贴"与 R补 撞名；
- 不臆造 27号文/后联字3号的完整标题（policyRefs 无该条目 → 列入 §8 不确定项）。

---

## 2. 批次2：输入页交互（#6 / #7 / #11）

### 2.1 #6 「清空本地录入数据」真正清空

**现状（根因，源码核实）**
```js
onReset: function () {
  wx.removeStorageSync('pension_input_v1');
  wx.showToast({ title: '已清空本地录入', icon: 'none' });
}
```
- 只删了 storage、弹 toast，**从未调用 setData** → 页面所有绑定值（含 input 数字、segments/yearRows、picker 年月）原样保留，即用户所见"数字没变"。
- onLoad 会 `wx.getStorageSync('pension_input_v1')` 回填，故重置必须同时改页面数据。

**修改规则（定稿）**
1. 把现 `data: {...}` 字面量抽成工厂函数 `defaultData()`（每次返回全新对象，**segments/yearRows 数组必须新建**，防止多实例共享引用）；`data: defaultData()`。
2. `onReset` 改为：
   ```js
   onReset: function () {
     this.setData(defaultData());
     wx.removeStorageSync('pension_input_v1');
     wx.showToast({ title: '已清空本地录入', icon: 'none' });
   }
   ```
3. 清空范围核对（defaultData 必须覆盖全部可录入字段）：gender/femaleType、birthYM、workStartYM、retireYM、deemedStartYM/deemedEndYM（#5 新字段）、segments（回到默认 1 段空基数）、yearRows（回到默认 1 行空值）、entryMode、accountBalanceManual、manualBalanceYM、futureMonthlyRatePct、doc31Eligible、doc31TransferYM、enterpriseInsuredYM、subsidyExcludedText、baseYearIndex、cPingOverride、customCYearText、boundWarnings、errorMsg。
4. 重置后 `retireHint` 等派生字段：defaultData 置空串，并在 setData 回调里调一次 `refreshDefaultRetire()`（默认出生年月会重新给出退休年月提示），避免提示语残留。
5. 本地缓存只有 `pension_input_v1` 一个键（saveDraft/onLoad 核实），清此键即可，不新增其它存储键。

### 2.2 #7 输入框数字居中（统一样式类）

**现状（根因，源码核实）**
- `app.wxss` 末行：`input { text-align: right; min-width: 240rpx; }` —— 全局右对齐，故所有输入框数字贴右。

**修改规则（定稿）**
1. 删除 app.wxss 中的全局 `input { text-align: right ... }`（避免页面级样式污染、也避免未来非数字 input 被波及）。
2. 在 `pages/index/index.wxss` 新增统一类：
   ```css
   .num-input { text-align: center; min-width: 240rpx; }
   ```
3. index.wxml 中**所有** `<input>`（type=number/digit）统一加 `class="num-input"`：deemed 无 input（picker）；segments 的月基数、yearRows 的年份/起始月/月数/年基数、账户累计额、未来年利率等，逐一对齐（grep 锚点见 §6）。
4. 验收以视觉为准：数字在输入框水平居中；picker 类"值 ›"文字维持 `.row` 原布局不动（用户只针对输入框数字）。

### 2.3 #11 测算等待遮罩（旋转圆圈）

**现状（源码核实）**
- `onCalculate` 同步执行 `buildInput()` + `Engine.calculate(input)` 后立即 navigateTo；计算期间主线程阻塞、页面无任何反馈，用户感知为"卡顿"。

**修改规则（定稿）**
1. index.js data 增加 `calculating: false`。
2. index.wxml 末尾（与按钮同级）加遮罩：
   ```xml
   <view wx:if="{{calculating}}" class="calc-mask">
     <view class="calc-spin"></view>
     <view class="calc-text">测算中，请稍候…</view>
   </view>
   ```
3. index.wxss：
   ```css
   .calc-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.35);
     display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 90; }
   .calc-spin { width: 64rpx; height: 64rpx; border: 6rpx solid rgba(255,255,255,0.4);
     border-top-color: #fff; border-radius: 50%; animation: calc-rot 0.8s linear infinite; }
   .calc-text { color: #fff; margin-top: 20rpx; font-size: 26rpx; }
   @keyframes calc-rot { to { transform: rotate(360deg); } }
   ```
   （如偏好沙漏：可把 `.calc-spin` 换成文字"⏳"加大字号，但推荐 CSS 旋转圈，真机渲染更稳。）
4. **关键实现点——必须让出一帧**，否则 setData 还没绘制就进入同步计算，遮罩不会出现：
   ```js
   onCalculate: function () {
     if (this.data.calculating) return;       // 防重复点击
     this.setData({ errorMsg: '' });
     var input;
     try { input = this.buildInput(); /* 原有空段校验 */ }
     catch (e) { this.setData({ errorMsg: e.message }); return; }
     this.setData({ calculating: true }, () => {
       setTimeout(() => {                    // 让遮罩先完成绘制
         var result;
         try { result = Engine.calculate(input); }
         catch (e) { this.setData({ calculating: false, errorMsg: e.message }); return; }
         this.saveDraft();
         app.globalData.lastInput = input;
         app.globalData.lastResult = result;
         wx.navigateTo({ url: '/pages/result/result' });
       }, 50);
     });
   }
   ```
5. navigateTo 后输入页遮罩随页面隐藏，无需手动复位；异常路径必须复位 `calculating:false`。

---

## 3. 批次3：输出页（#12a / #12b / #13）

### 3.1 #12a R储 政策说明 —— 详见 §4 专项核查
- 现状文案（result.wxml）："R储为用户口径符号，对应官方『个人账户累计储存额』（21号文第二条(二)）；即本金¥… + 利息¥…。" —— 未说明本金起算时点。
- 定稿：替换为 §4.4 的新文案，绑定新 vm 字段。

### 3.2 #12b 删除 R补 下方重复的"本金/利息"行

**现状（源码核实，result.wxml）** R补 区块结束（`vm.subsidy.notIncludedNote`）之后紧接着：
```xml
<view class="row"><text class="label">　└ 本金 / 利息</text>
  <text class="value">¥{{vm.it.rPrincipalText}} / ¥{{vm.it.rInterestText}}</text></view>
```
- 该行数据绑定的是 **R储 的**本金/利息，挂在 R补 区块下既属错位、又与上方 R储 说明"即本金+利息"重复，正是用户所见重复段。

**修改规则**：整行删除；result.js 中 `rPrincipalText/rInterestText` 若无其它引用可一并清理（§4 新文案会用新字段承载，不再用这两个键）。

### 3.3 #13 Z实指数年度明细账 —— 详见 §5 字段设计
- 引擎现状**未暴露**任何年度指数汇总（intermediates 无年度键，只有 `monthlyDetails[].z` 逐月值）→ 需引擎新增产出 + 结果页新增表卡。

---

## 4. #12a 专项核查结论（引擎实跑取证）

### 4.1 取证方法
在 Linux node v22 下 require 从 Windows 拉回的当前引擎，按 My-Case（账户 672920、余额年月 2026-08、未来年利率 1.5%；缴费记录 2000-11~2026-08 + 未来段）跑两案，直接打印 `intermediates.R储 / R储本金 / R储利息` 与逐年表。

### 4.2 引擎在"锚定实际余额"模式下的真实汇总逻辑
`pensionEngine.js → calcAccount()`：`accountBalanceManual != null` 分支提前返回，其中：
- 锚定余额 = `accountBalanceManualYM`（2026-08）**月末**真实余额 672920；
- 自 **anchorIdx+1 = 2026-09** 起至退休前一月（2033-06），共 **82 个月**按月滚动：
  `每月末 余额 = 余额×(1+r/12) + 当月基数×8%`（r=0.015，断缴月 add=0 仍计息）；
- 返回的 `principal`/`interest` **只累计滚动循环内的未来段**；
- **该分支完全不执行历史重建**（后半段按年历史模拟代码不可达），故 672920 不会被拆开、也不会与历史本金/利息重复相加。

### 4.3 实跑数值（两案，与 §0 一致）

| | 案1（未来 Z=0.6，月基数 7162.20） | 案2（未来 Z=3.0，月基数 35811.00） |
|---|---:|---:|
| 锚定余额（2026-08 末） | 672920.00 | 672920.00 |
| **未来段本金**（2026-09~2033-06，82月） | **46984.03** | **234920.16** |
| **未来段利息**（同期） | **75045.30** | **84884.69** |
| **R储** | **794949.33** | **992724.85** |

- 恒等式实跑校验通过：`672920 + 本金 + 利息 = R储`（两案精确成立）。
- 年度边界（案1 示例，引擎 yearly 表）：2026 行只含 **2026-09~12 共 4 个月**（本金 2291.90、利息 3375.21、年末 678587.12）；2033 行只含 1~6 月 6 个月。

### 4.4 结论与正确文案

1. **本金起算时点 = 2026-09**（锚定月次月），用户假设**正确**；本金 = 未来 82 个月每月 8% 入账之和，绝非账户全部历史本金。
2. **为何用户感觉与结果差挺多**：
   - 利息是对**不断增长的全部余额**按月复利（利息也生息、新增本金也参与计息），不是 `672920×1.5%×年数` 的单利；
   - 单利粗算 672920×1.5%×(82/12) ≈ **68974**，而实际未来利息 = **75045.30**，差约 **6071 元**；本金案1 = 7162.20×8%×82 = 46984.03。
   - 用户具体手算值未知，以上为最可能的差异来源（工程解释，非官方数字）。
3. **锚定余额无重复计算**：见 §4.2，引擎手工余额分支不跑历史模拟。
4. **R储 政策说明替换文案（定稿，案1 代入值）**：
   > "R储 对应官方『个人账户累计储存额』（京劳社养发〔2007〕21号）。本结果以您录入的真实余额 **672920 元（2026-08 末）** 为起点，**不再拆分其中历史本金与利息、也不重复计算**；其后 **2026-09~2033-06（82个月）** 按月滚动：新增本金（月基数×8%）**46984.03 元** + 记账利息（年利率 1.5% 折月复利，工程口径【预估】）**75045.30 元**。故 R储 = 672920 + 46984.03 + 75045.30 = **794949.33 元**。"
   - 案2 数值替换为 234920.16 / 84884.69 / 992724.85。
   - result.js 新增 vm 字段：`rStore: { anchor, anchorYM, fromYM, toYM, months, principal, interest, total, ratePct }`，文案在 JS 侧拼接（遵守 wcc「{{}} 内禁非 ASCII 字面量」的既有约束）。

---

## 5. #13 Z实指数年度明细账字段设计

### 5.1 口径定义
- 官方概念：实际缴费工资指数 = 当年缴费工资 Xn ÷ 上一年本市职工平均工资 C(n−1)（21号文/29号文体系）；
- 年度行定义（n = 1992~2033，共 42 行）：
  - **Xn** = 第 n 年各月缴费基数之和（断缴月按 0；My-Case 月度段基数 = 年基数÷缴费月数）；
  - **C(n−1)** = 引擎 `denominatorFor(n)` 得到的月分母 ×12（来源 official/assumed/custom/missing）；
  - **zYear = Xn / C(n−1)**（用户点名的年度指数，年工资对年分母）；
  - **zYearMonthAvg = (Σ 12 个月的月指数) / 12**（断缴月计 0；该列用于和总 Z实 的"月均"口径勾稽——Z实 = 全部月 z 之和 ÷ 窗口月数；满年连续缴费时两列相等）。

### 5.2 引擎产出（新增）
- 新增内部函数（建议名 `buildAnnualIndexLedger(input, monthlyDetails)`），在 calculate 末尾调用，输出到结果对象新键 **`result.annualIndex`**；不在 UI 层聚合（遵守"UI 不重算"）。
- 数据源已齐备：`monthlyDetails[]` 含 `ym/base/cDenominator/denomSource/z`；按年 group 后，对 1992~退休年之间**无 monthlyDetails 的年份补零行**（月序列从窗口起点 2000-11 才有行；1992~1999 需补齐）。

**字段结构（每行）**：
```js
{
  year: Number,              // n，1992~2033
  paidMonths: Number,        // 当年 base>0 的月数（0~12）
  windowMonths: Number,      // 年度内计入应缴窗口的月数（退休年=到退休前一月；本年外通常12）
  xAnnual: Number,          // Xn=Σ月基数，round2，元/年
  cPrevMonthly: Number|null,// C(n-1) 月值
  cPrevAnnual: Number|null, // = cPrevMonthly*12，round2
  zYear: Number|null,       // Xn/CprevAnnual，round4；分母缺失→null
  zMonthAvg: Number|null,   // Σ月z/12（按12个日历月），round4；分母缺失→null
  denomSource: String       // official|assumed|custom|missing|mixed
}
```
- 舍入：xAnnual/cPrevAnnual → round2；zYear/zMonthAvg → round4（与 Z实指数展示精度一致）；聚合用未舍入的原始 base/z。
- denomSource 合并规则：年内月份分母来源一致即取该值，跨年来源不同（如 2026 年 1~8 月 official 口径、9 月起 assumed）记 `mixed` 并在来源列分别标注。

### 5.3 本案预期样值（node 实算，案1，节选）
| n | 缴费月 | Xn(元) | C(n−1)(元/年) | Xn/C(n−1) | 备注 |
|---|---:|---:|---:|---:|---|
| 1992~1995 | 0 | 0 | 缺（T-10，未手录） | — | 分母 missing，行保留标"缺" |
| 1996~1999 | 0 | 0 | 官方（C1995~C1998） | 0.0000 | 无缴费（窗口自2000-11起），指数为0、分母可查 |
| 2000 | 2 | 6142.00 | 13778.04 | 0.4458 | 仅 11~12 月；Σ月z/12=0.4458（月z=2.6747×2/12） |
| 2001 | 12 | 41328.00 | 15726.00 | 2.6280 | 满 300% 档 |
| 2025 | 12 | 426564.00 | 143244.00 | 2.9779 | |
| 2026 | 12 | 315136.80 | 143244.00 | 2.2000 | 1~8月 35811/月 + 9~12月 7162.20/月；分母 assumed |
| 2027~2032 | 12 | 85946.40 | 143244.00 | 0.6000 | 未来 Z=0.6，分母沿用 11937×12【工程假设】 |
| 2033 | 6 | 42973.20 | 143244.00 | 0.3000 | 仅 1~6 月；Σz/12=0.30 |

- 勾稽：Σ(月 z) over 窗口 2000-11~2033-06 = 943.7341，÷392 = Z实 2.4075（与上轮基准一致）。

### 5.4 结果页展示
- result.wxml 新增独立 card「Z实指数 年度明细账（Xn / C(n−1)，n=1992~2033）」，表格列：
  `年份 | 缴费月数 | Xn(年工资) | C(n−1)(上年社平/年) | Z年=Xn/C(n−1) | 月均Σz/12 | 来源`
- 42 行较多：整表放可纵向滚动容器（`max-height: 60vh; overflow-y:auto`），或默认只渲染、字体沿用按年表 22rpx；不做折叠（用户要求"明细账"，且数据一次渲染成本可接受）。
- 来源列沿用 tag 三色：官方 / 预估 / 待官方核实 / 手录；分母缺失行 Z年显示"—"并黄字提示在「缺口年度C年」补录。
- result.js：把 `r.annualIndex` 映射为 `vmAnnual`（ASCII 键，rate tag 文本在 JS 侧预置）；CSV 导出可追加该表段落（非必须，建议加）。

---

## 6. 逐文件改动清单（函数名 / 锚点）

### 6.1 批次1

**pages/index/index.wxml**
- Section ②：删除 `deemedMode` 两个 `<text class="opt">` 与 `deemedMonths` 的 `<input>` 及两条条件 muted；插入 deemedStartYM/deemedEndYM 两个 picker（锚点：`<!-- 步骤二：视同缴费 -->`）。
- Section ④：删除 interestMode/fixedRatePct/fallbackRatePct/intraYearMethod 四个 `<view class="row">` 及后两条官方利率 muted；保留 accountBalanceManual/manualBalanceYM/futureMonthlyRatePct 三行与滚动 muted（锚点：`<!-- 步骤四 -->`；label 文案按 §1.2 改）。
- ④-2：删除「N实98认定月数(可选)」`<view class="row">`（锚点：`wx:if="{{doc31Eligible}}"` 区块顶部）；textarea label 按 §1.4 改名。

**pages/index/index.js**
- data：删 `deemedMode/deemedMonths/interestMode/fixedRatePct/fallbackRatePct/intraYearMethod/n98DeemedMonths`；加 `deemedStartYM/deemedEndYM`（默认 ''）；抽 `defaultData()` 工厂（与 #6 共用）。
- 删函数：`setDeemedMode/onDeemedMonths/setInterestMode/onFixedRate/onFallbackRate/setIntraYear/onN98Deemed`；加 `onDeemedStart/onDeemedEnd`。
- `buildInput()`：
  - 改传 `deemedStartYM/deemedEndYM`；区间校验（§1.1-3）；
  - 不再传 interestMode/fixedRate/fallbackRate/intraYearMethod/n98DeemedMonths；
  - `accountBalanceManual` 必填校验（'' → throw）；
  - doc31 校验增加 deemedEndYM ≤ 参保前一月、deemedStartYM ≥ workStartYM。

**calculator/pensionEngine.js**
- `validate`：新增 deemedStartYM/deemedEndYM 格式/次序/与 workStart 关系校验；accountBalanceManual 必填（原"可空"规则收紧，注意旧测试用例须同步）。
- `calculate` 视同段（锚点：注释 `2) 视同缴费月数`）：改为由 deemed 区间与有效窗口求交集得 `deemedRecognized`、`nTongMonths`（≤1992-09 的交集月）。
- N实98 段（锚点：`var n98End = ...`）：改为"窗口内实缴月 ∪ 视同交集月"，删除 n98DeemedMonths 优先逻辑。
- `insuredWindowStart`：不动。

**constants/policyData.js**：`version` 递增（如 2026.09.21-ui）；无参数变化。

### 6.2 批次2

**pages/index/index.js**
- 抽 `defaultData()`；`data: defaultData()`；
- `onReset`：setData(defaultData()) + removeStorageSync + 回调 refreshDefaultRetire（锚点：现 `onReset` 函数）；
- `onCalculate`：加 calculating 状态 + setTimeout 让帧（§2.3）。

**app.wxss**
- 删除末行 `input { text-align: right; min-width: 240rpx; }`。

**pages/index/index.wxss**
- 新增 `.num-input`（§2.2）、`.calc-mask/.calc-spin/.calc-text/@keyframes`（§2.3）。

**pages/index/index.wxml**
- 所有 `<input>` 加 `class="num-input"`（锚点：grep `<input` 逐个；picker 不加）；
- 末尾加 calculating 遮罩块。

### 6.3 批次3

**calculator/pensionEngine.js**
- 新增 `buildAnnualIndexLedger(...)`（§5.2），calculate 返回对象加 `annualIndex`。

**pages/result/result.wxml**
- R储 muted 行替换为新文案容器（绑定 `vm.rStoreNote`，§4.4）；
- 删除「　└ 本金 / 利息」整行（#12b，锚点：`└ 本金`）；
- 新增 annual ledger card（§5.4）。

**pages/result/result.js**
- onLoad 新增 vm.rStore / rStoreNote 拼装（含案1/2 数值与 1.5%【预估】标注）；
- 映射 `r.annualIndex → vmAnnual`（来源 tag 文案 JS 预置）；
- 清理 rPrincipalText/rInterestText（如无其它引用）；
- exportCsv 可选追加年度账段。

**pages/result/result.wxss**：新增 ledger 表/滚动容器样式（可复用 `.acct-table/.ac-row`）。

### 6.4 测试资产（须随代码同批改）
- `tests/oracle.js`：同步实现 deemed 起止区间、N实98 并集、annualIndex 参照聚合（oracle 现仍用旧 deemedMonths/恒 1992-10 起点，不同步会反向报错）。
- `autotest/engine-assert.js`：两案断言增加 R储本金/利息、annualIndex 关键行（2000=0.4458、2026=2.2、2027=0.6、2033=0.3；1992~1999 zYear=null）。
- `autotest/gui/mycases.js`（如存在）：payload 改为新字段（deemedStartYM/deemedEndYM、accountBalanceManual 必填、删除 interestMode 等），回归基准合计维持 14468.81 / 17238.88。

---

## 7. 给测试的验收点

### 7.1 批次1
- #5：Section ②只有起、止两个年月选择器，无月数输入框；选 1995-07~2000-10 后，结果页/中间变量视同=64 月；起>止、起早于参加工作、止晚于参保前一月均有明确报错。
- #8：Section ④仅 3 个可填项（累计额/余额年月/未来年利率）；页面无"利息模式、固定利率、缺失年度预估利率、计息口径"任何控件；账户累计额留空点测算报"请填写"；填 0 允许通过。
- #9：输入页无 N实98 任何输入控件；视同 1995-07~2000-10 时 N实98=3.00（36月）；改视同终点为 1997-12 时 N实98 应变 2.5（30月）——边界随区间联动。
- #10：R补 处有括注与通俗说明；扣除区间 label 已改名，页面能找到"大多数人留空"类提示。

### 7.2 批次2
- #6：任意填写多组数字后点"清空本地录入数据"——所有 input 立即变空、picker/段落恢复默认；**杀进程重进小程序（触发 onLoad）仍为空**（验证缓存同清）；清空后退休年月提示按默认数据重新生成。
- #7：输入页全部输入框数字水平居中（含年度模式各行、账户/利率行）。
- #11：点"开始测算"后立刻（≤100ms）出现半透明遮罩+旋转圆圈+"测算中"文字；计算完成跳结果页；制造校验错误时遮罩不出现/已消失；快速连点按钮不产生两次计算。

### 7.3 批次3
- #12a：R储 说明含"672920（2026-08末）为起点、不拆分/不重复；2026-09~2033-06 新增本金/利息"字样；案1 展示 672920+46984.03+75045.30=794949.33，案2 为 234920.16/84884.69/992724.85；1.5% 带【预估】。
- #12b：R补 区块下方不再出现"本金/利息"行；全页"本金/利息"只在 R储 说明中出现一次。
- #13：新增表 42 行（1992~2033 逐年不缺）；2000=0.4458、2026=2.2000、2027=0.6000、2033=0.3000；1992~1999 标"缺/—"；月均列与 Z实=2.4075 可勾稽；三分项与合计不回归（14468.81 / 17238.88）。

---

## 8. 官方口径 / 工程假设 / 不确定项

**官方口径（有原文/文号）**
- N实98 区间 1992-10~1998-06、连续工龄含视同/实缴：京劳社养发〔2007〕31号第二条(二)（上轮已抓原文）。
- 视同截止/建账起点 1992-10、Z同=1、R储=个人账户累计储存额：183号令 / 京劳社养发〔2007〕21号（21号文正文直链仍缺，沿用上轮判定）。
- Xn/C(n−1) 指数形式：21号文经 29号文、31号文转引可确认；逐字表述待 21号文官方链。

**工程假设（页面须标注）**
- 未来段记账年利率 1.5%、折月复利模型；2026 起指数分母沿用 11937 元/月（2024 全口径）；C平=12049（2025）占位。
- 年度账 zMonthAvg 按 12 个日历月计；denomSource=mixed 为工程合并规则。

**不确定 / 待官方确认（不编造）**
1. 用户 #12a 手算的具体数字未知，§4.4 的"单利 vs 复利 6071 元差异"为最可能解释，非用户确认结论。
2. 京劳社养发〔2002〕27号 / 后联字〔2002〕3号的**全称与官方直链**未在 policyRefs 收录，本文仅按引擎既有注释引用，不展开其条款细节。
3. 1992~1995 指数分母官方归档缺口（T-10）；本案无当年缴费，不影响结果但明细账行只能标"缺"。
4. 21号文正文官方直链、2025 记账利率官方值沿用上轮 T-02/T-04 待确认状态。
5. accountBalanceManual 改必填会改变引擎"无手工余额"契约——对历史测试是破坏性变更，实施前确认团队不再需要纯重建路径（UI 已不可达，但 node 级调用方需排查）。

---

## 附：本轮取证记录
- 拉文件：`win-ssh.sh` + PowerShell `-EncodedCommand` + `[Convert]::ToBase64String([IO.File]::ReadAllBytes())`，10+ 源文件完整拉取，未用 RDP、未动 IDE。
- 引擎实跑：node v22.22.0，My-Case 两案，输出与上轮基准（14468.81/17238.88）一致，新增本金/利息拆分与年度指数表均为本次实算产生。
