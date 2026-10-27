# BUG-02-0009 修复独立 GUI 验收报告（task-75 / GT-4021）

- 项目：北京企业养老金测算微信小程序（dev box 39.106.208.34，权威仓 pension）
- 基线：HEAD=**e530e95**（developer task-74，在 aed88fc 之上；origin/master 尚未推，按 dev box 权威仓验收）
- 手册：CLI-AUTO-PLAYBOOK.md（40215 常驻口只 connect/disconnect，§0/12）
- automator：单一常驻口 **40215**（LISTENING PID=6224），全程只 connect/disconnect
- 执行人：Senior Wechat Software Tester YDL（worker4）；时间：2026-10-28 02:02~02:10
- 独立取期望：`temp/derive-t75.js`（经产品真实模块 node 侧计算，未引用 developer 回显）

---

## 一、结论（TL;DR）

- **BUG-02-0009 修复独立验收全 PASS**：GT-4021 独立 GUI 回归 **13/13**；UT-1027 独立复跑 **15/15**；developer_test 全量 **42 文件 / 537 断言零失败**。
- 起始月 = 历史末月当月（2026-08）已由「错误放行」转为**正确拦截**；合法起点下历史段与自动段月份零交集，当月双计缺陷消除。
- 全程零 RDP、无 utility exit / FORCE_CLOSE、未杀进程；产品代码仅 developer task-74 的修复，tester 未改产品码。

## 二、缺陷与修复回顾

- 缺陷：planAssembler.js / planModel.js 下界校验用严格 `<`，start==历史末月（2026-08）时漏拦截，自动段首月与历史末段同月闭区间重叠双计，R续/J账/P月偏大。
- 修复（e530e95）：两处下界 `<`→`<=`（等价 start 须 ≥ 历史末月+1），注释更正，UT-1027 补等值边界。

## 三、GT-4021 独立 GUI 回归实测（真实文件导入，只读回读）

- 夹具 docs/customer_usecases/My-Case.md 经真实文件链路导入；导入后 ctx 实测 `{gender:male, femaleType:worker, birthYM:1973-07, historyEndYM:2026-08}`。
- 产品运行时 `#sharedData.buildValidatedInput()` 只读导出真实 sharedInput（**27 历史段**，futureMonthlyRate=0.015，retireYM=null），非引擎另算。
- 法定退休 2035-09；弹性退休 2033-08 经 legalRange 核对合法（区间 2033-07~2038-09，无退休红错）。

| 起始月 | 退休月 | 期望 | 实测（无起始月红错=合法） | isValidPlan | 红错 |
|---|---|---|---|---|---|
| 2026-08（=历史末月，等值） | 2035-09 | 拦 | **拦** | false | 缴费起始时间 2026-08 不得早于最后缴费月 2026-08 的次月 |
| 2026-07（严格早于） | 2035-09 | 拦 | **拦** | false | …2026-07 不得早于最后缴费月 2026-08 的次月 |
| 2033-08（晚于退休前月2033-07） | 2033-08 | 拦 | **拦** | false | …2033-08 不得晚于退休前一月（退休 2033-08） |
| 2026-09（历史末月+1） | 2035-09 | 合法 | **合法** | true | — |
| 2033-07（退休前月） | 2033-08 | 合法 | **合法** | true | — |
| 留空（动态缺省 2026-09） | 2035-09 | 合法 | **合法** | true | — |

## 四、assemblePlanInput 自动段首月 / 零交集（真实 sharedInput）

- 合法起点（windowStartYM=2026-09，retire=2033-08）：assemble 共 **28 段**（27 历史 + 1 自动），**自动段首月=2026-09=历史末月+1**。
- 逐月建表：历史段与自动段**月份零交集**（overlapMonths=[]）。
- 对照：windowStartYM=2026-08（当月）assemble **抛错**「…不得早于最后缴费月…的次月」，修复前会放行重叠双计。

## 五、UT-1027 独立复跑与相关原 UT 无回归

- UT-1027 独立 node 复跑：**pass=15 fail=0**（原下界/上界/留空/缺省 4 项 + BUG-02-0009 等值边界 11 项，含 isValidPlan 端到端、assemble 首月/零交集、当月起点抛错）。
- 相关原 UT（1025/1026/1028/1029/1030/1031）13 套件全绿。
- developer_test 全量兜底：**42 测试文件、537 断言、0 失败**（temp/ut-all-t75.json）。

## 六、矩阵回填

- `docs/requirement_coverage/phase2-final-coverage-matrix.md` 仅 GT-4021 一行：result 由 FAIL 改 **PASS 13/13**，script 列改独立入口 `system_test/TST-02-GT-4021/gt-4021-task75.js`，**bug 列保留 BUG-02-0009**（记录修复与复测）；其余所有行逐字节不变。本验收聚焦 0009，按任务书不跑全量 gate。

## 七、产物

- 独立入口：`system_test/TST-02-GT-4021/gt-4021-task75.js`；logs：`logs/result-GT4021-task75.json`、`logs/GT4021-task75.png`、`logs/run-trace.log`。
- 独立期望/全量 UT 证据：`temp/derive-t75.js`、`temp/ut-all-t75.json`（调试件留 temp）。

## 八、上线风险建议

- 下界 off-by-one 已闭环，历史/自动段零重叠；起始月缺省（历史末月+1）链路与利率/继续停保/parity 相关 UT 全绿，未见回归。建议 Manager 将 **BUG-02-0009 置 verified**，随当前分支一并发布。滚轮越界的人工目视仍归 MT-9002，不属本自动化验收范围。
