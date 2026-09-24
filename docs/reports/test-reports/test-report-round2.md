# 北京市企业职工养老金测算小程序 — 第二轮回归测试报告（WXML 编译缺陷专项）

| 项 | 内容 |
|---|---|
| 报告版本 | Round 2（第二轮独立回归） |
| 测试方 | YDL（资深微信软件测试专家，独立执行） |
| 执行日期 | 2026-09-18 |
| 被测对象 | 第二轮修复后全量代码（经 SSH 从开发服务器 `39.106.208.34` 全量拉取，压缩包 `pension-r2.zip`） |
| 修复说明 | `docs/fix-report-round2.md`（开发方） |
| 关联缺陷 | **BUG-017 Blocker**：pages/result/result.wxml 21 处 WXML Fatal：`unexpected character inside expression`（根因：`{{}}` 表达式内非 ASCII 标识符） |
| 关联用例 | TC-U-015（P0，第二轮新增，含 26 个违规表达式行列基线） |
| 结论 | **静态校验 + 全量自动化回归全部通过；修复确认。唯一遗留：微信开发者工具 IDE 实际编译须由用户复验一次（控制台结果反馈测试方）** |

---

## 1. 执行环境

| 项 | 值 |
|---|---|
| 代码获取方式 | SSH（sshpass）登录开发服务器，PowerShell `Compress-Archive` 整仓打包后 SFTP 拉取、网关切包；未使用开发方转交文件，保证独立审计 |
| 服务器 | Windows 11，`C:\Users\Administrator\Desktop\Wechat projects\pension` |
| 网关运行时 | Linux 6.8 / Node.js **v22.22.0**（纯 node 执行全部脚本，无外部依赖） |
| 用户实际报错环境（无法在网关复现 IDE） | 微信开发者工具 **2.02.2608070**，基础库 **3.17.2** |
| 修复前留证 | 开发方备份 `backup-round2/result.wxml.bak`（修复前整文件）、`result.js.bak`、`wxml-check.js.bak`，本轮负向测试直接使用该备份复现缺陷 |
| 被测文件清单 | 3 个 WXML：`pages/index/index.wxml`（68 个 `{{}}`）、`pages/logs/logs.wxml`（3）、`pages/result/result.wxml`（94），合计 **165 个表达式** |

---

## 2. 本轮新增测试资产（测试方独立编写，不覆盖开发者脚本）

| 资产 | 作用 | 结果 |
|---|---|---|
| `tests/wxml-expr-check.js` | 独立 WXML 表达式级静态扫描器。逐文件提取每个 `{{}}` 表达式并断言：**a)** 表达式内无任何非 ASCII 字符（逐字符码位扫描，含中文字面量/全角符号/⚠—▲▼ 等）；**b)** mustache 计数配对且顺序栈合法（能发现计数相同但 `}}{` 交叉等问题）；**c)** 无 wcc 不支持语法：可选链 `?.`、空值合并 `??`、箭头函数 `=>`、分号 `;`。输出 `文件:行:列`，支持 `--json`、`--root` | 修复后代码 **退出码 0**；对修复前备份 **26/26 复现**；对 5 组合成负样例（非ASCII/`?.`/`??`/`=>`/`;`/不配对）全部正确检出，退出码 1 |
| `tests/viewmodel-audit.js` | 桩化小程序运行时（Page/getApp/wx），加载**真实** `pages/result/result.js` 执行 onLoad，再从**真实** result.wxml 提取全部绑定路径，在 S1/S2/S3/手工账户余额/不计息 5 个场景下对 root、`vm`、`vmYearly/item`、`monthlyGroups/g/m`、`refDetail` 各作用域做可达性求值；被 `wx:if` 守卫隐藏的分支（空账户年组、空按年表）做作用域判定不误报；任何渲染路径上的 undefined 即失败 | 5 场景 **0 个未解析绑定**；守卫结构（`vmYearly.length`/`g.account`/`r.meta.retireSchedule`）齐备 |
| `tests/viewmodel-mapping-check.js` | 任务点名的映射字段逐项核对（存在性 + 值正确性，含三分项/三元拆分/占位符/按年表/折叠卡/弹窗 6 字段），另对 S3 计息三元、手工余额占位做场景化验证 | **全部通过** |

