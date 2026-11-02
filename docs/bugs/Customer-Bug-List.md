# Customer Bug List — 北京企业养老金测算小程序

> 来源：YDL 在 chat / team-workflow 中明确要求修改的问题（customer-reported）。
> 编号严格沿用 YDL 原始编号，**不改号**；未收录 agent/测试自发现的问题。
> 整理日期：2026-09-24。

---

## BUG-00-0000 (previous Bug 0)
**京劳社养发〔2007〕21号 and 京劳社养发〔2007〕31号 提到了R储 和 R补,以及如何计算。** 请找到这份文件，并修改specification.md: section 2.2。然后相应修改code and test case. 最后重新测试，用miniprogram-automator自动化测试。

## BUG-00-0001 (previous Bug 1)
**手机界面上「实际缴费记录」一节，如果用「年度模式录入」，直接输入年基数，不要用月基数。** 改界面和算法。

## BUG-00-0002 (previous Bug 2)
**报告里 N应缴 为什么是 40.75？** 请 architect 检查有关文件的算法，特别是 N应缴 的起点应该是什么时间，请核实并相应修改。

## BUG-00-0003 (previous Bug 3)
**报告里 R补=0**，但视同期间在事业单位（此信息补充到了 My-Case.md）。请重新计算。

## BUG-00-0004 (previous Bug 4)
**报告里 G同 != 0，G实 = 0**，是不是有问题？请 architect 检查有关文件的算法，核实并相应修改。

## BUG-00-0005 (previous Bug 5)
输入页 Section「视同缴费年限」**用起止年月，不用直接月数**。

## BUG-00-0006 (previous Bug 6)
输入页点击「清空本地录入数据」后，**所有输入框里的数字都没变**，应该都清空。

## BUG-00-0007 (previous Bug 7)
输入页**所有输入框里显示的数字都太靠右了，可以居中**。

## BUG-00-0008 (previous Bug 8)
输入页 Section「个人账户存储与利息」，**直接录入账户累计额，保留「未来段记账年利息」；删除利息模式、计息口径等**。

## BUG-00-0009 (previous Bug 9)
输入页「N实98」**不要输入，计算出来即可**（Refer to Bug 5，利用「视同缴费起止年月」）。

## BUG-00-0010 (previous Bug 10)
输入页「一次性个人账户补贴」是什么？（疑问，需澄清其含义/去向）

## BUG-00-0011 (previous Bug 11)
输入页点击「开始测算」后有短暂计算时间，**在原图上叠加等待沙漏或旋转圆圈**，让用户理解不是卡顿。

## BUG-00-0012 (previous Bug 12)
输出页 R储 的政策说明「即本金 xxx + 利息 xxx」——**这里的本金是从什么时间算起的？肯定不是个人账户里所有的**，请在政策说明写清楚。（用户假定从 2026-09 开始，但与结果差得挺多，请核实。）

## BUG-00-0013(previous Bug 12.1)
输出页 R补 的下方有一段政策说明，但**最下面又重复了「本金/利息」，请删除**。

## BUG-00-0014 (previous Bug 13)
输出页**增加 Z实指数 的按年计算结果 (Xn/Cn−1) 明细账，n = 1992 ~ 2033**。

## BUG-01-0015 (previous Bug 14)
计算 Z实指数 (Xn/Cn−1) 时，**如果不是整年的情况下算法有误，请改正**。

## BUG-01-0016 (previous Bug 15)
输入页「实际缴费记录」的输入，**缺省用「年度模式录入」，而不是月模式**。

## BUG-00-0017 (previous Bug 16)
输入页点击「开始测算」后旋转圆圈**时间太短，要持续到输出页弹出为止**。

## BUG-00-0018 (previous Bug 17)
计算 Z实指数核对：Z实 = SUM((Xn/Cn−1)) / N应缴 = 81.1528 / 32.6667 = **2.4843**（n=2000~2033），但系统算出 **2.4068**、反算 N应缴=33.667。**请检查是什么问题。**

## BUG-00-0019 (previous Bug 18)
计算 Z实指数，**如果 > 3 应取 3.0**（2019 年即因社平缴费基数下降导致 >3.0）。请查官方政策决定输出 Z 时是否加 `min(3, Z实)`。

## BUG-00-0020 (previous Bug 19)
My-Case.md 里 **2026 年数值已变成 287562**，以此为准。请确认 testcase 是否已同步修改。（用户要求 Show testcase file。）

## BUG-00-0021 (previous Bug 20)
**2026 的缴费基数（=1.0）是 12116，12116 × 0.6 ≈ 7270；从 2026-09 开始用 7270，一直到退休。** 请据此改 case。

## BUG-00-0022 (previous Bug 21)
输出页 Z实指数年度明细，计算 (Xn/Cn−1) 时，**如果不是整年，还原到「年计算法」，不用月均值**；这样即可 SUM(34 行)/N应缴，**删掉「边界年提示」**。

## BUG-00-0023 (previous Bug 22)
输入页「视同缴纳年限」——如果没有视同，**起止时间输入框无法清除**。Case MY3/4 里输入框仍残留 Case MY1/2 的旧值，confusing 且删不掉（虽然确实没在运算中使用）。

## BUG-00-0024 (previous Bug 23)
输出页「N应缴」，Case MY3 值是 **38.75，错误**（参保时间 2003-09）。N应缴 计算**第二次出错**。且下方注释仍残留 Case MY1/2 信息「参保时间 2000-11」，让人 confuse。

## BUG-00-0025 (previous Bug 24)
输出页「Z实指数」年明细下方的注释**仍引用 Case MY1/2 的数据**，注释内容没和实际 case 同步更新——这是个 common 问题，改。

## BUG-00-0026 (previous Bug 25)
输入页 section(4)「个人账户储蓄额与利息」可与 section(4)-2「人员身份与R补」**合并为一个 section(4)「个人账户养老金」**，「个人账户储蓄额」与「R补」作为两项。

## BUG-00-0027 (previous Bug 26)
输入页 section(4)-2「企业实际参保缴费起始」**并非仅在有 R补 时才有**。这一项是最基本信息，**挪到 section(1)「基本信息」里**；计算 N应缴 时可使用这个值。

## BUG-00-0028 (previous Bug 27)
I changed the value of POLICY_DATA.version from '2026.09.23-bug2224' to '2026.09.23-bug2526' in file policyData.js in DevTool. But my simulator still shows the old value '2026.09.23-bug2224'. pls check the reason and how to fix it? [Codebuddy fix it]: 在 DevTool里修改的静态数据，被cache里的旧数据覆盖了，simulator总是读取cache (saveDraft: function () { wx.setStorageSync('pension_input_v1',…)})。pension_input_v1的cache数据跟code改动立即变化，必须clear cache data(要重新录入所有缴费信息)，重启simulator, 重启DevTool都不管用.

---

## 附注
- 编号 (previous Bug 12) 在 YDL 原始消息中出现两次（R储 本金说明 / R补 重复「本金/利息」删除），第二个已命名为 **(previous 12.1)**。
- (previous Bug 0) 为最早一条关于「R储 和 R补」的原始要求（京劳社养发〔2007〕21号 / 31号），先于 Bug 1；按用户意见补录。
- (previous Bug 1~4) 首次提出于 2026-09-21，其余分组依次延续；(previous Bug 19/20/21) 为 YDL 对已发现问题的补充明示 + 数据更正。
- 本清单仅收录 customer（YDL）明确提出「改/核实/检查」的项，不含 tester/architect/developer 自查发现的问题。
- (previous Bug 27) 是项目主自己修改的，没有通过Claw AI的处理。Chat历史里没有。


``` phase 2 ```
## BUG-02-0000 (previous Bug 28)
The specification of phase2 and the dedicated test coverage matrix are not in .\docs\ on 开发服务器。And pls confirm the initial covreage matrix has same REQ items and owner assigned with the dedicated test coverage matrix.

## BUG-02-0001 (previous Bug 29)
"方案比较"输入页面，"输入方式"选择时，"手工输入"和"文件输入"两个按钮，没有缺省也没有高亮。反观"基本计算"输入页面，就是对的。

## BUG-02-0002 (previous Bug 30)
"基本计算"输入页面和"方案比较"输入页面，都没有更新版本信息。

## BUG-02-0003 (previous Bug 31)
"基本计算"输入页面和"方案比较"输入页面里，"文件输入"方式测试过吗？测试用的.txt文件放在哪里?

## BUG-02-0004
### testcase ID
- TST-02-UT-1025
- TST-02-UT-1026
- TST-02-UT-1027
- TST-02-MT-9000
- TST-02-MT-9001
- TST-02-GT-4019
- TST-02-GT-4020
- TST-02-GT-4021

### failure description
"方案比较" --> "文件输入" --> e7-my1.txt -->方案卡: 方案卡里只有"退休年月"。那么目前算法的起点是从什么？请加上"缴费起始时间"，并给出缺省值为实际缴费记录里 "最后一个缴费月 + 1月"。

### root cause analysis
**Root Cause（开发复核）**：方案卡仅采集「退休年月/Z/缴费性质」三项，自动缴费段的起点在 `planAssembler` 中被写死为常量 `WINDOW_START_YM='2026-09'`（`paybackModel.ORIGIN_YM`、`rContribution` 同源），没有随实际历史缴费末月动态确定，也不允许用户修改；起点一旦与真实“历史最后缴费月+1”不一致，自动段区间与 R续/回本/账户滚动都会整体错位。

### fix solution description
**Fix Solution（修复，D1）**：① 方案卡新增「缴费起始时间」month picker，**可手动编辑**；缺省值＝实际缴费记录最后缴费月+1月（My-Case 缴至 2026-08 → 缺省 2026-09），由共享区历史段动态推导，不再写死。② 校验：起始月须介于“历史末月”与“退休前一月”之间，越界红字阻断（早于历史末月或晚于退休前一月均提示）。③ `planAssembler`（删除写死起点，改为 `resolveWindowStart/defaultWindowStart`）、`paybackModel.retireOffset`（接受动态 origin）、`rContribution`（透传起点）、`roiModel.buildCaseInput`（同一动态值）四处起点统一由该 `windowStartYM` 贯穿，继续/停保两情形一致。

### fix verification process
- Verification is independently executed by the UT/GT listed in testcase ID; matrix result = PASS.

### bug status
**bug status**: closed（项目主 2026-10-28 批准；修复 + 独立复测通过）

## BUG-02-0005
### testcase ID
- TST-02-UT-1028
- TST-02-UT-1029

### failure description
"方案比较" --> "文件输入" --> e7-my1.txt，个人账户储蓄额，没有利率输入框。应该象"基本计算"里的一样，可以指定利率，利息计算必须持续到退休时年月。另外，现在算法，利率怎么算的?

### root cause analysis
**Root Cause（开发复核）**：`inputValidator.buildSharedInput` 在组装比较路径共享入参时把 `futureMonthlyRate` **写死为 null**，且方案卡/共享区均没有利率输入框；`pensionEngine.calcAccount` 见 `futureMonthlyRate==null` 即走“静态分支”（直接返回手工锚定余额、不计未来利息）。因此方案比较里个人账户从余额月起从未计息，与基本计算（可录利率、走逐月滚动分支）不一致——此即 BUG-02-0006/0007 的同一根因。利率算法：引擎对账户余额采用“年利率/12”的**月复利**，自余额所在次月起、逐月滚到退休前一月（退休当月不计利息），每月还叠加当月到账缴费的 8% 记账额。

### fix solution description
**Fix Solution（修复，D1，按项目主裁定 Q1=B）**：三方案**共用一个**记账利率，输入框放在**共享区**（shared-data，与账户累计储存额同区），**不放**方案卡；文件输入时取 common 段“个人账户利率”作为缺省（My-Case=1.5%），手工录入缺省亦为 1.5%（留空取缺省，填 0 表示不计息，允许 0~20%）。删除 `buildSharedInput` 中写死的 `futureMonthlyRate:null`，按 parseFloat(%)/100 透传该共享利率到每个方案，使 compare 账户进入引擎滚动分支、以该利率逐月计息至退休前一月（继续/停保两情形均接通：停保基准无未来缴费且利率归零）。

### fix verification process
- Verification is independently executed by the UT/GT listed in testcase ID; matrix result = PASS.

### bug status
**bug status**: closed（项目主 2026-10-28 批准；修复 + 独立复测通过）

## BUG-02-0006
### testcase ID
- TST-02-UT-1030

### failure description
"方案比较" --> "文件输入" --> e7-my1.txt，设置方案1：退休年月=2033-07; Z=0.6; 缴费性质=灵活就业。计算后，方案1的个人账户养老金=4919.74，和"基本计算"的不一致(J帐=5803元，利率=1.5%)。个人感觉是"方案比较"里算错了。

### root cause analysis
**Root Cause（开发复核）**：与 BUG-02-0005 同根因——比较路径 `futureMonthlyRate` 被写死为 null，账户走静态分支、未来段零利息，Z=0.6 方案未来缴费与利息都未滚动，导致 R储/J账户 系统性偏小（4919.74），与基本计算的滚动结果（J账 5803，1.5%）不一致。

### fix solution description
**Fix Solution（修复，D1）**：随 BUG-02-0005 接通共享利率滚动分支、BUG-02-0004 动态起点后，同一案例/利率/缴费起始月下，basic 与 compare 走**同一引擎运算路径**。已交付同输入台账（tests/bug02-0004-0007-check.js，TST-02-UT-1030）：利率 0/1.5% 两档、Z=0.6/3.0 下 R储/J账户/P月 两路径差均为 0（判据 ±0.001）。注：不以 GUI 旧值 5803/4919.74 为修复目标，最终绝对数以修复后台账由项目主判定。

### fix verification process
- Verification is independently executed by the UT/GT listed in testcase ID; matrix result = PASS.

