# Pension UI 变更设计 — Bug25 / Bug26（架构定稿 V1.8）

- 角色：pension 架构师
- 日期：2026-09-23（Asia/Shanghai）
- 基线：服务器 spec V1.7（`C:\Users\Administrator\Desktop\Wechat projects\pension\docs\specification.md`，
  22801B / 708 行）；上轮设计 `docs/pension-ui-change-design-bug22-24.md`（Bug23 口径B）。
- 范围纪律：**本轮只设计 + 预计算 + 改 spec 文档**。不改小程序源码、不跑 GUI、不 taskkill IDE、
  不碰 RDP。源码与 spec 均经 `win-ssh.sh`（PowerShell -EncodedCommand，Base64 收发）只读拉取。

---

## 0. 现状勘查结论（改前事实）

### 0.1 输入页 section 现状（`pages/index/index.wxml`）

| 现编号 | card-title | 关键内容 |
|---|---|---|
| ① | 基本信息 | 性别、女性身份、出生年月、**参加工作年月 workStartYM**、退休年月 |
| ② | 视同缴费年限（按档案认定起止年月） | hasDeemed 有/无开关、deemedStartYM/deemedEndYM |
| ③ | 实际缴费记录（单位 / 灵活就业） | entryMode 年度/月度切换、yearRows / segments、快捷填充 |
| ④ | 个人账户储存额与利息 | accountBalanceManual（余额）、manualBalanceYM（余额所在年月）、futureMonthlyRatePct（未来记账利率） |
| **④-2** | 人员身份与 R补（31号文·Z补贴） | doc31Eligible 开关、doc31TransferYM（调动/入伍/转制年月）、**enterpriseInsuredYM（企业实际参保缴费起始）**、subsidyExcludedText、R补说明 |
| ⑤ | 计发基数 C平 与缺口年度数据 | baseYearIndex、cPingOverride、customCYearText |

共 **6 个 card**（编号 ①②③④④-2⑤）。

### 0.2 `enterpriseInsuredYM` 现状（字段身份勘查）

| 维度 | 现状 |
|---|---|
| 字段 key | `enterpriseInsuredYM`（YYYY-MM 字符串） |
| 初始值 | `inputPageModel.buildInitialData`：`enterpriseInsuredYM: ''` |
| UI 位置 | 仅在 **section ④-2** 内；`wx:if="{{doc31Eligible}}"`——**只有 31号文开关打开时才显示** |
| 事件 | `onEnterpriseInsured`（index.js）→ setData |
| buildInput | `enterpriseInsuredYM: d.enterpriseInsuredYM || null`；doc31 人员校验必填（「31号文人员须填写企业实际参保缴费起始年月…」），非 doc31 人员不校验、值通常为空 |
| 引擎用途 1 | **应缴窗口起点**（pensionEngine.js `insuredWindowStart`，doc31 分支）：合法且 ≥1992-10 → 起点 = enterpriseInsuredYM；否则 1992-10 |
| 引擎用途 2 | **R补（Z补贴）**：`computeSubsidy(input, Z实)` 经 `accountSubsidy.js`，用其确定补贴 C 年截止年（参保前一年）与月折算 |
| 非 doc31 分支 | 窗口起点只读 `workStartYM`：`max(1992-10, workStartYM)`；**完全不读 enterpriseInsuredYM** |

> 结论：用户所指属实——「企业实际参保缴费起始」被绑在 ④-2 且仅 doc31 显示，
> 而它本是基本信息，普通人员同样可能存在「参工月 ≠ 实际参保起始月」（补缴、跨制度转入、中断后重参保）。

---

## 1. Bug25 定稿：section 合并（仅 UI 结构重组）

### 1.1 合并方案

把现 **section ④「个人账户储存额与利息」** 与现 **section ④-2「人员身份与 R补」**
合并为**单一 section ④「个人账户养老金」**，内含两项：

- **项 ① 个人账户储蓄额**
  - 个人账户累计储存额（余额，`accountBalanceManual`）
  - 余额所在年月（`manualBalanceYM`）
  - 未来记账利率（`futureMonthlyRatePct`）
- **项 ② 人员身份与 R补**
  - 31号文人员开关（`doc31Eligible`）
  - 相关申报项：调动/入伍/转制到企业年月（`doc31TransferYM`）、
    已领取一次性补贴需扣除年限（`subsidyExcludedText`）
  - R补说明（Z补贴政策说明文字；**注意「企业实际参保缴费起始」已按 Bug26 移至 section ①**）