> 设计说明：第一轮 `scripts/wxml-check.js` 仅校验 mustache 配对（能拦 BUG-001 的缺 `}`，拦不住"配对正确但表达式内容含中文"的 BUG-017）。本轮新脚本直接复刻 wcc 的限制面（非 ASCII + ES2020 语法），并做正负双向验证以防"永远绿"的无效检查。

### 2.1 负向验证（证明检查器真的能抓到本缺陷）

对 `backup-round2/result.wxml.bak` 运行新扫描器，**精确复现 26 个违规表达式**，行列号与用户 IDE 报错/开发方 fix-report 清单逐一吻合：

**A. 21 个 Fatal（中文属性名，IDE 21 处报错来源；行 38、53 一行多表达式）**

| # | 位置（行:列） | 表达式片段 |
|---|---|---|
| 1 | 27:45 | `r.pension.J基础` |
| 2 | 31:45 | `r.pension.J账户` |
| 3 | 35:45 | `r.pension.J过渡` |
| 4 | 38:61 | `r.pension.J基础` |
| 5 | 38:81 | `r.pension.J账户` |
| 6 | 38:101 | `r.pension.J过渡` |
| 7 | 38:138 | `r.intermediates.G同` |
| 8 | 38:168 | `r.intermediates.G实` |
| 9 | 44:121 | `r.intermediates.C平` |
| 10 | 45:93 | `r.intermediates.Z实指数` |
| 11 | 46:93 | `r.intermediates.Z同指数` |
| 12 | 47:100 | `yearsTextMap.N应缴` |
| 13 | 48:104 | `r.intermediates.K应缴月` |
| 14 | 49:90 | `yearsTextMap.N实同` |
| 15 | 50:94 | `yearsTextMap.N同` |
| 16 | 51:109 | `yearsTextMap.N实98` |
| 17 | 52:101 | `r.intermediates.R储` |
| 18 | 53:100 | `r.intermediates.R储本金 === null ? '—' : ...` |
| 19 | 53:166 | `r.intermediates.R储利息 === null ? '—' : ...` |
| 20 | 55:92 | `r.intermediates.G同` |
| 21 | 56:92 | `r.intermediates.G实` |

**B. 5 处同类隐患（表达式内含中文字符串字面量，wcc 同样拒绝，fix-report-round2 已一并修复）**

| # | 位置 | 内容 |
|---|---|---|
| 22 | 8:81 | 资格文案三元（'符合按月领取条件…'/'⚠ 不满足…'，43 个非 ASCII 字符） |
| 23 | 15:159 | `'延迟' / '提前'`（改由 result.js 提供 `offsetWord`） |
| 24 | 90:31 | `'不计息'`（改由 vmYearly 行 `rateText` 提供） |
| 25 | 106:54 | `'收起 ▲' / '展开 ▼'`（改为 WXS `ui` 模块函数） |
| 26 | 112:40 | `'—' / '不计息'`（改由年组 `account.rateText` 提供） |

修复后同一扫描器对全部 165 个表达式 **0 检出**。

---

## 3. 修复方案静态走查：ASCII 视图模型映射完整性

修复模式：**引擎输出（中文键，134 条用例锁定，不动）→ `pages/result/result.js` 新增 `buildResultVM()` 构造纯 ASCII 键视图模型 → WXML 只绑定 ASCII 路径；中文仅保留在表达式之外的静态标签文案与 `<wxs>` 模块中。**

### 3.1 任务点名项逐项核对（`viewmodel-mapping-check.js` 实测，全部 ✔）

