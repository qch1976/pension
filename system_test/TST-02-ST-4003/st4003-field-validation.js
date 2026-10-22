/* ST-4003 — 出生格式/负账户/利率越界/月数13/年份重复逐条拦截 独立入口（testcase-structure SKILL）
 * input: 基础合法头 + 逐条注入非法字段；expect: caseValidator.validate 逐条拦截并给出具体字段+原因
 * 公共: system_test/common/st-case-lib.js；运行: node st4003-field-validation.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const { ck, end } = L.makeChecker('ST-4003');

const HEADER = '# 生日: 1973-07-10\n# 参加工作时间: 1995-07\n# 养老保险目前交到: 2026-08\n# 预计退休时间: 2033-07\n# 个人账户金额: 1000\n# 缴费记录\n| 年份 | 基数 | 起始月 | 月数 | 身份 |\n| 2000 | 5000 | 1 | 12 | 单位 |\n';
const ROW13 = '| 2000 | 5000 | 1 | 13 | 单位 |\n';                       // 月数13
const DUP = '| 2000 | 5000 | 1 | 12 | 单位 |\n| 2000 | 6000 | 1 | 5 | 单位 |\n'; // 年份重复

function invalidFields(text) { const p = L.caseFile.parseCaseFile(text); const v = L.caseValidator.validate(p, {}); return { v, fields: (v.invalidOrMissing || []).map(x => x.field), reasons: (v.invalidOrMissing || []).map(x => x.reason || '') }; }

// 1) 出生日期格式错（1973/07/10 非 YYYY-MM-DD）
let r = invalidFields(HEADER.replace('# 生日: 1973-07-10', '# 生日: 1973/07/10'));
ck('出生格式错被拦 ok=false', r.v.ok === false, 'ok=' + r.v.ok);
ck('出生格式错定位 birthday 字段', r.fields.includes('birthday'), JSON.stringify(r.fields));

// 2) 负账户
r = invalidFields(HEADER.replace('# 个人账户金额: 1000', '# 个人账户金额: -100'));
ck('负账户被拦 ok=false', r.v.ok === false, 'ok=' + r.v.ok);
ck('负账户定位 accountBalance 字段', r.fields.includes('accountBalance'), JSON.stringify(r.fields));

// 3) 利率越界 25%（> 20%）
r = invalidFields(HEADER + '# 个人账户利率: 25%\n');
ck('利率越界25%被拦 ok=false', r.v.ok === false, 'ok=' + r.v.ok);
ck('利率越界定位 accountRate 字段', r.fields.includes('accountRate'), JSON.stringify(r.fields));
ck('利率越界原因含范围提示', r.reasons.some(s => /利率|0~20|范围/.test(s)), JSON.stringify(r.reasons));

// 4) 年内缴纳月数 13
r = invalidFields(HEADER.replace('| 2000 | 5000 | 1 | 12 | 单位 |', ROW13.trim()));
ck('月数13被拦 ok=false', r.v.ok === false, 'ok=' + r.v.ok);
ck('月数13原因含 1~12 提示', r.reasons.some(s => /月数须.*1~12|1~12.*月数/.test(s)), JSON.stringify(r.reasons));

// 5) 缴费年份重复
r = invalidFields(HEADER.replace('| 2000 | 5000 | 1 | 12 | 单位 |', DUP.trim()));
ck('年份重复被拦 ok=false', r.v.ok === false, 'ok=' + r.v.ok);
ck('年份重复原因含 缴费年份重复:2000', r.reasons.some(s => /缴费年份重复/.test(s) && /2000/.test(s)), JSON.stringify(r.reasons));

// 6) 基线（全合法）应通过
r = invalidFields(HEADER);
ck('基线全合法 ok=true', r.v.ok === true, 'ok=' + r.v.ok);

process.exit(end() ? 1 : 0);
