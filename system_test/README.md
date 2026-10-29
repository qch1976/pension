# system_test — tester 的 ST/GT 测试脚本

## 临时文件约束（BUG-02-0013，2026-10-29 项目主批准）

> 本仓库**不得**出现临时文件/临时目录。target 规则（新版 INPUT-COMMON.md + project-documentation SKILL）：

1. **临时件一律写外部 temp**：`C:\Users\Administrator\Desktop\Wechat projects\temp`（或环境变量 `PENSION_EXT_TEMP` 指定），永不入库、可随时删。
   - 典型临时件：一次性 probe、format-patch 产物、诊断 json/png、排查用 .ps1/.bat 脚本、ZIP。
2. **禁止**在项目根或项目内任何位置创建 `temp/`、`autotest/`、`tmp/`、`*.patch`、`temp-inspect*.ps1` 等临时文件。
3. **official log 才进项目**：仅写各自的 testcase 目录 `system_test/TST-02-<TYPE>-<NNNN>/logs/`（或 `customer_testcases/logs/`、`utils/logs/`），随 testcase 一起入库。
4. **harness 必须遵守**：脚本输出根统一取 `const EXT_TEMP = process.env.PENSION_EXT_TEMP || <外部 temp>; const EXT_OUT = path.join(EXT_TEMP, "pension-run-output")`，严禁把运行产物写进 repo（2026-10-29 已整改 7 个历史 harness）。

违规示例（已清理，勿再犯）：项目根 `temp/`、根 `autotest/output/`、根 `temp-inspect.ps1`。

> 依 project-documentation SKILL 目录树（folder 名受限、文件名自由）。
> 来源：B-3 迁移自原 `autotest/`（GUI 驱动、冒烟、compile-gate、probe、regression-rc）。
> 命名说明：本批历史脚本多形成于 GT-4xxx 编号定稿**之前**，文件名不带标准 TST-ID；统一收拢于 `TST-02-GT-4000/`（"GT-4000 段"占位，表示 Phase-2 GUI 自动化集合）。后续按 GUI redo 逐步把单脚本归位到精确 testcase folder（TST-02-GT-4xxx）。详见 matrix（docs/requirement_coverage/，B-4）与 B-3 迁移报告。

## 目录

- `common/` 公共件与门禁：`run-unit-tests.bat`（node UT 套件入口，清单指向 developer_test/）、`compile-gate/`（编译门禁 + bug1921 preview 编排）。
- `utils/` 与具体 testcase 无关、可独立执行的脚本：`probe.js`（含 Windows 绝对路径硬编码）。
- `customer_testcases/` tester 为 customer testcase（docs/customer_usecases/My-Case.md / MyWife-Case.md）写的脚本。
- `output/` ST/GT 运行证据（截图 / summary.json / trace / log）。
- `TST-02-GT-4000/` GUI 自动化回归：
  - `gui/`（原 `autotest/gui/` 整个：automator 驱动、编排 ps1/vbs/bat、各 bug 用例 run-*/bug*-case/verify-*、diag-*、shot-*、lib-gui.js、cases.js、mycases.js、t23/t47/phase1/e7 回归等）。
  - `smoke.js` ~ `smoke8.js`（原 `autotest/smoke*.js` 冒烟系列）。
  - `regression-rc.js`（原 `autotest/regression-rc.js` GUI 真实回归）。

## 备注（功能性，随 GUI redo 处理）

- 夹具引用已由 `tests/fixtures-case/`（B-2 已删副本）改为 `./docs/` 根：`gui/e7-fileio-regression.js`（`t47-c-planstart.js` 于 C-7 归位 `TST-02-GT-4019/`）。
- 早期脚本多以 `autotest/output/`（现 `system_test/output/`）落证据；运行前确保 `system_test/output/` 存在。
- `probe.js` / 编排脚本内含 `C:\Users\Administrator\...` 开发服务器绝对路径，属历史现场脚本，非可移植用例。
