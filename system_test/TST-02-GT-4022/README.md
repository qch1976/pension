# TST-02-GT-4022

> testcase folder（依 project-documentation SKILL：每 testcase 独立 folder + logs/）。
> 对应 Requirement：REQ-02-CAL-001, REQ-02-NFR-001

## 验证逻辑
【未执行-待GUI redo回填】脚本未入库（GUI redo dev box 侧产物），待归位；夹具 My-Case.md；结果页/方案卡只读断言 compare 共享利率0%×Z=0.6 的 R储/J账/P月，期望（t47-parity.js 独立引擎，仅期望来源非本GT实测）720608.58/5184.23/12684.67；结果页像素比对待 redo

## 脚本状态
**脚本未入库**：本 testcase 的 GUI redo 单脚本在 dev box (39.106.208.34) 与权威工作区均不存在（C-7 实测，仅证据 json 留存于 autotest/output/）。matrix script 列留空。待补写并跑通后归位。

## logs/
本 testcase 运行证据/日志落 `logs/`（.gitkeep 占位）。
