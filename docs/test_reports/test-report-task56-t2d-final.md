# T2-D 独立 GUI 验收报告 + T2 总账终报（task-56 / BUG-02-0007）

- 项目：北京企业养老金测算微信小程序（dev box 39.106.208.34，权威仓 pension）
- 基线：HEAD=**83a1129**（Step0 fetch 对齐；旧任务书 b64f5d6 作废，绝对数线索 4936.16/6651.57 未引用）
- 手册：CLI-AUTO-PLAYBOOK.md（226 行，MD5=a77c64e99aa0481f40717e59de0044ef，§0/1/5/7/12）
- automator：单一常驻口 **40215**（LISTENING OwningPID=6224，T2-C keeper 保留复用），全程只 `connect/disconnect`
- 执行人：Senior Wechat Software Tester YDL（worker4）；日期：2026-10-27/28
- 断言容差：TOL=0.001（数值）；J账拉开阈=100

---

## 一、本轮结论（TL;DR）

- **BUG-02-0007 独立 GUI 验收 PASS**：四独立 testcase GT-4023/4025/4028/4030 全 PASS（3/3、3/3、6/6、12/12）。
- **E7 零回归 PASS 6/6**（external 复用 40215，未自起端口）。
- **BUG-02-0004~0007 逐 BUG 全部 PASS**（见第三节）。
- **matrix-gate**：72 行自动化/脚本行零 ERROR；脚本字面判定 FAIL 仅因 **MT-9000~9002 三行 result 空白**——该三行系任务书明令「保持空白待项目主手测」的保留行。测试侧未为使 gate 转绿而改写保留行，gate 最终放行口径请 Manager/项目主裁决（见第六节）。
- 全程零 RDP、无 `utility process exit!`、无 FORCE_CLOSE/PROJECT_OPENED 重开、未杀 IDE/进程。

---

## 二、四独立 testcase 结构与实测

公共逻辑全部在 `system_test/common/gui-conn-lib.js`（零 case-specific input/expect/期望值）；入口仅 `require` common，不复制逻辑。本轮对 common 的扩展仅一处：新增 **`openCompareResultN`**（plans 1~3 多方案返回全部列），原 `openCompareResult` 复用之。

| testcase | 独立入口 | 输入 | 断言 | 结果 |
|---|---|---|---|---|
| GT-4023 | `system_test/TST-02-GT-4023/gt-4023.js` | My-Case；利率0%；Z=3.0 灵活就业 | compare 结果页只读 R续/J账/P月 | **PASS 3/3** |
| GT-4025 | `system_test/TST-02-GT-4025/gt-4025.js` | My-Case；利率1.5%；Z=3.0 | compare 结果页只读 R续/J账/P月 | **PASS 3/3** |
| GT-4028 | `system_test/TST-02-GT-4028/gt-4028.js` | My-Case；Z=0.6/1.0/3.0 三方案；利率0%与1.5% | J账两两拉开>100 | **PASS 6/6** |
| GT-4030 | `system_test/TST-02-GT-4030/gt-4030.js` | compile 门禁 + entry/basic/compare/compare-result | 编译无新增错误 + 四页落地非白屏 + 无 pageError | **PASS 12/12** |

各 testcase 的 result JSON + 截图均归各自 `TST-02-GT-40xx/logs/`（如 `TST-02-GT-4023/logs/result-GT4023.json`、`GT4023-compare-result.png`）。

### GT-4023 / GT-4025 实测（compare 结果页只读，期望由产品引擎独立自取）

| 用例 | R续 | J账 | P月 | 与期望 |
|---|---|---|---|---|
| GT-4023（0% × Z3.0） | 596107.20 | 6556.57 | 15292.32 | 一致（Δ=0） |
| GT-4025（1.5% × Z3.0） | 596107.20 | 7168.58 | 15904.33 | 一致（Δ=0） |

- R续=596107.20 与个人账户利率无关（R续 只统计个人负责缴纳额）；两档 J账差 612.01、P月差 612.01 恰为未来段利息口径，符合月复利（年/12）机制。

### GT-4028 三方案 J账拉开（两两 >100）

| 利率档 | Z0.6 J账 | Z1.0 J账 | Z3.0 J账 | 1.0−0.6 | 3.0−1.0 | 3.0−0.6 |
|---|---|---|---|---|---|---|
| 0% | 5184.23 | 5412.96 | 6556.57 | **228.73** | **1143.61** | **1372.34** |
| 1.5% | 5724.39 | 5965.09 | 7168.58 | **240.70** | **1203.49** | **1444.19** |

- 六组拉开差均 >100 且与独立自取期望一致（GAP_TOL=0.01）：compare J账随 Z 单调显著拉开，证明不再走「futureMonthlyRate 写死 null / 静态分支」。

