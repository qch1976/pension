/* ST-4004 — 视同起止颠倒、工作早于出生被拦 独立入口（testcase-structure SKILL）
 * input: ① 视同缴纳起始晚于结束 ② 参加工作时间早于出生年月；expect: validate 拦截并定位字段+原因
 * 公共: system_test/common/st-case-lib.js；运行: node st4004-deemed-workstart.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const { ck, end } = L.makeChecker('ST-4004');

const HEADER = '# 生日: 1973-07-10\n# 参加工作时间: 1995-07\n# 养老保险目前交到: 2026-08\n# 预计退休时间: 2033-07\n# 个人账户金额: 1000\n# 缴费记录\n| 年份 | 基数 | 起始月 | 月数 | 身份 |\n| 2000 | 5000 | 1 | 12 | 单位 |\n';
function invalidFields(text) { const p = L.caseFile.parseCaseFile(text); const v = L.caseValidator.validate(p, {}); return { v, fields: (v.invalidOrMissing || []).map(x => x.field), reasons: (v.invalidOrMissing || []).map(x => x.reason || '') }; }

// 1) 视同起止颠倒（起始 2000-10 > 结束 1995-07）
let r = invalidFields(HEADER + '# 视同缴纳起始时间(事业单位): 2000-10\n# 视同缴纳结束时间(事业单位): 1995-07\n');
ck('视同起止颠倒被拦 ok=false', r.v.ok === false, 'ok=' + r.v.ok);
ck('视同起止颠倒定位 deemedEndYM 字段', r.fields.includes('deemedEndYM'), JSON.stringify(r.fields));
ck('视同起止颠倒原因含 起始晚于结束', r.reasons.some(s => /起始晚于结束|起始.*晚于.*结束/.test(s)), JSON.stringify(r.reasons));

// 2) 视同起止正常（不应误拦）
r = invalidFields(HEADER + '# 视同缴纳起始时间(事业单位): 1995-07\n# 视同缴纳结束时间(事业单位): 2000-10\n');
ck('视同起止正常不误拦 ok=true', r.v.ok === true, 'ok=' + r.v.ok);

// 3) 参加工作早于出生（1970-01 < 1973-07）
r = invalidFields(HEADER.replace('# 参加工作时间: 1995-07', '# 参加工作时间: 1970-01'));
ck('工作早于出生被拦 ok=false', r.v.ok === false, 'ok=' + r.v.ok);
ck('工作早于出生定位 workStartYM 字段', r.fields.includes('workStartYM'), JSON.stringify(r.fields));
ck('工作早于出生原因含 早于出生', r.reasons.some(s => /早于出生/.test(s)), JSON.stringify(r.reasons));

// 4) 参加工作正常（不早于出生）
r = invalidFields(HEADER);
ck('基线全合法 ok=true', r.v.ok === true, 'ok=' + r.v.ok);

process.exit(end() ? 1 : 0);