建议 wxml 结构（示意，非最终源码）：

```html
<view class="card">
  <view class="card-title">④ 个人账户养老金</view>

  <view class="subhead">① 个人账户储蓄额</view>
  <!-- 余额 / 余额所在年月 / 未来记账利率（原④内容原样搬入） -->

  <view class="subhead">② 人员身份与 R补（31号文·个人账户补贴额 Z补贴）
    <text class="tag tag-official">京劳社养发〔2007〕31号</text></view>
  <!-- doc31 开关 + transfer + excluded + R补说明（原④-2内容搬入，enterpriseInsuredYM 控件移走） -->
</view>
```

- 样式：新增/复用 `.subhead`（分项小标题），两项在同一 card 内视觉分隔；不动任何计算逻辑。
- `index.js` / `inputPageModel.js`：**无需改 data 字段、无需改事件绑定、无需改 buildInput**；
  仅 wxml DOM 位置调整（控件随 card 搬迁，绑定路径不变）。

### 1.2 输入页 section 最终清单与顺序（V1.8 权威）

| 新编号 | 名称 | 内容要点 |
|---|---|---|
| **①** | **基本信息** | 性别、女性人员身份、出生年月、**参加工作年月 workStartYM**、**企业实际参保缴费起始 enterpriseInsuredYM（Bug26 新增至此，全部人员可填，与参工月并列）**、退休年月 |
| **②** | 视同缴费年限（按档案认定起止年月） | hasDeemed 有/无开关、deemedStartYM/deemedEndYM |
| **③** | 实际缴费记录（单位 / 灵活就业） | entryMode 年度/月度、yearRows / segments、快捷填充 |
| **④** | **个人账户养老金** | **项① 个人账户储蓄额**（余额、余额所在年月、未来记账利率）；**项② 人员身份与 R补**（doc31 开关、调动/入伍/转制年月、扣除年限、R补说明） |
| **⑤** | 计发基数 C平 与缺口年度数据 | baseYearIndex、cPingOverride、customCYearText |

- card 总数：6 → **5**；编号 ①②③④⑤ 连续，**取消 ④-2 编号**；
  原 ⑤（C平）**顺延重编号为 ⑤（位置不变、仅去掉与④-2并存的编号错位）**——
  实际变化：删除 1 个 card 壳，④-2 内容并入④，后续 section 编号由「⑤」仍为「⑤」但全页编号连续无跳号。
- **计算逻辑零改动**：Bug25 纯结构重组；所有 `intermediates` / `pension` 输出不变。

### 1.3 Bug25 验收点

- AC-B25-01：输入页共 5 个 card，标题依次 ① 基本信息 / ② 视同缴费年限 / ③ 实际缴费记录 /
  ④ 个人账户养老金 / ⑤ 计发基数 C平 与缺口年度数据；页面不存在「④-2」字样。
- AC-B25-02：section ④ 内可见两个分项小标题「① 个人账户储蓄额」「② 人员身份与 R补」；
  原余额三控件与原 doc31 控件全部在位、可交互，绑定值正确（录入→data→结果链路无变化）。
- AC-B25-03：doc31 开关切换、R补说明显隐行为与 V1.7 一致。
- AC-B25-04：四案（MY1~MY4）测算结果与 V1.7 逐项一致（Bug25 本身零数值变化）。

---

## 2. Bug26 定稿：企业实际参保缴费起始 字段普适化 + 参与 N应缴

### 2.1 字段统一命名

| 项 | 定稿 |
|---|---|
| UI 标签 | **企业实际参保缴费起始**（年月，picker mode=date fields="month"） |
| 内部 key | **保留 `enterpriseInsuredYM`**（doc31 引擎分支与 accountSubsidy 已使用，改名会制造无谓 churn；在注释中标注其通用语义） |
| 语义 | 被保险人在企业（企业职工养老保险制度内）**首次实际参保缴费的年月**；对灵活就业续保人员指首次以灵活身份实际缴费月 |
| 占位/说明 | 「如与参加工作月一致可留空；有补缴/跨制度转入/中断重参保时按实际参保起始填写」 |
| storage | 沿用 `pension_input_v1`，key 不变 → 草稿天然向后兼容，无需迁移逻辑 |

### 2.2 字段位置与可见性

- 从 section ④-2（合并后为 section ④ 项②）**移至 section ① 基本信息**，
  与「参加工作年月 workStartYM」**并列展示**（建议紧随其后）。