| 点名项 | 引擎输出 | 视图模型/WXML 绑定 | 结论 |
|---|---|---|---|
| 三分项 | `pension.J基础/J账户/J过渡` | `vm.pension.basic/account/transitional`，值直接透传；合计行 `totalDisplay` 直绑数值 | ✔ 无 undefined，三分项与合计数值一致（TC-I-305 口径保持） |
| C平 | `intermediates.C平` | `vm.it.cPing` | ✔ |
| Z实指数 / Z同指数 | `Z实指数 / Z同指数` | `vm.it.zReal / zDeemed` | ✔ S1 均 1.0000 |
| N应缴 | `N应缴=33` | `vm.yearsText.nShould`（result.js 年月格式化 `33年0个月（33.0000年）`） | ✔ |
| K应缴月 | `K应缴月=396` | `vm.it.kShouldMonths` | ✔ |
| N实+同 | `N实同=40.25` | `vm.yearsText.nRealDeemed`（40年3个月/40.2500年） | ✔ |
| N同 | `N同=7.25` | `vm.yearsText.nDeemed`（7年3个月/7.2500年） | ✔ |
| N实98 | `N实98=5.75` | `vm.yearsText.n98`（5年9个月/5.7500年） | ✔ |
| R储/本金/利息三元 | `R储 / R储本金 / R储利息`（新人 null） | `vm.it.rStore / rPrincipalText / rInterestText`：null→`'—'`、0 利息→`0`、正常→两位字符串 | ✔ S1（本金 144739.20/利息 0）、S3 官方利率（本金/利息均非占位且 R储=本金+利息）双场景验证 |
| R补占位 | `intermediates.R补=null`（T-01） | WXML 静态文案「不适用（官方计发办法无此项）」+ 待确认角标，不参与求和 | ✔ TC-C-117 与 TC-P-008 覆盖 |
| G同 / G实 | `G同=873.55 / G实=692.82` | `vm.it.gDeemed / gReal` | ✔ |
| formulaLines | 4 条，含中文 `text/expr/key/ref` | `r.formulaLines` 直绑（值为对象属性，非中文标识符，wcc 允许）；WXML 仅访问 `item.text/item.expr/item.ref` ASCII 路径 | ✔ 4 条字段齐全，ref（P01/P02/P04）经 `showRef` + policyRefs 可解析（TC-U-002 修复保持） |
| 延退对照卡 | `meta.retireSchedule`（6 字段） | `r.meta.retireSchedule.statutoryYM/chosenYM/offsetWord/chosenOffsetMonths/flexibleMinYM/flexibleMaxYM`，`offsetWord` 已移入 JS（消除原中文字面量）；整块 `wx:if="{{r.meta.retireSchedule}}"` 守卫 | ✔ |
| 按年记账表 | `account.yearly[]` | `vmYearly[]` 映射为 `year/interest/endBalance/rateText/rateSource`；rate 为 null（不计息）→ `rateText='不计息'`；S1 覆盖 1992–2025 共 34 行；**手工余额场景 yearly=[] 时整卡 `wx:if="{{vmYearly.length}}"` 隐藏** | ✔ 2025 行字段/值核对一致 |
| 按月折叠表 | `monthlyDetails[]` | `monthlyGroups[].year/principalSum/account/items[]`，item 映射 `ym/typeText/base/c/cSource/z(toFixed(4))/p8`；年账户块 `wx:if="{{g.account}}"` 守卫（S2 有 3 个、S3 有 8 个、手工场景全部 34 个年组 account=null，均正确隐藏而非渲染 undefined） | ✔ |
| warnings 列表 | `meta.warnings[]`（中文字符串数组） | `r.meta.warnings` 作为 `wx:for` 数据直出（数组元素值可为中文，仅标识符受限） | ✔ |
| 政策弹窗 | policyRefs P01/P02/P04/P05/P10/P12 | `refDetail` 六字段（name/docNo/clause/effective/status/url）经 `showRef` 注入 | ✔ 6 条 × 6 字段无缺 |
| 资格提示 | `meta.eligible` | 文案移入 JS `vm.eligibleText`（消除行 8 中文字面量） | ✔ |
| 弹性延缴卡 | `r.flexInfo.months/totalCost` | 同名 ASCII 路径 | ✔ S1 months=0 时卡片隐藏 |

