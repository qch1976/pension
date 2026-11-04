# GT-4035 独立 GUI 终验全绿证据（task-103 · BUG-02-0022 closed · REQ-02-IN-008）

- 时间：2026-11-04 10:59:05–11:00:52 GMT+8（UTC 02:59:05–03:00:52）
- 脚本：`system_test/TST-02-GT-4035/gt-4035-linear.js`（linear-ordered，node --check 过）
- 投递：PensionGuiRun job 链进 session 2，端口 40215，baseline=`task103-day-r2`；job result code=0（fail=0）
- tester worker4 独立取值，未引用 developer 自测数字。结果机读文件：`logs/result-GT4035-IN008.json`；截图 3 张（mp.screenshot 原生）：GT4035-yearmode.png / -basic.png / -compare.png。

## 19/19 PASS（逐项，actual 为本轮 page.data / 结果页实测）
| ID | 断言 | 实测 |
|---|---|---|
| IN008-Y1 | 年基数 189009.6 → Z 1.3000 | route=index z=1.3000 ✅ |
| IN008-Y0 | 年行存在 zValue 绑定 | zValue=1.3000 ✅ |
| IN008-Y2 | 年度 Z=0.6 → 月基数 7270 | monthly=7270 ✅ |
| IN008-Y3 | 年度 Z=1.3 → 月基数 15750.8 | monthly=15750.8 ✅ |
| IN008-Y4 | 年度 Z=3.0 → 月基数 36348 | monthly=36348 ✅ |
| IN008-Y5 | 年度 87240 → Z 0.6000 | zValue=0.6000 ✅ |
| IN008-P0 | 切月 expandYearRows 重建进月态 | ok=true mode=month n=27 ✅ |
| IN008-M0 | 月态就绪 | index/entryMode=month/onSegZ+onSegBase=function ✅ |
| IN008-M1 | 月度 Z=0.6 → 7270 | baseMonthly=7270 zValue=0.6 ✅ |
| IN008-M2 | 月度 Z=1.3 → 15750.8 | baseMonthly=15750.800000000001 zValue=1.3 ✅ |
| IN008-M3 | 月度 Z=3.0 → 36348 | baseMonthly=36348 zValue=3.0 ✅ |
| IN008-M4 | 月度改基数 15750.8 → Z 1.3000 | zValue=1.3000 ✅ |
| IN008-P0b | 未来段(2026-09~2033-06) Z=1.3 → 15750.8 | baseMonthly=15750.800000000001 ✅ |
| IN008-P1 | 基本计算结果页 ready | path=pages/result/result ✅ |
| IN008-P2 | 基本页 P月=14715.77 | P=14715.77 ✅ |
| IN008-P3 | 方案比较结果页 ready 且 2 列 | landed=true n=2 ✅ |
| IN008-P4 | 比较页 P月=14715.77 | P=14715.77 ✅ |
| IN008-P5 | 两页 P月一致 Δ=0 | basic=14715.77 compare=14715.77 Δ=0 ✅ |
| IN008-P6 | 两页三分项一致 | [8126.27,5667.88,921.62] vs 同，各项 Δ=0 ✅ |

basic J=[8126.27,5667.88,921.62]；compare J=[8126.27,5667.88,921.62]。

## 过程说明（诚实记录）
- 夜间多轮 FAIL/ABORT 均为测试驱动问题，非产品：①M 段最初排在真实「切月录入」之前，页面仍年态故读 undefined；②长会话跨 evaluate jsonrpc 偶发丢拍（L.ev 5 次重试耗尽返回 null）；③二次 reLaunch 偶尔 settle 到 pages/entry/entry。
- 解决（仅改测试脚本，未改业务码）：M 段移到真实 switchToMonth(P0)+M0 就绪断言之后；handler 触发与 page.data 读回合入同一 evaluate 同 tick；新增 ensureIndex()——若停在 entry 则走产品真实 `goBasic()` 回 index 再轮询 keys>5；修脚本 mp 作用域。
- 年度 Y0~Y5 在 r1/r2/r4/r5/day-r2 多轮稳定 6/6；月度三档+反向另有独立短会话 diag-insitu 同 tick 实测佐证。
