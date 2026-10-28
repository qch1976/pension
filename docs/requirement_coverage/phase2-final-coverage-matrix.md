# Phase-2 Testcase 覆盖矩阵（final）


| Requirement ID | Requirement Brief | owner | regression | testcase ID(s) | testcase Brief | script folder+name | result | bug |
|---|---|---|---|---|---|---|---|---|
| REQ-02-SCOPE-003 | 见 testcase brief | tester | no | TST-02-GT-4010 | 基本页文件导入并显式选退休月，P月与引擎一致 | system_test/TST-02-GT-4010/gt-4010-my1.js | PASS | - |
| REQ-02-IN-003 | 见 testcase brief | tester | no | TST-02-GT-4011 | compare界面建两卡差异并出比较结果 | system_test/TST-02-GT-4011/gt-4011-my2.js | PASS | - |
| REQ-02-VAL-004 | 见 testcase brief | tester | no | TST-02-GT-4012 | compare Z=3.0上限方案可算 | system_test/TST-02-GT-4012/gt-4012-my3.js | PASS | - |
| REQ-02-NFR-004 | 见 testcase brief | tester | yes | TST-02-GT-4013 | 妻子手工录入流程零回归 | system_test/TST-02-GT-4013/gt-4013-wife1.js | PASS | - |
| REQ-02-FMT-001 | 见 testcase brief | tester | no | TST-02-GT-4014 | 结果导出.txt报告并落沙箱 | system_test/TST-02-GT-4014/gt-4014-wife4.js | PASS | - |
| REQ-02-STORE-002 | 见 testcase brief | tester | no | TST-02-GT-4015 | 分享/再导出后沙箱报告持久 | system_test/TST-02-GT-4015/gt-4015-wife6.js | PASS | - |
| REQ-02-SCOPE-003 | 见 testcase brief | tester | no | TST-02-ST-4000 | compare多块解析与字段/年度记录核对 | system_test/TST-02-ST-4000/st4000-compare-blocks.js | PASS | - |
| REQ-02-FMT-000, REQ-02-VAL-001 | 见 testcase brief | tester | no | TST-02-ST-4001 | 空/空白文件按空文件处理 | system_test/TST-02-ST-4001/st4001-empty-file.js | PASS | - |
| REQ-02-VAL-003, REQ-02-VAL-006 | 见 testcase brief | tester | no | TST-02-ST-4002 | 缺字段时列出具体缺失项 | system_test/TST-02-ST-4002/st4002-missing-fields.js | PASS | - |
| REQ-02-VAL-004 | 见 testcase brief | tester | no | TST-02-ST-4003 | 字段格式/越界逐条校验 | system_test/TST-02-ST-4003/st4003-field-validation.js | PASS | - |
| REQ-02-VAL-005 | 见 testcase brief | tester | no | TST-02-ST-4004 | 视同起止颠倒/工作早于出生拦截 | system_test/TST-02-ST-4004/st4004-deemed-workstart.js | PASS | - |
| REQ-02-IN-004, REQ-02-VAL-000 | 见 testcase brief | tester | no | TST-02-ST-4005 | 正确字段回填且复用同一校验 | system_test/TST-02-ST-4005/st4005-buildinput-same.js | PASS | - |
| REQ-02-OUT-000, REQ-02-OUT-002, REQ-02-OUT-004 | 见 testcase brief | tester | no | TST-02-ST-4006 | 基本报告与引擎逐值一致且勾稽 | system_test/TST-02-ST-4006/st4006-basic-report.js | PASS | - |
| REQ-02-OUT-001 | 见 testcase brief | tester | no | TST-02-ST-4007 | 比较报告逐值并含预估/回本 | system_test/TST-02-ST-4007/st4007-compare-report.js | PASS | - |
| REQ-02-STORE-004 | 见 testcase brief | tester | no | TST-02-ST-4008 | inputs/outputs路径与storage隔离 | system_test/TST-02-ST-4008/st4008-store-paths.js | PASS | - |
| REQ-02-NFR-003 | 见 testcase brief | tester | no | TST-02-ST-4009 | 分享取消/缺失安静降级 | system_test/TST-02-ST-4009/st4009-share-degrade.js | PASS | - |
| REQ-02-IN-001 | 见 testcase brief | tester | no | TST-02-ST-4010 | 选择取消/空tempFiles安静返回 | system_test/TST-02-ST-4010/st4010-import-cancel.js | PASS | - |
| REQ-02-SCOPE-000, REQ-02-NFR-000 | 见 testcase brief | tester | no | TST-02-ST-4100 | 静态扫描无网络API | system_test/TST-02-ST-4100/st4100-no-network.js | PASS | - |
| REQ-02-SCOPE-001, REQ-02-IN-002, REQ-02-NFR-001 | 见 testcase brief | tester | yes | TST-02-ST-4101 | 文件/手工通道同引擎结果一致 | system_test/TST-02-ST-4101/st4101-same-engine.js | PASS | - |
| REQ-02-NFR-002 | 见 testcase brief | tester | no | TST-02-ST-4102 | 解析校验性能与summary反馈 | system_test/TST-02-ST-4102/st4102-parse-perf.js | PASS | - |
| REQ-02-SCOPE-002 | 见 testcase brief | tester | no | TST-02-ST-4103 | 手工/文件输入模式切换 | system_test/TST-02-ST-4103/st4103-inputmode-toggle.js | PASS | - |
| REQ-02-SCOPE-004, REQ-02-IN-005 | 见 testcase brief | tester | no | TST-02-ST-4200 | 多数据块basic报错/compare合法 | system_test/TST-02-ST-4200/st4200-multi-blocks.js | PASS | - |
| REQ-02-VAL-002 | 见 testcase brief | tester | no | TST-02-ST-4201 | 语法错误定位到行号 | system_test/TST-02-ST-4201/st4201-syntax-lineno.js | PASS | - |
| REQ-02-FMT-001 | 见 testcase brief | tester | no | TST-02-ST-4202 | 输出纯文本UTF-8而非PDF | system_test/TST-02-ST-4202/st4202-txt-utf8.js | PASS | - |
| REQ-02-IN-003 | 见 testcase brief | tester | no | TST-02-ST-4203 | 差异项误填不阻断共用导入 | system_test/TST-02-ST-4203/st4203-diff-not-block.js | PASS | - |
| REQ-02-STORE-000 | 见 testcase brief | developer | no | TST-02-UT-1000 | 沙箱目录创建与根路径取值 | developer_test/TST-02-UT-1000/file-store-ensuredirs-check.js | PASS | - |
| REQ-02-STORE-001 | 见 testcase brief | developer | no | TST-02-UT-1001 | 文件持久化与read+write兜底 | developer_test/TST-02-UT-1001/file-store-saveinput-check.js | PASS | - |
| REQ-02-NFR-004 | 见 testcase brief | developer | no | TST-02-UT-1002 | 文件封装不影响既有storage | developer_test/TST-02-UT-1002/file-store-writeoutput-check.js | PASS | - |
| REQ-02-STORE-003 | 见 testcase brief | developer | no | TST-02-UT-1003 | 列文件/清理越界跳过 | developer_test/TST-02-UT-1003/file-store-clean-check.js | PASS | - |
| REQ-02-STORE-004, REQ-02-NFR-000 | 见 testcase brief | developer | no | TST-02-UT-1004 | 仅本地文件API且与storage隔离 | developer_test/TST-02-UT-1004/file-store-localonly-check.js | PASS | - |
| REQ-02-FMT-000 | 见 testcase brief | developer | no | TST-02-UT-1005 | compare夹具三列表解析 | developer_test/TST-02-UT-1005/casefile-parse-compare-check.js | PASS | - |
| REQ-02-IN-001 | 见 testcase brief | developer | no | TST-02-UT-1006 | chooseMessageFile取消安静返回 | developer_test/TST-02-UT-1006/caseimport-choose-cancel-check.js | PASS | - |
| REQ-02-NFR-005 | 见 testcase brief | developer | no | TST-02-UT-1007 | 纯文本自解析无三方依赖 | developer_test/TST-02-UT-1007/casefile-notext-dep-check.js | PASS | - |
| REQ-02-SCOPE-004 | 见 testcase brief | developer | no | TST-02-UT-1008 | basic单块合法/多块报错 | developer_test/TST-02-UT-1008/casefile-basic-block-check.js | PASS | - |
| REQ-02-IN-000 | 见 testcase brief | developer | no | TST-02-UT-1009 | 手工/文件模式标志切换 | developer_test/TST-02-UT-1009/casefile-mode-flag-check.js | PASS | - |
| REQ-02-VAL-000 | 见 testcase brief | developer | no | TST-02-UT-1010 | 部分导入正确回填+错误单列 | developer_test/TST-02-UT-1010/casevalidator-partial-import-check.js | PASS | - |
| REQ-02-IN-002, REQ-02-VAL-003 | 见 testcase brief | developer | no | TST-02-UT-1011 | common校验通过并可产引擎输入 | developer_test/TST-02-UT-1011/casevalidator-compare-common-check.js | PASS | - |
| REQ-02-IN-003 | 见 testcase brief | developer | no | TST-02-UT-1012 | 方案块差异字段识别并忽略 | developer_test/TST-02-UT-1012/casefile-planblock-diff-check.js | PASS | - |
| REQ-02-VAL-001 | 见 testcase brief | developer | no | TST-02-UT-1013 | 空文件/读错不可计算 | developer_test/TST-02-UT-1013/casevalidator-empty-file-check.js | PASS | - |
| REQ-02-VAL-002, REQ-02-VAL-004, REQ-02-VAL-005 | 见 testcase brief | developer | no | TST-02-UT-1014 | 语法错误行号透传 | developer_test/TST-02-UT-1014/casevalidator-lineno-check.js | PASS | - |
| REQ-02-SCOPE-000, REQ-02-FMT-001, REQ-02-OUT-004 | 见 testcase brief | developer | no | TST-02-UT-1015 | 报告视图模型审核 | developer_test/TST-02-CT-1015/viewmodel-audit.js | PASS | - |
| REQ-02-SCOPE-001, REQ-02-OUT-000, REQ-02-NFR-001 | 见 testcase brief | developer | no | TST-02-UT-1016 | 报告数值直接取自引擎 | developer_test/TST-02-CT-1016/viewmodel-mapping-check.js | PASS | - |
| REQ-02-SCOPE-003, REQ-02-OUT-001 | 见 testcase brief | developer | no | TST-02-UT-1018 | 比较报告common/方案块逐值一致 | developer_test/TST-02-UT-1018/report-export-all-check.js | PASS | - |
| REQ-02-STORE-002, REQ-02-OUT-003 | 见 testcase brief | developer | no | TST-02-UT-1021 | 分享成功且文件已先落盘 | developer_test/TST-02-UT-1021/report-share-savefile-success-check.js | PASS | - |
| REQ-02-STORE-002 | 见 testcase brief | developer | no | TST-02-UT-1022 | 分享取消不影响已落盘文件 | developer_test/TST-02-UT-1022/report-share-cancel-check.js | PASS | - |
| REQ-02-OUT-003 | 见 testcase brief | developer | no | TST-02-UT-1023 | shareFileMessage缺失安静降级 | developer_test/TST-02-UT-1023/report-share-unavailable-check.js | PASS | - |
| REQ-02-NFR-003 | 见 testcase brief | developer | no | TST-02-UT-1024 | 存电脑可用时执行/缺失降级 | developer_test/TST-02-UT-1024/report-share-disk-check.js | PASS | - |
| REQ-02-CAL-000 | 缴费起始时间动态化+缺省 | developer | no | TST-02-UT-1025 | 缺省起始月=实际末月+1 | developer_test/TST-02-UT-1025/window-start-default-check.js | PASS | BUG-02-0004 |
| REQ-02-CAL-000 | 缴费起始时间可手动编辑 | developer | no | TST-02-UT-1026 | 手改起始月贯穿自动段至退休前月 | developer_test/TST-02-UT-1026/window-start-manual-check.js | PASS | BUG-02-0004 |
| REQ-02-CAL-000, REQ-02-VAL-004 | 起始月越界校验 | developer | no | TST-02-UT-1027 | 起始月越界校验 | developer_test/TST-02-UT-1027/window-start-boundary-check.js | PASS | BUG-02-0004 |
| REQ-02-CAL-001, REQ-02-VAL-004 | 共享区记账利率解析透传 | developer | no | TST-02-UT-1028 | 共享记账利率解析透传 | developer_test/TST-02-UT-1028/shared-rate-check.js | PASS | BUG-02-0005 |
| REQ-02-CAL-001 | 继续/停保两情形接通 | developer | no | TST-02-UT-1029 | continue/stop两情形分支 | developer_test/TST-02-UT-1029/continue-stop-branch-check.js | PASS | BUG-02-0005 |
| REQ-02-CAL-001, REQ-02-NFR-001 | basic/compare 同输入±0.001一致 | developer | no | TST-02-UT-1030 | basic/compare同输入结果一致 | developer_test/TST-02-UT-1030/basic-compare-consistency-check.js | PASS | BUG-02-0006 |
| REQ-02-CAL-001, REQ-02-NFR-001 | J账随Z拉开 | developer | no | TST-02-UT-1031 | J账随Z拉开 | developer_test/TST-02-UT-1031/compare-jz-spread-check.js | PASS | BUG-02-0007 |
| REQ-02-IN-003, REQ-02-FMT-000, REQ-02-VAL-004 | 缴费表5列解析+年内起始月/身份透传（BUG-02-0010） | developer | no | TST-02-UT-1032 | 5列解析与月段起止正确 | developer_test/TST-02-UT-1032/parse-5col-monthseg-check.js | PASS | BUG-02-0010 |
| REQ-02-IN-003, REQ-02-VAL-004 | 中文缴费身份→引擎枚举唯一映射（BUG-02-0010） | developer | no | TST-02-UT-1033 | 中文缴费身份唯一映射 | developer_test/TST-02-UT-1033/identity-map-check.js | PASS | BUG-02-0010 |
| REQ-02-FMT-000, REQ-02-NFR-004 | 旧3列文件向后兼容（BUG-02-0010） | developer | no | TST-02-UT-1034 | 旧3列文件向后兼容 | developer_test/TST-02-UT-1034/legacy-3col-compat-check.js | PASS | BUG-02-0010 |
| REQ-02-SCOPE-003, REQ-02-NFR-001 | 文件比较主链路身份合法出结果+双保险兜底（BUG-02-0010） | developer | no | TST-02-UT-1035 | 主链路身份合法并出结果 | developer_test/TST-02-UT-1035/compare-pipeline-identity-check.js | PASS | BUG-02-0010 |
| REQ-02-NFR-003, REQ-02-NFR-004 | compare-result 坏输入不白屏容错（BUG-02-0010） | developer | no | TST-02-UT-1036 | 坏输入不白屏并可读报错 | developer_test/TST-02-UT-1036/compare-result-faulttolerance-check.js | PASS | BUG-02-0010 |
| REQ-02-CAL-000 | 缴费起始时间可手动编辑（项目主手测） | YDL | no | TST-02-MT-9000 | 手改起始月后自动段更新（手测） | （manual，无脚本） |  | - |
| REQ-02-CAL-000 | 缴费起始时间动态化+缺省（项目主手测） | YDL | no | TST-02-MT-9001 | 缺省起始月展示（手测） | （manual，无脚本） |  | - |
| REQ-02-CAL-000, REQ-02-VAL-004 | 起始月越界校验（项目主手测） | YDL | no | TST-02-MT-9002 | 越界起始月拦截（手测） | （manual，无脚本） |  | - |
| REQ-02-CAL-000 | my1 缺省起始月展示+数据层（BUG-02-0004） | tester | no | TST-02-GT-4019 | My缺省起始月数据层断言 | system_test/TST-02-GT-4019/gt4019-planstart.js | PASS | - |
| REQ-02-CAL-000 | wife5 缺省起始月=paidTo+1=2026-01（BUG-02-0004） | tester | no | TST-02-GT-4020 | wife缺省起始月=paidTo+1 | system_test/TST-02-GT-4020/gt4020-planstart-wife.js | PASS | - |
| REQ-02-CAL-000, REQ-02-VAL-004 | 起始月边界/越界数据层（BUG-02-0004/0009 修复复测） | tester | no | TST-02-GT-4021 | 起始月边界/越界修复复测 | system_test/TST-02-GT-4021/gt-4021-task75.js | PASS 13/13 | BUG-02-0009 |
| REQ-02-CAL-001, REQ-02-NFR-001 | 利率0%×Z0.6 compare 结果（0005/0006） | tester | yes | TST-02-GT-4022 | 利率0%×Z0.6比较结果 | system_test/TST-02-GT-4022/gt-4022.js | PASS 3/3 | - |
| REQ-02-CAL-001, REQ-02-NFR-001 | 利率0%×Z3.0 compare 结果（0005/0006/0007） | tester | yes | TST-02-GT-4023 | 利率0%×Z3.0比较结果 | system_test/TST-02-GT-4023/gt-4023.js | PASS 3/3 | - |
| REQ-02-CAL-001, REQ-02-NFR-001 | 利率1.5%×Z0.6 compare 结果（0005/0006） | tester | yes | TST-02-GT-4024 | 利率1.5%×Z0.6比较结果 | system_test/TST-02-GT-4024/gt-4024.js | PASS 3/3 | - |
| REQ-02-CAL-001, REQ-02-NFR-001 | 利率1.5%×Z3.0 compare 结果（0005/0006/0007） | tester | yes | TST-02-GT-4025 | 利率1.5%×Z3.0比较结果 | system_test/TST-02-GT-4025/gt-4025.js | PASS 3/3 | - |
| REQ-02-CAL-001, REQ-02-VAL-004 | 共享利率缺省/0/25%越界解析透传（0005） | tester | no | TST-02-GT-4026 | 共享利率缺省/0/越界解析 | system_test/TST-02-GT-4026/gt-4026.js | PASS | - |
| REQ-02-NFR-001, REQ-02-SCOPE-003 | basic/compare 同输入两路径±0.001（0006） | tester | yes | TST-02-GT-4027 | basic/compare两路径结果一致 | system_test/TST-02-GT-4027/gt-4027.js | PASS 4/4 | - |
| REQ-02-CAL-001, REQ-02-NFR-001 | compare 三卡 J账随Z拉开>100（0007） | tester | no | TST-02-GT-4028 | 三卡J账随Z拉开 | system_test/TST-02-GT-4028/gt-4028.js | PASS 6/6 | - |
| REQ-02-CAL-001, REQ-02-NFR-004 | continue/stop 两情形接通+GUI零回归（0005/0007） | tester | yes | TST-02-GT-4029 | continue/stop接通且零回归 | system_test/TST-02-GT-4029/gt-4029.js | PASS | BUG-02-0010 |
| REQ-02-NFR-003, REQ-02-NFR-004 | compile 门禁+四页无报错渲染（⑨） | tester | yes | TST-02-GT-4030 | compile门禁与四页无报错渲染 | system_test/TST-02-GT-4030/gt-4030.js | PASS 12/12 | - |
| REQ-02-IN-003, REQ-02-VAL-004, REQ-02-FMT-000 | 缴费表5列（年内起始月份+缴费身份）解析/中文身份映射/旧3列向后兼容（BUG-02-0010 修复） | tester | no | TST-02-GT-4031 | 5列解析/身份映射/旧3列兼容 | system_test/TST-02-GT-4031/gt-4031.js | PASS | BUG-02-0010 |
| REQ-02-CAL-000, REQ-02-VAL-004 | 文件导入后未触碰卡 retireYM 随真实 ctx 法定值刷新/手选保护（BUG-02-0008 修复复测） | tester | no | TST-02-GT-4032 | 未触碰卡退休月刷新与手选保护 | system_test/TST-02-GT-4032/gt-4032-task78.js | PASS 33/33 | BUG-02-0008 |

> E7 六个 GUI 场景每个含 9 项 DOM/断言检查，共 54 项 GUI 断言全部 PASS（summary.json：6 pass / 0 fail）。
