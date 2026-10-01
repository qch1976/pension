# D9 — 编译门禁 + Phase-1 GUI Automator 回归（可复刻）

本目录交付 D9 的两部分：
1. **编译门禁**（`..\compile-gate\compile-gate.bat`，已纳入 Git，编译不过即非零退出）；
2. **miniprogram-automator GUI 回归脚本**：覆盖 Phase-1（D2~D8）主流程，逐关键状态产出真实模拟器截图。

关联需求：`REQ-01-NFR-003` 及 Phase-1 全部 REQ（SHR/PLN/CAL/RES）。

---

## 1. 一键复刻（人在 RDP，最稳）

前置（只需一次，与 `CLI-AUTO-PLAYBOOK.md` 一致）：
- Windows 机 `39.106.208.34`，用 mstsc 连入并**保持窗口真实显示**（勿最小化）；
- 微信开发者工具已打开本项目 `C:\Users\Administrator\Desktop\Wechat projects\pension`，模拟器已编译出首页；
- 「设置 → 安全设置 → 服务端口」已开启（IDE 服务端口 `60964`）；
- 公共 SDK 全机一份：`C:\Users\Administrator\wechat-automation\node_modules\miniprogram-automator@0.12.1`（勿重装）。

**双击运行**（RDP 会话内）：
```
autotest\gui\run-phase1-orchestrate.bat
```
它调用 `phase1-orchestrate.ps1`：为 **9 个场景各起一轮独立 `cli auto` + 独立端口 + 独立 Node 进程**，串行跑完并汇总。

无人在场/脚本化投递（/IT 计划任务投进交互 session）：
```
schtasks /Run /TN PensionPhase1Orchestrate     # 只投递一次
# 等待 autotest\output\phase1-gui\orchestrate.log 出现 "END " 即完成
```

> ⚠️ **不要**用 `run-all.bat`（`ALL` 单连接模式）——单 boot/单连接串接全部场景会在 cli auto 启动与就绪上退化，是历史失败主因。每个场景必须 fresh 进程、fresh 端口。

## 2. 端口规划（每场景独立、不复用、禁用 9561）

| 场景 i | auto 端口 | 内容 |
|---|---|---|
| 0 | 61001 | 共享段越界（2030-12 > 2026-08）toast |
| 1 | 61002 | 不足 2 个方案 toast |
| 2 | 61003 | compare 录入态就绪 |
| 3 | 61004 | 进结果页 + 比较表行列 + 角标 |
| 4 | 61005 | P 月三分项展开（基础/账户/过渡） |
| 5 | 61006 | P月·ROI 纯 CSS 条形归一化 + 6% 利率改算 |
| 6 | 61007 | 下钻三段现金流（并存/冲抵/月多领 + 逐月） |
| 7 | 61008 | 政策弹窗（183 号令 + 渐进延迟办法） |
| 8 | 61009 | 不足年限方案整列灰显 + ROI 红字不可用 |

单跑某一场景：`node phase1-gui-regression.js <i>`（已含 NODE_PATH 启动器）。
冷启动 attach 竞争（`getPageMetaByWebviewId null`）由脚本内部以「全新 cli auto + 新端口（61001/61101/61201）」自动重试，最多 3 次。

## 3. 真实截图清单（automator 原生 `mp.screenshot`）

产物目录：`autotest\output\phase1-gui\`（本轮实测，均真实渲染、非白屏/二维码/占位）：

| 文件 | 大小(B) | 对应步骤 |
|---|---|---|
| A1-shared-cutoff-toast.png | 77061 | 共享历史数据截止 2026-08 越界 toast |
| B1-too-few-plans-toast.png | 75255 | 请至少填全 2 个不同方案 toast |
| C0-compare-input.png | 72731 | compare 录入态 |
| C1-result-table.png | 63987 | 结果页比较表 + 【预估】/【基准】角标 |
| C2-components-expanded.png | 65479 | P 月三分项展开 3 行 |
| C3-css-bars.png | 64007 | P月/ROI 纯 CSS 条 + 6% 利率 |
| C5-drill-cashflow.png | 47818 | 下钻三段现金流汇总 + 逐月 |
| C6-policy-sheet.png | 112381 | 政策弹窗 ≥4 条 |
| D1-grey-blocked-roi.png | 48887 | 不足年限整列灰显 + ROI 红字「不可用」 |

> 截图失败最多重试 3 次（1.5s/3s 退避）；截图失败只告警，不吞业务断言。

## 4. 本轮结果（2026-10-01）

- **GUI 回归**：9/9 场景 `RESULTS 0,0,0,0,0,0,0,0,0`，全部 PASS；9 张真实截图。
- **编译门禁**：`GATE_EXIT=0`；日志含 `√ IDE server`、`√ Using AppID wx9c012db494b84dae`、`√ preview` 与真实预览二维码，包体 142.9 KB（146340 B）。
- **Phase-0 零回归**：权威套件 `tests\run-tests.js` = **P0 60/3、P1 55/0、P2 16/1 ⇒ 合计 131 通过 / 4 失败**，与基线一致；4 个失败均为历史既有：`TC-C-114`、`TC-C-207`、`TC-C-214`、`TC-X-007b`，非本次引入。全部 9 个测试套件 `EXITCODE=0`。

## 5. 文件说明

- `phase1-gui-regression.js`：夹具 + 就绪门禁 + 9 个场景断言/截图；
- `phase1-orchestrate.ps1`：每场景 fresh 进程串行编排 + 汇总 + `shots.json` 清单；
- `run-phase1-orchestrate.bat`：RDP 内一键入口；
- `phase1-runone.ps1`：单场景交互任务运行器（调试用）；
- 存储键：共享草稿 `pension_compare_input_v1`、方案草稿 `pension_plans_v1`、结果载荷 `pension_compare_payload_v1`。
