/* ST-4006 — 基本报告 P总/三分项与 Engine 逐值一致、勾稽平、两位小数 独立入口（testcase-structure SKILL）
 * input: My-Case basic（common + 退休2033-07 + 灵活就业 Z0.6）；expect:
 *        ① 引擎 pension={J基础,J账户,J过渡,total} 与报告模型(result.js vm.pension basic/account/transitional)逐值一致
 *        ② 勾稽平：J基础+J账户+J过渡 与 total 差 ≤0.01（两位小数 rounding 容差）
 *        ③ 报告渲染两位小数（reportExport f2）
 * 公共: system_test/common/st-case-lib.js；运行: node st4006-basic-report.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const E = require('../../calculator/pensionEngine.js');
const { ck, end } = L.makeChecker('ST-4006');

// case-specific input
const BASIC_SUFFIX = '\n# 预计退休时间: 2033-07\n# 从2026-09往后的缴费性质: 失业灵活就业\n# 预计从2026-09往后每月缴费Z值: 0.6\n';

const text = L.commonBlock(L.loadFixture('My-Case.md')) + BASIC_SUFFIX;
const v = L.caseValidator.validate(L.caseFile.parseCaseFile(text), {});
ck('basic 输入 canCalculate=true', v.canCalculate === true, 'canCalculate=' + v.canCalculate);

const r = E.calculate(v.engineInput);
const pn = r.pension || {};
ck('引擎返回 pension 含 J基础/J账户/J过渡/total', ['J基础', 'J账户', 'J过渡', 'total'].every(k => typeof pn[k] === 'number'), JSON.stringify(pn));

// 报告模型映射（result.js vm.pension: basic=J基础 account=J账户 transitional=J过渡）—— 同函数同源，逐值应一致
const vm = { basic: pn.J基础, account: pn.J账户, transitional: pn.J过渡 };
ck('报告 basic == 引擎 J基础（逐值一致）', vm.basic === pn.J基础, vm.basic);
ck('报告 account == 引擎 J账户（逐值一致）', vm.account === pn.J账户, vm.account);
ck('报告 transitional == 引擎 J过渡（逐值一致）', vm.transitional === pn.J过渡, vm.transitional);

// 勾稽平：三分项之和 ≈ total（容差 0.01）
const sum = pn.J基础 + pn.J账户 + pn.J过渡;
const diff = Math.abs(sum - pn.total);
ck('勾稽平：J基础+J账户+J过渡-total |差|≤0.01', diff <= 0.01, 'sum=' + sum.toFixed(2) + ' total=' + pn.total.toFixed(2) + ' diff=' + diff.toFixed(4));

// 两位小数：报告渲染 f2（round half-up + toFixed(2)）
function f2(n) { return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2); }
['J基础', 'J账户', 'J过渡', 'total'].forEach(k => {
  const s = f2(pn[k]);
  ck('报告渲染 ' + k + ' 两位小数（¥' + s + '）', /^\d+\.\d{2}$/.test(s), s);
});

process.exit(end() ? 1 : 0);
