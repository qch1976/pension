# 北京企业职工养老金测算小程序 —— Phase-2 需求规格说明书

## 文件存储与导入导出（优化输入输出）

| 项 | 内容 |
|---|---|
| 文档 | specification-phase2.md（正式需求规格，开发唯一依据，待项目主批准） |
| 版本 | V1.0（待批） |
| 日期 | 2026-10-08 |
| 作者 | Senior Wechat Software Architect YDL（p-mu45ws9mfajyky-worker2） |
| 上游依据 | INPUT-COMMON.md §Phase-2「优化输入输出」；Phase-0/Phase-1 已交付产品；docs/mycases 4 个用例（My-Case.md、MyWife-Case.md） |
| ID 规范 | REQ：`REQ-02-<模块>-<3位序号>`；TST：`TST-02-<UT/CT/ST/GT>-<4位序号>`，号段 architect 0000~0999 / developer 1000~3999 / tester 4000~9999；BUG：`BUG-02-<4位序号>`。均引用 requirement-coverage-matrix 技能（workspace 副本 md5=bf3d2c90），禁止自行编号 |
| 关闭门禁 | Phase-2 关闭前须运行技能目录 `node matrix-gate.js check specification-phase2.md <report>`，以本文 §11.1 architect initial matrix 为基线；不过不得关闭 |

---

## 1. 概述

Phase-0/1 已实现手工录入与本地计算。Phase-2 在**不改变计算引擎与结果口径**的前提下，新增**文件输入**与**文件输出（导出/分享）**能力，并解决微信小程序环境下「文件从哪来、存哪、到哪去」的问题：

- 用户可在两条既有流程（基本计算 / 方案比较）中选择 **手工输入**（沿用 Phase-0/1 界面与行为）或 **文件输入**（Phase-2 新增）。
- 输入文件采用用户在手机上**易编写**的纯文本格式（与 docs/mycases 现有用例同构）。
- 输出文件采用手机上**易查看、易转发留存**的格式，内容分别对应 Phase-0 / Phase-1 结果页。

**范围边界**：不新增任何养老金计发规则；不引入联网/服务端存储；不做账号体系；文件能力仅限本机沙箱 + 微信会话通道。超出 §Phase-2 的能力一律不做。

## 2. 范围目标（Requirements）

1. 【REQ-02-SCOPE-000】在基本计算与方案比较两条流程中，用户可选择「手工输入」或「文件输入」；选手工输入时 Phase-0/1 全流程行为与现网**零差异**（回归基线）。
2. 【REQ-02-SCOPE-001】选文件输入时，用户从微信会话中选取一份输入文件，系统解析、校验后回填/进入既有计算流程。
3. 【REQ-02-SCOPE-002】基本计算：**一份输入文件 = 一份完整数据**。
4. 【REQ-02-SCOPE-003】方案比较：**一份输入文件 = 一份共用数据（≤共享时点）**；每方案的可选项（退休年月、Z、缴费性质）仍在 Phase-1 界面填写，文件中不含方案差异项。
5. 【REQ-02-SCOPE-004】结果页支持将结果导出为文件并经微信会话分享/留存；基本计算导出内容对应 Phase-0 结果页，方案比较对应 Phase-1 结果页。

## 3. 术语与口径

沿用 Phase-0/1 术语（P月、J基础/J账户/J过渡、R续、回本月数、ROI、Z 值、C平、共享时点等），Phase-2 不新增业务术语。新增工程术语：

| 术语 | 含义 |
|---|---|
| Case 文件 | 输入文件，UTF-8 纯文本；头部为 `# 字段名: 值`，其后为缴费记录管道表；与 docs/mycases 同构 |
| 报告文件 | 输出文件，UTF-8 纯文本（人读报告），内容镜像对应结果页 |
| 沙箱 | 小程序私有可写目录 `wx.env.USER_DATA_PATH`，仅本小程序可访问 |
| 会话通道 | 经微信聊天会话取文件（`wx.chooseMessageFile`）/ 发文件（`wx.shareFileMessage`） |
| 共享时点 | 方案比较中各方案共用历史数据的截止月（如 2026-08；以文件内「养老保险目前交到」为准） |

