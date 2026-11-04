# MT-9005 / BUG-02-0019 tester 独立 GUI 取证证据（task-105；fixed 非终态）

- 时间：2026-11-04 12:42 GMT+8（UTC 04:42）
- 脚本：`system_test/TST-02-MT-9005/mt9005-gui.js`（linear 独立入口，node --check 过）
- 投递：PensionGuiRun job 进 session 2，40215，baseline=`task105-r4`；job result code=0
- 夹具：`docs/customer_usecases/e7-wife4.txt`（生日 1981-07-02、预计退休 2031-07、Z=3.0、**无性别字段**）
- tester worker4 独立取值（不引用 developer 回显）。机读结果 `logs/result-MT9005-0019.json`；3 张 mp.screenshot 原生证据图。
- 上游修复：commit `001ce27`，`calculator/retireSchedule.js flexibleRange` 下限由 `max(orig,stat-36)` 改为直接取原法定月 `orig`（已在权威仓核对）。

## 18/18 PASS（fail=0，exit0，aborted=undefined）

### A 基本计算页（0018 保真 / 身份即时 / warning 不阻断）
| ID | 结论 | 实测 |
|---|---|---|
| A0 | 导入落 index、birth=1981-07 | route=index birthYM=1981-07 ✅ |
| A1 | 0018 文件 retireYM=2031-07 保留 | retireYM=2031-07 ✅ |
| A2w | 切女工即时生效、提示无 2041-07 | 法定 2034-11（延迟40月）；2031-07 属弹性范围 ✅ |
| A2c | 切女干部即时生效、下限 2036-07 无 2041-07 | 超范围（2036-07~2042-06）✅ |
| A3 | 多次切身份后 2031-07 仍保留 | retireYM=2031-07 ✅ |
| A4 | warning 不阻断计算 | onCalculate 真跳结果页，P月=**6290.19** ✅ |

### B 方案比较页（放行=startCompare 真跳结果页；拦截=红错+不跳）
| ID | 场景 | 结论 / 实测 |
|---|---|---|
| B1a/b | 女工 2031-07 | 卡无红错；startCompare **真跳结果页（放行）** ✅ |
| B2a/b/c | 女工 2031-06 | 红错下限 **2031-07**、无 2041-07；landed=**false（拦截）** ✅ |
| B3a/b | 女干部 2036-07 | 无红错；**真跳结果页（放行）** ✅ |
| B4a/b/c | 女干部 2036-06 | 红错下限 **2036-07**、无 2041-07；landed=**false（拦截）** ✅ |
| B5 | 身份即时生效 | 同值 2031-07：女工合法、女干部报 2036-07（非 2041-07）✅ |
| B6 | 男口径不回退 | 男 2041-07 无红错（合法）✅ |

女工 2031-06 红错原文：「退休年月 2031-06 早于合法下限 **2031-07**（弹性提前不低于原法定年龄且不早于 2026-09），不能比较」。
女干部 2036-06 红错原文：「退休年月 2036-06 早于合法下限 **2036-07**（弹性提前不低于原法定年龄且不早于 2026-09），不能比较」。

## 说明
- 放行/拦截的 GUI 判定以 startCompare 是否真跳 `pages/compare-result` 为准；卡片红错文案用卡片 recheck 同一纯函数 `PM.planErrors`（node 侧）独立取值（当前基础库 selectAllComponents 子卡选择器返回 0，沿用 GT-4032 既定法）。
- r1~r3 的 FAIL/ABORT 均为 tester 驱动问题：连续切身份后计算未跳页（A4）；跨场景 navigateBack 后 compare 通道取 null。已通过 A4 干净重导复刻 GT-4039 已证路径、每场景独立重进 compare、evSure 读取兜底解决；非产品缺陷。
- 🔴 本取证非终态：矩阵 MT-9005 行保持 FAIL、BUG-02-0019 保持 fixed，等项目主本人再次手测通过后才转 PASS/closed。
