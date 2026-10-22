# TST-02-GT-4020

> testcase folder（依 project-documentation SKILL：每 testcase 独立 folder + logs/）。
> 对应 Requirement：REQ-02-CAL-000

## 验证逻辑
夹具 docs/customer_usecases/MyWife-Case.md；脚本 t47-c-planstart.js(wife)。真实文件导入后只读断言缺省起始月=paidTo 2025-12+1=2026-01（非写死2026-09）、windowStartYM 空、无起始月红错，11/11 检查通过。观察项 OBS-T47-01：该夹具缺性别行致退休月按男性默认触发退休红错，与起始月无关、不开 BUG。不含原生月滚轮点选（手测归 MT-9001）

## 脚本状态
**独立入口待补写**：本 testcase 尚无独立入口脚本（依 2026-10-22 独立入口铁律，一脚本多 testcase 为禁止模式）。此前 matrix 曾指 `system_test/TST-02-GT-4019/t47-c-planstart.js`（GT-4019 独立入口），C-7 已改留空；本 testcase 的独立入口脚本（含 case-specific input/expect）另立 C-8 任务补写后归位。matrix script 列现留空。
## logs/
本 testcase 运行证据/日志落 `logs/`（.gitkeep 占位）。
