/* ST-4101 — 文件通道 vs 手工通道经同一引擎 P月差≤0.01、引擎未被替换 独立入口（testcase-structure SKILL）
 * input: 同一 My-Case basic 数据，两条通道：① 文件通道 parseCaseFile→validate→engineInput
 *        ② 手工通道 直接构造等价 pageData→buildInputLike；expect:
 *        两通道喂给同一 pensionEngine.calculate 的 P月(total)差≤0.01、三分项逐值差≤0.01（同一引擎未被替换）
 * 公共: system_test/common/st-case-lib.js；运行: node st4101-same-engine.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const E = require('../../calculator/pensionEngine.js');
const { ck, end } = L.makeChecker('ST-4101');

const BASIC_SUFFIX = '\n# 预计退休时间: 2033-07\n# 从2026-09往后的缴费性质: 失业灵活就业\n# 预计从2026-09往后每月缴费Z值: 0.6\n';
const text = L.commonBlock(L.loadFixture('My-Case.md')) + BASIC_SUFFIX;

// 通道①：文件通道（parseCaseFile -> validate -> engineInput）
const vFile = L.caseValidator.validate(L.caseFile.parseCaseFile(text), {});
ck('文件通道 canCalculate=true', vFile.canCalculate === true, String(vFile.canCalculate));

// 通道②：手工通道（同一份数据经 mapParsedToPageData -> buildInputLike，等价手工录入路径）
const pageData = L.caseValidator.mapParsedToPageData(L.caseFile.parseCaseFile(text), {});
const manualInput = L.caseValidator.buildInputLike(pageData);

const rFile = E.calculate(vFile.engineInput);
const rManual = E.calculate(manualInput);
const pF = rFile.pension, pM = rManual.pension;
ck('两通道引擎均返回 pension.total', typeof pF.total === 'number' && typeof pM.total === 'number', pF.total + '/' + pM.total);

const dTotal = Math.abs(pF.total - pM.total);
ck('文件 vs 手工 P月(total)差≤0.01（同一引擎）', dTotal <= 0.01, 'file=' + pF.total.toFixed(2) + ' manual=' + pM.total.toFixed(2) + ' diff=' + dTotal.toFixed(4));
['J基础', 'J账户', 'J过渡'].forEach(k => {
  const d = Math.abs(pF[k] - pM[k]);
  ck('两通道 ' + k + ' 逐值差≤0.01', d <= 0.01, 'file=' + pF[k].toFixed(2) + ' manual=' + pM[k].toFixed(2) + ' diff=' + d.toFixed(4));
});
// 引擎未被替换：两通道 meta.policyDataVersion 一致
ck('两通道 policyDataVersion 一致（同一引擎/政策库）', (rFile.meta || {}).policyDataVersion === (rManual.meta || {}).policyDataVersion, (rFile.meta || {}).policyDataVersion);

process.exit(end() ? 1 : 0);
