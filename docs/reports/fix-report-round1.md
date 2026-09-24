# 阶段4 首轮缺陷修复报告（Fix Report — Test Round 1）

- 执行人：Senior Wechat Software Developer YDL
- 日期：2026-09-18
- 基线：服务器 `C:\Users\Administrator\Desktop\Wechat projects\pension`（修复前经 SSH 拉取逐字节比对，未采用测试夹具中的派生副本）
- 输入：`docs/test-report-round1.md`（1 Blocker + 13 Major + 8 Minor，共 22 项）、`docs/test-cases.md`、`docs/specification.md` V1.1
- 自测：全量夹具 134/134 通过；修复点专项自测 33/33 通过；`scripts/verify.js` 全过；新增 WXML 静态检查通过。

## 0. 本轮自测结果摘要

| 自测 | 命令 | 结果 |
|---|---|---|
| 全量回放夹具（首轮 134 条） | `node tests/run-tests.js` | **134/134 PASS**（P0 61、P1 56、P2 17），退出码 0 |
| 修复点专项自测（新增 33 条） | `node tests/round1-fixes.js` | **33/33 PASS** |
| 开发验算 | `node scripts/verify.js` | S1-S4 全部 ✅ PASS |
| WXML 配对静态检查（新增，防 BUG-001） | `node scripts/wxml-check.js` | 3 个 wxml 全部配对通过 |
| JS 语法检查 | `node -c`（全部改动文件） | OK |

对测试夹具本身做了 2 处**最小必要**更新（均因原夹具在修复后失效或自身有缺陷，非放松标准）：

1. `TC-U-010`（FR-04）：原断言硬编码 `false`（功能未实现占位），改为真实静态检查——已实现"复制上一段（起止顺延12个月、基数沿用）+ 全口径60%/100%/300%批量填充"。
2. `TC-P-011`：原断言读取外层变量 `wxml`，但同一 IIFE 内后面 `TC-P-006` 用 `var wxml` 声明（变量提升）导致读到 `undefined`，属测试自身遮蔽 bug；改为独立读取 `result.wxml` 后断言通过。
3. 新增 `tests/round1-fixes.js`（33 条），每个修复点对应报告缺陷编号，作为回归门禁。

## 1. Blocker（1 项，已修复）

### BUG-001｜结果页 WXML Mustache 不配对导致无法编译
- **修复方式**：结果页整体重写，修复 `{{r.intermediates.G实}` 缺 `}` 问题；新增 `scripts/wxml-check.js`（Mustache `{{}}` 计数 + 标签闭合扫描）并纳入自测，防复发。
- **改动文件**：`pages/result/result.wxml`、`scripts/wxml-check.js`（新增）。
- **自测**：`node scripts/wxml-check.js` 通过；TC-U-001（134 全量内含）PASS。

## 2. Major（13 项，全部已修复）