---

## 4. 文件格式选型决策（硬性要求④）

### 4.1 输入文件：纯文本 Case 文件（`.md` / `.txt`）

| 决策维度 | 结论 |
|---|---|
| 格式名称 | UTF-8 纯文本，采用 docs/mycases 既有语法：`# <字段名>: <值>` 头部行 + Markdown 管道表（缴费记录） |
| 为什么选它 | ① 手机上任意文本编辑器/备忘录即可编写，无需安装表格软件、无二进制兼容问题；② 与项目主给定 4 个用例文件**完全同构**，零转换即可直接导入；③ 人读即懂、出错可逐行定位；④ 纯文本可被 `FileSystemManager.readFile` 直接读取、解析实现轻、体积小 |
| 读取 API | `wx.chooseMessageFile({count:1, type:'file', extension:['md','txt']})` 取临时路径 → `wx.getFileSystemManager().readFile({filePath, encoding:'utf8'})` 读取 → 服务层解析 |
| 备选（不采用） | xlsx：手机端编写门槛高、需引入解析库、增包体积与兼容风险；JSON：手机上手写易因逗号/引号出错、不友好。二者均不采用 |

### 4.2 输出文件：人读纯文本报告（`.txt`）+ 微信会话分享

| 决策维度 | 结论 |
|---|---|
| 格式名称 | UTF-8 纯文本报告（固定 `.txt`，便于微信内直接文本预览），结构化分段、金额两位小数 |
| 为什么选它 | ① 微信会话对 `.txt` 提供原生文本预览，手机点开即看、可转发到「文件传输助手」留存到电脑；② 小程序内生成纯文本零三方依赖、不增包体积；③ 内容可与结果页逐行对应 |
| 写出/导出 API | `FileSystemManager.writeFile` 写入沙箱 → `wx.shareFileMessage({filePath, fileName})` 发送到所选微信会话；`wx.saveFileToDisk` 仅在开发者工具/PC 基础库可用时作为附加入口（不依赖其存在） |
| 备选（不采用，Q1 已裁定） | PDF：手机查看体验最佳，但小程序内生成需 canvas/排版、成本与包体积高；**项目主裁定本期不做 PDF，输出仅 txt** |

> 说明：微信小程序**不能直接浏览手机公共目录**，因此「用户易获取/易留存」通过微信会话通道实现——输入来自会话、输出回到会话；沙箱仅作本程序工作区。

---

## 5. 存储位置与访问路径（硬性要求⑤）

| REQ | 需求 |
|---|---|
| REQ-02-STORE-000 | 所有持久化输入/输出工作文件存于小程序私有沙箱根 `wx.env.USER_DATA_PATH` 之下固定目录：`pension/inputs/`（导入的 Case 文件副本）、`pension/outputs/`（生成的报告文件）。目录不存在时由 `FileSystemManager.mkdir({recursive:true})` 建立 |
| REQ-02-STORE-001 | `chooseMessageFile` 返回的是临时文件路径，可能被回收；系统须在通过校验后将原文以 `FileSystemManager.copyFile`/`writeFile` 复制到 `pension/inputs/<时间戳>-<原名>` 持久保存，再进入计算 |
| REQ-02-STORE-002 | 报告文件生成于 `pension/outputs/<模式>-<YYYYMMDD-HHmmss>.txt`，随后通过 `shareFileMessage` 导出；分享成功与否不影响沙箱内已生成文件 |
| REQ-02-STORE-003 | 沙箱文件仅本小程序可访问；提供「清理已存文件」入口（仅清理 pension 子目录，`trash` 语义不可用故删除前列出清单二次确认）；存储配额受小程序沙箱上限约束（单文件与总体均远小于上限，普通文本场景不构成风险） |
| REQ-02-STORE-004 | 不写入、也不声称写入手机公共目录（如系统「下载/文档」）；不使用联网存储。手工输入模式的草稿仍沿用 Phase-0/1 既有 Storage key，与文件模式互不污染 |

