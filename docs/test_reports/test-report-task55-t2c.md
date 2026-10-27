# task-55 T2-C 独立 GUI 验收报告（BUG-02-0006）

**用例**：GT-4022 / GT-4024 / GT-4027（Z0.6 basic/compare parity ±0.001）｜**日期**：2026-10-27｜**执行者**：Senior Wechat Software Tester YDL（worker4）
**环境**：dev box 39.106.208.34，权威工作区 pension（夹具基线 HEAD=3dfcf88，5 列夹具），40215 常驻口（keeper 三件套在 session2 detached 拉起），miniprogram-automator 0.12.1。
**手册**：CLI-AUTO-PLAYBOOK.md MD5=a77c64e99aa0481f40717e59de0044ef——新版手册首次实跑。

## 一、总结论：三独立 testcase 全部 PASS ✅

| Testcase | 独立入口 | 场景 | 结果 |
|---|---|---|---|
| GT-4022 | `system_test/TST-02-GT-4022/gt-4022.js` | 利率 0% × Z0.6 compare 结果页只读 | **PASS 3/3** |
| GT-4024 | `system_test/TST-02-GT-4024/gt-4024.js` | 利率 1.5% × Z0.6 compare 结果页只读 | **PASS 3/3** |
| GT-4027 | `system_test/TST-02-GT-4027/gt-4027.js` | 同完整输入 basic/compare 两路径，0%/1.5% 两档 | **PASS 4/4** |

无产品缺陷；BUG-02-0006 相关 basic/compare 数值一致性验收通过。公共逻辑全部抽到 `system_test/common/gui-conn-lib.js`，三入口仅含各自 case input/expect。

## 二、独立自取期望 vs GUI 实测（期望由产品模块独立重算，旧线索全未引用）

完整输入：男，1973-07 生，2033-07 退休，1995-07 参加工作，视同 1995-07~2000-10，账户余额 672920@2026-08；2026-09 起 Z=0.6 灵活就业，续缴 82 月。

| Testcase | 个人账户利率 | 量 | 独立引擎期望 | GUI 实测 | 判定 |
|---|---|---|---|---|---|
| GT-4022 | 0% | R续 | 119221.44 | 119221.44 | ✅ |
| GT-4022 | 0% | J账 | 5184.23 | 5184.23 | ✅ |
| GT-4022 | 0% | P月 | 12750.50 | 12750.50 | ✅ |
| GT-4024 | 1.5% | R续 | 119221.44 | 119221.44 | ✅ |
| GT-4024 | 1.5% | J账 | 5724.39 | 5724.39 | ✅ |
| GT-4024 | 1.5% | P月 | 13290.66 | 13290.66 | ✅ |

另：J基础=6697.57、J过渡=868.70，两利率档不变。利率语义——个人账户利率 futureMonthlyRate 只影响 J账户→P月；R续=82 月续缴额 119221.44，与利率无关；回本利率 userAnnualRate 不影响本三量。

## 三、GT-4027 两路径数值表与 Δ（容差 0.001）

| 利率档 | 路径 | J账 | P月 | R（页面字段） | ΔJ账 | ΔP月 |
|---|---|---|---|---|---|---|
| 0% | basic | 5184.23 | 12750.50 | R储=720608.58 | **0** | **0** |
| 0% | compare | 5184.23 | 12750.50 | R续=119221.44 | | |
| 1.5% | basic | 5724.39 | 13290.66 | R储=795690.76 | **0** | **0** |
| 1.5% | compare | 5724.39 | 13290.66 | R续=119221.44 | | |

**R 字段口径说明（非缺陷）**：basic 结果页展示「R储＝个人账户累计储存额」（历史 672920 滚存＋未来段入账本金 47688.58＋利息；0%=720608.58、1.5%=795690.76）；compare 结果页只展示「R续＝2026-09 起继续缴费」（119221.44，82 月灵活就业 20% 总成本）。二者不是同一量，不直接断言相等。同口径可 parity 的是 J账/P月（Δ=0）；引擎层两路径 R储亦完全相同（compare 的 continueResult.intermediates.R储=basic R储，仅 UI 未渲染）。勾稽：R续 119221.44 × 40%(8%/20%) = 47688.58 = 入账本金。

## 四、GUI 实测路径（真页面渲染，非引擎值冒充）

