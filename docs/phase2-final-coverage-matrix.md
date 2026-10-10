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

> E7 六个 GUI 场景每个含 9 项 DOM/断言检查，共 54 项 GUI 断言全部 PASS（summary.json：6 pass / 0 fail）。