---

## 6. 输入模式与界面

| REQ | 需求 |
|---|---|
| REQ-02-IN-000 | 基本计算与方案比较的输入起始处提供「手工输入 / 文件输入」二选一（默认手工，保持现网习惯） |
| REQ-02-IN-001 | 文件输入点「选择文件」→ 调 `wx.chooseMessageFile`（extension 限 md/txt）；用户取消时安静返回、不报错 |
| REQ-02-IN-002 | 基本计算文件输入：解析成功且校验通过后，携带完整一份数据进入既有 Phase-0 计算→结果页流程（等待遮罩沿用 Phase-0） |
| REQ-02-IN-003 | 方案比较文件输入：解析出的**共用数据**预置于 Phase-1 共享数据区；随后进入 Phase-1 方案输入界面，由用户照常添加 1~3 个方案的 3 项可选项并比较；文件导入不替代方案录入。**（Q6 裁定）文件中若误填「预计退休时间/缴费性质/Z值」等方案差异项 → 忽略并提示「方案差异项以界面为准」，不阻断共用数据导入** |
| REQ-02-IN-004 | 文件读入后允许用户在进入计算前**预览/再编辑**（回填到与手工模式相同的表单），编辑后按手工模式同一套校验执行；文件导入不绕过任何校验 |
| REQ-02-IN-005 | 一份文件含多于一份数据（如出现多个 `My case` 块）在基本计算模式下判定为格式错误并提示「一份文件只能包含一份数据」 |

### 6.1 Case 文件字段规范

头部字段（`# 字段名: 值`，字段名以规范清单为准、顺序可任意）：

| 字段（规范名） | 格式 | 基本计算 | 方案比较 |
|---|---|---|---|
| 生日 | YYYY-MM-DD | 必填 | 必填 |
| 预计退休时间 | YYYY-MM | 必填 | 忽略（方案差异，界面填） |
| 参加工作时间 | YYYY-MM | 必填 | 必填 |
| 首次建立养老账号 | YYYY-MM | 必填 | 必填 |
| 视同缴纳起始时间(事业单位) | YYYY-MM | 有视同则必填 | 同左 |
| 视同缴纳结束时间(事业单位) | YYYY-MM | 有视同则必填 | 同左 |
| 养老保险目前交到 | YYYY-MM | 必填（共享时点） | 必填（共享时点） |
| 个人账户金额(截至<共享时点>，不用验证) | 数字 | 必填 | 必填 |
| 个人账户利率(从<次月>到退休) | 百分比，如 1.5% | 必填 | 必填 |
| 从<次月>往后的缴费性质 | 失业灵活就业 / 企业职工 | 必填 | 忽略（方案差异，界面填） |
| 预计从<次月>往后每月缴费Z值 | 0.6~3.0 | 必填 | 忽略（方案差异，界面填） |

缴费记录表：管道表，列为 `年份 | 养老缴纳基数(年) | 年内缴纳月数`，覆盖至共享时点；解析时容忍表头分隔行与空白，仅截取三列数值。方案比较文件中此表只含共用历史段。

---

## 7. 导入校验规则（硬性要求⑥）

