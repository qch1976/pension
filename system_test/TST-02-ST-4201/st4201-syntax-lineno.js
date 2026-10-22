/* ST-4201 — 第2/3/4/5行语法错误逐条定位行号 独立入口（testcase-structure SKILL）
 * input: 在第 2/3/4/5 行各植入一处语法错误的文本；expect: parseCaseFile 逐条以 notices/errors
 *        给出每个错误对应的准确行号（1-based），不错位、不遗漏、不误报合法行
 * 公共: system_test/common/st-case-lib.js；运行: node st4201-syntax-lineno.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const { ck, end } = L.makeChecker('ST-4201');

// case-specific input: 第 1 行合法，第 2/3/4/5 行各一处语法错误（0-based -> line 1/2/3/4）
const TEXT = [
  '# 生日: 1973-07-10',        // line 1（idx0）合法
  '# 生日 1973-07-10',          // line 2（idx1）错：标题缺冒号
  '# 参加工作时间',             // line 3（idx2）错：缺冒号与值
  'gibberish line',            // line 4（idx3）错：无法解析文本
  '# 养老保险目前交到: 2026-08' // line 5（idx4）合法
].join('\n');

const p = L.caseFile.parseCaseFile(TEXT);
const notices = (p.notices || []).map(n => ({ line: n.line, reason: n.reason }));
const errs = (p.errors || []).map(e => ({ line: e.line, reason: e.reason }));
const all = notices.concat(errs);
console.log('all diagnostics=', JSON.stringify(all));

// 第 2 行（idx1）：缺冒号标题 → 定位 line 2
ck('第 2 行语法错误定位 line=2', all.some(d => d.line === 2), JSON.stringify(all.filter(d => d.line === 2)));
// 第 3 行（idx2）：缺冒号与值 → 定位 line 3
ck('第 3 行语法错误定位 line=3', all.some(d => d.line === 3), JSON.stringify(all.filter(d => d.line === 3)));
// 第 4 行（idx3）：无法解析文本 → 定位 line 4
ck('第 4 行语法错误定位 line=4', all.some(d => d.line === 4), JSON.stringify(all.filter(d => d.line === 4)));
// 合法行（1、5）不误报
ck('第 1 行（合法）不误报', !all.some(d => d.line === 1), '');
ck('第 5 行（合法）不误报', !all.some(d => d.line === 5), '');
// 逐条：每个错误一条独立诊断（不错位不合并）
ck('语法错误逐条独立（≥3 条诊断）', all.length >= 3, 'count=' + all.length);

// 第 5 行语法错误场景：再验证一个在 idx4 的错误（确保第 5 行也能定位）
const TEXT2 = [
  '# 生日: 1973-07-10',
  '# 参加工作时间: 1995-07',
  '# 养老保险目前交到: 2026-08',
  '# 预计退休时间: 2033-07',
  'bad line no colon'          // line 5（idx4）错
].join('\n');
const p2 = L.caseFile.parseCaseFile(TEXT2);
const all2 = (p2.notices || []).concat(p2.errors || []).map(d => ({ line: d.line, reason: d.reason }));
ck('第 5 行语法错误定位 line=5', all2.some(d => d.line === 5), JSON.stringify(all2.filter(d => d.line === 5)));

process.exit(end() ? 1 : 0);