- **所有人员可见可填**：去掉 `wx:if="doc31Eligible"` 条件；普通企业职工 / 灵活就业 / 新人均可填。
- `index.js`：`onEnterpriseInsured` 事件不变；`buildInput` 透传不变；
  doc31 必填校验保留；**非 doc31 人员不强制必填**（空值走 fallback，见 2.3）。

### 2.3 N应缴窗口起点规则修订（V1.8 权威，替换 V1.7 §2.1.1 普通人员分支）

```
窗口起点 insuredWindowStart(input)：
  ① doc31Eligible=true（31号文人员）：
       enterpriseInsuredYM 合法且 ≥1992-10 → 起点 = enterpriseInsuredYM
       否则 → 1992-10（并由既有校验提示）         【逻辑不变】
  ② doc31Eligible≠true（普通企业职工/灵活就业/新人）：
       anchor = enterpriseInsuredYM 合法 ? enterpriseInsuredYM : workStartYM
       起点 = (anchor 合法且 anchor > 1992-10) ? anchor : 1992-10
    即 窗口起点 = max(1992-10, enterpriseInsuredYM>0 ? enterpriseInsuredYM : workStartYM)
窗口终点：退休前一月
K应缴月 = 窗口起点 → 退休前一月（含两端、含断缴月）
N应缴   = K应缴月 ÷ 12
```

**与 Bug23 口径B 的关系：对口径B 的进一步补充（同一规则的锚点扩展），非推翻。**

- V1.7 口径B：非31号文人员起点 = max(1992-10, workStartYM)。
- V1.8：在口径B 基础上新增一个**优先锚点** `enterpriseInsuredYM`；
  该字段为空时严格回退到 workStartYM → **口径B 是 V1.8 规则在字段空值时的退化情形，完全兼容**。

**普通人员「企业实际参保起始」≠「参工月」时取哪个：取企业实际参保起始（优先）。理由：**

1. Z实指数分母 N应缴 的法定含义是「**应缴纳基本养老保险费年限**」（21号文附件、29号文第16条）。
   应缴义务的范围在存在「先用工、后参保」事实时，实务与经办口径以**实际参保关系建立**为界：
   - **补缴**：参工后未即时参保、之后补缴的，补缴时段是否计入应缴窗口以参保关系为准；本产品不模拟补缴追溯，
     以用户填报的实际参保起始为锚，避免把「无参保关系、无缴费、无指数记录」的月份纳入 K 又必然 z=0 而稀释 Z实；
   - **跨制度转入**（机关事业/居民养老/外地转入）：转入前在本制度内无应缴义务，窗口自转入后实际参保月起；
   - **中断后重参保**：首次实际参保月才是本制度应缴关系起点（中断本身在窗口内按断缴 z=0 处理，
     但窗口起点不应早于首次参保）。
2. 若用户希望把参工→参保之间的月份按断缴计入（主张应缴义务自参工始），**留空该字段即可回退参工月口径**——
   规则把选择权交给用户，空值行为即 V1.7 口径B。
3. 「参加工作月 workStartYM」保留其既有身份：人员类型（中人/新人）判定锚点、31号文 N实98/N同 截断锚点，
   不因本规则改变。

### 2.4 字段影响范围澄清（本轮不扩大公式）

| 计算/判定 | 是否受 enterpriseInsuredYM 影响（V1.8） |
|---|---|
| N应缴 / K应缴月（非doc31） | **是，新增参与（本轮核心）** |
| Z实指数 / J基础 / 月合计 | 是（随 K 与窗口变化而变化） |
| 31号文窗口起点 | 是（V1.7 起即如此，本轮不变） |
| R补（Z补贴）截止年 | 是（accountSubsidy，本轮不变） |
| 人员类型 中人/新人 判定 | **否**：仍按 workStartYM 是否早于 1998-07（183号令第23/24条以「参加工作」为界）；enterpriseInsuredYM ≥1998 不等于新人 |
| N实 / 实缴月 actualPaidMonths | **间接影响**：实缴月统计区间是窗口（引擎在 windowStartIdx→lastContribIdx 内逐月数 base>0）；锚点推后时，落在新窗口外的旧实缴月不再计入，N实同随之变化。缴费段数据本身不删除、R储 8% 入账与利息不受影响 |
| N实98 | 否（独立按 1992-10~1998-06 实际缴费月统计；但锚点晚于1998-07时窗口内本就无该区间月） |
| N同 / deemedMonths / G同 | 否：视同按 hasDeemed 与认定起止 |
| R储（个人账户累计） | 否：锚定余额 + 未来段复利，与窗口无关 |
| M 计发月数 / 资格 eligible | 否 |
| 新待遇公式（如跨制度转移账户合并等） | **本轮明确不做**，列未来工作 |