| 编号 | 修复方式 | 主要改动文件 | 对应自测 |
|---|---|---|---|
| BUG-002 | 引擎 `formulaLines[].ref` 统一为无连字符键 `P01/P02/P04`（与 `policyRefs.js` 一致），删除死代码映射，结果页标签可弹窗 | calculator/pensionEngine.js、pages/result/result.js、result.wxml | TC-U-002（4/4 弹窗）PASS |
| BUG-003 | 手工视同月数留空(NaN)在 `validate()` 硬阻断（manual 模式必须为非负整数）；首页 UI 层前置校验 | pensionEngine.js、pages/index/index.js | 专项 BUG-003 PASS；TC-F-009/TC-I-304 |
| BUG-004 | 视同月数负数/非整数/>600 阻断；与工龄矛盾按 E-08 截断到 `[workStart,1992-09]`（1992-10后参加工作=0），截断给黄字提示 | pensionEngine.js | 专项 BUG-004/BUG-004b/E08；TC-F-016/017/018 |
| BUG-005 | fixed 模式 fixedRate 必填且限定 0~24%，NaN/越界阻断，不再静默按 0% | pensionEngine.js、index.js、index.wxml | 专项 BUG-005/005b；TC-F-007 |
| BUG-006 | `cPingOverride` 必须 >0、`accountBalanceManual` 必须 ≥0，否则阻断；兜底利率 0~24% 校验 | pensionEngine.js | 专项 BUG-006a/006b；TC-I-303/304 |
| BUG-007 | "半年简化"口径下，**退休当年缴费利息改为按月折算** `(12-m0)/12`；0.5 固定权重仅作用于完整历史年度；年初余额退休年折算原已正确，保持 | pensionEngine.js `calcAccount()` | 专项 BUG-007；TC-C-404 |
| BUG-008 | 个人账户**月计入额用精确值 B×8% 全程累加**（不再逐月 round2）；仅 `yearly[]` 与 R储 展示位舍入；spec 4.7 | pensionEngine.js | 专项 BUG-008（564.528×20 容差0.01）；TC-I-301、TC-C-114 |
| BUG-009 | 缺口年度 C年录入支持双口径：UI 按 **C 年度（1991=…）** 录入时缴费年 y 取 custom[y-1]；自动探测键位并兼容旧的按缴费年度录法；首页文案/placeholder 同步改为 C 年度语义 | pensionEngine.js `denominatorFor()`、index.wxml、index.js | 专项 BUG-009a/009b；TC-X-011 |
| BUG-010 | 退休年月早于参加工作年月直接阻断并提示，不产出错误结果 | pensionEngine.js `validate()` | 专项 BUG-010；TC-F 相关 |
| BUG-011 | 1992-10 前缴费段不再被静默排除：`buildMonthMap()` 统计区间外月数，给出含具体年月范围的专项提示（不参与账户/指数、应按视同申报，E-02/P01） | pensionEngine.js | 专项 BUG-011；TC-X-004/004b |
| BUG-012 | official 模式缺失/预估利率年度在结果页**按年记账表**标【待官方核实】红角标，并补 T-03（2022 年 4.12%/6.12% 异文）、T-04（2025 待公布）文字说明；引擎 warnings 同步列出采用预估利率的年度 | result.wxml、result.js、pensionEngine.js | 专项/TC-P-011 PASS |
| GAP-01 | **渐进式延迟退休逐月对照表落地**（见下"政策核实"）：新增纯函数模块，首页按出生年月自动给出法定退休年月（手工可改）+ 延迟月数/弹性区间提示，结果页新增 P-05 对照卡；最低缴费年限按附件4年表动态判定 | calculator/retireSchedule.js（新增）、constants/policyData.js、index.js/wxml、result.wxml/js、pensionEngine.js | 专项 GAP-01-M1~E2、MIN-Y1~Y4（15 条）；TC-U-009、TC-X-009 |
| GAP-02 | 逐月明细按年分组行补充**当年利息、年末本息余额、当年记账利率及来源角标**；另增独立"个人账户按年记账"表 | result.wxml、result.wxss、result.js | TC-U-004（3 子断言）PASS |

## 3. Minor（8 项，全部已修复，无延期项）

| 编号 | 修复方式 | 改动文件 | 自测 |
|---|---|---|---|
| BUG-013 | 三个分项先各自 round2 到分，**总额 = J基础展示值 + J账户展示值 + J过渡展示值**，界面三者之和恒等于总额 | pensionEngine.js、result.wxml（总额卡显示加和等式） | 专项 BUG-013（S1/S2 两场景）；TC-I-305；TC-C-116（7457.38） |
| BUG-014 | 缴费晚于退休前一月的部分统计月数与范围并黄字提示（仍统一截断） | pensionEngine.js `buildMonthMap()` | 专项 BUG-014；TC-X-003 |
| BUG-015 | 出生年月直接限定 spec 7.2 的 1940-01~2010-12，退休年龄 40-70 校验，错误文案对症 | pensionEngine.js `validate()` | 专项 BUG-015/015b；TC-F-006 |
| BUG-016 | Z实指数、N应缴 行角标由橙色 `tag-assume` 改为绿色 `tag-official`（21号文官方公式）；断缴计0口径以注释/T-05 文字说明 | result.wxml | TC-P-006 PASS |
| GAP-03 | 首页新增**年度录入模式**（年缴月数 1~12 + 月均基数），自动展开为当年 1~k 月段，年贡献=k×B/C、分母仍计12月（spec 4.5） | index.js `expandYearRows()`、index.wxml | TC-U-007 PASS |
| GAP-04 | 录入基数按缴费年度与上年社平 60%~300% 核定区间比对，越界实时黄字提示（允许录入，E-05）；月度/年度两种模式均生效 | index.js `collectBoundWarnings()`、index.wxml | TC-U-008 PASS |
| GAP-05 | 新增"复制上一段（起止顺延12个月，基数沿用）"，配合已有全口径档次批量填充，覆盖长年限录入 | index.js、index.wxml | TC-U-010 PASS |
| GAP-06 | 逐月/按年明细支持**导出 CSV**（含本金/利息/年末余额/利率来源，BOM 头兼容 Excel），经剪贴板交付（小程序无通用文件写权限），并加分享 | result.js `exportCsv()`、result.wxml | TC-U-011 PASS |

