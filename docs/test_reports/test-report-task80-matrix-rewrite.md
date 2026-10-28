# 测试报告 · task-80 · phase2 覆盖矩阵全量重写 + 硬门禁

| 项 | 内容 |
|---|---|
| 任务 | p-mu45ws9mfajyky-task-80（tester worker4） |
| 基线 | dev box HEAD ＝ task-79 本地链顶 d69ebd5（origin/master 当时仍 2a61e71；task-79 待 Manager 推送） |
| 对象 | docs/requirement_coverage/phase2-final-coverage-matrix.md（76 个 testcase 行） |
| 门禁 | matrix-gate.js check（requirement-coverage-matrix skill，2026-10-28 11:45 升级版） |
| 结论 | **通过验收标准**：除 MT-9000/9001/9002 三个项目主有意留空的 result missing 外，零 error；UT-1015/1016 历史文件夹 mismatch 保留为 warning（可接受）。 |

## 1. 整改范围（76 行逐行，三类）

1. **testcase brief**：全部改为 ≤40 字、只写“测什么 + 关键断言点”的一句话；删除 test procedure（步骤、基线、TS、连接方式、长串实测/期望值、口号）。这些明细归 testcase design / 脚本 / 报告。
2. **script folder+name**：每个 UT/CT/ST/GT 行均填真实仓库相对独立入口路径，脚本在仓库内**实际存在**（重写脚本对每行 `fs.existsSync` 校验，零缺失）；task-79 已补齐 9 个 GT 入口，本轮 script 列与 task-79 一致、未再变更（git diff 无 script 行改动）。MT 三行保留「（manual，无脚本）」，门禁豁免。
3. **bug**：只保留 BUG ID（多个逗号分隔）或 `-`；删除全部括注/机制描述/“详见 bug table”等文字（解释归 bug 工单）。
4. 其它列（req / req brief / owner / regression / testcase ID / result）逐字节保留；result 不造数；MT-9000~9002 result 保持留空（项目主手测，门禁预期 3 个 error）。

## 2. 门禁输出（仓库内实测）

命令：`node matrix-gate.js check docs/requirement_coverage/phase2-final-coverage-matrix.md`

```
MATRIX GATE: FAIL  2026-10-28 （final rows=76  unique TST=76）
ERRORS (3):
  ✗ TST-02-MT-9000: result missing
  ✗ TST-02-MT-9001: result missing
  ✗ TST-02-MT-9002: result missing
WARNINGS (3):
  ! TST-02-UT-1015: script path folder "TST-02-CT-1015" 与 testcase ID "TST-02-UT-1015" 不符（历史一脚本多用例）
  ! TST-02-UT-1016: 同上（TST-02-CT-1016）
  ! architect initial matrix not present — coverage-completeness skipped; integrity checks only
```

- 3 个 error 全部是项目主有意保留的 MT 手测 result 空值（项目主手测后回填），符合任务验收口径。
- 2 个 warning 为历史 UT-1015/1016 编号归 CT 文件夹的已知 mismatch（任务明确“保留 warning 可接受”），非本轮新增。
- 第 3 个 warning 为该文件无 architect initial matrix 表（closed phase-1 形态），门禁自动跳过覆盖完整性、仅做完整性校验，属正常。
- 除上述外**零 error**（无空 script、无脚本不存在、无重复行、无越号段、无 bug 残留文字、result 无缺失）。

## 3. 变更与完整性

- git diff --stat：`phase2-final-coverage-matrix.md | 76 insertions / 76 deletions`（每行仅 brief 与 bug 两列更新；script/result/owner/regression/ID 未动）。
- 重写工具（temp/rewrite-matrix.js）对 76 行输出 `ROWS_REWRITTEN=76 PROBLEMS=0`：brief 映射全覆盖、非 MT 行 script 全存在、bug 全部纯化。
- 门禁脚本与整改工具均不入库（skill 目录/ temp）；入库产物仅矩阵本身与本报告/门禁快照。

## 4. 说明

- task-79 的 5 个本地 commit（含 9 个 GT 独立入口）尚未推送 origin，本次矩阵重写基于本地 HEAD d69ebd5；请 Manager 与 task-79 patch 一并经 Windows 推送。