### 2.5 引擎改动指引（交开发节点，本轮不动源码）

`calculator/pensionEngine.js` `insuredWindowStart`（约 571–576 行）非 doc31 分支：

```js
// 现：
var ws = input.workStartYM;
var insuredStart = ws && /^\d{4}-\d{2}$/.test(ws) && ws > '1992-10' ? ws : '1992-10';
// 改为：
var ei = input.enterpriseInsuredYM;
var anchor = ei && /^\d{4}-\d{2}$/.test(ei) ? ei : input.workStartYM;
var insuredStart = anchor && /^\d{4}-\d{2}$/.test(anchor) && anchor > '1992-10' ? anchor : '1992-10';
```

- 纯函数改动，`monthlyMap` 仍由 `buildMonthMap`（物理建账恒 1992-10 截断）独立构造，二者不得混用。
- 空值/非法值均安全回退；doc31 分支一行不动。

### 2.6 Bug26 验收点

- AC-B26-01：「企业实际参保缴费起始」控件位于 section ①，参加工作月之后并列；
  任意人员类型、doc31 开关关闭时也可见可填。
- AC-B26-02：section ④（含原④-2内容）内不再出现该字段控件。
- AC-B26-03（空值回退）：字段留空时 K/N应缴/Z实 与 V1.7 口径B 完全一致。
- AC-B26-04（优先锚点）：MY3 案（参工 2003-09）若填 2004-09，
  窗口=2004-09~2031-06、K=322、N=26.8333、Σ月z=768.6934、Z实=2.3872、实缴月314/N实同26.1667、J基础=5339.69、月合计=9046.17（J账户不变3706.48）。
- AC-B26-05（doc31 不受影响）：MY1/2 窗口仍 2000-11~2033-06、K=392，R补计算不变。
- AC-B26-06（类型判定不漂移）：普通人员填晚于 1998-07 的企业参保起始，中人/新人判定仍以参工月为准。
- AC-B26-07（草稿兼容）：旧 storage 草稿（无该字段或字段在④-2录入的值）加载后值不丢、位置在①。

---

## 3. 四案期望值（真实服务器引擎副本 node 实跑）

### 3.1 各案字段值确认

| 案 | 人员 | workStartYM | enterpriseInsuredYM | 退休 | 窗口（V1.8=V1.7） |
|---|---|---|---|---|---|
| MY1 | doc31 中人（机关2000-11转入企业） | 1995-07 | **2000-11**（现行值，doc31 分支一直用） | 2033-07 | 2000-11~2033-06 |
| MY2 | doc31 中人（同上，未来 Z=3） | 1995-07 | **2000-11** | 2033-07 | 2000-11~2033-06 |
| MY3 | Wife，新人（女工人，2031-07 退） | 2003-09 | **推定 2003-09**（案例无独立值；参工/首账号均 2003-09，三者一致） | 2031-07 | 2003-09~2031-06 |
| MY4 | Wife，新人（延迟，2036-07 退） | 2003-09 | **推定 2003-09** | 2036-07 | 2003-09~2036-06 |

> Wife 案例原文：「参加工作 2003-09」「首次建立养老账号 2003-09」，无单独企业实际参保起始；
> 按口径一致性推定 = 2003-09。

### 3.2 完整期望值表（V1.8，与 V1.7 逐项比对）

| 量 | MY1 | MY2 | MY3 | MY4 |
|---|---:|---:|---:|---:|
| 窗口起点 | 2000-11 | 2000-11 | 2003-09 | 2003-09 |
| **K / N应缴** | 392 / 32.6667 | 392 / 32.6667 | 334 / 27.8333 | 394 / 32.8333 |
| **Σ月z（未舍入）** | 942.0684 | 1138.8657 | 787.4583 | 967.4583 |
| **Z实指数** | **2.4032** | **2.9053** | **2.3577** | **2.4555** |
| **Σ窗口Z年（round4行值和）** | 78.5054 | 94.9053 | 65.6215 | 80.6215 |
| 实缴月 / N实同 | 392 / 38.0 | 392 / 38.0 | 326 / 27.1667 | 386 / 32.1667 |
| N同 / N实98 | 0 / 3.0 | 0 / 3.0 | 0 / 0 | 0 / 0 |
| M | 139 | 139 | 195 | 170 |
| **R储** | 795693.52 | 996432.00 | 722763.05 | 960080.64 |
| R储本金 / 利息 | 47691.20 / 75082.32 | 238442.88 / 85069.12 | 191917.44 / 49386.61 | 366387.84 / 112233.80 |
| **R补（Z补贴）** | 10923.92 | 13205.91 | 0（不适用） | 0（不适用） |
| **J基础** | 7791.06 | 8940.37 | 5495.33 | 6696.30 |
| **J账户** | 5803.00 | 7263.58 | 3706.48 | 5647.53 |
| **J过渡** | 868.70 | 1050.17 | 0 | 0 |
| **月合计** | **14462.76** | **17254.12** | **9201.81** | **12343.83** |

