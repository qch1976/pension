/* ST-4102 — 34行解析+校验<500ms、提供 summary 反馈 独立入口（testcase-structure SKILL）
 * input: My-Case common 块（≥34 行真实数据）重复解析+校验 N 轮取均值/最大值；expect:
 *        单次 parseCaseFile+validate 耗时 <500ms（性能门禁）；validate.summary 反馈存在
 * 公共: system_test/common/st-case-lib.js；运行: node st4102-parse-perf.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const { ck, end } = L.makeChecker('ST-4102');

const text = L.commonBlock(L.loadFixture('My-Case.md'));
const lineCount = text.split('\n').filter(s => s.trim()).length;
ck('样本行数≥34（真实数据量级）', lineCount >= 34, 'lines=' + lineCount);

// 性能：重复解析+校验 N 轮，取平均与最大耗时
const N = 50; const times = [];
for (let i = 0; i < N; i++) {
  const t0 = process.hrtime.bigint();
  const p = L.caseFile.parseCaseFile(text);
  L.caseValidator.validate(p, {});
  times.push(Number(process.hrtime.bigint() - t0) / 1e6); // ms
}
const avg = times.reduce((a, b) => a + b, 0) / N;
const max = Math.max(...times);
ck('单次解析+校验平均耗时 <500ms', avg < 500, 'avg=' + avg.toFixed(2) + 'ms');
ck('单次解析+校验最大耗时 <500ms', max < 500, 'max=' + max.toFixed(2) + 'ms');

// summary 反馈
const p = L.caseFile.parseCaseFile(text);
const v = L.caseValidator.validate(p, {});
ck('validate 提供 summary 反馈', v.summary != null && (typeof v.summary === 'string' ? v.summary.length > 0 : Object.keys(v.summary).length > 0), JSON.stringify(v.summary).slice(0, 80));

process.exit(end() ? 1 : 0);
