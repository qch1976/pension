/* ST-4002 — 缺生日/交到年月/退休均列出具体缺失字段名 独立入口（testcase-structure SKILL）
 * input: 仅含参加工作时间的残缺文本；expect: caseValidator.validate 的 missingFields/invalidOrMissing
 *        列出具体缺失字段名（birthday/paidToYM/retireYM），canCalculate=false
 * 公共: system_test/common/st-case-lib.js；运行: node st4002-missing-fields.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const { ck, end } = L.makeChecker('ST-4002');

// case-specific input: 缺 birthday/paidToYM/retireYM
const TEXT = '# 参加工作时间: 1995-07\n';
const EXPECT_MISSING = ['birthday', 'paidToYM', 'retireYM'];

const p = L.caseFile.parseCaseFile(TEXT);
const v = L.caseValidator.validate(p, {});
ck('validate ok=false（有缺失）', v.ok === false, 'ok=' + v.ok);
ck('canCalculate=false', v.canCalculate === false, 'canCalculate=' + v.canCalculate);
const missing = v.missingFields || [];
for (const f of EXPECT_MISSING) {
  ck('missingFields 含缺失字段名 ' + f, missing.includes(f), JSON.stringify(missing));
}
ck('invalidOrMissing 含 birthday', (v.invalidOrMissing || []).some(x => (x.field || x) === 'birthday'), JSON.stringify(v.invalidOrMissing));
ck('invalidOrMissing 含 paidToYM', (v.invalidOrMissing || []).some(x => (x.field || x) === 'paidToYM'), JSON.stringify(v.invalidOrMissing));
ck('invalidOrMissing 含 retireYM', (v.invalidOrMissing || []).some(x => (x.field || x) === 'retireYM'), JSON.stringify(v.invalidOrMissing));
ck('invalidOrMissing 每条含具体缺失原因 reason', (v.invalidOrMissing || []).every(x => x.reason), JSON.stringify(v.invalidOrMissing).slice(0, 80));

// 逐项补齐后缺失字段名随之减少（验证列名精确指向）
const p2 = L.caseFile.parseCaseFile('# 生日: 1973-07-10\n# 参加工作时间: 1995-07\n');
const v2 = L.caseValidator.validate(p2, {});
ck('补 birthday 后 missingFields 不含 birthday', !(v2.missingFields || []).includes('birthday'), JSON.stringify(v2.missingFields));
ck('补 birthday 后仍缺 paidToYM/retireYM', (v2.missingFields || []).includes('paidToYM') && (v2.missingFields || []).includes('retireYM'), JSON.stringify(v2.missingFields));

process.exit(end() ? 1 : 0);