### 3.3 零回归判定（重点结论）

**四案全部数值零回归。** 推导：

1. **MY1/MY2**：enterpriseInsuredYM=2000-11 本就是 V1.7 doc31 分支的窗口锚点；
   V1.8 doc31 分支「逻辑不变」→ K/Σz/Z实/R补/各项金额逐位不变。
2. **MY3/MY4**：推定 enterpriseInsuredYM=2003-09 = workStartYM=2003-09，
   新规则 `enterpriseInsuredYM>0 ? enterpriseInsuredYM : workStartYM` 取出的 anchor = 2003-09，
   与 V1.7 口径B 直接取 workStartYM 结果相同；max(1992-10, anchor) 仍为 2003-09
   → K=334/394、Σ月z=787.4583/967.4583、Z实=2.3577/2.4555、月合计=9201.81/12343.83，全部不变。
3. 实跑核验：用服务器引擎副本（未改一行源码）构造四案输入，输出与上表 V1.7 权威值**逐位一致**；
   脚本 `run-bug25-cases.js`（随本轮工作区留存），结构化结果 `cases-output-v18.json`。

### 3.4 差异情形演示（非权威MY案，仅证明新规则生效）

以 MY3 为底、仅把「企业实际参保缴费起始」改为晚于参工月（用引擎既有 workStartYM 分支等价模拟，
因 V1.8 新规则函数形式与现分支一致、仅锚点来源变化）：

| enterpriseInsuredYM | K | N应缴 | Σ月z | Z实 | J基础 | J账户 | 月合计 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2003-09（=参工，权威） | 334 | 27.8333 | 787.4583 | 2.3577 | 5495.33 | 3706.48 | 9201.81 |
| 2004-09 | 322 | 26.8333 | 768.6934 | 2.3872 | 5339.69 | 3706.48 | **9046.17** |
| 2005-09 | 310 | 25.8333 | 750.3986 | 2.4206 | 5203.43 | 3706.48 | **8909.91** |

规律：锚点推后 12 个月 → K−12；原 2003-09~2004-08 的 12 个实缴月（2003 段月 z≈0.207 等低指数月）移出窗口：

- Σ月z 787.4583→768.6934（−18.7649）、实缴月 326→314、N实同 27.1667→26.1667；
- Z实 = 768.6934/322 = **2.3872**（移出的是低于均值的低指数月，故 Z实 略升）；
- J基础 经 (C平+C平×Z实)/2×N实同×1% 传导，N实同 下降的效应更大 → 5495.33→**5339.69**；
- J账户 3706.48 不变（R储 锚定真实余额，与窗口无关）；月合计 → **9046.17**。

该演示同时验证了 §2.4 的间接影响口径：actualPaidMonths/N实同 随窗口收窄，
但缴费段数据、R储、R补 规则不变。四权威案锚点未变 → actualPaidMonths 零变化。

---

## 4. 交付物与合并提示

| 文件 | 路径 |
|---|---|
| 本设计 | `shared/wechat-automation/pension-ui-change-design-bug25-26.md`（并合并至服务器 `docs\`） |
| spec V1.8 | `/root/.openclaw/workspace/tmp-mycase/srv-docs5/specification.md`（合并至服务器 `docs\specification.md`） |
| 四案实跑脚本 | `tmp-mycase/bug25-src/run-bug25-cases.js` |
| 四案结构化结果 | `tmp-mycase/bug25-src/cases-output-v18.json` |

- 开发服务器合并：specification / design 入 `pension\docs\`；testcase 更新由测试节点按本设计 AC 另出。
- 本轮未改任何小程序源码、未跑 GUI、未 RDP、未 taskkill IDE。
