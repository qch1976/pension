# TST-02-GT-4000 — Phase-2 GUI 自动化集合（占位 folder）

> folder 名 = 标准 testcase ID（requirement-coverage-matrix）。`GT-4000` 为**集合占位**：本批脚本形成于 GT-4xxx 编号定稿之前，文件名不带标准 TST-ID，统一先收拢于此；后续 GUI redo 时按 matrix 把单脚本归位到精确 folder（如 TST-02-GT-4019/4026/4029/4031…）。

## 内容

- `gui/` 原 `autotest/gui/` 整个（微信开发者工具 automator 驱动）：
  - 编排/拉起：`phase1-orchestrate.ps1`、`t23-orchestrate.ps1`、`run-phase1-*.bat`、`start-cli.js`、`enable-cli.js`、`register-gui-task.ps1`、`gui-hidden.vbs` 等。
  - 用例/驱动：`lib-gui.js`、`cases.js`、`mycases.js`、`run-mycases.js`、`bug*-case.js` / `run-bug*.js`（bug14-16/17-18/19-21/22-24/25-26）、`verify-*.js`、`run-verify-*.js`、`t23-gui-regression.js`、`e7-fileio-regression.js`、`phase1-gui-regression.js`。
  - 已归位：`t47-c-planstart.js` 于 C-7 归位至 `system_test/TST-02-GT-4019/t47-c-planstart.js`（依独立入口铁律作 GT-4019 独立入口；GT-4020/4021 独立入口另立 C-8 补写，matrix 留空）。
  - 截图/证据：`shot-*.js`、`run-shot*.js`、`*-shot.js`、`diag-*.js`（诊断）、`README-D9-gui.md`。
- `smoke.js` ~ `smoke8.js` 冒烟系列（原 `autotest/smoke*.js`）。
- `regression-rc.js` GUI 真实回归（原 `autotest/regression-rc.js`）。

## logs/
本 folder 运行日志落 `logs/`（.gitkeep 占位）。

## 已知引用（B-3 已更新）
- 夹具：`tests/fixtures-case/` → `./docs/`（`gui/e7-fileio-regression.js`；`t47-c-planstart.js` 已迁 TST-02-GT-4019/）。
- 编排/ps1/vbs 内 `autotest\gui` → `system_test\TST-02-GT-4000\gui`；`autotest\output` → `system_test\output`。
