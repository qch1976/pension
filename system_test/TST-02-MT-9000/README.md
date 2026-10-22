# TST-02-MT-9000

> testcase folder（依 project-documentation SKILL：每 testcase 独立 folder + logs/）。
> 对应 Requirement：REQ-02-CAL-000

## 验证逻辑
My-Case 导入后在 plan-card 用原生月滚轮（picker mode=date fields=month）把「缴费起始时间」由缺省2026-09手改为2026-10，回写后自动段首月随之改变、结果页无红字/无阻断（automator 不可达的真实滚轮点选；对 BUG-02-0004，对应 UT-1026 的手工确认）

## 脚本状态
手工测试，无自动化脚本（matrix script 列=（manual，无脚本））。

## logs/
本 testcase 运行证据/日志落 `logs/`（.gitkeep 占位）。