### bug status
**bug status**: closed（项目主 2026-10-28 批准；修复 + 独立复测通过）

## BUG-02-0007
### testcase ID
- TST-02-UT-1031

### failure description
"方案比较" --> "文件输入" --> e7-my1.txt，设置方案3：退休年月=2033-07; Z=3.0; 缴费性质=灵活就业。计算后，方案3的个人账户养老金=4936.16，和"基本计算"的不一致(J帐=6651.57元，利率=0)。类似BUG-02-0006, 个人感觉是"方案比较"里算错了。

### root cause analysis
**Root Cause（开发复核）**：同 BUG-02-0005/0006——比较账户静态分支不滚动，Z=3.0 方案未来高基数缴费（8%记账额）与利息均未计入，R储/J账户 偏小（4936.16），与基本计算不一致。

### fix solution description
**Fix Solution（修复，D1）**：随 0005/0004 一并修复。同输入台账（TST-02-UT-1030/1031）证明：basic 与 compare 在利率 0/1.5%、Z=0.6/3.0 下 R储/J账户/P月 两路径差均为 0（±0.001）；且 compare 方案 J账随 Z(0.6→3.0) 显著拉开（利率0档 J账 1815.17→2978.31；1.5%档 1994.83→3218.86），不再是静态分支下的近似相同值。不以 GUI 旧值 6651.57/4936.16 为目标，最终绝对数以修复后台账由项目主判定。

### fix verification process
- Verification is independently executed by the UT/GT listed in testcase ID; matrix result = PASS.

### bug status
**bug status**: closed（项目主 2026-10-28 批准；修复 + 独立复测通过）

## BUG-02-0008
### testcase ID
- TST-02-GT-4032

### failure description
"方案比较"页在入口页**不填任何个人信息、直接用"文件输入"导入完整案例文件**时，两张用户从未触碰的默认方案卡，其"退休年月"停留在演示默认出生年（1965-10）推导出的陈旧值 **2026-01**，不随导入后真实出生年月（My-Case birthYM=1973-07，法定退休应为 **2035-09**）刷新，且该错误值已 persist 到本地 draft（pension_plans_v1）；导入后两张卡即处于非法（退休月早于历史末月）状态，用户须手动逐卡重选才能继续。

**复现前置**：entry 页不填写任何个人信息（birthYM 等保持演示默认 1965-10），直接进入"方案比较"→"文件输入"→导入 tests/fixtures-case/My-Case.md（完整文件，非仅 common 段）。属 E4 公共信息预填路径，与"先在 entry 填真实出生年再进 compare"的既有用法不同。

**影响**：2026-01 早于实际历史末月 historyEndYM=**2026-08**（也早于缴费起始缺省 2026-09），planModel 退休年月校验必判"退休月过早/早于最后缴费月"，两张默认卡导入即非法、阻断"开始比较"；错误值已 persist，重进页面仍残留，用户必须手动逐卡重选，违背"文件导入公共信息即可快速建案"。注：本缺陷**不影响**缴费起始月缺省——windowStartYM 为空时 startText=defaultWindowStartYM=historyEnd+1=2026-09，导入后 ctx 正确、起始月缺省正确。

### root cause analysis
**Root Cause（根因假设，基于源码 + dec 现象，待开发复核）**：① `inputPageModel.buildInitialData(true)` 给 shared-data 演示默认 male/birthYM=**1965-10**；② compare 首帧 plan-list attached 用该演示 ctx 调 `initialPlans → defaultRetireYM(1965-10)=2026-01`，写入每张卡并 persist；③ 文件导入 `shared-data.applyPrefill` 把 birthYM 改为 1973-07 并触发 ctx observer，但 plan-list observer 对退休月的重算条件是"`!retireTouched && !retireYM` 才补默认"，此刻 retireYM 已非空（2026-01）→条件不成立、**不重算**，陈旧值保留；④ compare 文件导入路径本身也不重建/校正 planList 的卡。即"attached 阶段用演示 ctx 预填退休月"与"observer 仅在退休月为空时才补默认"两处逻辑冲突，系统默认值与用户已选值之间缺少 `retireTouched` 之外的"是否系统默认值"区分。

### fix solution description
**Fix Solution（修复方向，三条择一/组合，本轮不实施）**：方向一——plan-list 的 ctx observer 去掉 `!retireYM` 限制，对所有 `retireTouched===false`（用户未手选）的卡一律以新 ctx 法定退休月重算，仅用户触碰过（true）才保留手选值；方向二——compare 文件导入 applyPrefill 成功后用真实 ctx 重新 `initialPlans()`/批量刷新所有未触碰卡的 retireYM，或在拿到真实公共信息前不预建卡（初始 retireYM 置空）；方向三——initialPlans 对缺省卡 retireYM 一律置空，交由 observer 在 ctx 为真实输入后统一填法定值，从源头避免演示出生年（1965-10→2026-01）被固化。

