# pension Bug 14/15/16 真机端到端验证报告

- 验证时间：2026-09-22 13:59–14:04（Asia/Shanghai）
- 验证人：YDL 测试节点（GUI real-device）
- 结果：**84/84 断言全部通过，三项 Bug 全部修复，两案三分项回归全绿**
- 机器：Windows 11 `39.106.208.34`
- IDE 服务端口：**60964**（监听正常）
- 投递方式：交互式计划任务 `\PensionGuiRun` → session 2 真实模拟器；**每用例 fresh `cli auto` 一次性端口**（bug15=9621、bug16err=9623、MY1=9625、MY2=9627，均未复用；各阶段带整段重试，本次无重试触发）
- 项目根：`C:\Users\Administrator\Desktop\Wechat projects\pension`

---

## 一、逐条验收结论

### Bug 14 — 非整年年指数按月均口径 ✅ 通过

以页面 data/DOM 为权威，两案均核验：

| 验收点 | 期望 | 实测（MY1 / MY2） | 结论 |
|---|---|---|---|
| 2000（缴费2个月）Z年 | ≈2.6747（不再是0.4458） | **2.6747 / 2.6747** | ✅ |
| 2000 窗口月数 | 2 | 2 / 2 | ✅ |
| 2000 部分年标记 | partialYear=true，页面标「非整年·月均」 | true，DOM 见橙色「非整年·月均」 | ✅ |
| 2033（缴费6个月）Z年 | 按实际月指数（MY1=0.6 / MY2=3.0） | **0.6000 / 3.0000** | ✅ |
| 2033 窗口月数 | 6 | 6 / 6 | ✅ |
| 整年 2001 | 2.6280 不变 | 2.6280 / 2.6280 | ✅ |
| 整年 2025 | 2.9779 不变 | 2.9779 / 2.9779 | ✅ |
| 整年 2027 | 0.6 / 3.0 | 0.6000 / 3.0000 | ✅ |
| 边界行 | 1992–1995 缺分母 zYear=null；1996–1999=0 | 一致 | ✅ |
| 口径勾稽 | Σ(Z年×窗口月)/392 = Z实 | 与下方 Z实 一致（容差 0.0002） | ✅ |
| 汇总 Z实 | MY1=2.4075 / MY2=2.9095 | **2.4075 / 2.9095** | ✅ |
| DOM 内容 | 含 2.6747、不含旧稀释值 0.4458 | 是 | ✅ |

### Bug 15 — 实际缴费记录默认年度模式 ✅ 通过

| 验收点 | 结果 |
|---|---|
| 冷启动进输入页 `entryMode='year'` | ✅ |
| yearRows 可见（数据 ≥1，DOM `.seg` 行数 = yearRows 长度） | ✅ |
| 月模式专属按钮不可见（年度态仅 1 个 mini-btn） | ✅ |
| 切到月模式正常（entry/month DOM 段数匹配） | ✅ |
| 切回年度模式正常 | ✅ |
| 切换往返中 yearRows 数据不被破坏 | ✅ |
| 已有月模式草稿恢复：entryMode/segments/yearRows 完整（9999 月基数、1234 年基数/5 月均保留） | ✅ |
| 清空后重置：entryMode 重新默认 year | ✅ |

### Bug 16 — 转圈持续可见直到结果页弹出 ✅ 通过

| 验收点 | 结果 |
|---|---|
| 输入页遮罩在跳转到结果页前采样均为 true（≥2 次，无提前消失；转场边界 null 已剔除） | ✅ |
| 正常抵达结果页，ready=true | ✅ |
| 结果页首帧后 pageLoading=false、遮罩 DOM 移除（无卡死） | ✅ |
| 制造校验错误（年度默认行年基数为空即点测算）：遮罩关闭 calculating=false、errorMsg 显示、无残留遮罩 | ✅ |
| 校验报错后页面仍可正常点按切换（未卡死） | ✅ |

**瞬态遮罩如实说明**：结果页 `pageLoading=true` 仅为**单渲染帧**（结果页 onLoad 内同步完成计算与首帧 setData），脚本以 70ms 高频采样仍**冻结不到该 true 帧**（两案均如此）。按任务预案，此项以 data/DOM 断言为准：输入页遮罩采样全程 true、转场无白屏间隙、结果页 ready 后 pageLoading=false 且遮罩消失，判定通过；报告中如实标注未截到该瞬时帧，未谎报。

---

## 二、两案三分项回归（页面 data 为权威）

| 用例 | J基础 | J账户 | J过渡 | 总额 | Z实 |
|---|---|---|---|---|---|
| MY1 | 7800.79 ✅ | 5797.79 ✅ | 870.23 ✅ | **14468.81** ✅ | 2.4075 ✅ |
| MY2 | 8950.12 ✅ | 7237.05 ✅ | 1051.71 ✅ | **17238.88** ✅ | 2.9095 ✅ |

均与 My-Case.md 基准一致（容差 0.01）。

---

## 三、关键截图（共 4 张，符合预算 ≤4）

1. `bug1416-MY1-top.png` — MY1 结果页首帧：总额 14468.81、三分项
2. `bug1416-MY1-ledger.png` — **年度明细账，可见 2000 非整年·月均行 = 2.6747**（1992–2003）
3. `bug1416-MY2-top.png` — MY2 结果页首帧：总额 17238.88、三分项
4. `bug1416-MY2-ledger.png` — 年度明细账，同含 2000 非整年·月均行 = 2.6747

截图说明：年度明细账位于结果页一个**内部 scroll-view** 中。该 scroll-view 的 scroll-top 无数据绑定，automator `scrollTo()` 被重置、真实 touch 拖拽在当前模拟器未驱动，故 4 张截图定格在该内部表顶部，**2000 部分年行已直接可见**；**2033 部分年行（窗口6、Z年 0.6/3.0、partialYear）以页面 data/DOM 断言为准并已全部通过**，此处如实说明，未用截图夸大。

---

## 四、产物路径

- 结构化结果（84 断言逐条明细）：
  `C:\Users\Administrator\Desktop\Wechat projects\pension\autotest\output\gui\bug14-16-verify.json`
- 关键截图：同目录 `bug1416-*.png`（4 张）
- CLI 日志：同目录 `cli-auto-bug1416-*.log`
- 本报告（Linux）：
  `/root/.openclaw/.arkclaw-team/shared/wechat-automation/pension-bug14-16-verify-report.md`

---

## 五、过程中排掉的两个环境陷阱（如实记录）

1. **截图写项目目录触发 IDE 重编译**：初版把 PNG 直接写入项目内 output，IDE 文件监听自动重编译、模拟器回到默认输入页，出现「旧 webview 断言绿、截图却是默认输入页」的假象。已将全部产物先落**项目外** `C:\Users\Administrator\wechat-automation\bug1416-tmp\`，GUI 证据采集完成后再复制进项目 output；脚本本身也从项目外运行，并在每次截图前加 currentPage 保护断言。
2. **automator 元素定位 API 用错**：SDK 元素只有 `offset()`（文档相对），无 `getBoundingClientRect/boundingClientRect`；修正后一次性把明细账卡顶定位到视口顶部（afterOffset.top≈10）。

**最终：环境全程就绪（session 2 活动、60964 监听、.ide 一致），无 environment-session defect；Bug14/15/16 全部通过，MY1/MY2 回归全绿。**
