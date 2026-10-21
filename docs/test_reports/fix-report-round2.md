# 第二轮修复报告：WXML 中文标识符编译错误

- 项目：北京市企业职工养老金测算小程序（原生小程序，AppID wx9c012db494b84dae）
- 环境：Win11 + 微信开发者工具 2.02.2608070，基础库 3.17.2
- 修复日期：2026-09-18
- 修复人：开发方（第二轮）
- 服务器路径：`C:\Users\Administrator\Desktop\Wechat projects\pension`
- 原文件备份：服务器项目根 `backup-round2\`（result.wxml.bak / result.js.bak / wxml-check.js.bak）

---

## 1. 缺陷根因

微信开发者工具内置的 WXML 编译器（wcc）对 `{{ }}` 数据绑定表达式按受限 JS 表达式语法做词法解析，**标识符只接受 ASCII 字符集**。表达式中一旦出现非 ASCII 字符（无论是属性名还是中文字符串字面量、中文函数名），wcc 即在对应行列报：

```
[WXML 文件编译错误] Failed to compile WXML files:
pages/result/result.wxml:27:44 Fatal: unexpected character inside expression
```

并使整个结果页（甚至整包预览）无法编译。

第一轮后 `pages/result/result.wxml` 仍直接绑定计算引擎 `pensionEngine.js` 的中文输出键（该引擎为纯 JS 模块，Node 与小程序 JS 运行时均允许中文键；仅 WXML 表达式不允许），因此在真机/工具编译时触发 21 处 Fatal。

**关键边界**：WXML 静态文本（标签之间的中文，如「基础养老金 J基础」）完全不受影响；只有 `{{ }}` 表达式内部的字符必须 ASCII。

---

## 2. 审计范围与完整位置清单

审计对象：项目内全部 WXML（共 3 个；项目无 app.wxml）

| 文件 | `{{}}` 表达式数 | 含非 ASCII 的表达式 |
|---|---|---|
| pages/result/result.wxml | 113（修复前） | **26 处** |
| pages/index/index.wxml | 49 | 0 |
| pages/logs/logs.wxml | 3 | 0 |

另用 grep 全量检查：全部 WXML 无可选链 `?.`、无空值合并 `??`、无 `{{}}` 内中文函数调用。

### 2.1 导致编译 Fatal 的 21 处（中文属性名，与用户实测报错一致）

| # | 文件:行:列（修复前） | 表达式片段 | 类别 |
|---|---|---|---|
| 1 | result.wxml:27:45 | `r.pension.J基础` | 三分项 |
| 2 | result.wxml:31:45 | `r.pension.J账户` | 三分项 |
| 3 | result.wxml:35:45 | `r.pension.J过渡` | 三分项 |
| 4 | result.wxml:38:61 | `r.pension.J基础` | 合计公式行 |
| 5 | result.wxml:38:81 | `r.pension.J账户` | 合计公式行 |
| 6 | result.wxml:38:101 | `r.pension.J过渡` | 合计公式行 |
| 7 | result.wxml:38:138 | `r.intermediates.G同` | 合计公式行 |
| 8 | result.wxml:38:168 | `r.intermediates.G实` | 合计公式行 |
| 9 | result.wxml:44:121 | `r.intermediates.C平` | 中间变量 |
| 10 | result.wxml:45:93 | `r.intermediates.Z实指数` | 中间变量 |
| 11 | result.wxml:46:93 | `r.intermediates.Z同指数` | 中间变量 |
| 12 | result.wxml:47:100 | `yearsTextMap.N应缴` | 年限文案 |
| 13 | result.wxml:48:104 | `r.intermediates.K应缴月` | 中间变量 |
| 14 | result.wxml:49:90 | `yearsTextMap.N实同` | 年限文案 |
| 15 | result.wxml:50:94 | `yearsTextMap.N同` | 年限文案 |
| 16 | result.wxml:51:109 | `yearsTextMap.N实98` | 年限文案 |
| 17 | result.wxml:52:101 | `r.intermediates.R储` | 个人账户 |
| 18 | result.wxml:53:100 | `r.intermediates.R储本金 === null ? '—' : r.intermediates.R储本金` | 三元（2 个中文键） |
| 19 | result.wxml:53:166 | `r.intermediates.R储利息 === null ? '—' : r.intermediates.R储利息` | 三元（2 个中文键） |
| 20 | result.wxml:55:92 | `r.intermediates.G同` | 中间变量 |
| 21 | result.wxml:56:92 | `r.intermediates.G实` | 中间变量 |

### 2.2 表达式内中文字符串字面量 5 处（当前 wcc 对字符串字面量内中文多容忍，但属同类隐患，一并外置）

| # | 位置（修复前） | 原表达式 | 处理 |
|---|---|---|---|
| 22 | result.wxml:8:81 | `r.meta.eligible?'符合按月领取条件（具体以经办核定为准）':'⚠ 不满足按月领取最低年限条件，以下仅为数学测算值'` | 文案移入 JS `vm.eligibleText` |
| 23 | result.wxml:15:159 | `…chosenOffsetMonths>=0?'延迟':'提前'` | JS 预计算 `retireSchedule.offsetWord` |
| 24 | result.wxml:90:31 | `item.rate===null?'不计息':item.rate` | JS 预生成 `vmYearly[].rateText` |
| 25 | result.wxml:106:54 | `expandedYear===g.year?'收起 ▲':'展开 ▼'` | data.ui.collapse/expand |
| 26 | result.wxml:112:40 | `g.account.rate==='—'?'不计息':g.account.rate` | JS 预生成 `g.account.rateText` |

---

## 3. 修复方案与选型理由

### 3.1 选型：页面 JS 构造纯 ASCII 视图模型（引擎与测试零改动）

在两个候选方案中选择「**只在展示层加 ASCII 视图模型，引擎继续输出中文键**」：

- 改动面最小：仅 3 个文件（result.wxml / result.js / wxml-check.js），引擎 `calculator/pensionEngine.js`、`tests/run-tests.js`（134 断言）、`tests/round1-fixes.js`（33 断言）、`tests/regression-check.js`（50 断言）、`tests/oracle.js`（测试方独立参照实现）**全部无需改动、零回归风险**。
- 若统一把引擎输出键重构为 ASCII，将连锁修改 4 个测试文件 100+ 处断言与 oracle 的对拍字段，还可能触碰测试方独立脚本 `tests/regression-check.js`（其直接读取 `r.pension.J基础`、`r.intermediates.G同` 等）和被明令禁止修改计算逻辑的 `tests/oracle.js`，风险与收益不成比例。
- 视图模型是纯映射、无任何计算/舍入，引擎与显示数值严格一致。

### 3.2 键映射表（result.js `onLoad` 构造）

```
vm.pension.basic        ← r.pension.J基础
vm.pension.account      ← r.pension.J账户
vm.pension.transitional ← r.pension.J过渡
vm.it.m                 ← r.intermediates.M
vm.it.cPing             ← r.intermediates.C平
vm.it.zReal             ← r.intermediates.Z实指数
vm.it.zDeemed           ← r.intermediates.Z同指数
vm.it.nShould           ← r.intermediates.N应缴
vm.it.kShouldMonths     ← r.intermediates.K应缴月
vm.it.nRealDeemed       ← r.intermediates.N实同
vm.it.nDeemed           ← r.intermediates.N同
vm.it.n98               ← r.intermediates.N实98
vm.it.rStore            ← r.intermediates.R储
vm.it.rPrincipal        ← r.intermediates.R储本金（另预格式化 rPrincipalText，null→'—'）
vm.it.rInterest         ← r.intermediates.R储利息（另预格式化 rInterestText，null→'—'）
vm.it.gDeemed           ← r.intermediates.G同
vm.it.gReal             ← r.intermediates.G实
vm.yearsText.nShould/nRealDeemed/nDeemed/n98 ← 原 yearsTextMap 四个年限文案
vm.eligibleText         ← 原第 8 行资格三元中文字面量
r.meta.retireSchedule.offsetWord ← 原第 15 行「延迟/提前」
vmYearly[].rateText     ← 原大表 null→'不计息'，否则直接取引擎 round4 小数（严格保持修复前显示语义）
monthlyGroups[].account.rateText ← 折叠区 null→'不计息'，否则百分比字符串（保持修复前语义）
ui.collapse / ui.expand ← 原第 106 行「收起 ▲ / 展开 ▼」
```

WXML 中所有标签静态中文文案（J基础、C平、Z实指数、官方、待官方核实、表头、免责声明等）原样保留；模板内仅出现 ASCII 标识符。`r.*` 下其余本来就是 ASCII 的绑定（meta/inputs/account/flexInfo/formulaLines/monthlyGroups 等）保持不变。

### 3.3 scripts/wxml-check.js 强化（CI/Node 侧卡口）

保留既有 Mustache 配对与标签闭合检查，新增：

1. 用 `/\{\{([\s\S]*?)\}\}/g` 提取每个表达式并定位其行列，逐字符扫描，**出现任意非 ASCII（charCode>127）即失败**，报 `文件:行:列` 与表达式片段；
2. 表达式内出现可选链 `?.`（正则 `/\?\s*\./`）即失败（wcc 不支持 ES2020 可选链）；
3. 输出统计扫描的文件数与表达式数（当前 3 文件 / 165 表达式）。

负向验证：对含 `{{r.pension.J基础}}` 与 `{{a?.b}}` 的临时样例，规则能分别报出 non-ascii 与 optional chain。

---

## 4. 改动文件清单

| 文件 | 改动 |
|---|---|
| pages/result/result.wxml | 26 处表达式全部改绑 ASCII 键/外置文案；静态中文文案不变；修复过程中发现并保持 `<button open-type="share">` 原样 |
| pages/result/result.js | 新增 `vm` / `vmYearly` / `ui` 视图模型、`offsetWord`、`rateText`、null 占位预格式化；原有分组、CSV、弹窗逻辑不变 |
| scripts/wxml-check.js | 新增表达式非 ASCII 检测与可选链检测，保留旧规则 |
| docs/fix-report-round2.md | 本报告（新增） |

未改动：calculator/pensionEngine.js、tests/ 全部文件（含 oracle.js、regression-check.js）、index 页、logs 页、常量/样式。未安装任何 npm 包，未改系统配置。

---

## 5. 自测结果（服务器项目根实际执行，Win11 + Node）

```
> node scripts\wxml-check.js
WXML 静态检查通过：3 个文件，165 个 {{}} 表达式；Mustache 配对、标签闭合、表达式纯 ASCII 全部合规。
EXIT=0

