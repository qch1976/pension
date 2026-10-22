# TST-02-GT-4021

> testcase folder（依 project-documentation SKILL：每 testcase 独立 folder + logs/）。
> 对应 Requirement：REQ-02-CAL-000, REQ-02-VAL-004

## 验证逻辑
夹具 My-Case.md；t47-c-planstart.js 只读回读 isValidPlan/errors（历史末月2026-08/退休2033-08→退休前月2033-07，基线 aefeb43，TS=20261014-123208）：2026-09 合法、2033-07 合法、2033-08 拒、留空合法均符合；唯 2026-08(=历史末月) 实测 isValidPlan=true 无起始月红错被错误放行，assemblePlanInput 自动段首月=2026-08 与历史末段同月闭区间重叠双计，下界 off-by-one（planAssembler.js:48/planModel.js:125 用 < 应 <=，start 须≥historyLast+1）。红点像素目视与滚轮越界点选归 MT-9002；引擎期望见 t47-parity，仅作期望值来源、不冒充本GT实测

## 脚本状态
**独立入口待补写**：本 testcase 尚无独立入口脚本（依 2026-10-22 独立入口铁律，一脚本多 testcase 为禁止模式）。此前 matrix 曾指 `system_test/TST-02-GT-4019/t47-c-planstart.js`（GT-4019 独立入口），C-7 已改留空；本 testcase 的独立入口脚本（含 case-specific input/expect）另立 C-8 任务补写后归位。matrix script 列现留空。
## logs/
本 testcase 运行证据/日志落 `logs/`（.gitkeep 占位）。
