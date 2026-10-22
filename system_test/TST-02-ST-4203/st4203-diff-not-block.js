/* ST-4203 — 误填差异项不阻断共用导入 独立入口（testcase-structure SKILL）
 * input: compare 夹具的 common 块被误填了方案差异字段（retireYM/contributionNature/zValue 属方案级）
 * expect: 共用导入（common 校验）不因此阻断——方案级差异字段在 common 中被忽略/不计入 missingFields，
 *         common 仍 canCalculate=true（或仅提示但不阻断），不误把差异项当缺失/错误
 * 公共: system_test/common/st-case-lib.js；运行: node st4203-diff-not-block.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const { ck, end } = L.makeChecker('ST-4203');

// common 块（合法 basic 字段）+ 误填方案差异项（retireYM/zValue/contributionNature 属方案级，不应阻断 common 校验）
const common = L.commonBlock(L.loadFixture('My-Case.md'));
const polluted = common + '\n# 预计退休时间: 2033-07\n# 预计从2026-09往后每月缴费Z值: 0.6\n# 从2026-09往后的缴费性质: 失业灵活就业\n';

const v = L.caseValidator.validate(L.caseFile.parseCaseFile(polluted), {});
ck('误填方案差异项后 common validate 不阻断（canCalculate=true）', v.canCalculate === true, 'canCalculate=' + v.canCalculate);
ck('误填差异项不产生 missingFields 阻断', (v.missingFields || []).length === 0, JSON.stringify(v.missingFields));
ck('误填差异项不产生 invalidOrMissing 致命错误', (v.invalidOrMissing || []).length === 0, JSON.stringify((v.invalidOrMissing || []).map(x => x.field)));

// 方案差异字段被正确纳入 engineInput（retireYM/z 等覆盖），不视为非法
const r = require('../../calculator/pensionEngine.js').calculate(v.engineInput);
ck('含差异项的 common 可跑引擎（pension.total 为数值）', typeof (r.pension || {}).total === 'number', (r.pension || {}).total);

// 对照：真正缺关键字段（如删 paidToYM）才应阻断（验证差异项与必需项区分）
const core = L.commonBlock(L.loadFixture('My-Case.md')).replace('# 养老保险目前交到: 2026-08', '');
const v2 = L.caseValidator.validate(L.caseFile.parseCaseFile(core), {});
ck('删必需字段 paidToYM 才阻断（canCalculate=false）', v2.canCalculate === false, 'canCalculate=' + v2.canCalculate);
ck('缺失必需字段列 missingFields 含 paidToYM', (v2.missingFields || []).includes('paidToYM'), JSON.stringify(v2.missingFields));

process.exit(end() ? 1 : 0);
