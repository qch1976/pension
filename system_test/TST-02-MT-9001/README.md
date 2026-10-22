# TST-02-MT-9001

> testcase folder（依 project-documentation SKILL：每 testcase 独立 folder + logs/）。
> 对应 Requirement：REQ-02-CAL-000

## 验证逻辑
wife5 文件导入后「缴费起始时间」缺省=实际缴费末月+1=2026-01（paidTo 2025-12+1），与 My-Case 同一缺省链路，非写死2026-09（对 BUG-02-0004 缺省侧，对应 UT-1025 的手工确认）

## 脚本状态
手工测试，无自动化脚本（matrix script 列=（manual，无脚本））。

## logs/
本 testcase 运行证据/日志落 `logs/`（.gitkeep 占位）。
