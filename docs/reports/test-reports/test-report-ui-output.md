# Pension 输出页 12a/12b/13 真机验证报告

**任务**：真机验证2-输出页(12-13) · Workflow `wf-c8e579037683` / node `wf-c8e579037683-node_test2`
**结论**：✅ **12a / 12b / 13 及两案三分项回归全部通过（全绿，53/53 条断言通过，0 fatal）**
**时间**：2026-09-22 01:55 (Asia/Shanghai)

---

## 一、环境与方法（环境就绪，非 environment-session defect）

| 项 | 值 |
|---|---|
| 宿主机 | Windows 11 `39.106.208.34` |
| 会话 | **Session 2 active**（用户 RDP / 开发者工具均活） |
| IDE 服务端口 | **60964（确认 Listen，与 `.ide` 一致）** |
| 项目根 | `C:\Users\Administrator\Desktop\Wechat projects\pension` |
| AppID | `wx9c012db494b84dae` |
| Automator SDK | `C:\Users\Administrator\wechat-automation\node_modules\miniprogram-automator` |
| 投递方式 | 计划任务 `\PensionGuiRun` → Session 2 真实模拟器（非 SSH session0） |
| 用例端口 | **每用例 fresh 一次性 cli auto，不复用**：O12A=9801 · O12B=9811 · O13=9831 · OREG(MY1)=9851 · OREG2(MY2)=9821 · OSHOT(明细帐)=9841 |
| 断言准则 | **以结果页 data / DOM 断言为准**，截图仅作真实渲染佐证（共 3 张） |

> 过程中 automation WebSocket 出现若干次 `timeout waiting for automator response`（尤其在整页截图后复用同一连接时），均为自动化通道瞬态/连接耗尽，非产品缺陷。通过把 MY1/MY2 拆到各自独立端口、精确定位截图独立用例后全部稳定通过。未对 IDE 做 taskkill。

---

## 二、逐条验收结果

### 12a) R储 政策说明明确本金起算时点 —— ✅ PASS（17/17）
- `vm.rStore.kind = future-roll`；**锚定余额 = 672920（2026-08 末既有）**，说明明确：**不拆分其中历史本金/利息、也不重复计算**。
- **本金段起算时点 = 锚定月次月 = 2026-09**；区间 **2026-09 ~ 2033-06，共 82 个月**。
- MY1：新增**本金 46984.03**（月基数×8%）+ 记账**利息 75045.30**（年利率1.5%折月复利，工程口径【预估】），
  恒等式 **672920 + 46984.03 + 75045.30 = R储 794949.33**，数字与引擎 `intermediates.R储本金/R储利息/R储` 完全一致。
- MY2 交叉核对：**本金 234920.16 + 利息 84884.69 = R储 992724.85**，与引擎一致。

### 12b) R补 底部重复本金/利息段已删除 —— ✅ PASS（7/7）
- 读取中间变量卡片 WXML：R补区**不再含重复「本金/利息」段**；旧绑定 `rPrincipalText / rInterestText` 已移除。
- **31号文本体说明完整保留**：`statusText`（J账户=(R储+R补)÷M）、`notIncludedNote`（虚拟计发额度，不计入账户实际余额/继承/冲抵）、
  分档公式 `showFormula=true`（分档/月模拟额），R补金额 = **10943.23**。

### 13) Z实指数年度明细账 n=1992~2033 —— ✅ PASS（17/17）
- 结果页 `vmAnnual` 共 **42 行（1992~2033）**，逐年列 **年份 / 缴费月 / Xn / C(n−1) / Z年 / 月均Σz / 来源**。
- **缺缴年标注正确**：1992~1999 `paidMonths=0`；1992~1995 分母缺失，来源 `missing`、C列显示 **「—」**。
- 关键年：**2000（2月）Xn=6142、Z年=0.4458**；2001 Z年=2.6280；2025 Z年=2.9779、来源 **official**。
- **工程口径注明**：2026 起 C 沿用 **11937 元/月**，来源 `assumed` 并标【待官方核实】；MY1 2026 Xn=315136.8、Z年=2.2；2027~2032 Z年=0.6；2033（6月）Z年=0.3。
- 勾稽：**Σ月z / K应缴 = Z实指数 MY1 = 2.4075**；MY2 Z实=2.9095 由批次3 node 断言（output-assert 138 条）覆盖。

### 回归：两案三分项 —— ✅ PASS
| 案 | J基础 | J账户 | J过渡 | 合计（元/月） |
|---|---|---|---|---|
| **MY1** | 7800.79 | 5797.79 | 870.23 | **14468.81** |
| **MY2** | 8950.12 | 7237.05 | 1051.71 | **17238.88** |

均 ±0.01；两案在各自独立 fresh 端口运行，结果页 `ready=true`，截图确认真实渲染（无白屏/二维码）。

---

## 三、断言汇总

| 用例 | 覆盖 | 通过/总数 | 结果 |
|---|---|---|---|
| O12A  | #12a（含MY2交叉） | 17/17 | ✅ |
| O12B  | #12b | 7/7 | ✅ |
| O13   | #13 | 17/17 | ✅ |
| OREG  | MY1 三分项回归 | 5/5 | ✅ |
| OREG2 | MY2 三分项回归 | 5/5 | ✅ |
| OSHOT | 明细帐截图定位 | 2/2 | ✅ |
| **合计** | | **53/53** | **✅ 全绿** |

## 四、产物路径

- **权威汇总（Windows 项目内）**：
  `C:\Users\Administrator\Desktop\Wechat projects\pension\autotest\output\gui\ui-output-verify.json`
- 单用例结果：同目录 `ui-output-O12A/O12B/O13/OREG/OREG2/OSHOT.json`
- **关键截图（同目录，3 张）**：
  - `ui-output-1-my1result.png`（约 213 KB）MY1 结果页，合计 **¥14468.81/月**
  - `ui-output-4-my2result.png`（约 215 KB）MY2 结果页，合计 **¥17238.88/月**
  - `ui-output-3-ledger.png`（约 193 KB）Z实指数年度明细账（列齐全、官方来源标签可见）
- **本报告**：`/root/.openclaw/.arkclaw-team/shared/wechat-automation/pension-ui-output-verify-report.md`
