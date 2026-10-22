/* ST-4000 — compare 模式 common+3方案块解析、字段/年度记录独立核对 独立入口（testcase-structure SKILL）
 * case-specific input:  fixture=My-Case.md（compare 模式：common 块 + 3 方案块）
 * expect output:        _splitBlocks 拆出 4 块（1 common + 3 plan）；common 块独立解析得字段 8 项、年度记录 27 条；
 *                       3 个 plan 块各自独立解析出 retireYM/contributionNature/zValue 且互不串扰
 * 公共逻辑:             system_test/common/st-case-lib.js
 * 运行:                 node st4000-compare-blocks.js   （node 直跑，无 GUI）
 */
'use strict';
const L = require('../common/st-case-lib.js');
const { ck, end } = L.makeChecker('ST-4000');

// ===== case-specific input =====
const FIXTURE = 'My-Case.md';
const EXPECT_BLOCKS = 4;                  // 1 common + 3 plan
const EXPECT_COMMON_FIELDS = 8;           // birthday/workStartYM/accountStartYM/deemedStartYM/deemedEndYM/paidToYM/accountBalance/accountRate
const EXPECT_COMMON_RECORDS = 27;
const EXPECT_PLAN_COUNT = 3;

// ===== 执行 + expect 断言 =====
const raw = L.loadFixture(FIXTURE);
const blocks = L.caseFile._splitBlocks(raw);
ck('拆块数=' + EXPECT_BLOCKS + '（1 common + 3 plan）', blocks.length === EXPECT_BLOCKS, 'blocks=' + blocks.length);

// common 块独立核对
const common = L.caseFile.parseCaseFile(blocks[0].lines.join('\n'));
ck('common 块字段数=' + EXPECT_COMMON_FIELDS, Object.keys(common.fields || {}).length === EXPECT_COMMON_FIELDS, Object.keys(common.fields || {}).length);
ck('common 块年度记录=' + EXPECT_COMMON_RECORDS + ' 条', (common.records || []).length === EXPECT_COMMON_RECORDS, (common.records || []).length);
ck('common 块含 birthday=1973-07-10', (common.fields || {}).birthday === '1973-07-10', (common.fields || {}).birthday);
ck('common 块含 paidToYM=2026-08', (common.fields || {}).paidToYM === '2026-08', (common.fields || {}).paidToYM);
// 年度记录独立：首条 year=2000、逐条含 year/base/type
const r0 = (common.records || [])[0] || {};
ck('common 年度记录首条 year=2000', r0.year === 2000, JSON.stringify(r0));
ck('common 年度记录每条含 year/base/type', (common.records || []).every(r => r.year && r.base != null && r.type), 'records=' + (common.records || []).length);

// 3 个 plan 块各自独立解析（互不串扰）
const planBlocks = blocks.slice(1);
ck('plan 块数=' + EXPECT_PLAN_COUNT, planBlocks.length === EXPECT_PLAN_COUNT, planBlocks.length);
const plans = planBlocks.map(b => L.caseFile.parseCaseFile(b.lines.join('\n')));
ck('3 个 plan 块各自解析出 retireYM', plans.every(p => (p.fields || {}).retireYM), plans.map(p => (p.fields || {}).retireYM).join(','));
ck('3 个 plan 块各自解析出 zValue', plans.every(p => (p.fields || {}).zValue != null), plans.map(p => (p.fields || {}).zValue).join(','));
ck('plan1 zValue=0.6（独立不串扰）', (plans[0].fields || {}).zValue === 0.6, (plans[0].fields || {}).zValue);
ck('plan2 zValue=1.0（独立不串扰）', (plans[1].fields || {}).zValue === 1.0, (plans[1].fields || {}).zValue);
ck('plan 块不含 common 的年度记录（字段/记录隔离）', plans.every(p => (p.records || []).length === 0), plans.map(p => (p.records || []).length).join(','));

process.exit(end() ? 1 : 0);
