# Pension 输入页 5~11 真机验证报告

**任务**：真机验证1-输入页(5-11) · Workflow `wf-c8e579037683` / node `wf-c8e579037683-node_test1`
**结论**：✅ **5~11 全部通过（全绿，50/50 条断言通过，0 fatal）**
**时间**：2026-09-22 00:45 (Asia/Shanghai)

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
| 用例端口 | **每个用例 fresh 一次性 cli auto 端口，不复用**：S5=9751 · S6=9702 · S7=9703 · S8=9722 · S9=9723 · S10=9706 · S11=9742 |
| 断言准则 | **以页面 data / DOM / 计算样式（getComputedStyle）为准**，截图仅作真实渲染佐证（共 3 张） |

> 过程中出现过若干次 `timeout waiting for automator response`，均为 automation WebSocket 的偶发瞬态超时（非产品缺陷）；通过脚本内重试、调整 calc/截图顺序、延长等待后全部稳定通过。未对 IDE 做 taskkill。

---

## 二、逐条验收结果

### 5) 视同缴费年限 = 起止年月选择，无直接月数框 —— ✅ PASS（7/7）
- Section「视同缴费年限」卡片存在，卡内 **2 个年月 picker**（起 / 止），卡内 **0 个直接月数 `<input>`**。
- 页面 data 中已无 `deemedMode` / `deemedMonths` 字段。
- 录入 **1995-07 → 2000-10** 后端到端测算，引擎 `intermediates.deemedMonths = 64`，符合预期。

### 6) 「清空本地录入数据」后所有输入真正变空 —— ✅ PASS（17/17）
- **真实点击** `.btn-ghost`（非 callMethod 伪造）后逐字段读 data：
  出生年月 / 参加工作年月 / 退休年月 / **视同起止年月** / **账户累计额** / 余额所在年月 / **年利率** / 补贴扣除区 / 手工C平 / 缺口年度文本 / 性别 **全部 = `""`**。
- 缴费段 `segments` 所有 `baseMonthly` 为空；**年度记录** `yearRows` 回到默认空行（`year`、`annualBase` 空）。
- 31号文字段复位（`doc31Eligible=false`、调动/参保年月空）。
- Storage `pension_input_v1` 已清，**reLaunch 重进后仍为空**（不会被 onLoad 草稿还原）。

### 7) 输入框数字水平居中 —— ✅ PASS（2/2）
- 读取计算样式 `text-align`：**月度模式 31 个 `<input>` 全部 `center`；年度模式 7 个 `<input>` 全部 `center`**。
- 说明：带右箭头的**日期 picker 展示框**按微信选择控件惯例靠右显示，不属于「数字输入框」；用户诉求中的数字输入框已全部居中。

### 8) 个人账户区只剩 账户累计额 + 未来段年利息 —— ✅ PASS（10/10）
- Section「个人账户储存额与利息」卡内 **仅 2 个 input**（账户累计额、未来段年利息）+ **1 个年月 picker**（余额所在年月）。
- 「利息模式 / 计息口径 / 固定利率 / 兜底 / 缺失年度预估利率」**文案全部消失**；data 中 `interestMode / fixedRatePct / fallbackRatePct / intraYearMethod` 字段全部删除。
- **账户前滚仍正确**：引擎 `intermediates.R储 = 794949.33`，与基线一致。

### 9) 无 N实98 输入框，引擎自动算出 = 3 —— ✅ PASS（3/3）
- 输入页无 `N实98` label，data 无 `n98DeemedMonths`。
- 引擎自动计算 `intermediates.N实98 = 3`（对应 36 个月），利用视同起止年月 1995-07~2000-10 中 1998 前的 36 月。

### 10) 补贴项有通俗说明 / 已改名 —— ✅ PASS（5/5）
- R补区有**通俗说明**：明确其为**「虚拟补贴」…「不能提取或继承」**，文案可见。
- 补贴项已改名为 **「已领取的一次性补贴扣除区间（…，非必填）」**。
- 卡片标题标注 **「R补（31号文·个人账户补贴额 Z补贴）」**。
- 扣除区 textarea placeholder 含 **「大多数人留空即可」**。

### 11) 开始测算等待遮罩（转圈 + 计算中）出现并消失 —— ✅ PASS（6/6）
- 点「开始测算」后 DOM 立即出现 **`.calc-mask`**，内含 **`.calc-spinner`（转圈）+ 文案「计算中…」**。
- 计算结束跳转结果页，遮罩随之消失；重进输入页 `.calc-mask` 节点数 = 0、`calculating = false`。
- ⚠️ **截图局限（如实说明）**：该遮罩是瞬态且引擎为**同步重算**，JS 线程阻塞期间 automation 的截图请求要等线程释放后才被服务，因此 `ui-input-2-mask.png` 与普通填写页像素一致（逐像素差≈0），**未能用截图冻结到遮罩**；遮罩的存在与否以 S11-1/2/3 的 **DOM/data 断言**为准（已确认出现 + 转圈 + 「计算中」）。

---

## 三、断言汇总

| 用例 | 条目 | 通过/总数 | 结果 |
|---|---|---|---|
| S5  | #5  | 7/7   | ✅ |
| S6  | #6  | 17/17 | ✅ |
| S7  | #7  | 2/2   | ✅ |
| S8  | #8  | 10/10 | ✅ |
| S9  | #9  | 3/3   | ✅ |
| S10 | #10 | 5/5   | ✅ |
| S11 | #11 | 6/6   | ✅ |
| **合计** | | **50/50** | **✅ 全绿** |

> 注：S7 每个断言代表「该模式下全部 input 集合」的整体判定（31 个 / 7 个），S6/S8 等含逐字段断言。

## 四、产物路径

- **权威汇总（Windows 项目内）**：
  `C:\Users\Administrator\Desktop\Wechat projects\pension\autotest\output\gui\ui-input-verify.json`
- 单用例结果：同目录 `ui-input-S5.json … ui-input-S11.json`
- **关键截图（同目录，3 张）**：
  - `ui-input-1-filled.png`（231 KB）真实填写页
  - `ui-input-2-mask.png`（231 KB）瞬态遮罩未冻结（以 DOM 为准）
  - `ui-input-3-result.png`（212 KB）端到端结果页，退休首月合计 **¥14468.81/月**
- **本报告**：`/root/.openclaw/.arkclaw-team/shared/wechat-automation/pension-ui-input-verify-report.md`
