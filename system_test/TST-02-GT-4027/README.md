# TST-02-GT-4027

> testcase folder（依 project-documentation SKILL：每 testcase 独立 folder + logs/）。
> 对应 Requirement：REQ-02-NFR-001, REQ-02-SCOPE-003

## 验证逻辑
【未执行-待GUI redo回填】脚本未入库（GUI redo dev box 侧产物），待归位；夹具 My-Case.md；同输入分别走 basic 与 compare 结果页，只读数值断言两路径 R储/J账/P月 差≤0.001（结果页截图比对待 redo）；t47-parity 四宫格差=0.0000 仅作期望来源

## 脚本状态
**脚本未入库**：本 testcase 的 GUI redo 单脚本在 dev box (39.106.208.34) 与权威工作区均不存在（C-7 实测，仅证据 json 留存于 autotest/output/）。matrix script 列留空。待补写并跑通后归位。

## logs/
本 testcase 运行证据/日志落 `logs/`（.gitkeep 占位）。