### fix verification process
> 本台账惯例只收 customer 明确提出项。**本条非 customer 提出**，系 tester（worker4 / Senior Wechat Tester YDL）独立 GUI 取证发现，经**项目主 2026-10-13 批准特批写入**（内部台账第 32 项，沿用 BUG-02 内部编号，不占 customer previous Bug 号）。**本轮不修复**，待 BUG-02-0004~0007 全部 PASS 后单独排期。
**独立证据（tester 独立采样，非引用 developer；fresh cli auto 口 40234，单连接 reLaunch entry→清双 draft→goCompare→导入完整 My-Case.md）**：
- Windows 证据文件 `system_test/output/t47/dec.txt`、`dec-run.log`（DEC_EXIT=0），脚本 `C:\t44\t47-dec.js`；本地报告 `output/p-mu45ws9mfajyky-worker4/t47-premise-and-bug-findings.md`。
- 导入前回读：pageCtx/sharedCtx `birthYM="1965-10"`；两张默认卡 `retireYM="2026-01"`、`retireTouched=false`，已 persist draft。
- 导入后回读：pageCtx `birthYM="1973-07"`、`historyEndYM="2026-08"`（公共信息正确回填）；但两张卡 `retireYM` 仍为 "2026-01"、`retireTouched=false`，draft 内同为 2026-01。
- 独立纯 node 跑 `planModel.defaultRetireYM(ctx)`（`retireSchedule.statutoryRetireYM`）：male/1973-07 法定退休月=**2035-09**；而 2026-01 恰是 male/**1965-10**（`inputPageModel.buildInitialData` 演示默认出生年）的法定退休月。

**回归点**：① 清 draft→entry 不填信息→直接 compare→文件导入 My-Case：两张卡 retireYM 应=**2035-09**（非 2026-01），无"退休过早/早于最后缴费月"红错，draft 内同为 2035-09；② 同路径导入 MyWife-Case（女性 1981-07）：默认退休月按性别/femaleType 正确计算，不残留 2026-01；③ 用户手动改过退休月（retireTouched=true）后再导入/改公共信息，手选值**不得**被覆盖；④ entry 正常填真实出生年再进 compare 的既有用法，以及 compare 三卡新增/删除/结果计算，不得回归。

**修复与独立验收（2026-10-28，项目主 2026-10-28 00:24 授权其休息后自主修复）**：① architect task-76 独立源码复核，将机制定位得比原根因假设更准——attached 时 ctx 尚为空、卡 retireYM 亦为空；真正写入演示陈旧值 2026-01 的是随后 onReady→syncCtx 在演示 ctx(1965-10) 下触发的 observer（原条件 `!retireTouched && !retireYM` 成立→填 2026-01 并 persist）；导入后 ctx=1973-07 再触发 observer，因 retireYM 已非空致条件不成立、陈旧值残留。三方向中选定【方向一】（最小回归面），设计见 output/p-mu45ws9mfajyky-worker2/bug02-0008-fix-design.md。② developer task-77 实现：planModel 新增纯函数 `syncUnspecifiedRetire(plans,ctx)`（retireTouched=true 保留手选；want 空或法定值与现值相同则不改、幂等），plan-list observer 去掉 `&& !p.retireYM`、仅按 `!p.retireTouched` 对所有未手改卡随最新 ctx 重算并 persist；新增 TST-02-UT-1037（28 断言），commit 6e8ea72 经 Manager 独立复核（diff + 独立复跑 UT1037=28/0；全量唯一异常 utils/assert-bug25-26.js 10 条输入页 UI 断言已在父提交验证为修复前历史过期断言、非回归）后经 Windows 推送。③ tester task-78 独立 GUI 验收（非引用上游回显，新建独立 testcase TST-02-GT-4032，常驻口 40215）：**33/33 PASS**——A My-Case(male1973-07) 导入后两卡=2035-09（非2026-01）/touched=false/storage 同/无红错/补全后可开始比较；B MyWife(1981-07) 导入默认 male=2044-07 不残留 2026-01，共享区正规交互切 female worker=2034-11、cadre=2039-06；C 脏 draft(2026-01/touched=false) 导入后自愈=2035-09 落 storage；D 手选 retireTouched=true(2035-03) 后改出生年/再导入均不覆盖；E 手工既有路径、三卡增删、手工建卡补全历史后比较两列 P月=15045.76/16577.37 有限正值零回归；独立复跑 UT-1037 28/28；矩阵新增 GT-4032 行 PASS（bug 列保留），commit d25d2ee 经 Windows 推送 origin/master。

**性别前提说明（Manager 已独立核实）**：MyWife-Case.md 无性别字段，services/caseValidator.js L64 `gender: options.gender \|\| 'male'`，导入不传性别即默认 male，故“导入即女性档”在现有解析下不会自动发生；B 点按“导入不残留 2026-01(male 2044-07)＋共享区正规交互切 female 验女性法定值”覆盖，符合工单“按性别/femaleType 正确计算”。夹具/解析自动识别性别属需求改动，已另报项目主裁定。

> **项目主 2026-10-28 10:43 裁定（无需改）**：gender 仅影响“预计退休时间”；My-Case.md / MyWife-Case.md 中 4 个 customer testcase 均已显式指定退休时间，故夹具内不必添加 gender 字段。本条关闭，不做解析/夹具改动。

**当前状态＝closed（修复并独立复测；项目主 2026-10-28 10:43 批准 close）**。

### bug status
**bug status**: closed（项目主 2026-10-28 批准；修复 + 独立复测通过）

## BUG-02-0009
### testcase ID
- TST-02-GT-4021
- TST-02-UT-1027

### failure description
"方案比较"页文件导入后，方案卡**缴费起始时间（缴费起始月）的下界越界校验存在 off-by-one**：当用户把缴费起始月选成**恰等于实际缴费历史最后一个月**（My-Case 历史末月 historyEndYM=**2026-08**，起始月取 2026-08）时，`isValidPlan` 仍返回 **true**、起始月无任何红色错误提示，本应按"起始月须为最后缴费月+1（2026-09）起"被拦截的等值边界被错误放行（严格早于的 2026-07 才能被拦）。

**现象**：起始月=2026-08（=历史末月）时 isValidPlan=true、planErrors 中无缴费起始月红错；assemblePlanInput 仍正常出方案。对照：2026-07（早于历史末月）被正确拦截（"缴费起始时间 2026-07 早于最后缴费月 2026-08，不能比较"），2026-09（历史末月+1，即动态缺省值）合法，上界 2033-08（=退休当月）被正确拦截（"不得晚于退休前一月（退休 2033-08）"）、2033-07（=退休前一月）合法，留空 resolve 成缺省 2026-09 合法。

**复现前置**：entry 不填信息→"方案比较"→"文件输入"→真实文件链路导入 tests/fixtures-case/My-Case.md（写真实 USER_DATA_PATH 文件→mock chooseMessageFile→onChooseCaseFile 真实解析；ctx: gender=male, birthYM=1973-07, historyEndYM=2026-08）。导入后在小程序运行时 `require('calculator/planModel.js' / 'planAssembler.js')` 只读回读 isValidPlan/planErrors/assemblePlanInput，临时 plan 仅作纯函数入参，不回写页面、不点原生月滚轮、不调 onCardChange。上界口径取 retireYM=2033-08（退休前一月=2033-07）。

**影响**：起始月=2026-08 被放行后，assemblePlanInput 生成的自动 flexible 段首月=**2026-08**（区间 2026-08→2033-07），与历史段末段（…→**2026-08**）在 **2026-08 当月形成闭区间重叠**：该月既按历史 baseMonthly(35945.25) 又按自动段 B=Z×C(7269.6) 重复计入（同月双计）。直接污染账户滚动（J账/个人账户累计）、R续 及最终 P月，使其偏大；起始月=2026-09 时自动段首月=2026-09，两段不重叠，结果正常。

### root cause analysis
**Root Cause（已定位源码，非猜测）**：下界校验用了严格小于而非"小于等于"。
- `calculator/planAssembler.js` 的 `validateWindowStart`（约 :48）：`if (historyLast && D.toIndex(start) < D.toIndex(historyLast)) return '缴费起始时间 ... 早于最后缴费月 ...';`
- `calculator/planModel.js` 的 planErrors（约 :125）：`if (... D.toIndex(windowStartYM) < D.toIndex(h)) ...` 同源。
- 当 start==historyLast（2026-08==2026-08）时 `<` 为 false → 漏拦截；而同函数上界 `toIndex(start) > toIndex(retireYM)-1`（含端点，=退休前一月合法）才是正确写法，下界应对称要求 start ≥ historyLast+1。函数注释自述"须介于历史末月与退休前一月之间（含端点）"，与客户原始诉求缺省="最后一个缴费月 **+1月**"共同表明 2026-08 不合法。
- UT 缺口：tests/bug02-0004-0007-check.js 的 TST-02-UT-1027 未覆盖"起始月恰好=历史末月"等值边界，故 developer UT 全绿但漏过此 off-by-one。

### fix solution description
**Fix Solution（本轮不实施，交开发）**：① planAssembler.js `validateWindowStart` 下界改为含端点：`D.toIndex(start) <= D.toIndex(historyLast)` 即拦截（等价 start 须 ≥ historyLast+1），错误文案与产品确认（建议"不得早于最后缴费月的次月"）；② planModel.js planErrors 同源行同步 `<`→`<=`；③ 同步订正函数注释"含端点"表述（下界实为历史末月+1 起，端点 2026-08 不合法），避免注释与实现背离；④ TST-02-UT-1027 增补等值边界：start=historyLast 必须拦截、start=historyLast+1 合法，并断言 assemblePlanInput 在合法起点下自动段首月=historyLast+1、历史段与自动段月份零交集。

### fix verification process
> 本台账惯例只收 customer 明确提出项。**本条非 customer 提出**，系 tester（worker4 / Senior Wechat Tester YDL）独立 GUI 取证发现，经**项目主 2026-10-14 批准登记**（下一可用内部号 BUG-02-0009，0008 已占；沿用 BUG-02 内部编号，不占 customer previous Bug 号）。**本轮不修复**，待 BUG-02-0004~0007 收口后单独排期。
**独立证据（tester 独立采样，非引用 developer；常驻 automator 口 40215，用例间只 connect/disconnect，零 RDP）**：
- 权威基线 **aefeb43** 复现：summary `gt4021-20261014-123208.summary.json`、trace `gt4021-20261014-123208.trace.txt`、截图 `gt4021-20261014-123208.png`（TS=20261014-123208；14c4820 首轮 TS=20261014-120513 同结论）。
- 缺陷报告与小报告：`output/p-mu45ws9mfajyky-worker4/bug02-0004-0007-gui-regression/task53/BUG-02-0009-GT4021-lower-boundary-offbyone-20261014.md`、`T2A-report-GT4019-4021-20261014.md`。
- 两路一致：除小程序运行时回读外，另在本地独立克隆用 GUI 导出的真实 sharedInput（`gt-my-20261014-115327.sharedinput.json`）重算 assemblePlanInput 复核。
- Manager（worker1）已独立读 123208 summary 复核，retire=2033-08 与 2033-07 两场景 2026-08 均 valid=true 被错放，FAIL 成立。

**回归点**：① 修复后重跑 GUI GT-4021（回归脚本 `autotest` 侧 t47 / worker4 `scripts/gt4021-regression.js`，expect 显式含 2026-07 reject）：2026-08 应转 isValidPlan=false 且有起始月红错；2026-07、2033-08 仍拦截；2026-09、2033-07、留空 仍合法；② 三断言：=历史末月拒 / =末月+1合法 / 任何合法起点历史段与自动段零重叠（自动段首月>历史末月）；③ 回归 GT-4019/4020 动态缺省不受影响（缺省仍=历史末月+1：My 2026-09、wife 2026-01）；④ 原生月滚轮手工滚到历史末月当月也应红错拦截（红点/滚轮点选归 MT-9002 人工确认）。

**修复与独立验收（2026-10-28，项目主 2026-10-28 00:24 授权其休息后自主修复）**：① developer task-74 按 Fix Solution 修复两处下界 `<`→`<=`、文案改「不得早于最后缴费月的次月」、订正注释、补 TST-02-UT-1027 等值边界，本地 commit e530e95；Manager 独立复核 diff + 独立复跑 UT（1025 3/0、1026 3/0、1027 15/0）后经 Windows 推送（e530e95）。② tester task-75 独立 GUI 验收（非引用 developer 回显）：GT-4021 回归 13/13 PASS（2026-08 等值现正确拦截、2026-07/2033-08 仍拦、2026-09/2033-07/留空合法；真实 sharedInput 复核合法起点自动段首月=历史末月+1、历史/自动段月份零交集）、独立复跑 UT-1027 15/15、developer_test 全量 42 文件/537 断言零失败；矩阵 GT-4021 FAIL→PASS（bug 列保留）；结构按一 testcase 一入口整改（删旧入口 gt4021-planstart-boundary.js、保留单一 gt-4021-task75.js），commit 95a26cc 经 Windows 推送 origin/master。

**当前状态＝closed（修复并独立复测；项目主 2026-10-28 10:43 批准 close）**。

### bug status
**bug status**: closed（项目主 2026-10-28 批准；修复 + 独立复测通过）

## BUG-02-0010
### testcase ID
- TST-02-UT-1032
- TST-02-UT-1033
- TST-02-UT-1034
- TST-02-UT-1035
- TST-02-UT-1036
- TST-02-GT-4029
- TST-02-GT-4031

### failure description
"方案比较"页经"文件输入(.md/.txt)"导入含缴费记录表的共用案例（如 tests/fixtures-case/My-Case.md）后，点"开始比较"虽成功跳转到比较结果页，但结果页**整页无法构建任何方案数据**：`ready=false`、比较列 0、`loadError` 为空，屏幕仅剩标题"比较结果"和"返回方案输入页"按钮（无数据、无错误文案的白屏兜底）。手工"分段(bound)"通道不受影响。

**复现前置（修复前基线 ffcd5d5）**：entry 不填信息→"方案比较"→"文件输入"→真实文件链路导入 tests/fixtures-case/My-Case.md（历史 27 缴费段，余额锚点 672920/2026-08，利率 1.5%）；用 plan-list 真实方法 applyPlans 补两张合法且不同方案卡（退休/Z/缴费性质齐全），点击页面真实"开始比较"。常驻 automator 口 40215，用例间只 connect/disconnect，零 RDP。

### root cause analysis
**Root Cause（已定位源码，非猜测）**：
- 文件导入与手工"年度模式"走 year 通道：`services/caseValidator.js mapParsedToPageData` 生成 yearRows 只有 `{year,startMonth,annualBase,months}`（旧夹具/旧解析无身份列），`inputPageModel.emptyYearRow()` 亦无 type。
- `calculator/inputValidator.js buildSharedInput`（约 :169）段映射直接 `type: s.type`，对 year 通道 `s.type===undefined` 不做默认兜底；而 basic 通道 `buildInputLike`（约 :91）是 `type: s.type || 'enterprise'`、手工 bound 段默认 enterprise。两通道口径不一致，历史段 type=null 通过共享区校验（共享校验不查 type）却被引擎 `pensionEngine` 入参校验（type 须 ∈{enterprise,flexible}）整段拒绝。
- `pages/compare/compare.js startCompare` 只按 isValidPlan 过滤方案卡、不预检历史段 type，照常 navigateTo；`pages/compare-result/compare-result.js onLoad→rebuild→buildView` 无 try/catch，buildView 抛错后 ready 恒 false，wxml 兜底块显示空 loadError，形成"无数据无提示"白屏。
- 该 type 透传映射随 D2 共享数据组件引入（commit 8e76fa1）起潜伏；只要文件/年度行不带身份就必现。

### fix solution description
**Fix Solution（开发 worker3 task-58，提交 0bc2775，已落地）**：
1. `services/caseFile.js`：缴费表由旧 3 列扩为 **5 列＝年份|养老缴纳基数(年)|年内起始月份(1~12)|年内缴纳月数|缴费身份**；新增全仓库唯一 `mapIdentityToType`（单位/企业职工→enterprise，灵活/灵活就业/失业灵活就业→flexible，无法识别逐行报错）；5 列读 startMonth（1~12 整数校验）+身份，**旧 3 列向后兼容**（startMonth 缺省 1、身份缺省 enterprise）；records 增加 startMonth/type 及行号。
2. `services/caseValidator.js`：复用同一身份映射；mapParsedToPageData 透传 startMonth/type（不再硬编码 '1'/缺身份）。
3. `calculator/inputValidator.js buildSharedInput` 与 `calculator/planAssembler.js cloneSharedInput` 段映射补 `type: s.type || 'enterprise'`，与 buildInputLike 口径统一（双保险）。
4. 结果页容错：`compareResultModel` 新增 `buildViewSafe`（纯 buildView 仍抛错供预检/单测，safe 捕获返回可读 error）；compare-result `rebuild` 改走 safe，异常置 ready=false+可读 loadError 不白屏；compare `startCompare` 跳转前 buildViewSafe 预检，段身份非法在输入页 toast 拦截不跳转。
5. 逐字节对齐项目主权威新夹具（tests/fixtures-case 与 docs/mycases 各 2 份，LF）：My-Case 首段 2000 由旧缺省起始月 1 **纠正为 11**（2000-11~2000-12，与建账 2000-11 对齐）；MyWife 2003=09 起 4 月、2005=01 起 7 月、2006=04 起 9 月。新增 tests/bug02-0010-check.js（62 断言，入 run-unit-tests.bat）。

### fix verification process
> 本台账惯例只收 customer 明确提出项。**本条非 customer 提出**，系 tester（worker4 / Senior Wechat Tester YDL）在 task-54（BUG-02-0005 独立 GUI 验收 GT-4029）真实文件链路回归时独立 GUI 取证发现，经**项目主 2026-10-14 16:10 批准**登记（下一可用内部号 BUG-02-0010，0009 已占）并**裁定方案 A 本轮立即修复**；开发 worker3 于 task-58 修复，提交 **0bc2775**，tester worker4 同轮真实链路复测通过。状态见 bug status 行。
**独立证据（tester 独立采样，非引用 developer）**：
- 端到端白屏：`output/.../task54/screenshots/probe-e2e-20261014-142052.png`、`logs/probe-e2e-20261014-142052.trace.txt`、`json/probe-e2e-20261014-142052.summary.json`（跳转后 ready=false、view 空、0 列）。
- 三引擎路径一致报错：`json/probe-bv-20261014-141752.summary.json`——运行时生产 `compareResultModel.buildView`、`roiModel.computeROI`、`planAssembler.assemblePlanInput + Engine.calculate` 均抛 `输入校验失败：缴费段1身份类型非法；…；缴费段27身份类型非法`；`buildValidatedInput()` 的历史 27 段 `histTypeSet=[null]`、seg0=`{startYM:'2000-01',endYM:'2000-02',baseMonthly:3071}`（旧 3 列夹具起始月按缺省 1）。
- 两路一致：另在本地克隆用 parseCaseFile→validate→buildSharedInput→assemblePlanInput→calculate 复算同样抛"缴费段身份类型非法"；手工 bound 通道（段默认 type='enterprise'）本地实测可正常计算（P月=9429.31）。
- 覆盖缺口说明（Manager worker1 独立复核解开 GT-4010 表面冲突）：task-52 GT-4010 当年 harness `t41-p2-accept.js:285` 对手工段手工盖章 enterprise，未对真实文件 yearRows 无 type 主链路做端到端覆盖，故当时 PASS，非数值误判。
- 隔离佐证（非生产路径）：对共享入参内存副本补历史段 type='enterprise'（不回写页面）后 continue/stop 9/9 PASS（`json/gt4029v2-20261014-145854.summary.json`），证明 BUG-02-0005/0007 利率透传与 continue/stop 逻辑本身正确，仅被本缺陷挡在引擎入口。

**复测（tester worker4，基线 0bc2775，常驻口 40215，独立取值，非引用 developer 数字）**：
- **GT-4029 真实链路 12/12 PASS**（`json/gt4029reg-20261014-180229.summary.json`）：文件导入→两张合法不同卡→真实开始比较，结果页 ready=true、2 列、loadError 空、P月 13290.66(z0.6)/13726.27(z1.0)（与 tester 本地独立重算一致）；27 历史段全 enterprise、seg0=2000-11~2000-12；continue 利率 0.015 透传至退休前月、自动段 B=Z×C、账户滚动计息，stop 无自动段、利率归零、静态锚定余额零计息。
- **GT-4031（5 列起始月+身份解析）12/12 PASS**（`json/gt4031-20261014-182115.summary.json`）：My 27 段 seg0=2000-11~12 enterprise(baseMonthly 3071)、全 enterprise；MyWife 设女性/女工人后 23 段，seg0=2003-09~12、2005=01~07、2006=04~12 全 enterprise，两卡（产品法定退休月 2034-11，z0.6/z3）真实结果页 ready、P月 8465.41/11179.12（与独立重算一致）；临时 5 列含「灵活」行→flexible(2010-03~04)；旧 3 列→startMonth 缺省 1、type 缺省 enterprise（向后兼容）；非法身份「外包」、起始月 13 均逐行 fileErrors 拦截。
- **GT-4026 回归 7/7 PASS**（`json/gt4026-20261014-180358.summary.json`）：共享利率缺省/留空回退 1.5%、录"0"=0 可算、录"25"越界红错阻断、利率只在共享区 plan-card 无利率字段，修复后无回归。
- GUI 零回归：三轮常驻口只 connect/disconnect、零 RDP；业务轮 WeappLog 计数 utility-exit/force-close/opened 无新增（8/9/9，9/9 为批准启动器 T47Launcher40215 拉起 automator 附加项目的通道固有增量，非业务脚本），40215 全程 Listen。

**回归点（已覆盖/后续保留）**：① 真实 5 列文件（含灵活身份）文件导入→结果页渲染；② 旧 3 列文件仍可导入不白屏；③ 非法身份/非法起始月输入页可读拦截；④ 手工 bound/年度两通道结果一致；⑤ GT-4026 利率链路、GT-4029 continue/stop 长期回归。

### bug status
**bug status**: closed（项目主 2026-10-28 批准；修复 + 独立复测通过）

## BUG-02-0011
### testcase ID
- TST-02-MT-9003

### failure description
缴费基数和每月缴费的精度有误，应该**精确到个位，四舍五入**。
复现："方案比较" --> "文件输入" --> e7-my1.txt --> 方案卡 -> Z值=0.6。目前计算 2026.9 之后的缴费基数和每月缴费值精确到小数点后 2 位：12116*0.6=7269.6，月缴=7269.6*20%=1453.92。官方口径（项目主实测口径）应为：12116*0.6=7269.6 => **7270（精确到个位，四舍五入）**，月缴=7270*20% => **1454（精确到个位，四舍五入）**。
要求：修改代码；并由 worker2 查找有无相关官方文件说明该四舍五入算法，更新到项目相应文档与 code 中。

### root cause analysis
待 developer（worker3）定位、architect（worker2）核对官方口径后回填（已派工，本节随后补实测根因与源码行号）。

### fix solution description
YDL(项目主)：问题描述有误。缴费基数和每月缴费的精度没有“**精确到个位，四舍五入**”的提法。之所以Z=0.6时看到四舍五入到个位，只是因为它是下限值，官方文件的额外处理。如果缴费基数为Z=0.7, Z=1.3, 就不会有四舍五入到个位的情况。所以问题的提法有误。进一步的action放到BUG-02-0014.

### fix verification process
（2026-10-29 tester worker4 独立验收）项目主 2026-10-28 复核确认：0011 原提法「精度到个位四舍五入」不是通用规则——Z=0.6 时所见取整属该情形下限值的额外处理，Z=0.7/1.3 并不取整；故本票裁定 **cnn（correction not needed）**，相关代码改动全部回滚。
tester 独立实测佐证（基线 7723276，产品模块直算）：`planAssembler` 自动段 `baseMonthly = z × c` 为裸值 7269.599999999999（未取整），与项目主复核结论一致，属**当前正确状态**；不据此判缺陷。
取整相关的一切判断推迟到 BUG-02-0014，本轮不做。

### bug status
**bug status**: cnn（项目主 2026-10-29 决定关闭：原提法有误、非缺陷，属取消类闭环）

## BUG-02-0012
### testcase ID
- TST-02-MT-9003

### failure description
"方案比较"的输出页面，ROI 的计算细节没有显示。需要找一个合适的地方显示，例如在"数值下钻" -> "查看明细"中展示 ROI 计算细节。

### root cause analysis
展示层缺失，非计算错误。独立源码复核（基线 ee67b1f）：
1) 计算侧已具备：`calculator/roiModel.js computeROI()` 已完整产出 ROI 全链条——`pMonthly`（继续缴费 P月=continueResult.pension.total）、`baselineMonthly`（停保 0 投入基准 P月=baselineResult.pension.total）、`rContinued`（R续累计）、`roi`/`roiRounded`/`percentText`、`status`('ok'|'blocked')/`reason`、`eligible`/`baselineEligible`、`minRequiredMonths`/`baselineTotalMonths`；公式 `roi=(pMonthly-baselineMonthly)/rCont`（roiModel.js L98）。
2) 视图编排侧断链：`calculator/compareResultModel.js buildView()` 的 `drills`（第 5 步，原 L163-207）只装配了 history/deemed/account/customCYear/pension(三分项)/cashflow 六项，**未把 roiModel 的 ROI 产出透传到 drills**；`columns` 只取了 `roiText`/`roiStatus`（表格单格文本）与 `rank`。
3) 页面侧无承接：`pages/compare-result/compare-result.wxml` 下钻弹窗（"数值下钻→查看明细"，cr-sheet-body）原有 5 个 section 无任何 ROI 段；`compare-result.js` 的 `openDrill` 仅按 `view.drills` 取对象，无 ROI 字段可渲染。
结论：ROI 数值确实算出来了，但结果页下钻视图从未包含 ROI 明细字段与展示节点，用户只能看到表格里一个 ROI 百分比，无法看到"分子/分母/结果"的推导过程。属纯展示层缺失（BUG-02-0012），与 BUG-02-0011 的取整口径无关（该票已 cnn 作废）。
### fix solution description
已在「数值下钻 → 查看明细」弹窗中新增「ROI 计算细节」section（进入即展开，位于"月养老金三分项"之后、"相对基准净差额现金流"之前），纯展示层改动、不重算任何计发数值。

改动清单（commit **b6c82b9**，基线 ee67b1f，未 push）：
1) `calculator/compareResultModel.js`
   - 新增纯函数 `buildRoiDrill(it, contMonths, userRatePercent, pbRes)`：只做展示派生（月差额、回本文案、只读上下文），字段全部透传 roiModel 实际产出；
   - `drills` 每项新增 `roi` 字段；`module.exports` 增列 `buildRoiDrill`（便于单测）；
   - 未改动任何计发/ROI/payback 计算逻辑。
2) `pages/compare-result/compare-result.wxml`
   - `cr-sheet-body` 内新增 `<view class="cr-dr-section">ROI 计算细节</view>`；
   - 复用既有 `cr-dr-section/cr-dr-h/cr-dr-row` 样式，**未新增 wxss、未新增组件**；
   - 正常分支展示：用户年利率（只读上下文）、回本情况（只读上下文，源自 paybackModel 的 branch/ceilMonths）、继续缴费 P月（分子基准）、停保 0 投入基准 P月、月差额（继续−停保）、R续累计（含缴费月数）、`ROI = 月差额 ÷ R续`（百分比 + 4 位原值）；
   - blocked 分支展示：ROI 不可用 + 阻断原因 + 最低需缴月数 + 停保累计缴费月数 + 继续情形是否满足按月领取（不展示公式链，避免误导）。
3) `developer_test/TST-02-UT-1039/roi-drill-check.js`（新增，55 断言）
   - 正常分支：roi 对象存在性、字段完整性（16 项 key）、与 roiModel 独立算值逐项比对（pMonthly/baselineMonthly/rContinued/roiRounded/percentText）；
   - 数值勾稽：月差额 = P月 − 基准；ROI = (P月−基准)/R续（原值恒等 + 4 位舍入容差）；两方案均验；
   - blocked 分支：status/reason/roiRounded=null/percentText=''/baselineEligible=false/月数依据齐全且自洽（停保累计 < 最低需缴）；
   - `buildRoiDrill` 纯函数边界（无 payback 结果不炸）；
   - 回归：drills 既有 6 字段与 columns.roiText 未被破坏。

验证：TST-02-UT-1039 pass=55 fail=0；全量 developer_test **43 文件 pass=620 fail=0 failFiles=0**（原 565 + 新增 55），零回归。

字段来源严格取自 roiModel 实际产出，未臆造；"回本月份/未回本原因/年利率"属 `calculator/paybackModel.js`（branch A/B/C/BASELINE、months/ceilMonths/rate），在本 section 仅作只读上下文展示，不参与 ROI 公式。
### fix verification process
待 tester（worker4）独立 GUI 复测（不引用开发回显，独立读 page.data + 截图）：
1) compare 文件输入完整案例（如 e7-my1.txt）→ 开始比较 → 结果页点任一方案"数值下钻 → 查看明细"；
2) 断言弹窗内出现「ROI 计算细节」段，且正常情形 7 行齐备（用户年利率 / 回本情况 / 继续缴费 P月 / 停保基准 P月 / 月差额 / R续累计 / ROI 公式与百分比）；
3) 独立核算：月差额 = 继续P月 − 停保基准P月；ROI ≈ 月差额 ÷ R续（与页面显示一致）；
4) blocked 场景（历史缴费月数不足致停保基准不合格）：ROI 段显示"不可用 + 原因 + 最低需缴月数 + 停保累计月数"，不显示公式链；
5) 回归：三分项/现金流/回本双列/条形图/导出报告均正常；
6) 证据：page.data 回读 + storage 回读 + 至少 1 张 automator 原生截图，结论独立判定。

**实测结果（2026-10-29 tester worker4 独立验收）**：独立 GUI 验收 **10/10 PASS**（TST-02-MT-9003，常驻口 40215 只 connect/disconnect，基线 7723276）：
①结果页 ready、2 列；`view.drills[*].roi` 每项存在且核心 15 字段齐备（ok/status/reason/userRatePercent/paybackText/paybackSub/pMonthly/baselineMonthly/deltaMonthly/rContinued/contMonths/roiRounded/percentText/minRequiredMonths/baselineTotalMonths/eligible/baselineEligible）；
②勾稽：月差额 = 继续P月 − 停保基准P月（两方案均真）；ROI = (P月−基准)/R续（两方案均真）；
③页面 roi 与 node 侧 `roiModel.computeROI` **独立重算逐项一致**（status/pMonthly/baselineMonthly/rContinued/roiRounded/percentText 全 match，未引用开发回显）；
④真实 openDrill 下钻：drillId=p0、drill.roi 存在、percentText=2.12%（列 ROI 2.12%/0.86%）；
⑤回归：drills 既有 history/deemed/account/pension/cashflow 五项仍在、columns.roiText 正常非空。
证据：`system_test/TST-02-MT-9003/logs/result-GT4033-0012.json`、`GT4033-roi-drill.png`、`run-trace.log`。

### bug status
**bug status**: closed（项目主 2026-10-28 批准关闭口径；修复 + tester 独立 GUI 验收 10/10 PASS，2026-10-29 tester worker4 独立验收）

## BUG-02-0013
### testcase ID
- TST-02-MT-9003

### failure description
./pension/autotest/ 目录再次出现，需 worker4 检查其内容是 testcase 正式 log 还是临时测试输出，并挪到合适位置（参照 project-documentation SKILL）。
另：临时文件不得放在 ./pension/ 下，./pension/temp/ 目录是错误的，应删除；测试生成的文件只要不是 official log，就不要放在 project folder 内。./pension/temp/ 现有内容移至 C:\Users\Administrator\Desktop\Wechat projects\temp\。项目主已将此要求更新到 INPUT-COMMON.md。

### root cause analysis
（tester worker4 核查 autotest/ 与 temp/ 内容及来源，2026-10-29）
1. `./pension/autotest/` 只剩 `output/`（15 文件 / 0.59MB），全部是**历史一次性 GUI/引擎回归的运行产物**，不是 testcase official log：
   - `autotest/output/e7/` 13 件（e7-regression-summary.json + my1/my2/my3/wife4/wife5/wife6 各 result/export PNG，2026-10-28 00:28~00:42），写入者 `system_test/TST-02-GT-4000/gui/e7-fileio-regression.js`。
   - `autotest/output/engine/bug25-26-assert.json`，写入者 `developer_test/utils/assert-bug25-26.js`。
   - `autotest/output/gui/d4-compare-table.md`，写入者 `developer_test/utils/plan-compare-table.js`。
2. 根因：上述 harness/工具把输出根硬编码为 `path.join(PROJECT,'autotest','output',...)`（B-3 迁移后 autotest/gui 已迁入 system_test，但输出路径未同步改），每次运行都会在项目内**重建** autotest/；同时调查过程又留下 `temp/`（71 件 patch/探针产物）与项目根 `temp-inspect*.ps1`。
3. `autotest/` 与 `temp/` 均未被 git 跟踪（tracked_autotest=0、tracked_temp=0），故不影响版本库，但违反「临时文件不得落 project folder」规则，且 `docs/test_reports/` 多份历史报告以 autotest/output/gui/*.json 为证据链接。

### fix solution description
（tester worker4 执行，2026-10-29，项目主批准方案 1~5）
1. **autotest/output 外移保留**（不删，维持历史报告证据可查）：15 文件 → `C:\Users\Administrator\Desktop\Wechat projects\temp\pension-autotest-output-20261029\`，随后删除项目内 `autotest/`。
2. **repo temp/ 外移**：71 文件 → `...\temp\pension-temp-20261029\`，随后删除项目内 `temp/`。
3. **项目根遗留临时脚本外移**：`temp-inspect.ps1`、`temp-inspect2.ps1` → `...\temp\pension-root-leftovers\`。
4. **harness 改造（7 个文件）** 输出根统一改为外部 temp：
   - 注入 `const EXT_TEMP = process.env.PENSION_EXT_TEMP || <外部 temp>; const EXT_OUT = path.join(EXT_TEMP,'pension-run-output')`；
   - `system_test/TST-02-GT-4000/gui/`{bug1416-verify, bug2224-run, e7-fileio-regression, shot-fix, t3-env-verify}.js、`system_test/TST-02-GT-4019/t47-c-planstart.js`、`developer_test/utils/plan-compare-table.js` 的 OUT 全部改指 EXT_OUT 子目录；仓库内已无 `'autotest'` 输出路径残留。
   - official log 规则不变：仍写各自 `system_test/TST-02-<TYPE>-<NNNN>/logs/`。
5. **配置与文档**：`project.config.json` 的 packOptions.ignore 删除已不存在的 autotest/temp 两条（最小 diff 1 行）；`system_test/README.md` 新增「临时文件约束（BUG-02-0013）」四条铁律（临时件只写外部 temp / 禁止项目内 temp|autotest|tmp|*.patch / official log 才进项目 / harness 必须用 EXT_TEMP），并列出违规示例。
6. **清单备份**：迁移前落全量清单（文件名+大小+时间+去向）`...\temp\pension-cleanup-manifest-20261029.json`；迁移后逐项校验份数一致（15/15、71/71）才删源目录。

### fix verification process
（tester worker4 自检，2026-10-29，基线 dev box HEAD=b1c326c，零 RDP、未连 GUI）
- 迁移校验：autotest 15/15、temp 71/71 文件份数与字节数一致后删除源目录；清单 json 已落外部 temp。
- 项目内检查：`dir /ad temp autotest tmp` 与 `dir *.patch temp-*.ps1` 均无输出 → 项目根已无临时目录/临时文件。
- official log 完好：`system_test/TST-02-GT-4032/logs/` 仍为 5 件（3 PNG + result json + run-trace.log），未被触碰。
- harness 残留检查：`findstr /S "'autotest'"` 在 7 个改造文件内零命中；EXT_OUT 定义与 OUT 指向均确认生效。
- 改动范围：9 文件（7 harness + project.config.json + system_test/README.md），+70/−9；未触碰 product code。
- 待 Manager 复核：项目目录内不再有 temp/、autotest/ 已正确归位。


**实测结果（2026-10-29 tester worker4 独立验收）**：清理结果自检 PASS（基线 7723276）：
①项目内 `./pension/autotest/` 与 `./pension/temp/` **均已不存在**（`dir /ad temp autotest tmp` 无输出）；
②外部 temp 承载全部临时件：`pension-autotest-output-20261029`（15 件，校验 15/15）、`pension-temp-20261029`（71 件，校验 71/71）、`pension-root-leftovers`（temp-inspect.ps1/temp-inspect2.ps1）；清单 `pension-cleanup-manifest-20261029.json`；
③harness 改造生效：`PENSION_EXT_TEMP` 机制确认存在（e7-fileio-regression.js 等 7 处 OUT 改指 EXT_OUT，repo 内 `autotest` 输出路径零残留）；
④official log 未被触碰：`system_test/TST-02-GT-4032/logs/` 5 件完好；`project.config.json` 失效 ignore 两条已删；`system_test/README.md` 已写入临时文件约束。
证据：`output/p-mu45ws9mfajyky-worker4/task85-bug0013-cleanup/`（patch 7723276 + 迁移清单）。

### bug status
**bug status**: closed（修复 + tester 自检 PASS，2026-10-29 tester worker4 独立验收）

## BUG-02-0014
### testcase ID
- TST-02-MT-9003

### failure description
Z=0.6 是**最低**缴费系数。它对应的**最低缴费基数**和**最低每月缴费**的精度有误，应该**精确到个位，四舍五入**。
复现路径："方案比较" --> "文件输入" --> e7-my1.txt --> 方案卡，针对 Z 值=0.6（最低值）：目前计算 2026.9 之后的缴费基数和每月缴费值精确到小数点后 2 位——12116*0.6=7269.6，月缴=7269.6*20%=1453.92。官方口径应为：12116*0.6=7269.6 => **7270（四舍五入到个位）**，月缴=7270*20% => **1454（四舍五入到个位）**。
要求：修改**最低** Z 值（=0.6）对应的算法。对于 **0.6 < Z <= 3.0** 的 Z 值，**没有**四舍五入到个位的要求。

### root cause analysis
（developer worker3 独立复核，基线 066b60f）
计算侧从未区分「最低缴费档」与其余档位，所有 Z 走同一条裸值算式，故最低档缺失"到元四舍五入"这一步：
1) **calculator/planAssembler.js `buildAutoSegments` L94-95**：原 `var base = z * c;`，注释明写"中间不四舍五入，保留精确基数"。Z=0.6、C=12116 时得 7269.599999999999（裸值，未取整），作为自动段 `baseMonthly` 输出给下游。
2) **calculator/rContribution.js `computeR` L47**：原 `var burden = s.baseMonthly * rate;`，直接用未取整基数乘费率。灵活就业 20% → 1453.92；企业职工 8% → 581.568。R续 合计亦按此精确值逐月累加。
3) **constants/policyData.js**：无"缴费基数核定区间/最低档"相关常量，业务代码里 0.6 / 3 仅出现在 inputValidator 的越界提示（L85 `denom*0.6`）与 planModel 的 Z 校验区间（Z_MIN=0.60），**没有任何一处可作为"最低档"判定依据被计算链复用**。
4) 档位判定依赖需注意：`Z_MIN` 定义在 `calculator/planModel.js`，而 planModel 已 `require('./planAssembler.js')`；若让 planAssembler 反向 require planModel 会形成**循环依赖**（小程序端可能拿到空对象）。故最低档下限必须下沉到 policyData 作为唯一事实来源。

结论：这是"最低档缺专门取整规则"的实现缺口（即 0011 被否的根因正是把该口径错误地做成全局取整）；其余档位当前精确算法本身正确，不得改动。
### fix solution description
仅对**最低缴费档 Z=0.6**的自动段缴费基数与每月缴费做"精确到个位、四舍五入"；**0.6<Z<=3.0 一律保持原精确算法不变**（未做任何全局取整）。

改动清单（commit **588efb8**，基线 066b60f，未 push）：
1) `constants/policyData.js`：新增核定区间常量
   `baseRatio: { min: 0.6, max: 3.0, roundLowestToYuan: true }`（60%~300% 依国办发〔2019〕13号；`min` 即最低档判定依据，**唯一事实来源**，业务代码不再散写魔法数）
2) `calculator/planAssembler.js`
   - 新增 `LOWEST_Z`（取自 `P.baseRatio.min`）、`isLowestZ(z)`（浮点容差 `1e-9`，'0.6'/'0.60'/0.6 同档）、`roundYuan(n)`（四舍五入到个位）、`roundLowestToYuan(n, z)`（仅"最低档且开关开启"才取整），均导出便于单测与 rContribution 复用
   - `buildAutoSegments` L94-95：`var base = z * c;` → `var base = roundLowestToYuan(z * c, z);`（非最低档原样返回裸值，行为逐位不变）
3) `calculator/rContribution.js computeR`：`var burden = s.baseMonthly * rate;` → `var burden = Asm.roundLowestToYuan(s.baseMonthly * rate, plan.z);`
   - 取整顺序严格两级：① 基数到元 ② 以取整后基数×费率再取整到元。Z=0.6/C=12116：7269.6 → **7270**；灵活 7270×20% → **1454**；企业 7270×8%=581.6 → **582**
4) **pensionEngine 未改动**：自动段基数已由 ①② 产出 7270，引擎自动继承；刻意不对账户 8% 入账再取整，避免改变 R储 进而影响 P月/三分项（守住"不影响 P月/三分项"约束）
5) `developer_test/TST-02-UT-1040/lowest-z-rounding-check.js`（新增，64 断言）
   - 最低档判定：`baseRatio.min`/`LOWEST_Z`/`isLowestZ`（0.6/'0.6'/'0.60' 为真；0.7/1.0/1.3/3.0/空/NaN/'abc' 为假）
   - Z=0.6 取整：基数 7270（整元）、灵活月缴 1454、企业月缴 582、全区间逐月均整元、R续=月数×1454
   - **非最低档防回归红线**：0.7/1.0/1.3/1.5/2.0/3.0 逐档断言基数与月缴严格等于原精确值（如 Z=1.0 灵活月缴 2423.2000000000003 且 ≠2423；Z=3.0 灵活 7269.6 且 ≠7270；Z=1.3 基数 15750.800000000001 且 ≠15751）
   - 引擎侧：Z=0.6 自动段逐月基数=7270；Z=1.3 仍为精确值、≠15751
   - P月/三分项自洽（Z=0.6 与 Z=1.3 均验），证明计发口径未被本改动破坏

验证：TST-02-UT-1040 **pass=64 fail=0**；全量 developer_test **44 文件 pass=684 fail=0 failFiles=0**（原 620 + 新增 64），零回归。
实测各档位（dev box 直算，非引用回显）：Z=0.6→基数 7270 / flex 1454 / ent 582；Z=0.7→8481.199999999999 / 1696.2399999999998 / 678.496；Z=1.0→12116 / 2423.2000000000003 / 969.28；Z=1.3→15750.800000000001 / 3150.1600000000003 / 1260.064；Z=3.0→36348 / 7269.6 / 2907.84 —— 除 Z=0.6 外全部与改动前逐位一致。
### fix verification process
**实测结果（2026-11-03 tester worker4 独立 GUI 验收，基线 3caf0bb，常驻口 40215 只 connect/disconnect，零 RDP，独立取值未引用 developer 回显）**：新建独立 GT `system_test/TST-02-MT-9003/gt-4034-lowest-z.js`，**24/24 断言全 PASS**。

① **最低档 Z=0.6（唯一取整档）**：自动段缴费基数 = **7270**（整元，7269.6 四舍五入）；灵活就业月缴(20%) = **1454**；自动段逐月基数均为整元（allInteger=true）。
② **非最低档不取整（本轮最易做错处，逐档实测）**：
   - Z=0.7 → 基数 8481.199999999999、月缴 1696.2399999999998（`roundLowestToYuan(base,0.7)` 原样返回，未改动）
   - Z=1.0 → 基数 12116、月缴 2423.2000000000003
   - Z=1.3 → 基数 15750.800000000001、月缴 3150.1600000000003
   - Z=3.0 → 基数 36348、月缴 **7269.6**
③ **红线（最易被"顺手取整"污染）**：Z=3.0 月缴恰为 **7269.6**，与最低档取整后基数 7270 数值相近，已硬断言 `月缴 === 7269.6 且 ≠ 7270 / ≠ 1454` —— PASS。
④ **GUI ↔ node 交叉验证（页面级主证据）**：Z=0.6 卡 页面 P月 **13290.69** = node 独立重算 **13290.69**；Z=3.0 卡 页面 **15904.33** = node **15904.33**（Δ<0.01）。
   其中 **13290.69 是修复后的值（修复前为 13290.66）**，直接证明"最低档基数 7269.6→7270 的取整已真实进入页面结果链"，而非仅纯函数层生效。
⑤ **回归零破坏**：两卡结果页正常出 2 列且 P月/三分项勾稽（13290.69=6697.58+5724.41+868.7；15904.33=7685.58+7168.58+1050.17）；continue 情形 rate=0.015 且账户计息 75082.32>0；stop 情形 rate=null 且零计息 —— 与修复前口径一致，未被取整改动波及。

证据：`system_test/TST-02-MT-9003/logs/result-GT4034-0014.json`（含各 Z 实测值、guiVsNode、z06 明细）、`GT4034-lowest-z.png`、`run-trace.log`。

**过程说明（如实记录）**：首轮 3 项 FAIL 均为 tester 脚本侧缺陷，非产品问题，已定位并修正：① 在结果页误取 `#sharedData` 组件（结果页无该组件）→ 改为按设计跳过；② 用"是否为整数"判"是否被取整"，误伤 Z=1.0(12116)/Z=3.0(36348) 这类本身即整数的档位 → 改为"严格等于裸值且 `roundLowestToYuan` 原样返回"的语义判据；③ 0014-9a 的 node 对照用 `CASES.slice(0,2)` 取到 Z=0.7 去比页面第 2 卡 Z=3.0，属 Z 标号配对错位 → 改为按页面实际两卡显式取值。修正后 24/24 全绿。

# bug status
**bug status**: closed（修复 commit 588efb8 + tester 独立 GUI 验收 24/24 PASS，2026-11-03 tester worker4 独立 GUI 验收；项目主 2026-10-29 口径：仅最低档 Z=0.6 到元四舍五入）

## BUG-02-0015
### testcase ID
- TST-02-MT-9004

### failure description
"方案比较" 输出页 → "比较结果" → `数值下钻` → `查看明细`。显示列表右侧的具体数值**最右边总有 3 个字符被写到屏幕外**，看不见；列表宽度超出屏幕范围。
截图：`C:\Users\Administrator\Desktop\Wechat projects\temp\右边缺字.png`
（项目主实测，UI 布局缺陷：下钻明细表列宽/横向溢出未适配屏宽。）

### root cause analysis
**developer（worker3）实测定位，非推测**（基线 `8b6b5ea`，automator 直连常驻口 40215 取 `boundingClientRect`）

根因在 **`pages/compare-result/compare-result.wxss` 的 `.cr-sheet-body`（下钻弹层正文 scroll-view，原第 169 行）盒模型**，不是列宽、也不是缺横向滚动：

```css
/* 修复前 */
.cr-sheet-body { padding: 20rpx 32rpx 40rpx; max-height: 64vh; }
```

- 该节点是 `<scroll-view scroll-y class="cr-sheet-body">`（`compare-result.wxml` 第 157 行），`width` 未声明 → 默认 `100%`；
- **未设 `box-sizing`**，小程序默认 `content-box`，于是 `padding: 20rpx 32rpx` 的**左右共 64rpx 被加在 100% 之外**，实际外宽 = 屏宽 + 64rpx ≈ 屏宽 + 35px；
- 实测（模拟器 `windowWidth=411px`，`pixelRatio=2.625`，`1rpx≈0.548px`）：

| 节点 | 实测 left | 实测 right | 实测 width | 是否超屏（屏宽 411px） |
|---|---|---|---|---|
| `.cr-sheet`（弹层） | 0 | 411 | 411 | 否 |
| **`.cr-sheet-body`（正文）** | **0** | **445** | **445** | **是，溢出 34px** |
| `.cr-dr-row`（明细行，44 行） | 17 | 428 | 411 | 是，行右端 17px 在屏外 |

- `.cr-dr-row` 是 `display:flex; justify-content: space-between` 的自由两段布局，右端 `<text>` 无收缩约束 → 随容器一起被推到屏外 17px，正是项目主截图「最右 3 个字符被写到屏幕外」；
- 同类隐患：`.cr-sheet-head`（padding 28rpx 32rpx）与 `.cr-sheet` 也缺 `box-sizing`，只是被父级 `overflow` 掩盖。

### 补充：同文件既有 wcc 违例（0012 带入，非本单引入）
`compare-result.wxml:221:92` 的 `{{drill.roi.eligible ? '是' : '否'}}` 在 `{{}}` 表达式内使用中文非 ASCII 字面量，wcc 报 `unexpected character inside expression`，`developer_test/TST-02-CT-1017/wxml-expr-check.js` 报 1 处 `non-ascii-in-expr`。

### fix solution description
**修复（commit `7fe6a94`，基线 `8b6b5ea`，未 push）— 纯 wxml/wxss 层，`calculator/` 全部文件零改动**

1. `pages/compare-result/compare-result.wxss`
   - `.cr-sheet-body`：新增 `width:100%` + **`box-sizing:border-box`** + `overflow-x:hidden`（根因修复点：padding 收进 100% 内）；
   - `.cr-sheet`：新增 `box-sizing:border-box` + `max-width:100%` + `overflow:hidden`（弹层兜底，残余像素不外溢）；
   - `.cr-sheet-head`：新增 `box-sizing:border-box` + `width:100%`；
   - 明细行改**两段式自适应**（无固定 px）：`.cr-dr-k` = `flex:1 1 auto; min-width:0; word-break:break-word`（标签列可压缩换行）；`.cr-dr-v` = `flex:0 0 auto; max-width:62%; text-align:right; word-break:break-all`（**关键数值不压缩、右对齐、整列在屏内**）；
   - `.cr-dr-row` / `.cr-dr-cf` 增 `width:100%` + `box-sizing:border-box`；现金流行拆 `.cr-cf-ym` / `.cr-cf-d`（数值右对齐，可压缩）；顺带修正原 `.cr-dr-cf` 的 `padding: 4r 0` 缺单位（无效声明）。
2. `pages/compare-result/compare-result.wxml`：明细各行 `<text>` 全部标注 `cr-dr-k` / `cr-dr-v`（历史段、视同、账户锚点、自定义年度、J 三分项、ROI 明细、现金流合计）；「余额 / 年度：值」由单文本节点拆为标签 + 数值两节点（仅拆分，数值不变）。
3. **CT-1017 违例清除**：`{{drill.roi.eligible ? '是' : '否'}}` → `<text wx:if="{{drill.roi.eligible}}">是</text><text wx:else>否</text>`，bool 判定仍直接取 `drill.roi.eligible`，**ROI 数值逻辑与 roiModel 零改动**。
4. 新增 `developer_test/TST-02-CT-1043/drill-width-budget-check.js`（40 断言）：
   - ① 下钻容器盒模型（`box-sizing:border-box` / `width:100%` / `overflow-x:hidden`）；
   - ② 下钻弹层所有相关 class **固定 px 宽度 = 0**、固定 rpx 宽度合计 **0rpx ≤ 750rpx**；
   - ③ 明细行两段式 flex 语义（标签可压缩、数值不压缩 + 右对齐 + 百分比 max-width）；
   - ④ 行内宽度预算 **62% + 16rpx(2.13%) = 64.13% < 100%**（标签列始终 ≥35.87%）；
   - ⑤ WXML 结构约束（每个 `.cr-dr-row` 顶层 text 必须带 `cr-dr-k`/`cr-dr-v`；中文表达式已移除）；
   - ⑥ 数值口径零改动守卫（`calculator/*` 五个核心文件不被改动/不含样式类）。

### fix verification process
**（developer worker3 自测：dev box automator 直连 40215 实测 + 静态断言；独立 GUI 验收归 tester）**

**① 实测宽度（模拟器真渲染取值，修复前 → 修复后，屏宽 411px）**

| 节点 | 修复前 max right | 修复后 max right | 修复前溢出 | 修复后溢出 |
|---|---|---|---|---|
| `.cr-sheet` | 411 | 411.3 | 0 | 0 |
| `.cr-sheet-body` | **445** | **411.3** | **1（34px）** | **0** |
| `.cr-dr-row`（41~44 行） | **428** | **394.3** | **全部行** | **0** |
| `.cr-dr-row .cr-dr-v`（数值列） | —（无此节点） | 394.3 | — | **0** |
| `.cr-dr-cf .cr-cf-d`（现金流 51 行） | — | 394.3 | — | **0** |

两个分支均实测：ROI 正常列（`p2`，`roi.ok=true`）与 ROI 阻断列（`p1`，`reason=继续缴费为0，ROI不可用`，即原 221 行中文表达式所在分支），**溢出计数全部为 0**，数值列右边界 394.3px < 屏宽 411px，留 16.7px 安全边。

**② 关键数值未被裁切（DOM 文本取证，ROI 阻断分支 41 行逐行读取）**
```
P月 10765.49 / 基础 5995.92 / 账户 3738.44 / 过渡 1031.13
余额 672920（2026-08）
ROI 不可用 / 原因 继续缴费为0，ROI不可用
最低需缴月数 180 / 停保累计缴费月数 310
继续缴费情形是否满足按月领取 是      ← 原 {{...?'是':'否'}} 改 wx:if 后渲染正确
历史段 2026-01 至 2026-08 35945.25（企业）   ← 最右数值完整，无截断
```

**③ 宽度预算证据（回答工单点名项）**
- 下钻弹层固定 px 宽度：**0 处**（`.cr-sheet` / `.cr-sheet-head` / `.cr-sheet-body` / `.cr-dr-*` / `.cr-cf-*` 全扫描）；
- 固定 rpx 宽度合计：**0rpx**（修复后明细区不再有任何固定宽，全部 flex 权重 / 百分比）；
- 行内宽度权重：数值列 `max-width:62%` + `margin-left:16rpx`(=2.13%) = **64.13%**，标签列弹性占 **≥35.87%**，合计 **100% 无溢出**；
- 全文 `.wxss` 扫描：`pages/` + `app.wxss` 中**无任何非 rpx 的固定 px 宽度**（0 处命中）。

**④ 回归（dev box 实跑）**
- `developer_test` 全量：**48 文件 / pass=818 / fail=0 / badFiles=0**（上一轮基线 47 文件 pass=778，本轮 +TST-02-CT-1043 的 40 断言）；
- `TST-02-CT-1017/wxml-expr-check.js`：**由 1 处违规转全绿**（5 文件 / 353 个 `{{}}` 表达式，无非 ASCII、配对正确、无 `?.`/`??`/`=>`/`;`）；
- `tools/gates/bug-gate.js`：**BUG GATE PASS**；`tools/gates/matrix-gate.js`：**MATRIX GATE PASS**（79 行，仅 2 条历史 one-script-multi-testcase 警告）；
- 计算引擎零触碰：`git show --stat 7fe6a94` 仅 5 个文件（2 个页面样式/结构 + 1 个新增测试 + logs），`calculator/**` 无改动。

**⑤ 给 tester 的独立 GUI 验收点**
1. 「方案比较」→ 录入 ≥2 方案 → 「比较结果」→ 任一列「查看明细」；
2. 断言：明细列表**无横向溢出**、最右数值（如历史段末行 `35945.25`、`R续累计`、`ROI 百分比`）**完整可见**、字符不被裁切；
3. 覆盖 ROI 正常列与 ROI 阻断列两种分支（阻断列需让某方案 R续=0，如起始月=退休月）；
4. 截图取证；
5. 注意：本单状态为 `fixed`（**未 closed**），因 0015/0016/0017 共用矩阵行 `TST-02-MT-9004`，该行仍 FAIL，最终关闭须等项目主复测该行。

### bug status
**bug status**: fixed

## BUG-02-0016
### testcase ID
- TST-02-CT-1044（模型级，developer，新增；见矩阵新增行）
- TST-02-MT-9006（项目主手测 GUI，并行存在）

### failure description
**Requirement update**（需求变更，非缺陷）：需新增 requirement ID、设计新 testcase 并加入矩阵。
"方案比较" 输出页 → "比较结果" → `回本月数`：当前**仅以 `R续` 最小的方案为基准**。要求**增加以 `R续=0` 方案（即停保情形）为基准的两行显示**，利率分别取 `利率=0` 与 "比较结果" 页面里的利率输入值；这样可以算出**全部方案**的回本时间，与 ROI 的算法基线保持一致。

### root cause analysis
非缺陷，属需求变更。现状：回本月数仅按 R续 最小方案作基准（`calculator/paybackModel.js selectBaseline()`，基准即 argmin R续，由 `computeAtRate()` 调用），缺少以 R续=0（停保）为基准的口径，导致无法覆盖全部方案的回本时间，且与 ROI 逐方案停保基线（`calculator/roiModel.js buildCaseInput(sharedInput, plan, false)` L27-46 与 `computeROI()` 产出的 `baselineMonthly` / `baselineEligible`）口径不一致。

**实现前实测确认（基线 bfd8e88）**：旧两行（argmin R续 基准）对 R续 最大的方案只能给出「退休后抵回 907 个月」，而 ROI 已按逐方案停保基线算出该方案 ΔP=2749.23，两个口径确实分叉——需求成立。

### fix solution description
**已实现（worker3，commit `045b4af`，基线 `9e7814d`，本地 commit 未 push）——纯新增视图，不改任何计算引擎口径**

按规格 `docs/design/stop-baseline-payback-design-bug16.md` §5 实现，四个文件：

1. **`calculator/paybackModel.js`** — 新增 `computeStopBaseline(series, annualRate)` / `computeStopDouble(series, userAnnualRate)`（**现有 `selectBaseline` / `computeAtRate` / `computeDouble` 一行未动，语义冻结**）：
   - 停保基准 = 逐方案自身 0 投入情形。因 `T_b = T_k`，全程落在 `m <= T_b` 区间：`d_m = burdenK_m − 0`，直接复用已有 `cashflows()` / `futureValue()` / `branchBMonths()`，**未复制公式**。
   - `ΔP_k = pMonthly − pStop`，其中 `pStop` 由调用方传入 `roiModel.computeROI()` 的 `baselineMonthly`（**与 ROI 分子同一个减数**）。
   - 分支码：`SELF`（本身即停保）/ `NA`（停保基准不足最低缴费年限）/ `B`（退休后抵回）/ `C`（无法抵回），输出结构对齐 `computeAtRate`：`{ mode:'stop', annualRate, byId:{[id]:{branch,months,ceilMonths,FV,dP,rate}} }`。
2. **`calculator/compareResultModel.js`** — `buildView()` 内：
   - 新增 `stopSeries`：在原 `series` 上追加 `pStop = it.baselineMonthly`、`stopEligible = it.baselineEligible`（均直接取 `roiModel.computeROI` 产出，**未另建停保引擎调用**）；
   - `stopDbl = PB.computeStopDouble(stopSeries, rate)`；
   - 列字段新增 `pbS0` / `pbSU`（复用 `paybackText()`，在其内新增 `SELF` / `NA` 两个文案分支；`paybackText` 对旧分支的输出**逐字未变**）。
3. **`pages/compare-result/compare-result.wxml`** — 在原有两行后追加两行（结构照抄，`cr-cell`/`cr-cell-grey` 灰显规则一致）：
   - 标签 `回本月数（停保基准·0%）` 绑 `c.pbS0.text/sub`；
   - 标签 `回本月数（停保基准·{{view.userRatePercent}}%）` 绑 `c.pbSU.text/sub`。
4. **`pages/compare-result/compare-result.js`** — 仅透传（`view` 直接绑定），**未改一行**（无新逻辑）。

**边界实现（规格 §6 六项全覆盖）**
| # | 场景 | 实现位置 | 显示 |
|---|---|---|---|
| 1 | 该方案 R续 = 0 | `computeStopBaseline` `!(k.rTotal > 0)` → `branch:'SELF'` | 「—（即停保基准）」，不参与排名 |
| 2 | 永不回本（ΔP≤0 或年金现值不足） | `branchBMonths()` 返回 Infinity → `branch:'C'` | 「无法抵回（该利率下）」 |
| 3 | `baselineEligible=false` | 前置 `k.stopEligible === false` → `branch:'NA'` | 「不可用（停保基准不足最低缴费年限）」，与 ROI blocked 口径一致 |
| 4 | 页面利率 = 0 | `computeStopDouble` 两列各自计算 | 两行同值，**仍渲染两行**（wxml 两个独立 `cr-row`，不合并） |
| 5 | 利率 null/undefined | `typeof annualRate === 'number' ? annualRate : 0` | 按 0 处理 |
| 6 | 方案灰显（grey） | wxml `cr-cell-grey` 类沿用原规则 | 新两行同步灰显，文案同边界 3 |

**新增 testcase 实现**：`developer_test/TST-02-CT-1044/stop-baseline-payback-check.js`（占位骨架 → **109 断言**，A1~A10 全覆盖；期望值由脚本按规格公式**独立复算**，不读被测 FV/dP/months 中间量；含 A4 与 ROI 的 `baselineMonthly`/`pMonthly` 勾稽、A9 旧两行数值冻结快照）。

### fix verification process
**（developer worker3 自测：dev box node 直算产品模块；独立 GUI 验收归 tester）**

**① 新两行实测数值（真实夹具 `My-Case.md`，3 方案，基线前后对照）**
```
方案集 A（p0 z=0.6/retire2033-07，p1 z=1.3/retire2035-09，p2 z=3.0/retire2030-12）
利率 0%   : p0 退休后抵回 48个月 | p1 退休后抵回 31个月 | p2 退休后抵回 122个月
利率 1.5% : p0 退休后抵回 48→52个月 | p1 31→34个月 | p2 122→137个月
利率 20%  : 0%列不变 | 1.5%列 → 全部「无法抵回（该利率下）」（分支C）
方案集 B（含 R续=0 方案 p1 retire2026-12）
          : p1 两行均为「—（即停保基准）」（branch=SELF），p0 仍给正常月数
```

**② 与 ROI 勾稽（A4，逐方案实测）**
```
方案  pMonthly   baselineMonthly   ΔP(新行减数)   R续       停保基准合格
p0    13290.69   10765.69          2525.00        119228    true
p1    15505.25   11036.19          4469.06        136086.91 true
p2    13617.98   10558.64          3059.34        370749.6  true
```
切点：新行 `ΔP === round2(pMonthly − baselineMonthly)`，**与 ROI 分子同一个减数**；A4 另逐方案将 `roiModel.computeROI()` 的 `baselineMonthly` / `pMonthly` 与回本行所用值做相等断言（0 误差）。

**③ 旧两行数值冻结（A9，与改动前逐字比对，±0）**
```
改动前（bfd8e88 实跑快照）→ 改动后
A|0%   p0 基准方案（R续最小） | p1 退休前抵回 1个月 | p2 退休后抵回 907个月
A|1.5% p0 基准方案 | p1 退休前抵回 1个月 | p2 「0%列 907个月 / 用户利率列 无法抵回」
A|20%  同 1.5% 口径
B|0%   p0 退休前抵回 1个月 | p1 基准方案（R续最小）
B|1.5% 同 B|0%
全部逐字相等，0 差异；baselineId 仍为 p0（argmin R续），BASELINE 分支唯一，列数=方案数（停保基准未新增列/未加徽标）
```

**④ 测试与回归（dev box 实跑）**
- `TST-02-CT-1044`：**pass=109 fail=0**（A1~A10 全覆盖）
- 全量 `developer_test`：**49 文件 / pass=927 / fail=0 / badFiles=0**（上轮基线 48 文件 pass=818，本轮 +CT-1044 的 109 断言）
- `tools/gates/bug-gate.js`：**BUG GATE PASS**；`tools/gates/matrix-gate.js`：**MATRIX GATE PASS**（80 行）
- 引擎零触碰：`pensionEngine` / `planAssembler` / `rContribution` / `roiModel` **无任何改动**（`buildCaseInput` 仅被 `computeROI` 原有路径读取）；`compare-result.js` 未改

**⑤ GUI 实测（dev box 模拟器，automator 直连 40215，真实渲染）**

> ① 的数值取自「未显式设 `sharedInput.futureMonthlyRate`」的夹具；GUI 走 `buildFixtureInput('My-Case.md', 0)`（显式 `futureMonthlyRate=0`），故绝对值不同，两者均为正确口径。

**4 方案输入**（p0 z0.6/2033-07、p1 z1.3/2035-09、p2 z3.0/2030-12、p3 z1.0/起始月=退休月2026-12）

`回本月数` 在 DOM 中真实渲染出 4 行（行标签逐字读取）：
```
回本月数（0%）                ← 旧行1，保留
回本月数（0.00%）             ← 旧行2，保留（页面利率 0%，故与旧行1 同值）
回本月数（停保基准·0%）        ← 新行1
回本月数（停保基准·0.00%）     ← 新行2
```

4 列逐列实测（GUI `page.data().view.columns`，已与 node 侧 `buildView` 同输入对照一致）：

| 列 | R续 | 旧行(0%) | 新行1 | 新行2 | ROI baselineMonthly / ΔP |
|---|---|---|---|---|---|
| p0 | 119228 | 退休前抵回 1个月 | 退休后抵回 61个月 | 退休后抵回 61个月 | 10765.69 / 1984.84 |
| p1 | 136086.91 | 退休前抵回 1个月 | 退休后抵回 38个月 | 退休后抵回 38个月 | 11036.19 / 3615.36 |
| p2 | 370749.6 | 退休前抵回 7个月 | 退休后抵回 135个月 | 退休后抵回 135个月 | 10558.64 / 2749.23 |
| p3 | **0** | 基准方案（R续最小） | **—（即停保基准）** | **—（即停保基准）** | 10765.49 / 0 |

关键验证点（GUI 实测取证）：
- **覆盖全部方案列**：旧行对 p3 只能显示「基准方案（R续最小）」（无月数），新两行对 p0/p1/p2 全部给出具体月数 —— 需求「算出全部方案回本时间」已达成；
- **R续=0 边界**：p3 两行均为「—（即停保基准）」，branch=`SELF`；
- **勾稽**：p3 的 `pMonthly` = `baselineMonthly` = 10765.49，ΔP=0 —— 实证停保基准与 ROI 同源；
- **利率 0% 时两行同值但仍渲染两行**（边界 4）；
- 截图：`temp\shot-0016-payback4rows.png`（automator 原生 `mp.screenshot()` 取得）。

**⑥ 给 tester 的独立 GUI 验收点**
1. 「方案比较」→ 录入 ≥2 方案（其中至少一个 `起始月 = 退休月` 以覆盖 R续=0）→「比较结果」；
2. `回本月数` 区应出现 **4 行**：旧的 `回本月数（0%）`/`（页面利率%）` + 新的 `回本月数（停保基准·0%）`/`（停保基准·页面利率%）`；
3. 新两行覆盖**全部方案列**（含旧行显示「基准方案」的那一列，新行应给实际月数）；
4. R续=0 的方案列：两行显示「—（即停保基准）」；
5. 页面利率输入 0 时新两行同值但仍是两行；改 20% 后出现「无法抵回（该利率下）」；
6. 数值与独立重算一致（按设计规格 §4 公式：`FV=Σ burden_m(1+i)^(T−m)`，`ΔP=pMonthly−baselineMonthly`，`r=0` 时 `FV/ΔP`，`r>0` 时 `−ln(1−FV·i/ΔP)/ln(1+i)`，向上取整）；
7. 回归：旧两行与改动前完全一致；
8. 🔴 本单状态 `fixed`（**未 closed**）：最终关闭须等 tester 独立 GUI 验收（含 MT-9006）后同批处理。

### bug status
**bug status**: fixed

## BUG-02-0017
### testcase ID
- TST-02-MT-9004

### failure description
用 "文件输入" → `e7-my1.txt` 作为**共用数据**，用 "基本计算" 与 "方案比较" 分别计算 **Z=1.3** 的情况，两者数据差别 **>0.001 元**。
Case 的**非共用数据**：灵活就业缴费起点从 2026.9 算起；有 R补，转到企业时间 2000.11；退休年月 2033.7；个人账户利率=0.0。
**实测："基本计算" 养老金 = 14715.75；"方案比较" = 14715.77，相差 0.02 元。**

### root cause analysis
（developer worker3 独立复核 + 实测，基线 0daec7e）

**表层现象**：同一份输入（e7-my1.txt + Z=1.3 + 利率0 + R补转企业2000-11 + 退休2033-07），基本计算与方案比较 P月 相差 0.02 元。

**实测定位（真实 e7-my1.txt 复现）**：
| 基本计算侧基数 | 基本计算 P月 | 方案比较 P月 | Δ |
|---|---|---|---|
| 15750.800000000001（= Z×C 裸值，与比较页一致） | 14643.64 | 14643.64 | 0 |
| 15750.8（2位小数） | 14643.64 | 14643.64 | 0 |
| **15751（个位四舍五入）** | 14643.66 | 14643.64 | **+0.02** |

→ **0.02 的唯一成因：基数被取整到个位**。取到 2 位小数不产生任何差异。

**两侧计算链路逐处排查（均无取整，附行号）**：
1. `calculator/planAssembler.js L122`：`var base = roundLowestToYuan(z*c, z);` → 实测 `isLowestZ(1.3)=false`，输出 **15750.800000000001**，未取整（BUG-02-0014 未误伤非最低档）。
2. `pages/index/index.js expandYearRows`：`baseMonthly = annualBase / k`，无取整。
3. `pages/index/index.js L469 fillAtCaliber`：`Math.round(caliber*ratio*100)/100`，取 **2 位小数**，且仅 60/100/300% 三档（不含 130%），不产生 0.02。
4. `services/caseValidator.js L33`：`baseMonthly = annualBase / k`，无取整。
5. `pages/index/index.wxml L138/L169`：基数/年基数输入框均为 `type="digit"` 原始值，无精度限制、无整数提示。
6. `calculator/rContribution.js` / `calculator/pensionEngine.js`：仅对 Z=0.6 最低档取整，Z=1.3 路径不触发。

**两页等价性严格验证**（7 组参数，Δ 全部 0.00e+0，三分项逐项一致）：Z=0.6/0.7/1.3/3.0 × flexible/enterprise × 利率 0/1.5% × 退休 2030-12/2033-07/2035-09。

**根因定性**：「基本计算」页（pages/index）**没有 Z 概念** —— `index.js` 不 require planAssembler、无自动段生成，2026-09 之后的缴费基数必须用户手工填写。而 Z=1.3 的真实基数是 `12116×1.3 = 15750.800000000001`（浮点无限尾巴），用户不可能手填出该值：填 15750.8 恰好 Δ=0，填 15751（最自然写法）即产生 +0.02。属**功能缺失**（基本计算页缺少与方案比较同源的 Z→基数入口），非引擎舍入错误。经项目主 2026-11-03 裁定，按**方案乙**补齐该功能。
### fix solution description
按项目主裁定的**方案乙**实现：基本计算页在「月缴费基数」输入框旁新增「Z值」输入框，两者**双向自动转换**，转换算法与方案比较页**完全同源**。

**改动清单（commit 5ff95dc，基线 0daec7e，未 push）**
1. `calculator/inputPageModel.js`（新增纯函数，导出便于单测）
   - `Z_DECIMALS = 4`（Z 保留 4 位小数）
   - `baseFromZ(z, yearY, customCYear)`：Z → 月缴费基数。C 统一取 `planAssembler.denominatorForYear`（与引擎/方案比较同源，**无魔法数**）；取整统一走 `planAssembler.roundLowestToYuan`（仅最低档 Z=0.6 到元，非最低档保留原精确值）
   - `zFromBase(base, yearY, customCYear)`：月缴费基数 → Z，`normZ` 归一到 4 位小数
   - 非法/空输入一律返回 `null`（不抛错，由 UI 各自处理）
2. `pages/index/index.js`
   - 新增 `onSegZ`（改 Z → 基数重算）、`segYearOf`（取段所属缴费年度用于查 C）
   - `onSegBase` 增强：改基数 → Z 回算并以 `toFixed(4)` 回写
   - **防无限回写**：`this._zGuard` 标志 —— Z→基数的 setData 回调期间置 true，基数的 bindinput 回流不再反算 Z；setData 完成回调中复位。**最后编辑的一方为准**
   - `addSegment` / `copyLastSegment` / `fillAtCaliber` 均同步维护 `zValue` 字段（复制沿用上段 Z；快捷填充按所选档次回算 Z）
3. `pages/index/index.wxml`
   - 「月缴费基数(元)」下方新增「Z值」输入框（`type="digit"`，绑定 `item.zValue` / `onSegZ`）
   - 增加一行实时联动提示：`Z=xxx ⇄ 月基数 xxx 元（与方案比较页同源；最低档 Z=0.6000 取整到元）`
4. `developer_test/TST-02-UT-1041/z-base-convert-check.js`（新增，49 断言）
   - 三档验收值：Z=0.6→**7270**、Z=1.3→**15750.800000000001**、Z=3.0→**36348**
   - 同源性：`baseFromZ` 与 `planAssembler.buildAutoSegments` 逐位相等（5 档）
   - 双向：`zFromBase` 回算并与原 Z 往返自洽（6 档）；`toFixed(4)` 输出 0.6000/1.3000/3.0000；Z=1.2345 仍保 4 位
   - 非法输入：0/空/非数字/负数全部返回 null
   - 自定义 C 年：`{2026:10000}` 时 Z=1.3→13000（证明同源且可覆盖）
   - 红线：Z=0.6 基数 7270 / 灵活月缴 1454 / 企业月缴 582；Z=3.0 基数 36348 / 灵活月缴 **7269.6（≠7270，证明未取整）**
   - 两页一致性：Z=0.6/1.3/3.0 三档，两页基数逐位相同、P月 与三分项 Δ<0.01；0017 现场参数（Z=1.3）Δ 严格为 0

**验证**：TST-02-UT-1041 **pass=49 fail=0**；全量 developer_test **45 文件 pass=733 fail=0 failFiles=0**（原 684 + 新增 49），零回归，BUG-02-0014 全部 UT 保持全绿。

**边界实现说明（按裁定要求写进提交）**：基数被改 → Z 回算；Z 被改 → 基数重算；**最后编辑的一方为准**。往返编辑通过 `_zGuard` 防 setData 循环，实测连续来回编辑（Z→基数→Z→基数）无无限回写、无值污染。
### fix verification process
（developer worker3 自测，dev box 直接调用产品模块，非 GUI 回显；独立 GUI 验收归 tester）

**实测 1：三档 Z→基数（dev box 直算）**
```
Z=0.6  -> 7270                （最低档到元取整）
Z=1.3  -> 15750.800000000001  （不取整）
Z=3.0  -> 36348               （不取整）
Z=0.7  -> 8481.199999999999   Z=1.0 -> 12116
```

**实测 2：基数→Z 双向（保留 4 位小数）**
```
7270              -> 0.6000
15750.8           -> 1.3000
36348             -> 3.0000
8481.199999999999 -> 0.7000
往返：0.6→7270→0.6000 ✅ / 1.3→15750.800000000001→1.3000 ✅ / 3.0→36348→3.0000 ✅
```

**实测 3：两页一致性（0017 现场参数：真实 e7-my1.txt + Z=1.3 + 利率0 + doc31 R补转企业2000-11 + 退休2033-07）**
```
Z=1.3 -> baseFromZ = 15750.800000000001  |  方案比较页自动段基数 = 15750.800000000001
基本计算 P月 = 14643.64    方案比较 P月 = 14643.64
Δ = 0.0000000000  →  判据 Δ<0.01 ✅ PASS（原 0.02 已归零）
```

**实测 4：红线未破**
```
Z=0.6 基数 7270 / 灵活月缴 1454 ✅
Z=3.0 基数 36348 / 灵活月缴 7269.6（未取整为 7270）✅
全量 developer_test 45 文件 pass=733 fail=0（含 0014 的 UT-1040 全绿）✅
```

**给 tester 的独立 GUI 验收点**（不引用开发回显，独立读 page.data + 截图）
1. 基本计算页（entry → 基本计算）任一缴费段：基数框旁出现「Z值」输入框；
2. 在 Z值 填 `1.3` → 月缴费基数自动变为 `15750.800000000001`（或显示为 15750.8）；
3. 在 Z值 填 `0.6` → 月缴费基数自动变为 `7270`；填 `3.0` → `36348`；
4. 反向：改月缴费基数为 `15750.8` → Z值 自动回算显示 `1.3000`（4 位小数）；
5. **连续来回编辑**（改 Z → 改基数 → 改 Z）值不打架、无页面卡死、无无限刷新；
6. 主验收：e7-my1.txt 导入 + Z=1.3 + 利率0 + R补转企业2000-11 + 退休2033.7 → 「基本计算」与「方案比较」两页 P月 完全一致（Δ<0.01）；
7. 回归：Z=0.6 基数 7270/月缴 1454；Z=3.0 月缴 7269.6 不取整；三卡增删、结果页三分项正常。
### bug status
**bug status**: fixed（commit 5ff95dc，待 tester 独立 GUI 验收）

## BUG-02-0018
### testcase ID
- TST-02-MT-9005

### failure description
"基本计算" → "文件输入" → `e7-my4.txt`，选择性别 `女`。此时计算的**缺省退休年龄应该是 2031.7 或 2036.7**，但界面显示 **2034.11 或 2039.6**，全错，完全无法判断是如何算出的。

### root cause analysis
文件导入链路把「性别」用硬兜底值覆盖了用户选择，导致三身份全部走男性口径。

**证据链（逐环节实测，基线 3e0921f）**
1. **夹具本身没有性别字段**：`e7-wife4.txt` 只有 `# 生日: 1981-07-02`、`# 预计退休时间: 2031-07`，**无性别/身份字段**（`caseFile.parseCaseFile` 也不解析性别，全文件 grep 无 gender/性别）。题面写的 `e7-my4.txt` 不存在，实际夹具为 `e7-wife4.txt`。
2. **`services/caseValidator.js` `mapParsedToPageData()` L51-52**：`gender: options.gender || 'male'`、`femaleType: options.femaleType || 'worker'` —— 文件没有性别就**硬填 male/worker**。
3. **`components/shared-data/shared-data.js` `applyPrefill()` L188-199**：把 pageData 逐键 `setData` 回填，其中 `gender='male'`、`femaleType='worker'` 被原样写入，**覆盖用户在界面上已选的「女 / 女干部」**。
4. **`pages/index/index.js` `applyImportResult()` L104-118**：同样 `patch[k] = pd[k]` 回填 gender/femaleType，覆盖用户选择。
5. **`pages/index/index.js` `refreshDefaultRetire()` L138-143**：`this.setData({ retireYM: stat })` —— **无条件**用法定值覆盖 retireYM，即使文件里已明确写了 `2031-07`。

**数值验算（1981-07 出生，`calculator/retireSchedule.js`）**
`keyOf`+`statutoryRetireYM` 本身算法正确：男 2044-07 / 女工人 2034-11 / 女干部 2039-06；弹性下限分别 2041-07 / 2031-11 / 2036-07。
所以界面出现 **2034-11 / 2039-06** 不是算错，而是**性别被覆盖成 male/worker 后的女性档值**；0019 的 **2041-07** 则完全是**男性**弹性下限（`1981-07 + 60 年 = 2041-07`），证明 ctx 当时是 male。

**0018 定性**：.txt 已自带 `retireYM=2031-07`，但 `refreshDefaultRetire` 无条件覆盖，加上性别被硬填成 male（→2044-07）或 worker（→2034-11）或 cadre（→2039-06），三者都不是文件值。属**导入回填 + 缺省推导两处缺陷叠加**。
### fix solution description
**修复（commit a00c0a2，基线 3e0921f，未 push）**

1. `services/caseValidator.js` `mapParsedToPageData()`
   - 保留 male/worker 兜底默认值（引擎要求合法 gender，且无性别字段的旧夹具如 My-Case 依赖它，避免"性别缺失"报错）；
   - **新增标记** `genderFromFile` / `femaleTypeFromFile`（仅当 `options.gender/femaleType` 显式传入时为 true），用于告知调用方"文件里到底有没有性别"，把"是否覆盖用户选择"的决策交给调用方。
2. `components/shared-data/shared-data.js` `applyPrefill()`
   - `genderFromFile===false` 时 **删除 patch.gender**、`femaleTypeFromFile===false` 时删除 patch.femaleType，不再覆盖用户在界面上已选的「女 / 女干部」。
3. `pages/index/index.js` `applyImportResult()`
   - 同规则：`gender`/`femaleType` 在文件未提供时不回写，保留用户选择。
4. `pages/index/index.js` `refreshDefaultRetire()`
   - **retireYM 已是合法 `YYYY-MM` 时直接返回（保留文件值/用户值），不再被法定值覆盖**；仅在 retireYM 为空（新建/清空）时才推导缺省法定值。
5. `developer_test/TST-02-UT-1042/female-retire-ym-check.js`（新增，45 断言）
   - 三身份法定值：男 2044-07 / 女工人 2034-11 / 女干部 2039-06
   - 三身份弹性区间下限：2041-07 / 2031-11 / 2036-07，并断言**女干部下限 ≠ 男性 2041-07**
   - `planModel.legalRange` / `validateRetireYM` 三身份逐项校验
   - 0018：`genderFromFile=false` 标记正确；已有 retireYM（2031-07）在男/女工人/女干部三种 ctx 下**均不被覆盖**；空 retireYM 时仍能正确推导缺省值
   - 0019：女干部 2031-07 被拦截且文案下限为 **2036-07**、**不含 2041-07**；2036-07/2039-06 放行；男性 2041-07 行为不回退
   - 回归：TST-02-UT-1035（无性别夹具 My-Case 比较管道）保持 8/8 通过

**验证**：TST-02-UT-1042 **pass=45 fail=0**；全量 developer_test **46 文件 pass=778 fail=0 failFiles=0**，零回归。
### fix verification process
**（developer worker3 自测，dev box 直算产品模块；独立 GUI 验收归 tester）**

真实夹具 `e7-wife4.txt`（生日 1981-07-02，文件自带 retireYM=2031-07）实测：
```
导入后 pageData.genderFromFile = false（不再硬覆盖用户选择）
导入后 retireYM 保留文件值 2031-07（修复前会被覆盖）
三身份法定值：男 2044-07 / 女工人 2034-11 / 女干部 2039-06
三身份弹性下限：男 2041-07 / 女工人 2031-11 / 女干部 2036-07
```

**给 tester 的独立 GUI 验收点**
1. 「基本计算」→「文件输入」→ 导入 e7-wife4.txt；
2. 性别选 **女**：`retireYM` 保留文件的 **2031-07**，不再显示 2044-07/2034-11；提示行按女性口径给出法定 2034-11 与弹性区间 2031-11~2037-11（若文件值 2031-07 早于下限 2031-11，应提示"超出弹性范围"，属正确提示而非覆盖）；
3. 性别选 **女干部**：法定 2039-06，弹性区间 2036-07~2042-06；
4. 性别选 **男**：法定 2044-07，弹性区间 2041-07~2047-07（男性口径不回退）；
5. 清空 retireYM 后重新选性别：应能正确推导对应身份的法定值。

> 说明：题面写"应为 2031.7 或 2036.7"，实测女工人口径法定=2034-11、弹性下限=2031-11，女干部法定=2039-06、弹性下限=2036-07。文件自带值 2031-07 现已**原样保留**（不再被覆盖），是否落在弹性区间内由 `refreshRetireHint` 如实提示。若项目主口径要求"缺省退休年月"取弹性下限而非法定值，请另行裁定，本次按"保留文件值 + 法定值兜底"实现。
### bug status
**bug status**: fixed（commit a00c0a2，待 tester 独立 GUI 验收）

## BUG-02-0019
### testcase ID
- TST-02-MT-9005

### failure description
"方案比较" → "文件输入" → `e7-my4.txt`，选择性别 `女 干部`。在两个方案卡中分别选择 `退休年月`=**2031.7** 和 **2036.7**。每个方案卡下方会出现警告："退休年月早于合法下限 **2041.7** …"。女 1981.7 出生，退休时间**不可能是 2041.7**（那是男性的值）。程序因此认为比较输入不合理，点击 `开始比较` 后弹框、比较计算被 **block**。
截图：`C:\Users\Administrator\Desktop\Wechat projects\temp\退休2041.png`

### root cause analysis
文件导入链路把「性别」用硬兜底值覆盖了用户选择，导致三身份全部走男性口径。

**证据链（逐环节实测，基线 3e0921f）**
1. **夹具本身没有性别字段**：`e7-wife4.txt` 只有 `# 生日: 1981-07-02`、`# 预计退休时间: 2031-07`，**无性别/身份字段**（`caseFile.parseCaseFile` 也不解析性别，全文件 grep 无 gender/性别）。题面写的 `e7-my4.txt` 不存在，实际夹具为 `e7-wife4.txt`。
2. **`services/caseValidator.js` `mapParsedToPageData()` L51-52**：`gender: options.gender || 'male'`、`femaleType: options.femaleType || 'worker'` —— 文件没有性别就**硬填 male/worker**。
3. **`components/shared-data/shared-data.js` `applyPrefill()` L188-199**：把 pageData 逐键 `setData` 回填，其中 `gender='male'`、`femaleType='worker'` 被原样写入，**覆盖用户在界面上已选的「女 / 女干部」**。
4. **`pages/index/index.js` `applyImportResult()` L104-118**：同样 `patch[k] = pd[k]` 回填 gender/femaleType，覆盖用户选择。
5. **`pages/index/index.js` `refreshDefaultRetire()` L138-143**：`this.setData({ retireYM: stat })` —— **无条件**用法定值覆盖 retireYM，即使文件里已明确写了 `2031-07`。

**数值验算（1981-07 出生，`calculator/retireSchedule.js`）**
`keyOf`+`statutoryRetireYM` 本身算法正确：男 2044-07 / 女工人 2034-11 / 女干部 2039-06；弹性下限分别 2041-07 / 2031-11 / 2036-07。
所以界面出现 **2034-11 / 2039-06** 不是算错，而是**性别被覆盖成 male/worker 后的女性档值**；0019 的 **2041-07** 则完全是**男性**弹性下限（`1981-07 + 60 年 = 2041-07`），证明 ctx 当时是 male。

**0019 定性**：女干部场景下 ctx.gender 被 `applyPrefill` 覆盖成 `male`，`planModel.legalRange()` 用 `Schedule.keyOf('male', ...)` 取到男性档，弹性下限 = 1981-07+60年 = **2041-07**，于是 2031-07/2036-07 被判"早于合法下限"，`startCompare` 被 block。女干部的**正确下限是 2036-07**（原法定 55 岁）。
### fix solution description
**修复（commit a00c0a2，基线 3e0921f，未 push）**

1. `services/caseValidator.js` `mapParsedToPageData()`
   - 保留 male/worker 兜底默认值（引擎要求合法 gender，且无性别字段的旧夹具如 My-Case 依赖它，避免"性别缺失"报错）；
   - **新增标记** `genderFromFile` / `femaleTypeFromFile`（仅当 `options.gender/femaleType` 显式传入时为 true），用于告知调用方"文件里到底有没有性别"，把"是否覆盖用户选择"的决策交给调用方。
2. `components/shared-data/shared-data.js` `applyPrefill()`
   - `genderFromFile===false` 时 **删除 patch.gender**、`femaleTypeFromFile===false` 时删除 patch.femaleType，不再覆盖用户在界面上已选的「女 / 女干部」。
3. `pages/index/index.js` `applyImportResult()`
   - 同规则：`gender`/`femaleType` 在文件未提供时不回写，保留用户选择。
4. `pages/index/index.js` `refreshDefaultRetire()`
   - **retireYM 已是合法 `YYYY-MM` 时直接返回（保留文件值/用户值），不再被法定值覆盖**；仅在 retireYM 为空（新建/清空）时才推导缺省法定值。
5. `developer_test/TST-02-UT-1042/female-retire-ym-check.js`（新增，45 断言）
   - 三身份法定值：男 2044-07 / 女工人 2034-11 / 女干部 2039-06
   - 三身份弹性区间下限：2041-07 / 2031-11 / 2036-07，并断言**女干部下限 ≠ 男性 2041-07**
   - `planModel.legalRange` / `validateRetireYM` 三身份逐项校验
   - 0018：`genderFromFile=false` 标记正确；已有 retireYM（2031-07）在男/女工人/女干部三种 ctx 下**均不被覆盖**；空 retireYM 时仍能正确推导缺省值
   - 0019：女干部 2031-07 被拦截且文案下限为 **2036-07**、**不含 2041-07**；2036-07/2039-06 放行；男性 2041-07 行为不回退
   - 回归：TST-02-UT-1035（无性别夹具 My-Case 比较管道）保持 8/8 通过

**验证**：TST-02-UT-1042 **pass=45 fail=0**；全量 developer_test **46 文件 pass=778 fail=0 failFiles=0**，零回归。
### fix verification process
**（developer worker3 自测，dev box 直算产品模块；独立 GUI 验收归 tester）**

女干部（1981-07）实测：
```
planModel.legalRange(女干部) = 2036-07 ~ 2042-06（法定 2039-06）
validateRetireYM('2031-07', 女干部) → 拦截，文案下限 2036-07，不含 2041-07
validateRetireYM('2036-07', 女干部) → 合法放行
validateRetireYM('2039-06', 女干部) → 合法放行
男性对照：validateRetireYM('2041-07', 男) → 合法（男性口径未回退）
```

**给 tester 的独立 GUI 验收点**
1. 「方案比较」→「文件输入」→ 导入 e7-wife4.txt，共享区性别选 **女干部**；
2. 两张方案卡分别设退休年月 **2031-07** 与 **2036-07**；
3. 断言：**不出现**"早于合法下限 2041-07"警告；2031-07 若报错也须报 **2036-07** 为下限；
4. 「开始比较」**可正常执行并出结果**，不被 block；
5. 回归：性别切 **男** 时，2041-07 仍为下限（男性行为不变）；
6. 证据：page.data 回读 + 截图。
### bug status
**bug status**: fixed（commit a00c0a2，待 tester 独立 GUI 验收）