### GT-4030 编译门禁 + 四页渲染

- **编译门禁**（`common/compile-gate/compile-exit.js`，cli preview）：exitCode=0、真实 preview 标记=true、AppID=wx9c012db494b84dae、errorLines=[]（无新增错误）。
- **四页可打开 + 非白屏渲染**（view/button/text 节点计数），全程 pageError=0：

| 页面 | 落地 | view 等节点数 | data 键数 |
|---|---|---|---|
| entry 数据通道选择页 | ✅ | 16 | 1 |
| index basic 录入页 | ✅ | 425 | 40 |
| compare 方案比较页 | ✅ | 9 | 7 |
| compare-result 结果页 | ✅ | 141 | 11 |

> 测试侧返工记录（非产品缺陷）：GT-4030 入口初版两处脚本问题——① 误用 `safeAttempt` 返回字段（`v` 误写 `result`）、② `makeRecorder.ck` 5 参只传 4 参；③ 非白屏初用 automator 不支持的 `<page>` 标签选择器（恒 0 节点），改为 `$$('view'/'button'/'text')` 后四页全部真实落地。产品代码无改动、无缺陷。

---

## 三、T2 总账：逐 BUG（0004~0007）与 GT-4019~4030 十二行

### 3.1 逐 BUG 判定

| BUG | 主题 | 关键覆盖 | 判定 |
|---|---|---|---|
| BUG-02-0004 | 缴费起始时间动态化/可编辑 + 越界校验 | GT-4019、GT-4020（缺省）、GT-4021（边界，另见 BUG-0009） | **PASS**（起始月缺省/手动/上下界主链路；下界等值 off-by-one 归 BUG-0009 另排期） |
| BUG-02-0005 | compare 共享利率透传、继续/停保接通 | GT-4022/4023/4024/4025、GT-4026、GT-4029 | **PASS** |
| BUG-02-0006 | basic/compare 同输入两路径一致（±0.001） | GT-4022/4024、GT-4027、GT-4023/4025 | **PASS** |
| BUG-02-0007 | Z3.0 parity + J账随 Z 拉开 | GT-4023、GT-4025、GT-4028 | **PASS** |

### 3.2 GT-4019~4030 十二行：本轮新写 vs 复用

| testcase | 本轮 | 独立入口（script 列） | 结果 |
|---|---|---|---|
| GT-4019 | 复用 | system_test/TST-02-GT-4019/gt4019-planstart.js | PASS |
| GT-4020 | 复用 | system_test/TST-02-GT-4020/gt4020-planstart-wife.js | PASS |
| GT-4021 | 复用 | system_test/TST-02-GT-4021/gt4021-planstart-boundary.js | FAIL（=BUG-0009，本轮不修） |
| GT-4022 | 复用 | system_test/TST-02-GT-4022/gt-4022.js | PASS 3/3 |
| **GT-4023** | **本轮新写** | system_test/TST-02-GT-4023/gt-4023.js | PASS 3/3 |
| GT-4024 | 复用 | system_test/TST-02-GT-4024/gt-4024.js | PASS 3/3 |
| **GT-4025** | **本轮新写** | system_test/TST-02-GT-4025/gt-4025.js | PASS 3/3 |
| GT-4026 | 复用 | （脚本侧历史行，script 待归位，gate warning 非阻断） | PASS |
| GT-4027 | 复用 | system_test/TST-02-GT-4027/gt-4027.js | PASS 4/4 |
| **GT-4028** | **本轮新写** | system_test/TST-02-GT-4028/gt-4028.js | PASS 6/6 |
| GT-4029 | 复用 | （脚本侧历史行，script 待归位，gate warning 非阻断） | PASS |
| **GT-4030** | **本轮新写（替代旧 gt4030-compile-render.js）** | system_test/TST-02-GT-4030/gt-4030.js | PASS 12/12 |

### 3.3 basic / compare 独立数值表与 Δ（GT-4027 parity，tester 独立采样）

| 利率 | basic（R储·累计储存额） | compare（R续·继续缴费） | J账 basic | J账 compare | ΔJ账 | P月 basic | P月 compare | ΔP月 |
|---|---|---|---|---|---|---|---|---|
| 0% | 720608.58 | 119221.44（Z0.6 臂） | 5184.23 | 5184.23 | **0** | 12750.50 | 12750.50 | **0** |
| 1.5% | 795690.76 | 119221.44（Z0.6 臂） | 5724.39 | 5724.39 | **0** | 13290.66 | 13290.66 | **0** |

