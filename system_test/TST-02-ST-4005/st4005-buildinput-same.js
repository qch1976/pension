/* ST-4005 — Q3 字段回填、错误补齐后仍走同一校验 buildInput 独立入口（testcase-structure SKILL）
 * input: 夹具 mapParsedToPageData -> buildInputLike；expect: buildInputLike 与 validate.engineInput
 *        走同一构造、键集完全一致；修正错误字段回填后再次 buildInputLike 仍产出同一键集
 * 公共: system_test/common/st-case-lib.js；运行: node st4005-buildinput-same.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const { ck, end } = L.makeChecker('ST-4005');

const { parsed } = L.parseFixture('My-Case.md');
const pageData = L.caseValidator.mapParsedToPageData(parsed, {});
const inp = L.caseValidator.buildInputLike(pageData);
const engineInput = L.caseValidator.validate(parsed, {}).engineInput || {};

const kInp = Object.keys(inp).sort().join(',');
const kEng = Object.keys(engineInput).sort().join(',');
ck('buildInputLike 键集 == validate.engineInput 键集（同一校验构造）', kInp === kEng, 'buildInputLike=' + Object.keys(inp).length + ' engineInput=' + Object.keys(engineInput).length);
ck('buildInputLike 含核心键 birthYM/workStartYM/retireYM/segments', ['birthYM', 'workStartYM', 'retireYM', 'segments'].every(k => k in inp), Object.keys(inp).join(','));

// Q3 字段回填：pageData 含夹具字段映射后的值，buildInputLike 正确取到
ck('birthYM 由夹具 birthday 1973-07-10 回填=1973-07', inp.birthYM === '1973-07', inp.birthYM);
ck('workStartYM=1995-07', inp.workStartYM === '1995-07', inp.workStartYM);
ck('segments 数=夹具年度记录 27', (inp.segments || []).length === 27, (inp.segments || []).length);

// 错误补齐后仍走同一校验：构造一个初始缺 retireYM 的 pageData，补齐后 buildInputLike 键集不变
const pd2 = JSON.parse(JSON.stringify(pageData)); delete pd2.retireYM;
const inp2 = L.caseValidator.buildInputLike(pd2);
ck('删 retireYM 后 buildInputLike 键集仍一致（结构稳定）', Object.keys(inp2).sort().join(',') === kInp, Object.keys(inp2).length);
pd2.retireYM = '2033-07';
const inp3 = L.caseValidator.buildInputLike(pd2);
ck('补齐 retireYM 后 buildInputLike 键集仍一致', Object.keys(inp3).sort().join(',') === kInp, Object.keys(inp3).length);
ck('补齐后 retireYM=2033-07', inp3.retireYM === '2033-07', inp3.retireYM);

process.exit(end() ? 1 : 0);
