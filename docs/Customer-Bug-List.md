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
"方案比较" --> "文件输入" --> e7-my1.txt -->方案卡: 方案卡里只有"退休年月"。那么目前算法的起点是从什么？请加上"缴费起始时间"，并给出缺省值为实际缴费记录里 "最后一个缴费月 + 1月"。

**Root Cause（开发复核）**：方案卡仅采集「退休年月/Z/缴费性质」三项，自动缴费段的起点在 `planAssembler` 中被写死为常量 `WINDOW_START_YM='2026-09'`（`paybackModel.ORIGIN_YM`、`rContribution` 同源），没有随实际历史缴费末月动态确定，也不允许用户修改；起点一旦与真实“历史最后缴费月+1”不一致，自动段区间与 R续/回本/账户滚动都会整体错位。

**Fix Solution（修复，D1）**：① 方案卡新增「缴费起始时间」month picker，**可手动编辑**；缺省值＝实际缴费记录最后缴费月+1月（My-Case 缴至 2026-08 → 缺省 2026-09），由共享区历史段动态推导，不再写死。② 校验：起始月须介于“历史末月”与“退休前一月”之间，越界红字阻断（早于历史末月或晚于退休前一月均提示）。③ `planAssembler`（删除写死起点，改为 `resolveWindowStart/defaultWindowStart`）、`paybackModel.retireOffset`（接受动态 origin）、`rContribution`（透传起点）、`roiModel.buildCaseInput`（同一动态值）四处起点统一由该 `windowStartYM` 贯穿，继续/停保两情形一致。

## BUG-02-0005
"方案比较" --> "文件输入" --> e7-my1.txt，个人账户储蓄额，没有利率输入框。应该象"基本计算"里的一样，可以指定利率，利息计算必须持续到退休时年月。另外，现在算法，利率怎么算的?

**Root Cause（开发复核）**：`inputValidator.buildSharedInput` 在组装比较路径共享入参时把 `futureMonthlyRate` **写死为 null**，且方案卡/共享区均没有利率输入框；`pensionEngine.calcAccount` 见 `futureMonthlyRate==null` 即走“静态分支”（直接返回手工锚定余额、不计未来利息）。因此方案比较里个人账户从余额月起从未计息，与基本计算（可录利率、走逐月滚动分支）不一致——此即 BUG-02-0006/0007 的同一根因。利率算法：引擎对账户余额采用“年利率/12”的**月复利**，自余额所在次月起、逐月滚到退休前一月（退休当月不计利息），每月还叠加当月到账缴费的 8% 记账额。

**Fix Solution（修复，D1，按项目主裁定 Q1=B）**：三方案**共用一个**记账利率，输入框放在**共享区**（shared-data，与账户累计储存额同区），**不放**方案卡；文件输入时取 common 段“个人账户利率”作为缺省（My-Case=1.5%），手工录入缺省亦为 1.5%（留空取缺省，填 0 表示不计息，允许 0~20%）。删除 `buildSharedInput` 中写死的 `futureMonthlyRate:null`，按 parseFloat(%)/100 透传该共享利率到每个方案，使 compare 账户进入引擎滚动分支、以该利率逐月计息至退休前一月（继续/停保两情形均接通：停保基准无未来缴费且利率归零）。

## BUG-02-0006
"方案比较" --> "文件输入" --> e7-my1.txt，设置方案1：退休年月=2033-07; Z=0.6; 缴费性质=灵活就业。计算后，方案1的个人账户养老金=4919.74，和"基本计算"的不一致(J帐=5803元，利率=1.5%)。个人感觉是"方案比较"里算错了。

**Root Cause（开发复核）**：与 BUG-02-0005 同根因——比较路径 `futureMonthlyRate` 被写死为 null，账户走静态分支、未来段零利息，Z=0.6 方案未来缴费与利息都未滚动，导致 R储/J账户 系统性偏小（4919.74），与基本计算的滚动结果（J账 5803，1.5%）不一致。