| REQ | 需求 |
|---|---|
| REQ-02-VAL-000 | **部分导入（Q3 裁定，取代原原子性）**：解析后，**正确的字段直接回填导入**；VAL-001~006 检测到的错误/缺失提示**必须全部显示**，错误或缺失字段允许用户在 **Phase-0/Phase-1 既有界面手工补充/修正**后继续。手工补齐后仍走与手工模式**同一套校验（含 buildInput 交叉规则），不得绕过**；正确字段不因个别错误而整体作废 |
| REQ-02-VAL-001 | 读取/编码错误（文件不可读、非 UTF-8、空文件）→ 明确提示，无法解析时不进入计算 |
| REQ-02-VAL-002 | 语法错误须**定位到行**：无法识别的头部字段、缺失冒号、表格行列数不为 3、数值列非数字等，逐条列出「第 N 行：原因」 |
| REQ-02-VAL-003 | 字段缺失：按模式（基本计算/方案比较）与「是否有视同」判定必填项；缺失时列出缺失字段名 |
| REQ-02-VAL-004 | 非法值：日期非 YYYY-MM/DD、利率越界、Z 不在 0.60~3.00、缴费性质非二值、年内月数不在 1~12、年份重复等，逐条指出 |
| REQ-02-VAL-005 | 业务交叉校验**复用 Phase-0 `buildInput` 全量规则**：时间先后（参工≤建账≤共享时点≤退休）、视同起止一致、31号文人员 hasDeemed 与视同起止、退休年月合法区间（方案差异项不在文件校验内）等；文件通道不得比手工通道更宽松 |
| REQ-02-VAL-006 | 错误以可滚动列表呈现（字段/行号 + 原因）；用户可在界面逐条补齐/修正，或返回重选文件/改走手工输入；正确部分已回填的同时明确「校验通过，共解析 N 条缴费年度/月；另有 M 项待补充」 |

---

## 8. 文件输出（导出）

| REQ | 需求 |
|---|---|
| REQ-02-OUT-000 | 基本计算结果页新增「导出/分享结果」；报告内容 = Phase-0 结果页全部信息：P月及 J基础/J账户/J过渡 三分项，以及各中间结果（Z实指数、C平、N实+同、N应缴、R储、R补、G同、G实、Z同指数等）与政策引用 |
| REQ-02-OUT-001 | 方案比较结果页新增「导出/分享结果」；报告内容 = Phase-1 结果页全部信息：各方案 P月、R续、回本月数（0% 与用户利率两列）、ROI、比较/排名及方案差异项与政策引用 |
| REQ-02-OUT-002 | 报告为纯文本、分段带标题、标注【预估】等角标与「不符合按月领取条件」等状态；数值口径/小数位与屏幕结果**完全一致**（精确到月、金额两位、指数/ROI 四位），导出不得另算 |
| REQ-02-OUT-003 | 导出流程：写沙箱 → 调 `wx.shareFileMessage` 让用户选会话发送；用户取消分享不报错、文件仍留存沙箱；导出过程显示等待反馈 |
| REQ-02-OUT-004 | 报告含生成时间、输入共享时点与模式标识，便于区分版本；不含任何账号/个人敏感信息之外的内容（本就仅本机数据） |

---

## 9. 非功能需求（NFR）

| REQ | 需求 |
|---|---|
| REQ-02-NFR-000 | **零联网**：文件读写/解析/报告生成全部本地完成，不发起任何网络请求 |
| REQ-02-NFR-001 | **不改引擎**：仅复用 `pensionEngine` 与 `buildInput`；文件模式与手工模式对同一数据必须得到同一结果（一致性 ≤0.01），输出向后兼容 |
| REQ-02-NFR-002 | 性能：常规 Case 文件（数十行）解析+校验在可感知时间内完成并给反馈；内存与沙箱占用可控 |
| REQ-02-NFR-003 | 兼容：所用 API（chooseMessageFile / shareFileMessage / FileSystemManager）在目标基础库可用；不支持 saveFileToDisk 的环境优雅降级，不影响主路径 |
| REQ-02-NFR-004 | 可测试/可复刻：文件解析、校验、报告序列化均抽为可单测的纯逻辑模块；GUI 文件选择/分享可经 miniprogram-automation 复刻（以 docs/mycases 为夹具），并保证 Phase-0/1 手工流程零回归 |
| REQ-02-NFR-005 | 包体积：文件能力不引入重型三方库（纯文本自解析），主包体积增量最小化 |

---

## 10. 接口与数据流（架构建议，供开发实现）

**建议新增模块**（产品代码内）：

