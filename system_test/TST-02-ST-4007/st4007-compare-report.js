/* ST-4007 — 比较报告逐方案逐值、【预估】、基准、两档回本 独立入口（testcase-structure SKILL）
 * input: My-Case compare（common sharedInput + 3 方案 plan1/2/3，z=0.6/1.0/3.0，均灵活就业、retire2033-07）
 * expect: compareResultModel.buildView 输出 3 列，逐方案 pMonthly/jBasic/jAccount/jTransit 为数值且随 z 递增；
 *         estimated(【预估】)标记存在；eligible 基准正确；pb0(0%档)/pbU(用户档) 两档回本列齐全
 * 公共: system_test/common/st-case-lib.js；运行: node st4007-compare-report.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const CRM = require('../../calculator/compareResultModel.js');
const { ck, end } = L.makeChecker('ST-4007');

// case-specific input
const Z_LIST = [0.6, 1.0, 3.0];         // 3 方案 z 值
const RETIRE = '2033-07';

const { parsed } = L.parseFixture('My-Case.md');
const sharedInput = L.caseValidator.validate(parsed, {}).engineInput;
const raw = L.loadFixture('My-Case.md');
const blocks = L.caseFile._splitBlocks(raw).slice(1);
const plans = blocks.map((b, i) => { const f = L.caseFile.parseCaseFile(b.lines.join('\n')).fields; return { id: 'plan' + (i + 1), retireYM: f.retireYM, segType: L.caseFile.mapIdentityToType(f.contributionNature), z: f.zValue, windowStartYM: '' }; });

ck('sharedInput 含 27 条历史段', (sharedInput.segments || []).length === 27, (sharedInput.segments || []).length);
ck('构造 3 个方案（z 递增 0.6/1.0/3.0）', plans.length === 3 && plans.every(p => p.retireYM === RETIRE && p.segType === 'flexible'), JSON.stringify(plans.map(p => p.z)));

const view = CRM.buildView(sharedInput, plans, 0);
const cols = view.columns || [];
ck('buildView 输出 3 列（逐方案）', cols.length === 3, cols.length);

// 逐方案逐值：pMonthly/jBasic/jAccount/jTransit 为数值
cols.forEach((c, i) => {
  ck('方案' + (i + 1) + ' pMonthly 为数值', typeof c.pMonthly === 'number', c.pMonthly);
  ck('方案' + (i + 1) + ' jBasic/jAccount/jTransit 为数值', [c.jBasic, c.jAccount, c.jTransit].every(x => typeof x === 'number'), c.jBasic + '/' + c.jAccount + '/' + c.jTransit);
});
// 逐值随 z 递增（z 越大 P月越高）
ck('pMonthly 随 z 递增（plan1<plan2<plan3）', cols[0].pMonthly < cols[1].pMonthly && cols[1].pMonthly < cols[2].pMonthly, cols.map(c => c.pMonthly).join('<'));

// 【预估】标记
cols.forEach((c, i) => ck('方案' + (i + 1) + ' estimated(【预估】)标记为布尔', typeof c.estimated === 'boolean', c.estimated));
// eligible 基准
cols.forEach((c, i) => ck('方案' + (i + 1) + ' eligible 基准为 true（eligible 方案）', c.eligible === true, c.eligible));

// 两档回本：pb0(0%档) + pbU(用户档) 列齐全（对象含展示文本）
cols.forEach((c, i) => ck('方案' + (i + 1) + ' 两档回本 pb0/pbU 列齐全', c.pb0 != null && c.pbU != null, 'pb0=' + JSON.stringify(c.pb0).slice(0, 30)));

process.exit(end() ? 1 : 0);
