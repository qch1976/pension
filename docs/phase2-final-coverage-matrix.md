# Phase-2 Testcase 覆盖矩阵（final）


| Requirement ID | Requirement Brief | owner | regression | testcase ID(s) | testcase Brief | result | bug |
|---|---|---|---|---|---|---|---|
| REQ-02-SCOPE-003 | 见 testcase brief | tester | no | TST-02-GT-4010 | my1 基本 + common/方案文件导入结果页（P月11228.94，三分项5047.20/5363.35/818.39） | PASS | - |
| REQ-02-IN-003 | 见 testcase brief | tester | no | TST-02-GT-4011 | my2 compare 差异项以界面为准 | PASS | - |
| REQ-02-VAL-004 | 见 testcase brief | tester | no | TST-02-GT-4012 | my3 compare Z=3.0 上限方案 | PASS | - |
| REQ-02-NFR-004 | 见 testcase brief | tester | yes | TST-02-GT-4013 | wife1 历史手工流程 GUI 零回归（fresh 独立用例，作为 NFR-004 测试侧唯一行） | PASS | - |
| REQ-02-FMT-001 | 见 testcase brief | tester | no | TST-02-GT-4014 | wife4 导出 .txt 报告并落沙箱 | PASS | - |
| REQ-02-STORE-002 | 见 testcase brief | tester | no | TST-02-GT-4015 | wife6 导出/分享后沙箱文件仍在（6/6，每场景9检查共54项） | PASS | - |
| REQ-02-SCOPE-003 | 见 testcase brief | tester | no | TST-02-ST-4000 | compare common+3方案块解析、字段/年度记录独立核对 | PASS | - |
| REQ-02-FMT-000, REQ-02-VAL-001 | 见 testcase brief | tester | no | TST-02-ST-4001 | 空串/纯空白按空文件处理 | PASS | - |
| REQ-02-VAL-003, REQ-02-VAL-006 | 见 testcase brief | tester | no | TST-02-ST-4002 | 缺生日/交到年月/退休均列出具体缺失字段名 | PASS | - |
| REQ-02-VAL-004 | 见 testcase brief | tester | no | TST-02-ST-4003 | 出生格式/负账户/利率越界/月数13/年份重复逐条 | PASS | - |
| REQ-02-VAL-005 | 见 testcase brief | tester | no | TST-02-ST-4004 | 视同起止颠倒、工作早于出生被拦 | PASS | - |
| REQ-02-IN-004, REQ-02-VAL-000 | 见 testcase brief | tester | no | TST-02-ST-4005 | Q3 正确字段回填、错误补齐后仍走同一校验 buildInput | PASS | - |
| REQ-02-OUT-000, REQ-02-OUT-002, REQ-02-OUT-004 | 见 testcase brief | tester | no | TST-02-ST-4006 | 基本报告 P总/三分项与 Engine 逐值一致、勾稽平、两位小数 | PASS | - |
| REQ-02-OUT-001 | 见 testcase brief | tester | no | TST-02-ST-4007 | 比较报告逐方案逐值、【预估】、基准、两档回本 | PASS | - |
| REQ-02-STORE-004 | 见 testcase brief | tester | no | TST-02-ST-4008 | inputs/outputs 固定路径、与 pension storage key 互不污染 | PASS | - |
| REQ-02-NFR-003 | 见 testcase brief | tester | no | TST-02-ST-4009 | 分享取消/缺失/存盘失败均安静降级、报告仍落盘 | PASS | - |
| REQ-02-IN-001 | 见 testcase brief | tester | no | TST-02-ST-4010 | 选择取消/空 tempFiles 安静返回、读错归不可读 | PASS | - |
| REQ-02-SCOPE-000, REQ-02-NFR-000 | 见 testcase brief | tester | no | TST-02-ST-4100 | 静态扫描 services/calculator/pages 无 wx.request/socket 等网络API | PASS | - |
| REQ-02-SCOPE-001, REQ-02-IN-002, REQ-02-NFR-001 | 见 testcase brief | tester | yes | TST-02-ST-4101 | 文件通道 vs 手工通道经同一引擎 P月差≤0.01，引擎未被替换 | PASS | - |
| REQ-02-NFR-002 | 见 testcase brief | tester | no | TST-02-ST-4102 | 34行解析+校验<500ms、提供 summary 反馈 | PASS | - |
| REQ-02-SCOPE-002 | 见 testcase brief | tester | no | TST-02-ST-4103 | 默认手工、setInputMode 按 dataset.v 切换、两选项均绑定 | PASS | - |
| REQ-02-SCOPE-004, REQ-02-IN-005 | 见 testcase brief | tester | no | TST-02-ST-4200 | basic 多数据块判「一份文件只能包含一份数据」、compare 多块合法不误报 | PASS | - |
| REQ-02-VAL-002 | 见 testcase brief | tester | no | TST-02-ST-4201 | 第2/3/4/5行各类语法错误逐条定位行号 | PASS | - |
| REQ-02-FMT-001 | 见 testcase brief | tester | no | TST-02-ST-4202 | 输出纯文本字符串、标注 .txt/UTF-8、不含 PDF | PASS | - |
| REQ-02-IN-003 | 见 testcase brief | tester | no | TST-02-ST-4203 | 误填差异项不阻断共用导入、提示以界面为准 | PASS | - |
| REQ-02-STORE-000 | 见 testcase brief | developer | no | TST-02-UT-1000 | 内存 fsm 验证 mkdir/根取 USER_DATA_PATH | PASS | - |
| REQ-02-STORE-001 | 见 testcase brief | developer | no | TST-02-UT-1001 | copyFile/writeFile 持久化、read+write 兜底 | PASS | - |
| REQ-02-NFR-004 | 见 testcase brief | developer | no | TST-02-UT-1002 | 存储封装不影响既有 storage | PASS | - |
| REQ-02-STORE-003 | 见 testcase brief | developer | no | TST-02-UT-1003 | listStoredFiles/cleanList 跳过越界 | PASS | - |
| REQ-02-STORE-004, REQ-02-NFR-000 | 见 testcase brief | developer | no | TST-02-UT-1004 | 封装仅本地文件 API、与 storage key 隔离 | PASS | - |
| REQ-02-FMT-000 | 见 testcase brief | developer | no | TST-02-UT-1005 | compare fixture（#头部+三列表）解析通过 | PASS | - |
| REQ-02-IN-001 | 见 testcase brief | developer | no | TST-02-UT-1006 | chooseMessageFile 取消安静返回 | PASS | - |
| REQ-02-NFR-005 | 见 testcase brief | developer | no | TST-02-UT-1007 | 纯文本自解析、无三方依赖 | PASS | - |
| REQ-02-SCOPE-004 | 见 testcase brief | developer | no | TST-02-UT-1008 | basic 单块合法、多块报错 | PASS | - |
| REQ-02-IN-000 | 见 testcase brief | developer | no | TST-02-UT-1009 | 模式标志切换逻辑 | PASS | - |
| REQ-02-VAL-000 | 见 testcase brief | developer | no | TST-02-UT-1010 | Q3 部分导入：正确回填+错误单列 | PASS | - |
| REQ-02-IN-002, REQ-02-VAL-003 | 见 testcase brief | developer | no | TST-02-UT-1011 | compare common 校验通过、可产出引擎输入 | PASS | - |
| REQ-02-IN-003 | 见 testcase brief | developer | no | TST-02-UT-1012 | 方案块差异字段识别忽略 | PASS | - |
| REQ-02-VAL-001 | 见 testcase brief | developer | no | TST-02-UT-1013 | 空文件/读取错误不可计算 | PASS | - |
| REQ-02-VAL-002, REQ-02-VAL-004, REQ-02-VAL-005 | 见 testcase brief | developer | no | TST-02-UT-1014 | 语法行号透传 | PASS | - |
| REQ-02-SCOPE-000, REQ-02-FMT-001, REQ-02-OUT-004 | 见 testcase brief | developer | no | TST-02-UT-1015 | 基本报告头部/纯本地生成，不触网 | PASS | - |
| REQ-02-SCOPE-001, REQ-02-OUT-000, REQ-02-NFR-001 | 见 testcase brief | developer | no | TST-02-UT-1016 | 报告数值直接取自 Engine 结果，未另算 | PASS | - |
| REQ-02-SCOPE-003, REQ-02-OUT-001 | 见 testcase brief | developer | no | TST-02-UT-1018 | 比较报告 common+方案块逐值一致 | PASS | - |
| REQ-02-STORE-002, REQ-02-OUT-003 | 见 testcase brief | developer | no | TST-02-UT-1021 | 分享成功文件已先落盘 | PASS | - |
| REQ-02-STORE-002 | 见 testcase brief | developer | no | TST-02-UT-1022 | 分享取消，已落盘文件不受影响 | PASS | - |
| REQ-02-OUT-003 | 见 testcase brief | developer | no | TST-02-UT-1023 | shareFileMessage 缺失安静降级 | PASS | - |
| REQ-02-NFR-003 | 见 testcase brief | developer | no | TST-02-UT-1024 | saveFileToDisk 可用执行/缺失安静降级 | PASS | - |
| REQ-02-CAL-000 | 缴费起始时间动态化+缺省 | developer | no | TST-02-UT-1025 | 缺省缴费起始月=实际缴费末月+1（动态，非写死） | PASS | BUG-02-0004 |
| REQ-02-CAL-000 | 缴费起始时间可手动编辑 | developer | no | TST-02-UT-1026 | 手改起始月贯穿自动段首月/止于退休前一月 | PASS | BUG-02-0004 |
| REQ-02-CAL-000, REQ-02-VAL-004 | 起始月越界校验 | developer | no | TST-02-UT-1027 | 早于历史末月/晚于退休前一月拦、留空合法 | PASS | BUG-02-0004 |
| REQ-02-CAL-001, REQ-02-VAL-004 | 共享区记账利率解析透传 | developer | no | TST-02-UT-1028 | 1.5%/缺省/0/越界，buildSharedInput透传不写死null，SHARED_KEYS含字段 | PASS | BUG-02-0005 |
| REQ-02-CAL-001 | 继续/停保两情形接通 | developer | no | TST-02-UT-1029 | continue含自动段透传利率；stop无自动段且零利率 | PASS | BUG-02-0005 |
| REQ-02-CAL-001, REQ-02-NFR-001 | basic/compare 同输入±0.001一致 | developer | no | TST-02-UT-1030 | 利率0/1.5%×Z0.6/3.0，R储/J账/P月两路径差≤0.001（实测0） | PASS | BUG-02-0006/0007 |
| REQ-02-CAL-001, REQ-02-NFR-001 | J账随Z拉开 | developer | no | TST-02-UT-1031 | compare J账 Z0.6→3.0显著拉开(>100)，不再静态相同 | PASS | BUG-02-0007 |
| REQ-02-CAL-000 | 缴费起始时间可手动编辑（项目主手测） | YDL | no | TST-02-MT-9000 | My-Case 导入后在 plan-card 用原生月滚轮（picker mode=date fields=month）把「缴费起始时间」由缺省2026-09手改为2026-10，回写后自动段首月随之改变、结果页无红字/无阻断（automator 不可达的真实滚轮点选；对 BUG-02-0004，对应 UT-1026 的手工确认） |  |  |
| REQ-02-CAL-000 | 缴费起始时间动态化+缺省（项目主手测） | YDL | no | TST-02-MT-9001 | wife5 文件导入后「缴费起始时间」缺省=实际缴费末月+1=2026-01（paidTo 2025-12+1），与 My-Case 同一缺省链路，非写死2026-09（对 BUG-02-0004 缺省侧，对应 UT-1025 的手工确认） |  |  |
| REQ-02-CAL-000, REQ-02-VAL-004 | 起始月越界校验（项目主手测） | YDL | no | TST-02-MT-9002 | 月滚轮手点越界值（早于历史末月2026-08、晚于退休前一月2033-07）应被拦截并提示，留空合法（对应 UT-1027 的手工确认） |  |  |
| REQ-02-CAL-000 | my1 缺省起始月展示+数据层（BUG-02-0004） | tester | no | TST-02-GT-4019 | 【未执行-待GUI redo回填】夹具 tests/fixtures-case/My-Case.md；脚本 t47-c-planstart.js(my，常驻 automator 口只 connect/disconnect)。entry 不填信息→compare 文件导入→plan-card 只读断言：缺省「缴费起始时间」startText=2026-09(historyEnd 2026-08+1)、windowStartYM 空、无起始月红错，自动段首月数据层=2026-09。不含原生月滚轮点选（手测归 MT-9000） |  |  |
| REQ-02-CAL-000 | wife5 缺省起始月=paidTo+1=2026-01（BUG-02-0004） | tester | no | TST-02-GT-4020 | 【未执行-待GUI redo回填】夹具 tests/fixtures-case/MyWife-Case.md；脚本 t47-c-planstart.js(wife)。导入后只读断言缺省起始月=paidTo 2025-12+1=2026-01（非写死2026-09）、windowStartYM 空、无红错。不含原生月滚轮点选（手测归 MT-9001） |  |  |
| REQ-02-CAL-000, REQ-02-VAL-004 | 起始月边界/越界数据层（BUG-02-0004） | tester | no | TST-02-GT-4021 | 【未执行-待GUI redo回填】夹具 My-Case.md；t47-c-planstart.js 只读回读 isValidPlan/errors：2026-08 拒、2026-09 合法、2033-07 合法、2033-08 拒、留空合法（历史末月2026-08/退休前月2033-07）。红点像素目视与滚轮越界点选归 MT-9002；引擎期望见 t47-parity，仅作期望值来源、不冒充本GT实测 |  |  |
| REQ-02-CAL-001, REQ-02-NFR-001 | 利率0%×Z0.6 compare 结果（0005/0006） | tester | yes | TST-02-GT-4022 | 【未执行-待GUI redo回填】夹具 My-Case.md；结果页/方案卡只读断言 compare 共享利率0%×Z=0.6 的 R储/J账/P月，期望（t47-parity.js 独立引擎，仅期望来源非本GT实测）720608.58/5184.23/12684.67；结果页像素比对待 redo |  |  |
| REQ-02-CAL-001, REQ-02-NFR-001 | 利率0%×Z3.0 compare 结果（0005/0006/0007） | tester | yes | TST-02-GT-4023 | 【未执行-待GUI redo回填】夹具 My-Case.md；利率0%×Z=3.0，compare 结果 R储/J账/P月 只读断言，parity 期望 911362.88/6556.57/15221.46（仅期望来源）；像素待 redo |  |  |
| REQ-02-CAL-001, REQ-02-NFR-001 | 利率1.5%×Z0.6 compare 结果（0005/0006） | tester | yes | TST-02-GT-4024 | 【未执行-待GUI redo回填】夹具 My-Case.md；利率1.5%×Z=0.6，R储/J账/P月 parity 期望 795690.76/5724.39/13224.83（仅期望来源）；像素待 redo |  |  |
| REQ-02-CAL-001, REQ-02-NFR-001 | 利率1.5%×Z3.0 compare 结果（0005/0006/0007） | tester | yes | TST-02-GT-4025 | 【未执行-待GUI redo回填】夹具 My-Case.md；利率1.5%×Z=3.0，R储/J账/P月 parity 期望 996432.00/7168.58/15833.47（仅期望来源）；像素待 redo |  |  |
| REQ-02-CAL-001, REQ-02-VAL-004 | 共享利率缺省/0/25%越界解析透传（0005） | tester | no | TST-02-GT-4026 | 【未执行-待GUI redo回填】夹具 My-Case.md；共享区利率输入只读/数据层：缺省1.5%透传、"0"解析为0、25%越界拒（区间0~20%）。GUI 共享区手输与拦截提示像素待 redo；t47-parity 已验解析（仅期望来源、非实测） |  |  |
| REQ-02-NFR-001, REQ-02-SCOPE-003 | basic/compare 同输入两路径±0.001（0006） | tester | yes | TST-02-GT-4027 | 【未执行-待GUI redo回填】夹具 My-Case.md；同输入分别走 basic 与 compare 结果页，只读数值断言两路径 R储/J账/P月 差≤0.001（结果页截图比对待 redo）；t47-parity 四宫格差=0.0000 仅作期望来源 |  |  |
| REQ-02-CAL-001, REQ-02-NFR-001 | compare 三卡 J账随Z拉开>100（0007） | tester | no | TST-02-GT-4028 | 【未执行-待GUI redo回填】夹具 My-Case.md；compare 建 Z=0.6/1.0/3.0 三方案，结果页只读 J账断言三档拉开>100（parity：利率0% gap 1372.34、1.5% gap 1444.19，仅期望来源）；三卡像素目视待 redo（文件导入不自动建卡，需 redo 建卡路径） |  |  |
| REQ-02-CAL-001, REQ-02-NFR-004 | continue/stop 两情形接通+GUI零回归（0005/0007） | tester | yes | TST-02-GT-4029 | 【未执行-待GUI redo回填】夹具 My-Case.md；continue（含自动段 B=Z×C、利率透传至退休前月）与 stop（无自动段、利率归零）两情形结果页只读断言 + GUI 零回归检查；像素待 redo |  |  |
| REQ-02-NFR-003, REQ-02-NFR-004 | compile 门禁+四页无报错渲染（⑨） | tester | yes | TST-02-GT-4030 | 【未执行-待GUI redo回填】脚本 autotest/compile-gate/compile-exit.js（编译门禁）+ entry/basic/compare/结果 四页导航只读检查：编译成功无报错、四页可渲染无白屏。现有 shots/ 仅记录 NO_PAGE/编译受阻现场、非通过证据，redo 后回填 |  |  |

> E7 六个 GUI 场景每个含 9 项 DOM/断言检查，共 54 项 GUI 断言全部 PASS（summary.json：6 pass / 0 fail）。