| 模块 | 职责 | 主要接口（建议） |
|---|---|---|
| `services/caseFile.js` | Case 文件解析 | `parseCaseFile(text, mode)` → `{sharedData, errors[]}`；纯逻辑可 UT |
| `services/caseValidator.js` | 字段/业务校验（复用 buildInput） | `validate(parsed, mode)` → `{ok, errors[{line,field,reason}]}` |
| `services/reportExport.js` | 结果 → 纯文本报告 | `buildBasicReport(result)` / `buildCompareReport(result)` |
| `services/fileStore.js` | 沙箱目录与读写 | `saveInput/ensureDirs/writeOutput/cleanAll`，封装 FileSystemManager |
| 页面 | 输入起始模式切换、文件选择、校验结果、结果页导出按钮 | `pages/*` 增量，不新增独立页面也可（复用现有页） |

**数据流**：

- 文件输入：`chooseMessageFile`(tempPath) → `readFile`(utf8) → `parseCaseFile` → `validate`（失败→行级错误列表，终止）→ copy 到 `pension/inputs/` → 回填共享/表单 → 复用既有引擎 → 结果页。
- 文件输出：结果页 → `buildXxxReport` → `writeFile` 到 `pension/outputs/` → `shareFileMessage` 导出会话。

---

## 11. REQ 索引与覆盖矩阵

### 11.0 REQ 编号索引

| REQ ID | 简述 | 追溯 INPUT-COMMON |
|---|---|---|
| REQ-02-SCOPE-000 | 手工/文件输入二选一，手工零差异 | §Phase-2.2 |
| REQ-02-SCOPE-001 | 从会话选文件并解析进入流程 | §Phase-2.2 |
| REQ-02-SCOPE-002 | 基本计算一份文件一份数据 | §Phase-2.3 |
| REQ-02-SCOPE-003 | 方案比较一份文件一份共用数据，差异项界面填 | §Phase-2.3 |
| REQ-02-SCOPE-004 | 结果导出文件，内容对应两结果页 | §Phase-2.4 |
| REQ-02-FMT-000 | 输入纯文本 Case 文件(.md/.txt) | §Phase-2.1 |
| REQ-02-FMT-001 | 输出纯文本报告(.txt)+会话分享 | §Phase-2.1/4 |
| REQ-02-STORE-000 | 沙箱 USER_DATA_PATH/pension/{inputs,outputs} | §Phase-2.1 |
| REQ-02-STORE-001 | 临时文件复制持久化 | §Phase-2.1 |
| REQ-02-STORE-002 | 报告写沙箱再分享 | §Phase-2.4 |
| REQ-02-STORE-003 | 清理沙箱文件入口 | §Phase-2.1 |
| REQ-02-STORE-004 | 不写公共目录/不联网，草稿 key 隔离 | §Phase-2.1 |
| REQ-02-IN-000 | 输入起始模式切换 | §Phase-2.2 |
| REQ-02-IN-001 | chooseMessageFile 选择/取消 | §Phase-2.2 |
| REQ-02-IN-002 | 基本计算文件→Phase-0 流程 | §Phase-2.3 |
| REQ-02-IN-003 | 方案比较文件→共用数据+界面补方案 | §Phase-2.3 |
| REQ-02-IN-004 | 导入后预览/再编辑，不绕校验 | §Phase-2.2/3 |
| REQ-02-IN-005 | 一份文件多数据块判错 | §Phase-2.3 |
| REQ-02-VAL-000 | 部分导入：正确字段先回填，错误/缺失界面补齐 | §Phase-2.3；Q3 |
| REQ-02-VAL-001 | 读取/编码/空文件处理 | §Phase-2.3 |
| REQ-02-VAL-002 | 语法错误定位到行 | §Phase-2.3 |
| REQ-02-VAL-003 | 必填字段缺失检查 | §Phase-2.3 |
| REQ-02-VAL-004 | 非法值/范围检查 | §Phase-2.3 |
| REQ-02-VAL-005 | 复用 buildInput 业务交叉校验 | §Phase-2.3 |
| REQ-02-VAL-006 | 错误列表呈现与界面补齐/改道手工 | §Phase-2.2/3 |
| REQ-02-OUT-000 | 基本计算导出内容 | §Phase-2.4 |
| REQ-02-OUT-001 | 方案比较导出内容 | §Phase-2.4 |
| REQ-02-OUT-002 | 报告口径/小数位同屏、含角标状态 | §Phase-2.4 |
| REQ-02-OUT-003 | 写沙箱→shareFileMessage 流程 | §Phase-2.4 |
| REQ-02-OUT-004 | 报告版本/时点/模式标识 | §Phase-2.4 |
| REQ-02-NFR-000 | 零联网 | 工程约束 |
| REQ-02-NFR-001 | 不改引擎、两模式同结果 | 工程约束 |
| REQ-02-NFR-002 | 性能反馈 | 工程约束 |
| REQ-02-NFR-003 | API 兼容与降级 | 工程约束 |
| REQ-02-NFR-004 | 可单测/可复刻/GUI 回归 | 工程约束 |
| REQ-02-NFR-005 | 不引重型库、控包体积 | 工程约束 |