**Fix Solution（修复，D1）**：随 BUG-02-0005 接通共享利率滚动分支、BUG-02-0004 动态起点后，同一案例/利率/缴费起始月下，basic 与 compare 走**同一引擎运算路径**。已交付同输入台账（tests/bug02-0004-0007-check.js，TST-02-UT-1030）：利率 0/1.5% 两档、Z=0.6/3.0 下 R储/J账户/P月 两路径差均为 0（判据 ±0.001）。注：不以 GUI 旧值 5803/4919.74 为修复目标，最终绝对数以修复后台账由项目主判定。

## BUG-02-0007
"方案比较" --> "文件输入" --> e7-my1.txt，设置方案3：退休年月=2033-07; Z=3.0; 缴费性质=灵活就业。计算后，方案3的个人账户养老金=4936.16，和"基本计算"的不一致(J帐=6651.57元，利率=0)。类似BUG-02-0006, 个人感觉是"方案比较"里算错了。

**Root Cause（开发复核）**：同 BUG-02-0005/0006——比较账户静态分支不滚动，Z=3.0 方案未来高基数缴费（8%记账额）与利息均未计入，R储/J账户 偏小（4936.16），与基本计算不一致。

**Fix Solution（修复，D1）**：随 0005/0004 一并修复。同输入台账（TST-02-UT-1030/1031）证明：basic 与 compare 在利率 0/1.5%、Z=0.6/3.0 下 R储/J账户/P月 两路径差均为 0（±0.001）；且 compare 方案 J账随 Z(0.6→3.0) 显著拉开（利率0档 J账 1815.17→2978.31；1.5%档 1994.83→3218.86），不再是静态分支下的近似相同值。不以 GUI 旧值 6651.57/4936.16 为目标，最终绝对数以修复后台账由项目主判定。

## BUG-02-0008

> 本台账惯例只收 customer 明确提出项。**本条非 customer 提出**，系 tester（worker4 / Senior Wechat Tester YDL）独立 GUI 取证发现，经**项目主 2026-10-13 批准特批写入**（内部台账第 32 项，沿用 BUG-02 内部编号，不占 customer previous Bug 号）。**本轮不修复**，待 BUG-02-0004~0007 全部 PASS 后单独排期。

"方案比较"页在入口页**不填任何个人信息、直接用"文件输入"导入完整案例文件**时，两张用户从未触碰的默认方案卡，其"退休年月"停留在演示默认出生年（1965-10）推导出的陈旧值 **2026-01**，不随导入后真实出生年月（My-Case birthYM=1973-07，法定退休应为 **2035-09**）刷新，且该错误值已 persist 到本地 draft（pension_plans_v1）；导入后两张卡即处于非法（退休月早于历史末月）状态，用户须手动逐卡重选才能继续。

**复现前置**：entry 页不填写任何个人信息（birthYM 等保持演示默认 1965-10），直接进入"方案比较"→"文件输入"→导入 tests/fixtures-case/My-Case.md（完整文件，非仅 common 段）。属 E4 公共信息预填路径，与"先在 entry 填真实出生年再进 compare"的既有用法不同。

