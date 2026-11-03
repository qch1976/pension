# GT-4035 r5 实测原文（REQ-02-IN-008 FAIL 复现证据，task-101）

- 时间：2026-11-03 21:18:14–21:19:50 GMT+8（UTC 13:18:14–13:19:50）
- 脚本：`system_test/TST-02-GT-4035/gt-4035-base-z-twoway.js`，端口 40215，baseline=`task101-pre-fix-r5`
- 来源：逐行摘自本机 logs/run-trace.log（`*.log` 按仓库 .gitignore 不入 git，故留此 .md 存档）
- 说明：本次为干净进入 pages/index/index 后的真实交互全跑；年度模式 6/6 FAIL（缺陷，BUG-02-0022）；月度 M1 实跑 PASS，M2–M4 及 §③ 的 FAIL 为当拍读回时序假象（月度链路后经 diag-month/diag-seq/diag-route 三次独立复跑三档全对，见 BUG-02-0022 工单），非产品缺陷、不登记。

```text
2026-11-03T13:18:14.358Z WARMED pages/index/index data keys>5 in 21ms
2026-11-03T13:18:27.526Z FAIL IN008-Y1 年度模式改年缴费基数 → Z 即时刷新=1.3000（月基数/12116，4位小数） :: actual=zValue=undefined expected=1.3000
2026-11-03T13:18:27.527Z FAIL IN008-Y0 年度模式年度行存在 zValue 绑定（Z值输入框） :: actual=zValue=undefined expected=field present
2026-11-03T13:18:28.138Z FAIL IN008-Y2 年度模式 Z=0.6 → 月基数 7270（最低档取整到元） :: actual=handler=false monthly=NaN expected=7270
2026-11-03T13:18:28.748Z FAIL IN008-Y3 年度模式 Z=1.3 → 月基数 15750.8（不取整） :: actual=handler=false monthly=NaN expected=15750.8
2026-11-03T13:18:29.358Z FAIL IN008-Y4 年度模式 Z=3.0 → 月基数 36348 :: actual=handler=false monthly=NaN expected=36348
2026-11-03T13:18:29.972Z FAIL IN008-Y5 年度模式年基数 7270×12 → Z=0.6000 :: actual=zValue=undefined expected=0.6000
2026-11-03T13:18:32.174Z PASS IN008-M1 月度模式 Z=0.6 → 月基数 7270 :: actual=base=7270 expected=7270
2026-11-03T13:18:46.211Z FAIL IN008-M2 月度模式 Z=1.3 → 月基数 15750.8 :: actual=base=undefined expected=15750.8
2026-11-03T13:18:50.241Z FAIL IN008-M3 月度模式 Z=3.0 → 月基数 36348 :: actual=base=undefined expected=36348
2026-11-03T13:18:54.274Z FAIL IN008-M4 月度模式改基数 → Z 回算 1.3000 :: actual=zValue=undefined expected=1.3000
2026-11-03T13:19:06.882Z PASS IN008-P0 切月录入后 segments 由 yearRows 重建 :: actual={"ok":true,"n":27} expected=ok=true
2026-11-03T13:19:15.150Z FAIL IN008-P0b 未来段 Z=1.3 → 基数 15750.8 :: actual=base= expected=15750.8
2026-11-03T13:19:17.653Z PASS IN008-P1 基本计算结果页 ready :: actual=path=pages/result/result expected=pages/result/result
2026-11-03T13:19:17.653Z FAIL IN008-P2 基本计算 P月=14715.77 :: actual=P=12415.52 expected=14715.77
2026-11-03T13:19:47.985Z PASS IN008-P3 方案比较结果页 ready 且2列 :: actual=landed=true n=2 expected=2
2026-11-03T13:19:47.986Z PASS IN008-P4 方案比较 P月=14715.77 :: actual=P=14715.77 expected=14715.77
2026-11-03T13:19:47.987Z FAIL IN008-P5 两页 P月一致 Δ=0（<0.01） :: actual=basic=12415.52 compare=14715.77 Δ=-2300.25 expected=Δ<0.01
2026-11-03T13:19:47.989Z FAIL IN008-P6 两页三分项一致（各项 Δ<0.01） :: actual=[6154.36,5437.83,823.33] vs [8126.27,5667.88,921.62] expected=all Δ<0.01
2026-11-03T13:19:50.266Z === TST-02-GT-4035 pass=5 fail=13 ===
```

## 月度链路独立复跑（同一环境，diag 脚本不经主脚本读回，全部正确）
- Z=0.6 → baseMonthly=7270，zValue=0.6
- Z=1.3 → baseMonthly=15750.800000000001，zValue=1.3
- Z=3.0 → baseMonthly=36348，zValue=3.0
- 全程 getCurrentPages() 栈仅 ["pages/index/index"]，无导航漂移。