- **compare**：connect 40215 → 先回中性页 entry（防残留结果页被误读）→ 向 storage 装载与 compare.startCompare 同构的**输入** `{sharedInput,plans}`（key=`pension_compare_payload_v1`）→ reLaunch compare-result，由页面 onLoad 内 `compareResultModel.buildViewSafe` 真实计算并 setData 渲染 → 只读结果页 view（rContinued/jAccount/pMonthly）+ 截图。
- **basic**：reLaunch index → setData 夹具对应页面数据（month 模式，喂与 compare 同源完整段：历史段＋未来 Z 段）→ 调页面真实 `onCalculate()`（产品 buildInput→Engine.calculate→navigateTo）→ result 页只读 `r.intermediates.R储 / r.pension.J账户 / r.pension.total`。
- **单方案合规**：compare 表单 UI 强制 ≥2 个不同方案（dedup），单方案 GT 无法经真实表单到结果页；故经 storage 装载同构**输入**驱动结果页，注入的是输入，结果仍由产品代码渲染，属真实只读 GUI 实测。

## 五、过程中两处测试侧问题（如实记录，均非产品缺陷）

1. **basic 初版漏未来段**：只喂历史段（到 2026-08）曾得 ΔP=1984.81 假阳性，定位为测试输入不完整（「缴到2026-08停缴」vs「续缴到2033-07」本就不同），改 month 模式喂完整段后 Δ=0。
2. **公共库 storage key 占位符写错（本人失误）**：重构时误把会话摘要中的截断显示串（含「…」）当成 compare-result 的真实 storage key，导致 compare 装载写到错误 key，页面读到更早遗留的 1.5% payload，一度出现「注入并回读 0 却渲染 1.5%」。经分步探针（回读 storage/逐步确认 path）锁定后，key 更正为纯 ASCII `pension_compare_payload_v1`，重跑三 testcase 全部真实 PASS。产品代码经核实无缺陷（roiModel 继续分支正确沿用共享区利率）。

## 六、新版 PLAYBOOK 首次实跑反馈

**走通**：①§12 keeper 三件套 + 投递链有效，独立 keeper 17s 拉起 40215，60964 预检 exit3 在位；本任务多轮 connect→disconnect 复用同一常驻口，无 FORCE_CLOSE / utility exit / 项目窗重开。②§12.2 输出位置有效（onFileChange 已 disable，脚本/正式 log 不触发 watch 编译；调试件留工程外 temp/）。③零 RDP、凭据只走 wrapper、固定 40215、业务脚本只 disconnect——全部遵守。

**建议修订**：
1. `mp.callWxMethod('setStorageSync', key, data)` 在 0.12.1 reject 非 Error 对象；同步 storage 装载改用 **`mp.evaluate(fn,...args)`** 在 app service 内直接 `wx.setStorageSync`。
2. 重页面（compare-result onLoad 同步 buildView）下 automator 命令偶发 `timeout waiting for automator response`，且 reLaunch 超时后导航有时未发生——非白屏、非 §12.3 熔断。建议每命令 safe 容错重试，reLaunch 后用 currentPage().path 确认到达再轮询 ready。
3. 结果页三分项默认折叠（`.cr-comp-row` 受 wx:if），tap 展开也可能触发全局超时；只读取值优先 `page.data()` 视图模型，DOM/截图作渲染佐证。
4. 建议手册明确「结果页只读验收可经 storage 装载同构**输入**（key 必须与页面 PAYLOAD_KEY 逐字符一致，建议用 evaluate 参数传入）驱动」的合规边界与核对方法。

## 七、证据清单（随 Git，按独立 testcase 归位）

- `system_test/TST-02-GT-4022/gt-4022.js` + `logs/result-GT4022.json`、`logs/GT4022-compare-result.png`
- `system_test/TST-02-GT-4024/gt-4024.js` + `logs/result-GT4024.json`、`logs/GT4024-compare-result.png`
- `system_test/TST-02-GT-4027/gt-4027.js` + `logs/result-GT4027.json`、`logs/GT4027-basic-result-0pct.png`
- 公共库：`system_test/common/gui-conn-lib.js`
- 矩阵：`docs/requirement_coverage/phase2-final-coverage-matrix.md`（仅 GT-4022/4024/4027 三行）
- 过程件（不入 Git）：`temp/` 下 run-gt47.js、compare-probe2.js、*-trace.log 等。
