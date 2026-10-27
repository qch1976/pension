# TST-02-GT-4032 · BUG-02-0008 修复独立 GUI 验收（task-78）

- **缺陷**：BUG-02-0008 — 文件导入后未触碰默认方案卡 retireYM 残留演示出生年陈旧值 2026-01，不随真实 ctx 刷新。
- **基线**：origin/master = 6e8ea72（planModel.syncUnspecifiedRetire + plan-list observer 去掉 !retireYM）。
- **单一入口**：`gt-4032-task78.js`（一 testcase 一入口；公共逻辑 `../common/gui-conn-lib.js`，common 零本 case 值）。
- **运行**：`node gt-4032-task78.js 40215 external 6e8ea72`（常驻 automator 口 40215，只 connect/disconnect，零 RDP）。
- **结果**：**PASS 33/33**（A 主链路 / B MyWife / C 脏 draft 自愈 / D 手选保护 / E 零回归）；UT-1037 独立复跑 28/28。
- **产物**：`logs/result-GT4032-task78.json`、`logs/run-trace.log`、截图 `logs/GT4032-A-mycase.png` / `GT4032-B-mywife.png` / `GT4032-E-result.png`。
- **报告**：`docs/test_reports/test-report-task78-bug08-verify.md`；矩阵新增行见 `docs/requirement_coverage/phase2-final-coverage-matrix.md`。