共 **36** 条 REQ（SCOPE5 + FMT2 + STORE5 + IN6 + VAL7 + OUT5 + NFR6 = 36）。

### 11.1 Architect Initial Matrix（初始矩阵）

> 按 requirement-coverage-matrix 技能（md5 bf3d2c90）：每条 REQ 一行；initial matrix **不设 test by、也不填 regression/testcase ID**，直接在 **owner** 列标明由谁测，取值仅 developer/tester/both；**不预判最终行数**——实际行数由 developer/tester 按真实 case 数各自增加（一个 testcase 一行、REQ ID 重复）。TST 编号按其号段：developer 1000~3999、tester 4000~9999；类型仅 UT/CT/ST/GT。

| requirement ID | req brief description | owner (developer/tester/both) |
|---|---|---|
| REQ-02-SCOPE-000 | 手工/文件输入二选一，手工流程零差异 | both |
| REQ-02-SCOPE-001 | 从会话选文件解析进入流程 | both |
| REQ-02-SCOPE-002 | 基本计算一份文件一份数据 | tester |
| REQ-02-SCOPE-003 | 方案比较文件仅共用数据、差异项界面填 | both |
| REQ-02-SCOPE-004 | 结果导出对应两结果页 | both |
| REQ-02-FMT-000 | 输入纯文本 Case 文件选型 | tester |
| REQ-02-FMT-001 | 输出纯文本报告+会话分享选型 | tester |
| REQ-02-STORE-000 | 沙箱 inputs/outputs 目录 | developer |
| REQ-02-STORE-001 | 临时文件复制持久化 | developer |
| REQ-02-STORE-002 | 报告写沙箱再分享 | developer |
| REQ-02-STORE-003 | 清理沙箱文件入口 | developer |
| REQ-02-STORE-004 | 不写公共目录/不联网、草稿隔离 | both |
| REQ-02-IN-000 | 输入起始模式切换 | developer |
| REQ-02-IN-001 | chooseMessageFile 选择/取消 | both |
| REQ-02-IN-002 | 基本计算文件→Phase-0 流程 | both |
| REQ-02-IN-003 | 方案比较文件→共用+界面补方案 | both |
| REQ-02-IN-004 | 导入后预览/再编辑不绕校验 | tester |
| REQ-02-IN-005 | 一份文件多数据块判错 | tester |
| REQ-02-VAL-000 | 部分导入：正确先回填、错误界面补齐 | both |
| REQ-02-VAL-001 | 读取/编码/空文件处理 | both |
| REQ-02-VAL-002 | 语法错误定位到行 | both |
| REQ-02-VAL-003 | 必填字段缺失检查 | both |
| REQ-02-VAL-004 | 非法值/范围检查 | both |
| REQ-02-VAL-005 | 复用 buildInput 交叉校验 | both |
| REQ-02-VAL-006 | 错误列表呈现/改道手工 | tester |
| REQ-02-OUT-000 | 基本计算导出内容 | both |
| REQ-02-OUT-001 | 方案比较导出内容 | both |
| REQ-02-OUT-002 | 报告口径同屏含角标 | tester |
| REQ-02-OUT-003 | 写沙箱→shareFileMessage | developer |
| REQ-02-OUT-004 | 报告版本/时点标识 | tester |
| REQ-02-NFR-000 | 零联网 | both |
| REQ-02-NFR-001 | 不改引擎、两模式同结果 | both |
| REQ-02-NFR-002 | 性能反馈 | tester |
| REQ-02-NFR-003 | API 兼容与降级 | developer |
| REQ-02-NFR-004 | 可单测/可复刻/GUI 回归 | both |
| REQ-02-NFR-005 | 不引重型库、控包体积 | developer |

