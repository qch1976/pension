# TST-02-GT-4028

> testcase folder（依 project-documentation SKILL：每 testcase 独立 folder + logs/）。
> 对应 Requirement：REQ-02-CAL-001, REQ-02-NFR-001

## 验证逻辑
【未执行-待GUI redo回填】脚本未入库（GUI redo dev box 侧产物），待归位；夹具 My-Case.md；compare 建 Z=0.6/1.0/3.0 三方案，结果页只读 J账断言三档拉开>100（parity：利率0% gap 1372.34、1.5% gap 1444.19，仅期望来源）；三卡像素目视待 redo（文件导入不自动建卡，需 redo 建卡路径）

## 脚本状态
**脚本未入库**：本 testcase 的 GUI redo 单脚本在 dev box (39.106.208.34) 与权威工作区均不存在（C-7 实测，仅证据 json 留存于 autotest/output/）。matrix script 列留空。待补写并跑通后归位。

## logs/
本 testcase 运行证据/日志落 `logs/`（.gitkeep 占位）。