- 两路径 J账/P月 |Δ|≤0.001（实测 0）。R 字段口径不同（basic 累计储存额 vs compare 继续缴费，非同一量，不直接比；R续×40%(8%/20%)≈入账本金勾稽成立）。
- J账拉开差汇总：Z0.6→Z3.0，0% 档 +1372.34、1.5% 档 +1444.19（见 2.3）。

---

## 四、E7 文件导入/导出零回归（regression=yes，不新增 GT 行）

- 脚本：`system_test/TST-02-GT-4000/gui/e7-fileio-regression.js`，按批准改为 **external**：加 `external` 标志时不自起 cli auto，直连常驻 40215（每操作全新 connect/disconnect），入参解析修正（数字=port/index，external 为标志），夹具路径对齐 `docs/customer_usecases/`。
- 六场景真实跑 `readFile→parseCaseFile→caseValidator→部分回填→onCalculate→reportExport→fileStore.writeOutput` 全链（仅 mock chooseMessageFile/shareFileMessage 原生面板，用毕 restore）：

| 场景 | 夹具 | 结果 |
|---|---|---|
| my1 / my2 / my3 | My-Case.md（block1/2/3） | PASS |
| wife4 / wife5 / wife6 | MyWife-Case.md（block4/5/6） | PASS |

- 权威 summary（startedAt 2026-10-27T16:42:28Z）：totals `{all:6, pass:6, fail:0}`。文件持久化（inputs/outputs 固定路径）、导入导出（新增 basic-*.txt、PensionReport-v2.0 头/生成时点/两位小数金额）、分享降级（mock ok/取消/缺失安静处理、报告仍落盘）均无回归。

---

## 五、编译门禁结果

见 2.3/GT-4030：cli preview exit=0、真实 preview 二维码标记、无 error 行。源码包 ≤2MB 的 packOptions.ignore 历史措施保持有效。

---

## 六、matrix-gate 输出与放行口径（需 Manager/项目主确认）

`node matrix-gate.js check docs/requirement_coverage/phase2-final-coverage-matrix.md`（dev box 真实仓库内运行，2026-10-27T16:45Z）：

- final rows=75，unique TST=75；architect initial matrix 缺失（closed phase-1，覆盖完整性自动 skip，仅完整性校验）。
- **ERRORS（3，非自动化缺陷）**：`TST-02-MT-9000/9001/9002: result missing`——该三 MT 行 result/bug 按任务书第 4 条**保持空白（待项目主手测）**。脚本不区分「故意留空的手测行」与「漏填」，故字面判 FAIL。
- **WARNINGS（12，全部非阻断）**：GT-4010~4015、GT-4026/4029/4031 为历史行 script 列尚未归位（backfill 期间按 warning 处理）；UT-1015/1016 为历史「一脚本多用例/目录」模式，warning 非 error。
- 测试侧判定：**72 行自动化/脚本行零 ERROR、零产品 FAIL（GT-4021 的已知 FAIL 已正确关联 BUG-0009）**；gate 的 3 个 ERROR 全部来自项目主保留待手测的 MT 行，不应由测试侧填造结果消解。建议 gate 放行口径＝「自动化行全绿 + MT 保留行以项目主手测结果回填后自然转 PASS」，请 Manager 裁决；如项目主已完成 MT 手测，回填三行 result 后 gate 即字面 PASS。

---

## 七、BUG-02-0008（本轮不修，另排期）

tester 独立取证、项目主 2026-10-13 特批登记：entry 不填信息、直接文件导入完整案例时，两张默认方案卡的「退休年月」停留在演示默认出生年（1965-10→2026-01）推导的陈旧值，不随导入后真实出生年（My-Case 1973-07，法定 2035-09）刷新，且 persist 到 draft，导入即非法、阻断比较。根因＝「attached 用演示 ctx 预填退休月」与「observer 仅在退休月为空才补默认」冲突。**本轮按任务书不修复**，待 BUG-02-0004~0007 收口后单独排期（修复方向与回归点见 `docs/bugs/Customer-Bug-List.md` BUG-02-0008）。另 BUG-02-0009（缴费起始月下界等值 off-by-one，GT-4021 已 FAIL）同样本轮不修、单独排期。

---

## 八、环境与可复刻性

- 连接：全程 SSH/CLI/automator，零 RDP/freerdp/Xvfb；无脚本诱发的 FORCE_CLOSE/PROJECT_OPENED 重开（计数 0），无 connect 后 1s 内 `utility process exit!`。
- 投递：经 /IT 计划任务 PensionGuiRun（ASCII `job.txt`，目标为 .js），串行 runner `temp/run-t2d.js`（验证用，不入 git）。
- 产物：正式 result JSON/截图归各 `TST-02-GT-40xx/logs/`；本报告归 `docs/test_reports/`；调试件留 `temp/`。
- 40215 常驻口任务结束后保留（停止 keeper 须 Manager 同意）。