（共 36 行 REQ；owner 汇总：both=19，developer=8，tester=9。该分布仅为基线，最终 testcase 行由开发/测试按实产出增列。）

---

## 12. 开发任务建议拆解（供 PM 排产，非自行开发）

| 序号 | 任务 | 关联 REQ | 建议验收 |
|---|---|---|---|
| E1 | fileStore 沙箱目录/读写/清理封装 | STORE-* | UT 覆盖建目录/复制/清理 |
| E2 | caseFile 解析器（头部+缴费表） | FMT-000、IN | 4 个 mycases 全解析、行级错误用例 |
| E3 | caseValidator（字段+复用 buildInput） | VAL-* | 原子性、错误定位行、与手工同口径 |
| E4 | 输入模式切换 UI + 文件选择 + 校验结果 + 回填 | SCOPE/IN | GUI 复刻、手工零回归 |
| E5 | reportExport 纯文本报告（两模式） | OUT-000~002/004 | 与结果页逐值一致 |
| E6 | 导出/分享 UI（shareFileMessage + 降级） | OUT-003、NFR-003 | 分享成功/取消均正常 |
| E7 | 门禁 + automator 文件导入导出回归脚本 | NFR-004 | matrix-gate 通过、真实截图、Phase-0/1 零回归 |

依赖：E1→E2/E3→E4/E5→E6→E7。

---

## 13. 项目主批复与技术答复（T33）

### 13.1 项目主批复决议（已并入正文）

| ID | 批复 | 落实位置 |
|---|---|---|
| Q1 | 输出仅 **txt**，不做 PDF | §4.2、REQ-02-FMT-001 |
| Q3 | **部分导入**：正确字段直接回填；错误/缺失在 Phase-0/1 界面手工补齐，补齐后仍走同一套（含 buildInput）校验 | REQ-02-VAL-000/006 |
| Q4 | 报告扩展名固定 **txt** | §4.2、REQ-02-OUT-002 |
| Q6 | 方案比较文件误填差异项 → **忽略并提示「方案差异项以界面为准」，不阻断导入** | REQ-02-IN-003 |

（原 Q2 公共目录、Q5 沙箱保留策略，以 §13.2 技术答复结论为准；Q7/Q8 为新增技术核实。）

### 13.2 技术问题核实答复（基于实测/官方文档，区分事实与推测）

#### Q2：开发者工具模拟器如何复刻微信会话选文件

- **事实**：开发者工具模拟器中调用 `wx.chooseMessageFile` 会拉起**工具自己的「选择聊天文件」面板**（非真机微信会话），需工具处于登录态、且该账号有可列出的聊天文件；无聊天文件时列表面为空。因此模拟器**不能凭空构造真机会话文件**，依赖账号数据、不稳定。
- **事实（已本地核实）**：官方自动化包 **miniprogram-automator@0.12.1** 提供 `miniProgram.mockWxMethod(method, result)`（包内 `out/MiniProgram.d.ts:27` 实测存在）。可在自动化中把 `chooseMessageFile` 桩成直接 `success({tempFilePath: <夹具路径>})`，从而**跳过原生面板**、走与真机一致的后续 readFile→解析→校验链。
- **结论/可复刻方案**：GUI 自动化不依赖真实会话面板——先把夹具 Case 文件放到沙箱（经 `FileSystemManager.writeFile` 写入，或用包内固定夹具），再 `mockWxMethod('chooseMessageFile', {tempFilePath, errMsg:'chooseMessageFile:ok'})`，用 docs/mycases 4 例复刻；`restoreWxMethod` 恢复。另对 parse/validate 做纯逻辑 UT（不需任何 wx API）。
- **推测（需在开发机最终确认）**：mockWxMethod 对 chooseMessageFile 这类需交互面板的 API 是否在当前工具版本完全生效，以开发服务器实跑为准；若个别工具版本不生效，降级方案=直接对 `services/caseFile.parseCaseFile` 喂夹具文本，仍可复刻业务链。

