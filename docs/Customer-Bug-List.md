# Customer Bug List — 北京企业养老金测算小程序

> 来源：YDL 在 chat / team-workflow 中明确要求修改的问题（customer-reported）。
> 编号严格沿用 YDL 原始编号，**不改号**；未收录 agent/测试自发现的问题。
> 整理日期：2026-09-24。

---

## Bug 0
**京劳社养发〔2007〕21号 and 京劳社养发〔2007〕31号 提到了R储 和 R补,以及如何计算。** 请找到这份文件，并修改specification.md: section 2.2。然后相应修改code and test case. 最后重新测试，用miniprogram-automator自动化测试。

## Bug 1
**手机界面上「实际缴费记录」一节，如果用「年度模式录入」，直接输入年基数，不要用月基数。** 改界面和算法。

## Bug 2
**报告里 N应缴 为什么是 40.75？** 请 architect 检查有关文件的算法，特别是 N应缴 的起点应该是什么时间，请核实并相应修改。

## Bug 3
**报告里 R补=0**，但视同期间在事业单位（此信息补充到了 My-Case.md）。请重新计算。

## Bug 4
**报告里 G同 != 0，G实 = 0**，是不是有问题？请 architect 检查有关文件的算法，核实并相应修改。

---

## Bug 5
输入页 Section「视同缴费年限」**用起止年月，不用直接月数**。

## Bug 6
输入页点击「清空本地录入数据」后，**所有输入框里的数字都没变**，应该都清空。

## Bug 7
输入页**所有输入框里显示的数字都太靠右了，可以居中**。

## Bug 8
输入页 Section「个人账户存储与利息」，**直接录入账户累计额，保留「未来段记账年利息」；删除利息模式、计息口径等**。

## Bug 9
输入页「N实98」**不要输入，计算出来即可**（Refer to Bug 5，利用「视同缴费起止年月」）。

## Bug 10
输入页「一次性个人账户补贴」是什么？（疑问，需澄清其含义/去向）

## Bug 11
输入页点击「开始测算」后有短暂计算时间，**在原图上叠加等待沙漏或旋转圆圈**，让用户理解不是卡顿。

## Bug 12
输出页 R储 的政策说明「即本金 xxx + 利息 xxx」——**这里的本金是从什么时间算起的？肯定不是个人账户里所有的**，请在政策说明写清楚。（用户假定从 2026-09 开始，但与结果差得挺多，请核实。）

## Bug 12.1
输出页 R补 的下方有一段政策说明，但**最下面又重复了「本金/利息」，请删除**。

## Bug 13
输出页**增加 Z实指数 的按年计算结果 (Xn/Cn−1) 明细账，n = 1992 ~ 2033**。

---

## Bug 14
计算 Z实指数 (Xn/Cn−1) 时，**如果不是整年的情况下算法有误，请改正**。

## Bug 15
输入页「实际缴费记录」的输入，**缺省用「年度模式录入」，而不是月模式**。

## Bug 16
输入页点击「开始测算」后旋转圆圈**时间太短，要持续到输出页弹出为止**。

---

## Bug 17
计算 Z实指数核对：Z实 = SUM((Xn/Cn−1)) / N应缴 = 81.1528 / 32.6667 = **2.4843**（n=2000~2033），但系统算出 **2.4068**、反算 N应缴=33.667。**请检查是什么问题。**

## Bug 18
计算 Z实指数，**如果 > 3 应取 3.0**（2019 年即因社平缴费基数下降导致 >3.0）。请查官方政策决定输出 Z 时是否加 `min(3, Z实)`。

---

## Bug 19
My-Case.md 里 **2026 年数值已变成 287562**，以此为准。请确认 testcase 是否已同步修改。（用户要求 Show testcase file。）

## Bug 20
**2026 的缴费基数（=1.0）是 12116，12116 × 0.6 ≈ 7270；从 2026-09 开始用 7270，一直到退休。** 请据此改 case。

## Bug 21
输出页 Z实指数年度明细，计算 (Xn/Cn−1) 时，**如果不是整年，还原到「年计算法」，不用月均值**；这样即可 SUM(34 行)/N应缴，**删掉「边界年提示」**。

---

## Bug 22
输入页「视同缴纳年限」——如果没有视同，**起止时间输入框无法清除**。Case MY3/4 里输入框仍残留 Case MY1/2 的旧值，confusing 且删不掉（虽然确实没在运算中使用）。

## Bug 23
输出页「N应缴」，Case MY3 值是 **38.75，错误**（参保时间 2003-09）。N应缴 计算**第二次出错**。且下方注释仍残留 Case MY1/2 信息「参保时间 2000-11」，让人 confuse。

## Bug 24
输出页「Z实指数」年明细下方的注释**仍引用 Case MY1/2 的数据**，注释内容没和实际 case 同步更新——这是个 common 问题，改。

---

## Bug 25
输入页 section(4)「个人账户储蓄额与利息」可与 section(4)-2「人员身份与R补」**合并为一个 section(4)「个人账户养老金」**，「个人账户储蓄额」与「R补」作为两项。

## Bug 26
输入页 section(4)-2「企业实际参保缴费起始」**并非仅在有 R补 时才有**。这一项是最基本信息，**挪到 section(1)「基本信息」里**；计算 N应缴 时可使用这个值。

---

## Bug 27
I changed the value of POLICY_DATA.version from '2026.09.23-bug2224' to '2026.09.23-bug2526' in file policyData.js in DevTool. But my simulator still shows the old value '2026.09.23-bug2224'. pls check the reason and how to fix it? [Codebuddy fix it]: 在 DevTool里修改的静态数据，被cache里的旧数据覆盖了，simulator总是读取cache (saveDraft: function () { wx.setStorageSync('pension_input_v1',…)})。pension_input_v1的cache数据跟code改动立即变化，必须clear cache data(要重新录入所有缴费信息)，重启simulator, 重启DevTool都不管用.

---

## 附注
- 编号 Bug 12 在 YDL 原始消息中出现两次（R储 本金说明 / R补 重复「本金/利息」删除），第二个已命名为 **12.1**。
- Bug 0 为最早一条关于「R储 和 R补」的原始要求（京劳社养发〔2007〕21号 / 31号），先于 Bug 1；按用户意见补录。
- Bug 1~4 首次提出于 2026-09-21，其余分组依次延续；Bug 19/20/21 为 YDL 对已发现问题的补充明示 + 数据更正。
- 本清单仅收录 customer（YDL）明确提出「改/核实/检查」的项，不含 tester/architect/developer 自查发现的问题。
- Bug 27 是项目主自己修改的，没有通过Claw AI的处理。Chat历史里没有。


``` phase 2 ```
## Bug 28
The specification of phase2 and the dedicated test coverage matrix are not in .\docs\ on 开发服务器。And pls confirm the initial covreage matrix has same REQ items and owner assigned with the dedicated test coverage matrix.

## Bug 29
"方案比较"输入页面，"输入方式"选择时，"手工输入"和"文件输入"两个按钮，没有缺省也没有高亮。反观"基本计算"输入页面，就是对的。

## Bug 30
"基本计算"输入页面和"方案比较"输入页面，都没有更新版本信息。

## Bug 31
"基本计算"输入页面和"方案比较"输入页面里，"文件输入"方式测试过吗？测试用的.txt文件放在哪里?