> node tests\run-tests.js
用例总数: 134  通过: 134  失败: 0
按优先级: {"P0":{"pass":61,"fail":0},"P1":{"pass":56,"fail":0},"P2":{"pass":17,"fail":0}}
按模块: {"TC-F":18,"TC-C":57,"TC-I":14,"TC-U":18,"TC-X":17,"TC-P":10} 全通过
RUNTESTS_EXIT=0

> node tests\round1-fixes.js
阶段4修复点专项自测：33 通过，0 失败
ROUND1_EXIT=0

> node tests\regression-check.js（测试方独立脚本，服务器上已存在，未做任何修改）
总计 50 通过 50 失败 0
全部通过 ✅

> node scripts\verify.js
VERIFY_EXIT=0（S1~S5 全部 ✅ PASS，无 FAIL 行）

> node --check pages\result\result.js
RESULT_JS_SYNTAX_OK
```

合计 134 + 33 + 50 = 217 条断言/用例全绿，verify 手算场景全过。无任何既有断言被删除或弱化；本轮未修改测试文件，故无断言调整记录。

---

## 6. 给测试方/用户的验证重点

1. **编译验证（核心）**：微信开发者工具 2.02.2608070 + 基础库 3.17.2 重新编译，控制台应不再出现任何 `unexpected character inside expression`；结果页正常渲染。
2. **结果页显示对照**（建议跑 S1：男 1965-10 / 1985-07 参加工作 / 2025-10 退休）：
   - 总额大字、J基础/J账户/J过渡 三个分项数值与修复前一致；
   - 中间变量卡：C平=12049、Z实指数=1.0000、N应缴/N实+同=40.25 年文案（「40年3个月（40.2500年）」）、R储本金/利息、G同/G实 正常；
   - 不计息场景下个人账户表与折叠区利率列显示「不计息」（保持原语义）；计息场景大表利率列仍显示引擎小数原值、折叠区显示百分比；
   - 资格不符用例顶部红条文案、延退卡「延迟/提前 N 个月」、年折叠「收起 ▲/展开 ▼」文案与修复前一致。
3. **静态卡口**：`node scripts/wxml-check.js` 可作为 CI 必跑项；任何后续在 `{{}}` 内写中文标识符/中文字面量/可选链都会立即失败并给出行列。
4. **引擎零改动对拍**：oracle 对拍与 50 项独立回归仍全绿，计算结果未受展示层调整影响。
5. 备份在 `backup-round2\`，如需对照修复前模板可取用（勿长期随包发布，确认无误后可自行删除）。

**结论：21 处 Fatal 编译错误及 5 处同类隐患已全部修复，217 条既有测试全绿，可进入回归。**