#### Q5：文件都走会话，沙箱是否还需保留文件

- **事实**：`chooseMessageFile` 返回的是**临时文件**，官方文件系统文档明确「临时文件仅当前生命周期保证有效，重启后不一定可用，退出后可能按 LRU 清理」。
- **利（保留）**：重新进入/重新计算/再次导出无需用户重选文件；部分导入（Q3）场景下用户跨界面补齐时，原始文件须仍可读。**弊**：占用 200MB 用户文件额度（纯文本实际极小），需提供清理。
- **推荐**：**保留输入副本与输出报告**（本规格 STORE 设计），配合「清理已存文件」入口；不做自动 LRU（纯文本量可忽略，避免误伤，如需自动上限再请项目主定）。

#### Q7：是否仍需 USER_DATA_PATH 及如何获取

- **事实（官方文档）**：`wx.env.USER_DATA_PATH` 是小程序**本地用户文件目录**根（基础库 1.7.0+），允许自定义子目录与文件名，与缓存文件合计上限 200MB；该值由运行时**自动注入**，**无需手动配置/创建**，直接读取字符串即可（真机为 `wxfile://` 协议，开发者工具为 `http://`，代码不应硬编码或假设协议）。
- **结论**：仍需要——Q3 部分导入要跨界面保留原文、导出前要先把报告落盘，临时路径会被回收，故必须落到 USER_DATA_PATH。用法：`var root = wx.env.USER_DATA_PATH;` 后拼接子路径，经 FileSystemManager 写。

#### Q8：pension 子目录从何而来

- **事实**：`wx.env.USER_DATA_PATH` 本身**不预置** pension 目录；该子目录由**小程序自己创建**。首次文件操作前调用 `FileSystemManager.mkdir({dirPath: root+'/pension/inputs', recursive:true})`（及 outputs），`recursive:true` 使上级一并创建、已存在不报错。
- **结论**：由 `services/fileStore.ensureDirs()` 在启动或首次导入/导出时惰性创建；无任何手工/服务器预置步骤。

### 13.3 §11.1 按最新 SKILL 重校结论

| 校验项 | 结论 |
|---|---|
| SKILL 版本 | workspace 副本 md5=**bf3d2c90**，为最新 |
| 表头/列数 | initial matrix 表头 `requirement ID | req brief description | owner`（3 列），已取消 test by、直接用 owner；合法 |
| owner 取值 | 36 行取值均 ∈ {developer,tester,both}，无空/非法 |
| 行数对应 | matrix 36 行 ↔ §11.0 REQ 索引 36 条，一一对应（REQ index 经门禁解析=36） |
| owner 汇总 | both=19、developer=8、tester=9（合计 36） |
| 门禁实测 | 运行 `matrix-gate.js check`：成功解析 initial matrix，`REQ requiring cases=36`、owner=both 正确展开为 developer+tester 两侧；此刻无 final matrix，故 "testcase coverage matrix not found" 及覆盖缺失报错**属预期**，不影响“initial matrix 解析正确”的结论。报告留存 matrix-gate-t33.txt |

**总结**：initial matrix 结构/取值/勾稽全部合规；待开发/测试产出用例并回填 final matrix 后，门禁覆盖项方可转 PASS。

---

## 14. 待裁定问题清单（已批复）

> Q1~Q6 已于 2026-10-09 由项目主批复，决议与落实见 §13.1；Q7/Q8 技术核实见 §13.2。暂无新增待裁定项。
