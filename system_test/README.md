# system_test — tester 的 ST/GT 测试脚本

> 依 project-documentation SKILL 目录树（folder 名受限、文件名自由）。
> 来源：B-3 迁移自原 `autotest/`（GUI 驱动、冒烟、compile-gate、probe、regression-rc）。
> 命名说明：本批历史脚本多形成于 GT-4xxx 编号定稿**之前**，文件名不带标准 TST-ID；统一收拢于 `TST-02-GT-4000/`（"GT-4000 段"占位，表示 Phase-2 GUI 自动化集合）。后续按 GUI redo 逐步把单脚本归位到精确 testcase folder（TST-02-GT-4xxx）。详见 matrix（docs/requirement_coverage/，B-4）与 B-3 迁移报告。

## 目录

- `common/` 公共件与门禁：`run-unit-tests.bat`（node UT 套件入口，清单指向 developer_test/）、`compile-gate/`（编译门禁 + bug1921 preview 编排）。
- `utils/` 与具体 testcase 无关、可独立执行的脚本：`probe.js`（含 Windows 绝对路径硬编码）。
- `customer_testcases/` tester 为 customer testcase（docs/My-Case.md / MyWife-Case.md）写的脚本。
- `output/` ST/GT 运行证据（截图 / summary.json / trace / log）。
- `TST-02-GT-4000/` GUI 自动化回归：
  - `gui/`（原 `autotest/gui/` 整个：automator 驱动、编排 ps1/vbs/bat、各 bug 用例 run-*/bug*-case/verify-*、diag-*、shot-*、lib-gui.js、cases.js、mycases.js、t23/t47/phase1/e7 回归等）。
  - `smoke.js` ~ `smoke8.js`（原 `autotest/smoke*.js` 冒烟系列）。
  - `regression-rc.js`（原 `autotest/regression-rc.js` GUI 真实回归）。

## 备注（功能性，随 GUI redo 处理）

- 夹具引用已由 `tests/fixtures-case/`（B-2 已删副本）改为 `./docs/` 根：`gui/t47-c-planstart.js`、`gui/e7-fileio-regression.js`。
- 早期脚本多以 `autotest/output/`（现 `system_test/output/`）落证据；运行前确保 `system_test/output/` 存在。
- `probe.js` / 编排脚本内含 `C:\Users\Administrator\...` 开发服务器绝对路径，属历史现场脚本，非可移植用例。
