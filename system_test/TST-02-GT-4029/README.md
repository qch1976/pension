# TST-02-GT-4029

> testcase folder（依 project-documentation SKILL：每 testcase 独立 folder + logs/）。
> 对应 Requirement：REQ-02-CAL-001, REQ-02-NFR-004

## 验证逻辑
基线 0bc2775；脚本 gt4029-regression.js（常驻口40215，5列新夹具 My-Case.md 真实文件导入+真实开始比较）。12/12 PASS（TS=20261014-180229）：S0 built+rate0.015、S0b 27历史段身份全 enterprise（BUG-02-0010 回归佐证）、S1 continue rate0.015 透传、S2 自动段首月=resolvedStart、S3 自动段末月=退休前一月、S4 账户滚动计息 R储>余额/yearly>0、S5 stop rate=null、S6 stop 仅历史段 maxEnd<resolvedStart、S7 stop R储=余额/yearly=0 零计息、S8 两情形 eligible；S9 结果页 ready=true/2列/loadError空 不再白屏、S10 结果页 P月 13290.66(z0.6)/13726.27(z1.0) 与 tester 本地独立重算一致。证据 json/gt4029reg-20261014-180229.summary.json、screenshots/*.png（修复前 ffcd5d5 曾因历史段无身份白屏 FAIL，关联 BUG-02-0010，已修复复测 PASS）；脚本未入库（GUI redo dev box 侧产物），待归位

## 脚本状态
**脚本未入库**：本 testcase 的 GUI redo 单脚本在 dev box (39.106.208.34) 与权威工作区均不存在（C-7 实测，仅证据 json 留存于 autotest/output/）。matrix script 列留空。待补写并跑通后归位。

## logs/
本 testcase 运行证据/日志落 `logs/`（.gitkeep 占位）。