**审计结论：ASCII 视图模型与引擎输出一一对应，无漏映射；所有可能为 null/空数组的分支均有 `wx:if` 守卫或 JS 侧占位文案，5 个渲染场景下不存在界面显示 undefined 的路径。** 唯一需提示：`yearsText*` 在 result.js 中统一为「X年Y个月（小数年）」展示格式，与首轮报告中公式说明区的 `37.00年` 写法是文案格式差异（数值口径 33/396/40.25/7.25/5.75 均与引擎一致），非映射缺陷。

---

## 4. 全量自动化回归结果

在网关闭环执行（`/tmp/r2logs/all-results.txt` 留档），**8 个命令退出码全部为 0**：

| # | 命令 | 结果 | 退出码 |
|---|---|---|---|
| 1 | `node tests/run-tests.js` | **134/134 通过，0 失败**（P0 61 / P1 56 / P2 17；TC-F18/TC-C57/TC-I14/TC-U18/TC-X17/TC-P10） | 0 |
| 2 | `node tests/round1-fixes.js` | **33/33 通过**（GAP-01 延退对照表、最低年限、BUG-003~015 修复点） | 0 |
| 3 | `node scripts/verify.js` | 26 项 PASS，含 217 条手工核算/S1-S5/逆算器/错误路径 | 0 |
| 4 | `node scripts/wxml-check.js`（开发者增强版） | **3 文件 / 165 表达式；mustache 配对、标签闭合、表达式纯 ASCII 全部合规** | 0 |
| 5 | `node tests/regression-check.js`（首轮测试方独立回归） | **50/50 通过**（22 缺陷逐条回归 + S1/S2/S3 独立 oracle 对拍） | 0 |
| 6 | `node tests/wxml-expr-check.js`（**本轮新增**） | 3 文件 / 165 表达式全合规 | 0 |
| 7 | `node tests/viewmodel-audit.js`（**本轮新增**） | 5 场景全部绑定可解析；不计息/手工余额占位分支正确 | 0 |
| 8 | `node tests/viewmodel-mapping-check.js`（**本轮新增**） | 点名映射项逐项全部通过 | 0 |

### 4.1 计算引擎零回归

- 修复仅触及 `pages/result/result.wxml`、`pages/result/result.js`（新增 `buildResultVM`，`calculate()` 调用点与返回结构不变）、`scripts/wxml-check.js`（纯增强）。
- `calculator/**`、`constants/**`、`tests/oracle.js`、`tests/run-tests.js`、`tests/round1-fixes.js`、`scripts/verify.js` 字节级未变（见第 5 节），S1 7457.38 / S2 7782.98 / S3 合计、R储 144739.20/298962.05/430669.96 等 oracle 锚点全部维持。

---

## 5. 开发者测试改动审查（是否弱化断言）

以首轮验收基线（workflow `wf-8f02e564497e` 产物 `regression/pension-fixed/`，2026-09-18 11:49 快照）为基准逐文件 diff：

| 文件 | 是否改动 | 判定 |
|---|---|---|
| `tests/oracle.js`（独立计算基线） | **未改动**。MD5 `d6363e7b8449f8827ea5519af039e91f`，与首轮三处留存副本（tests/、pension/tests/、regression/pension-fixed/tests/）**逐一字节相同** | ✔ 无重大问题，对拍基线可信 |
| `tests/run-tests.js`（134 断言） | 未改动（与基线 diff 为空） | ✔ |
| `tests/round1-fixes.js`（33 断言） | 未改动 | ✔ |
| `scripts/verify.js`（26 项） | 未改动 | ✔ |
| `scripts/wxml-check.js` | **增强**：在原有 mustache 配对/标签闭合之上新增「表达式非 ASCII 检出（带行列）」与「可选链检出」，计数输出改为表达式总数。逐条审查 diff：**只有新增检查分支与文案，无任何规则删除、无阈值放宽、无 try/catch 吞错、退出码语义不变（有违规即 1）** | ✔ 合理，属补强而非弱化 |
| 新增 `pages/result/result.js` 中 `buildResultVM` | 非测试文件，附带核对：纯映射函数，无反向修改引擎；三元占位（null/0/'—'）语义在 mapping-check 中验证正确 | ✔ |

