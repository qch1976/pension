# TST-02-GT-4026

> testcase folder（依 project-documentation SKILL：每 testcase 独立 folder + logs/）。
> 对应 Requirement：REQ-02-CAL-001, REQ-02-VAL-004

## 验证逻辑
基线 0bc2775；脚本 gt4026.js（常驻口40215 只 connect/disconnect，真实文件导入 My-Case.md）。7/7 PASS（TS=20261014-180358，修复后回归；首轮 ffcd5d5 TS=20261014-135914 同结论）：①common 利率自动带出共享区 futureMonthlyRatePct="1.5"→built.input.futureMonthlyRate=0.015；②手工/纯函数缺省 parseSharedRatePct('')={0.015,usedDefault}、inputPageModel 默认'1.5'；③留空回退0.015；④录"0"→rate=0 不计息可算；⑤录"25"→buildValidatedInput ok:false 红错「记账年利率超出合理范围(0~20%)：25」阻断；⑥两方案卡数据均无利率字段（Q1=B，利率只在共享区）。证据 json/gt4026-20261014-180358.summary.json；脚本未入库（GUI redo dev box 侧产物），待归位

## 脚本状态
**脚本未入库**：本 testcase 的 GUI redo 单脚本在 dev box (39.106.208.34) 与权威工作区均不存在（C-7 实测，仅证据 json 留存于 autotest/output/）。matrix script 列留空。待补写并跑通后归位。

## logs/
本 testcase 运行证据/日志落 `logs/`（.gitkeep 占位）。
