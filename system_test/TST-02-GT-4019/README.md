# TST-02-GT-4019

> testcase folder（依 project-documentation SKILL：每 testcase 独立 folder + logs/）。
> 对应 Requirement：REQ-02-CAL-000

## 验证逻辑
夹具 docs/customer_usecases/My-Case.md；脚本 t47-c-planstart.js(my，常驻 automator 口只 connect/disconnect)。entry 不填信息→compare 真实文件导入→plan-card 只读断言：缺省「缴费起始时间」startText=2026-09(historyEnd 2026-08+1)、windowStartYM 空、无起始月红错，自动段首月数据层=2026-09，11/11 检查通过。不含原生月滚轮点选（手测归 MT-9000）

## 脚本状态
脚本已归位：`system_test/TST-02-GT-4019/t47-c-planstart.js`。

## logs/
本 testcase 运行证据/日志落 `logs/`（.gitkeep 占位）。