**审查结论：不存在为使测试通过而弱化/删除断言的行为；一条测试断言都未被改动，唯一改动的检查脚本是纯增强。**

---

## 6. 缺陷修复确认

| 项 | 结论 |
|---|---|
| 21 处 Fatal 根因（中文属性名） | 已修复：result.wxml 全部改绑 ASCII 路径，94 个表达式无非 ASCII |
| 5 处中文字面量隐患 | 已修复：文案/词表移入 result.js 与 WXS，静态扫描 0 检出 |
| 引擎不回归 | 134 + 33 + 50 + 26（verify）共 243 项既有用例/验算全绿，oracle 未改 |
| 映射完整性 | 5 场景绑定可达性 + 点名字段值核对全部通过，无 undefined 路径 |
| 防复发机制 | TC-U-015 入正式用例库（P0，附 26 条行列基线）；`tests/wxml-expr-check.js` 与开发者增强版 `scripts/wxml-check.js` 双闸；建议后续接入 CI/pre-commit |

---

## 7. 遗留项与后续动作

| # | 遗留项 | 等级 | 处置 |
|---|---|---|---|
| 1 | **微信开发者工具（2.02.2608070 / 基础库 3.17.2）实际编译未由测试方在 IDE 内复验**——网关为 Linux 无 IDE，静态扫描依据 wcc 限制面复刻但不能 100% 等同于编译器实测 | **待用户确认** | **请用户在微信开发者工具中重新编译（建议先「清缓存 → 清除编译缓存」后再编译），重点确认：① Console 面板 0 条 `unexpected character inside expression` / 无 Fatal；② 结果页正常渲染，三分项、中间变量卡、按年记账表、折叠月明细、延退对照卡、warnings 区均无数值 undefined/空白；③ 用 S1（1965-10 男 / 1985-07 参加工作 / 2025-10 退休）走查合计 7457.38。请将编译控制台结果（通过或报错截图/文案）反馈测试方闭环** |
| 2 | IDE 编译自动化（miniprogram-automator） | 增强项 | 按任务要求**本轮不安装**；待环境就绪后可将「启动 IDE → 编译 → 取 console 错误 → 跳转结果页断言」自动化，替代遗留项 1 的人工动作 |
| 3 | 中文字段引擎侧重命名（`J基础` 等） | 建议（非本轮范围） | 当前以视图模型隔离层解决，风险可控；若后续引擎也要中→英重构，须同步重写 134 条用例与 oracle，单独立项 |

---

## 8. 附：本轮测试命令与留档

```
# 全量回归（均在项目根目录，Node v22.22.0）
node tests/run-tests.js            # 134/134
node tests/round1-fixes.js         # 33/33
node scripts/verify.js             # 26 PASS
node scripts/wxml-check.js         # 165 表达式合规
node tests/regression-check.js     # 50/50
node tests/wxml-expr-check.js      # 新增：165 表达式合规（负向：修复前备份 26/26 检出）
node tests/viewmodel-audit.js      # 新增：5 场景绑定 0 undefined
node tests/viewmodel-mapping-check.js  # 新增：映射逐项通过
```

留档：网关输出目录 `/root/.openclaw/.arkclaw-team/subagent-workflows/wf-baca6a7a9a88/output/a-mr07wjfyntttop/`；
服务器落盘：`C:\Users\Administrator\Desktop\Wechat projects\pension\docs\test-cases.md`、`docs\test-report-round2.md`，新增脚本落盘 `tests\`。

**最终结论：BUG-017 修复在静态与自动化层面确认通过、零回归、无漏映射、测试资产已补强且开发者无弱化断言行为；是否彻底关闭以用户在微信开发者工具重新编译后的控制台反馈为准。**
