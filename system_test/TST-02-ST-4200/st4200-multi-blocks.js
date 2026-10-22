/* ST-4200 — basic 多数据块判「一份文件只能包含一份数据」、compare 多块合法不误报 独立入口（testcase-structure SKILL）
 * input: ① basic 含 2 数据块 ② compare（common+3 plan 多块）③ basic 单数据块
 * expect: basic 多块 ok=false 报「一份文件只能包含一份数据（检测到 N 个数据块）」；
 *         compare 多块合法（不误报该错）；basic 单块不触发
 * 公共: system_test/common/st-case-lib.js；运行: node st4200-multi-blocks.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const { ck, end } = L.makeChecker('ST-4200');

// ① basic 含 2 数据块 → 报「一份文件只能包含一份数据」
const basic2 = '# 生日: 1973-07-10\n\n```\n# 生日: 1974-01-01\n```\n';
const p1 = L.caseFile.parseCaseFile(basic2);
ck('basic 含 2 数据块 ok=false', p1.ok === false, 'ok=' + p1.ok);
ck('basic 多块报「一份文件只能包含一份数据」', (p1.errors || []).some(e => /一份文件只能包含一份数据/.test(e.reason || '')), JSON.stringify(p1.errors));
ck('basic 多块标注检测块数（检测到 2 个数据块）', (p1.errors || []).some(e => /检测到 2 个数据块/.test(e.reason || '')), JSON.stringify(p1.errors));

// ② basic 含 3 数据块 → 同样拦截并标注 3
const basic3 = '# 生日: 1973-07-10\n\n```\n# 生日: 1974-01-01\n```\n\n```\n# 生日: 1975-01-01\n```\n';
const p2 = L.caseFile.parseCaseFile(basic3);
ck('basic 含 3 数据块 ok=false', p2.ok === false, 'ok=' + p2.ok);
ck('basic 3 块标注「检测到 3 个数据块」', (p2.errors || []).some(e => /检测到 3 个数据块/.test(e.reason || '')), JSON.stringify(p2.errors));

// ③ compare 模式（My-Case：common+3 plan 多块）合法，不误报「一份文件」
const { parsed: cmp } = L.parseFixture('My-Case.md');
ck('compare 多块不误报「一份文件只能包含一份数据」', !(cmp.errors || []).some(e => /一份文件只能包含一份数据/.test(e.reason || '')), JSON.stringify(cmp.errors));

// ④ basic 单数据块不触发该错
const basic1 = '# 生日: 1973-07-10\n# 参加工作时间: 1995-07\n';
const p3 = L.caseFile.parseCaseFile(basic1);
ck('basic 单数据块不触发多块错误', !(p3.errors || []).some(e => /一份文件只能包含一份数据/.test(e.reason || '')), JSON.stringify(p3.errors));

process.exit(end() ? 1 : 0);
