/* ST-4001 — 空串/纯空白按空文件处理 独立入口（testcase-structure SKILL）
 * input: 空串 '' 与纯空白 '   \n  \n'；expect: parseCaseFile 均按空文件处理（ok=false、errors 含「文件为空或不可读」、不产生 fields/records）
 * 公共: system_test/common/st-case-lib.js；运行: node st4001-empty-file.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const { ck, end } = L.makeChecker('ST-4001');

const CASES = [['空串', ''], ['纯空白', '   \n  \n   \n'], ['仅换行', '\n\n\n']];
for (const [tag, text] of CASES) {
  const p = L.caseFile.parseCaseFile(text);
  ck(tag + ' 按空文件处理 ok=false', p.ok === false, 'ok=' + p.ok);
  ck(tag + ' errors 含「文件为空或不可读」', (p.errors || []).some(e => /为空|不可读/.test(e.reason || '')), JSON.stringify(p.errors));
  ck(tag + ' 不产生 fields', Object.keys(p.fields || {}).length === 0, JSON.stringify(p.fields));
  ck(tag + ' 不产生 records', (p.records || []).length === 0, 'records=' + (p.records || []).length);
}
process.exit(end() ? 1 : 0);
