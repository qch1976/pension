# TST-02-UT-1030 — basic/compare 同输入 ±0.001 一致（REQ-02-CAL-001 / NFR-001，BUG-02-0006/0007）

本 folder 归位多个同主题 UT 脚本（一脚本对多用例，放主用例 folder TST-02-UT-1030，B-0 口径）：

| 脚本 | 覆盖 |
|---|---|
| compare-result-model-check.js | 比较结果视图模型（buildView/buildViewSafe）逐值/容错 |
| plan-model-check.js | 方案输入模型（起始月/资格） |
| plan-assembler-check.js | 方案装配（自动段首月/退休前一月） |
| plan-dedup-check.js | 方案去重 |
| payback-check.js | 回本年模型 |
| roi-check.js | ROI 模型 |
| r-contribution-check.js | R补=Z补贴 贡献 |

> 主用例：basic/compare 同输入 ±0.001 一致（UT-1030）。关联 BUG-02-0006/0007。