**独立证据（tester 独立采样，非引用 developer；fresh cli auto 口 40234，单连接 reLaunch entry→清双 draft→goCompare→导入完整 My-Case.md）**：
- Windows 证据文件 `autotest/output/t47/dec.txt`、`dec-run.log`（DEC_EXIT=0），脚本 `C:\t44\t47-dec.js`；本地报告 `output/p-mu45ws9mfajyky-worker4/t47-premise-and-bug-findings.md`。
- 导入前回读：pageCtx/sharedCtx `birthYM="1965-10"`；两张默认卡 `retireYM="2026-01"`、`retireTouched=false`，已 persist draft。
- 导入后回读：pageCtx `birthYM="1973-07"`、`historyEndYM="2026-08"`（公共信息正确回填）；但两张卡 `retireYM` 仍为 "2026-01"、`retireTouched=false`，draft 内同为 2026-01。
- 独立纯 node 跑 `planModel.defaultRetireYM(ctx)`（`retireSchedule.statutoryRetireYM`）：male/1973-07 法定退休月=**2035-09**；而 2026-01 恰是 male/**1965-10**（`inputPageModel.buildInitialData` 演示默认出生年）的法定退休月。

**影响**：2026-01 早于实际历史末月 historyEndYM=**2026-08**（也早于缴费起始缺省 2026-09），planModel 退休年月校验必判"退休月过早/早于最后缴费月"，两张默认卡导入即非法、阻断"开始比较"；错误值已 persist，重进页面仍残留，用户必须手动逐卡重选，违背"文件导入公共信息即可快速建案"。注：本缺陷**不影响**缴费起始月缺省——windowStartYM 为空时 startText=defaultWindowStartYM=historyEnd+1=2026-09，导入后 ctx 正确、起始月缺省正确。

**Root Cause（根因假设，基于源码 + dec 现象，待开发复核）**：① `inputPageModel.buildInitialData(true)` 给 shared-data 演示默认 male/birthYM=**1965-10**；② compare 首帧 plan-list attached 用该演示 ctx 调 `initialPlans → defaultRetireYM(1965-10)=2026-01`，写入每张卡并 persist；③ 文件导入 `shared-data.applyPrefill` 把 birthYM 改为 1973-07 并触发 ctx observer，但 plan-list observer 对退休月的重算条件是"`!retireTouched && !retireYM` 才补默认"，此刻 retireYM 已非空（2026-01）→条件不成立、**不重算**，陈旧值保留；④ compare 文件导入路径本身也不重建/校正 planList 的卡。即"attached 阶段用演示 ctx 预填退休月"与"observer 仅在退休月为空时才补默认"两处逻辑冲突，系统默认值与用户已选值之间缺少 `retireTouched` 之外的"是否系统默认值"区分。

**Fix Solution（修复方向，三条择一/组合，本轮不实施）**：方向一——plan-list 的 ctx observer 去掉 `!retireYM` 限制，对所有 `retireTouched===false`（用户未手选）的卡一律以新 ctx 法定退休月重算，仅用户触碰过（true）才保留手选值；方向二——compare 文件导入 applyPrefill 成功后用真实 ctx 重新 `initialPlans()`/批量刷新所有未触碰卡的 retireYM，或在拿到真实公共信息前不预建卡（初始 retireYM 置空）；方向三——initialPlans 对缺省卡 retireYM 一律置空，交由 observer 在 ctx 为真实输入后统一填法定值，从源头避免演示出生年（1965-10→2026-01）被固化。

**回归点**：① 清 draft→entry 不填信息→直接 compare→文件导入 My-Case：两张卡 retireYM 应=**2035-09**（非 2026-01），无"退休过早/早于最后缴费月"红错，draft 内同为 2035-09；② 同路径导入 MyWife-Case（女性 1981-07）：默认退休月按性别/femaleType 正确计算，不残留 2026-01；③ 用户手动改过退休月（retireTouched=true）后再导入/改公共信息，手选值**不得**被覆盖；④ entry 正常填真实出生年再进 compare 的既有用法，以及 compare 三卡新增/删除/结果计算，不得回归。

**登记与状态**：tester worker4 独立 GUI 取证发现（证据 dec.txt / 口 40234）；项目主 2026-10-13 批准特批登记；状态＝本轮**不修**，待 BUG-02-0004~0007 全 PASS 后单独排期。


## BUG-02-0009

> 本台账惯例只收 customer 明确提出项。**本条非 customer 提出**，系 tester（worker4 / Senior Wechat Tester YDL）独立 GUI 取证发现，经**项目主 2026-10-14 批准登记**（下一可用内部号 BUG-02-0009，0008 已占；沿用 BUG-02 内部编号，不占 customer previous Bug 号）。**本轮不修复**，待 BUG-02-0004~0007 收口后单独排期。

"方案比较"页文件导入后，方案卡**缴费起始时间（缴费起始月）的下界越界校验存在 off-by-one**：当用户把缴费起始月选成**恰等于实际缴费历史最后一个月**（My-Case 历史末月 historyEndYM=**2026-08**，起始月取 2026-08）时，`isValidPlan` 仍返回 **true**、起始月无任何红色错误提示，本应按"起始月须为最后缴费月+1（2026-09）起"被拦截的等值边界被错误放行（严格早于的 2026-07 才能被拦）。

**现象**：起始月=2026-08（=历史末月）时 isValidPlan=true、planErrors 中无缴费起始月红错；assemblePlanInput 仍正常出方案。对照：2026-07（早于历史末月）被正确拦截（"缴费起始时间 2026-07 早于最后缴费月 2026-08，不能比较"），2026-09（历史末月+1，即动态缺省值）合法，上界 2033-08（=退休当月）被正确拦截（"不得晚于退休前一月（退休 2033-08）"）、2033-07（=退休前一月）合法，留空 resolve 成缺省 2026-09 合法。

**复现前置**：entry 不填信息→"方案比较"→"文件输入"→真实文件链路导入 tests/fixtures-case/My-Case.md（写真实 USER_DATA_PATH 文件→mock chooseMessageFile→onChooseCaseFile 真实解析；ctx: gender=male, birthYM=1973-07, historyEndYM=2026-08）。导入后在小程序运行时 `require('calculator/planModel.js' / 'planAssembler.js')` 只读回读 isValidPlan/planErrors/assemblePlanInput，临时 plan 仅作纯函数入参，不回写页面、不点原生月滚轮、不调 onCardChange。上界口径取 retireYM=2033-08（退休前一月=2033-07）。

**独立证据（tester 独立采样，非引用 developer；常驻 automator 口 40215，用例间只 connect/disconnect，零 RDP）**：
- 权威基线 **aefeb43** 复现：summary `gt4021-20261014-123208.summary.json`、trace `gt4021-20261014-123208.trace.txt`、截图 `gt4021-20261014-123208.png`（TS=20261014-123208；14c4820 首轮 TS=20261014-120513 同结论）。
- 缺陷报告与小报告：`output/p-mu45ws9mfajyky-worker4/bug02-0004-0007-gui-regression/task53/BUG-02-0009-GT4021-lower-boundary-offbyone-20261014.md`、`T2A-report-GT4019-4021-20261014.md`。
- 两路一致：除小程序运行时回读外，另在本地独立克隆用 GUI 导出的真实 sharedInput（`gt-my-20261014-115327.sharedinput.json`）重算 assemblePlanInput 复核。
- Manager（worker1）已独立读 123208 summary 复核，retire=2033-08 与 2033-07 两场景 2026-08 均 valid=true 被错放，FAIL 成立。

**影响**：起始月=2026-08 被放行后，assemblePlanInput 生成的自动 flexible 段首月=**2026-08**（区间 2026-08→2033-07），与历史段末段（…→**2026-08**）在 **2026-08 当月形成闭区间重叠**：该月既按历史 baseMonthly(35945.25) 又按自动段 B=Z×C(7269.6) 重复计入（同月双计）。直接污染账户滚动（J账/个人账户累计）、R续 及最终 P月，使其偏大；起始月=2026-09 时自动段首月=2026-09，两段不重叠，结果正常。

**Root Cause（已定位源码，非猜测）**：下界校验用了严格小于而非"小于等于"。
- `calculator/planAssembler.js` 的 `validateWindowStart`（约 :48）：`if (historyLast && D.toIndex(start) < D.toIndex(historyLast)) return '缴费起始时间 ... 早于最后缴费月 ...';`
- `calculator/planModel.js` 的 planErrors（约 :125）：`if (... D.toIndex(windowStartYM) < D.toIndex(h)) ...` 同源。
- 当 start==historyLast（2026-08==2026-08）时 `<` 为 false → 漏拦截；而同函数上界 `toIndex(start) > toIndex(retireYM)-1`（含端点，=退休前一月合法）才是正确写法，下界应对称要求 start ≥ historyLast+1。函数注释自述"须介于历史末月与退休前一月之间（含端点）"，与客户原始诉求缺省="最后一个缴费月 **+1月**"共同表明 2026-08 不合法。
- UT 缺口：tests/bug02-0004-0007-check.js 的 TST-02-UT-1027 未覆盖"起始月恰好=历史末月"等值边界，故 developer UT 全绿但漏过此 off-by-one。

**Fix Solution（本轮不实施，交开发）**：① planAssembler.js `validateWindowStart` 下界改为含端点：`D.toIndex(start) <= D.toIndex(historyLast)` 即拦截（等价 start 须 ≥ historyLast+1），错误文案与产品确认（建议"不得早于最后缴费月的次月"）；② planModel.js planErrors 同源行同步 `<`→`<=`；③ 同步订正函数注释"含端点"表述（下界实为历史末月+1 起，端点 2026-08 不合法），避免注释与实现背离；④ TST-02-UT-1027 增补等值边界：start=historyLast 必须拦截、start=historyLast+1 合法，并断言 assemblePlanInput 在合法起点下自动段首月=historyLast+1、历史段与自动段月份零交集。

**回归点**：① 修复后重跑 GUI GT-4021（回归脚本 `autotest` 侧 t47 / worker4 `scripts/gt4021-regression.js`，expect 显式含 2026-07 reject）：2026-08 应转 isValidPlan=false 且有起始月红错；2026-07、2033-08 仍拦截；2026-09、2033-07、留空 仍合法；② 三断言：=历史末月拒 / =末月+1合法 / 任何合法起点历史段与自动段零重叠（自动段首月>历史末月）；③ 回归 GT-4019/4020 动态缺省不受影响（缺省仍=历史末月+1：My 2026-09、wife 2026-01）；④ 原生月滚轮手工滚到历史末月当月也应红错拦截（红点/滚轮点选归 MT-9002 人工确认）。

**登记与状态**：tester worker4 独立 GUI 取证发现（常驻口 40215，基线 aefeb43，TS=20261014-123208）；Manager worker1 独立复核 FAIL 成立；项目主 2026-10-14 批准登记为 BUG-02-0009；矩阵 TST-02-GT-4021 行按实落 FAIL 并关联本条；状态＝本轮**不修**，待 BUG-02-0004~0007 收口后单独排期。


## BUG-02-0010

> 本台账惯例只收 customer 明确提出项。**本条非 customer 提出**，系 tester（worker4 / Senior Wechat Tester YDL）在 task-54（BUG-02-0005 独立 GUI 验收 GT-4029）真实文件链路回归时独立 GUI 取证发现，经**项目主 2026-10-14 16:10 批准**登记（下一可用内部号 BUG-02-0010，0009 已占）并**裁定方案 A 本轮立即修复**；开发 worker3 于 task-58 修复，提交 **0bc2775**，tester worker4 同轮真实链路复测通过。状态＝**本轮已修复**。

"方案比较"页经"文件输入(.md/.txt)"导入含缴费记录表的共用案例（如 tests/fixtures-case/My-Case.md）后，点"开始比较"虽成功跳转到比较结果页，但结果页**整页无法构建任何方案数据**：`ready=false`、比较列 0、`loadError` 为空，屏幕仅剩标题"比较结果"和"返回方案输入页"按钮（无数据、无错误文案的白屏兜底）。手工"分段(bound)"通道不受影响。

**复现前置（修复前基线 ffcd5d5）**：entry 不填信息→"方案比较"→"文件输入"→真实文件链路导入 tests/fixtures-case/My-Case.md（历史 27 缴费段，余额锚点 672920/2026-08，利率 1.5%）；用 plan-list 真实方法 applyPlans 补两张合法且不同方案卡（退休/Z/缴费性质齐全），点击页面真实"开始比较"。常驻 automator 口 40215，用例间只 connect/disconnect，零 RDP。

**独立证据（tester 独立采样，非引用 developer）**：
- 端到端白屏：`output/.../task54/screenshots/probe-e2e-20261014-142052.png`、`logs/probe-e2e-20261014-142052.trace.txt`、`json/probe-e2e-20261014-142052.summary.json`（跳转后 ready=false、view 空、0 列）。
- 三引擎路径一致报错：`json/probe-bv-20261014-141752.summary.json`——运行时生产 `compareResultModel.buildView`、`roiModel.computeROI`、`planAssembler.assemblePlanInput + Engine.calculate` 均抛 `输入校验失败：缴费段1身份类型非法；…；缴费段27身份类型非法`；`buildValidatedInput()` 的历史 27 段 `histTypeSet=[null]`、seg0=`{startYM:'2000-01',endYM:'2000-02',baseMonthly:3071}`（旧 3 列夹具起始月按缺省 1）。
- 两路一致：另在本地克隆用 parseCaseFile→validate→buildSharedInput→assemblePlanInput→calculate 复算同样抛"缴费段身份类型非法"；手工 bound 通道（段默认 type='enterprise'）本地实测可正常计算（P月=9429.31）。
- 覆盖缺口说明（Manager worker1 独立复核解开 GT-4010 表面冲突）：task-52 GT-4010 当年 harness `t41-p2-accept.js:285` 对手工段手工盖章 enterprise，未对真实文件 yearRows 无 type 主链路做端到端覆盖，故当时 PASS，非数值误判。
- 隔离佐证（非生产路径）：对共享入参内存副本补历史段 type='enterprise'（不回写页面）后 continue/stop 9/9 PASS（`json/gt4029v2-20261014-145854.summary.json`），证明 BUG-02-0005/0007 利率透传与 continue/stop 逻辑本身正确，仅被本缺陷挡在引擎入口。

**Root Cause（已定位源码，非猜测）**：
- 文件导入与手工"年度模式"走 year 通道：`services/caseValidator.js mapParsedToPageData` 生成 yearRows 只有 `{year,startMonth,annualBase,months}`（旧夹具/旧解析无身份列），`inputPageModel.emptyYearRow()` 亦无 type。
- `calculator/inputValidator.js buildSharedInput`（约 :169）段映射直接 `type: s.type`，对 year 通道 `s.type===undefined` 不做默认兜底；而 basic 通道 `buildInputLike`（约 :91）是 `type: s.type || 'enterprise'`、手工 bound 段默认 enterprise。两通道口径不一致，历史段 type=null 通过共享区校验（共享校验不查 type）却被引擎 `pensionEngine` 入参校验（type 须 ∈{enterprise,flexible}）整段拒绝。
- `pages/compare/compare.js startCompare` 只按 isValidPlan 过滤方案卡、不预检历史段 type，照常 navigateTo；`pages/compare-result/compare-result.js onLoad→rebuild→buildView` 无 try/catch，buildView 抛错后 ready 恒 false，wxml 兜底块显示空 loadError，形成"无数据无提示"白屏。
- 该 type 透传映射随 D2 共享数据组件引入（commit 8e76fa1）起潜伏；只要文件/年度行不带身份就必现。

**Fix Solution（开发 worker3 task-58，提交 0bc2775，已落地）**：
1. `services/caseFile.js`：缴费表由旧 3 列扩为 **5 列＝年份|养老缴纳基数(年)|年内起始月份(1~12)|年内缴纳月数|缴费身份**；新增全仓库唯一 `mapIdentityToType`（单位/企业职工→enterprise，灵活/灵活就业/失业灵活就业→flexible，无法识别逐行报错）；5 列读 startMonth（1~12 整数校验）+身份，**旧 3 列向后兼容**（startMonth 缺省 1、身份缺省 enterprise）；records 增加 startMonth/type 及行号。
2. `services/caseValidator.js`：复用同一身份映射；mapParsedToPageData 透传 startMonth/type（不再硬编码 '1'/缺身份）。
3. `calculator/inputValidator.js buildSharedInput` 与 `calculator/planAssembler.js cloneSharedInput` 段映射补 `type: s.type || 'enterprise'`，与 buildInputLike 口径统一（双保险）。
4. 结果页容错：`compareResultModel` 新增 `buildViewSafe`（纯 buildView 仍抛错供预检/单测，safe 捕获返回可读 error）；compare-result `rebuild` 改走 safe，异常置 ready=false+可读 loadError 不白屏；compare `startCompare` 跳转前 buildViewSafe 预检，段身份非法在输入页 toast 拦截不跳转。
5. 逐字节对齐项目主权威新夹具（tests/fixtures-case 与 docs/mycases 各 2 份，LF）：My-Case 首段 2000 由旧缺省起始月 1 **纠正为 11**（2000-11~2000-12，与建账 2000-11 对齐）；MyWife 2003=09 起 4 月、2005=01 起 7 月、2006=04 起 9 月。新增 tests/bug02-0010-check.js（62 断言，入 run-unit-tests.bat）。

**复测（tester worker4，基线 0bc2775，常驻口 40215，独立取值，非引用 developer 数字）**：
- **GT-4029 真实链路 12/12 PASS**（`json/gt4029reg-20261014-180229.summary.json`）：文件导入→两张合法不同卡→真实开始比较，结果页 ready=true、2 列、loadError 空、P月 13290.66(z0.6)/13726.27(z1.0)（与 tester 本地独立重算一致）；27 历史段全 enterprise、seg0=2000-11~2000-12；continue 利率 0.015 透传至退休前月、自动段 B=Z×C、账户滚动计息，stop 无自动段、利率归零、静态锚定余额零计息。
- **GT-4031（5 列起始月+身份解析）12/12 PASS**（`json/gt4031-20261014-182115.summary.json`）：My 27 段 seg0=2000-11~12 enterprise(baseMonthly 3071)、全 enterprise；MyWife 设女性/女工人后 23 段，seg0=2003-09~12、2005=01~07、2006=04~12 全 enterprise，两卡（产品法定退休月 2034-11，z0.6/z3）真实结果页 ready、P月 8465.41/11179.12（与独立重算一致）；临时 5 列含「灵活」行→flexible(2010-03~04)；旧 3 列→startMonth 缺省 1、type 缺省 enterprise（向后兼容）；非法身份「外包」、起始月 13 均逐行 fileErrors 拦截。
- **GT-4026 回归 7/7 PASS**（`json/gt4026-20261014-180358.summary.json`）：共享利率缺省/留空回退 1.5%、录"0"=0 可算、录"25"越界红错阻断、利率只在共享区 plan-card 无利率字段，修复后无回归。
- GUI 零回归：三轮常驻口只 connect/disconnect、零 RDP；业务轮 WeappLog 计数 utility-exit/force-close/opened 无新增（8/9/9，9/9 为批准启动器 T47Launcher40215 拉起 automator 附加项目的通道固有增量，非业务脚本），40215 全程 Listen。

**回归点（已覆盖/后续保留）**：① 真实 5 列文件（含灵活身份）文件导入→结果页渲染；② 旧 3 列文件仍可导入不白屏；③ 非法身份/非法起始月输入页可读拦截；④ 手工 bound/年度两通道结果一致；⑤ GT-4026 利率链路、GT-4029 continue/stop 长期回归。

**登记与状态**：tester worker4 独立 GUI 取证发现（ffcd5d5，TS=20261014-142052/141752）；Manager worker1 独立复现坐实并厘清 GT-4010 覆盖缺口；项目主 2026-10-14 16:10 批准登记 BUG-02-0010 并裁定本轮修复；开发 worker3 task-58 提交 0bc2775；tester worker4 同轮 GT-4026/4029/4031 全部 PASS；矩阵 TST-02-GT-4026/4029 回填 PASS、新增 TST-02-GT-4031 行关联本条；状态＝**本轮已修复**。