## 4. 政策核实与 spec 澄清记录（GAP-01 触发）

- 新增 `docs/policy-clarification.md`，完整记录核实过程（URL、文号、锚点、结论）。
- 核实来源：中国政府网新华社受权全文《全国人大常委会关于实施渐进式延迟法定退休年龄的决定》及国务院《办法》
  https://www.gov.cn/yaowen/liebiao/202409/content_6974294.htm（当日 HTTP 200 抓取全文）；新华社发布的附件1-4对照表图片逐行视觉抽核。
- 关键锚点：男 1965-01→2025-02（60岁1月）、女干部 1970-01→2025-02、女工人 1975-01→2025-02；男/女干部每4个出生月延1月（封顶36月：男1976-09起63岁、女干部1981-09起58岁），女工人每2个出生月延1月（封顶60月：1984-11起55岁）。附件4：2030年起最低缴费年限每年+6个月，2030=186月、2039起=240月。弹性提前/延迟各不超过3年、提前不低于原法定年龄。
- 结论：**spec V1.1 的 P-05 口径与官方一致，未修改任何既有计发公式**；仅将政策落地为对照表实现与动态最低年限；同步修正了 `policyRefs.P05` 原文链接（原 qstheory 直链已 404）并细化条款描述。

## 5. 观察项处理（报告 3.4）

1. "次月起按月折算"措辞歧义：代码按 4.6 权重公式执行，本次在代码注释与结果页明确"退休当年缴费一律按实际月数折算、半年简化仅作用于完整历史年度"。
2. N应缴截止口径：统一按 4.5"退休前一月"，代码与注释一致。
3. 2026 年分母沿用：除"C平年度不一致"外，assumed 年度现在每月明细带【预估】角标，并输出"官方社平尚未发布、分母沿用最近官方值"专项 warning。
4. 自测覆盖度：`tests/` 已纳入交付与本报告门禁；新增 WXML 静态检查与 33 条修复点专项断言。

## 6. 未修复项 / 遗留

- **无未修复的 Blocker/Major/Minor 缺陷**（22/22 已修复并有自测）。
- 仍依赖**人工环境**的事项（非代码缺陷，列入回归测试必做）：微信开发者工具编译截图/日志、基础库≥3.0、iOS/Android 真机渲染、深色模式、storage 往返、480月性能（TC-U-012~014）。BUG-001 编译阻断已解除并通过静态配对检查，但真机/工具侧冒烟须在下一阶段执行。
- spec 既有 T-01~T-16 待确认项（2006-2010 过渡期补差不模拟、1991-1994 官方工资缺口、2022/2025 利率异文等）维持 V1.1 结论，不属于本轮缺陷。

## 7. 变更文件清单

新增：`calculator/retireSchedule.js`、`scripts/wxml-check.js`、`tests/round1-fixes.js`、`docs/policy-clarification.md`、`tests/round1-fixes-output.txt`、`tests/test-results-round4.json`
修改：`calculator/pensionEngine.js`、`constants/policyData.js`、`constants/policyRefs.js`、`pages/index/index.js`、`pages/index/index.wxml`、`pages/result/result.js`、`pages/result/result.wxml`、`pages/result/result.wxss`、`app.wxss`、`tests/run-tests.js`（2 处失效/自身缺陷断言修正）、`README.md`

全部修改已直接落盘服务器项目目录 `C:\Users\Administrator\Desktop\Wechat projects\pension`。

## 8. 结论

首轮报告的 1 个 Blocker、13 个 Major、8 个 Minor 已全部修复；全量 134 条自测与新增 33 条修复点自测全部通过，计算引擎与页面保持解耦，政策引用配置完整，未静默改动任何官方公式（P-05 落地经过官方来源核实并留痕）。

**可进入回归测试。** 回归时请重点覆盖：①微信开发者工具编译与真机（TC-U-012~014，上一轮零覆盖项）；②延退对照表三类人群的界面默认退休年月与 M 取数；③2030 年后退休最低年限递增的资格判定；④月度/年度两种录入模式结果一致性；⑤结果页三分项加和与 CSV 导出。
