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

