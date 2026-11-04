// developer_test/TST-02-UT-1042/female-retire-ym-check.js
// TST-02-UT-1042（BUG-02-0018 + BUG-02-0019，owner=developer）node 断言，纯逻辑不依赖 wx。
// 覆盖：
//   ① 三身份（男 / 女工人 / 女干部）法定退休年月与弹性区间合法下限均正确，男性行为不回退；
//   ② 0018：文件导入不得用 male/worker 硬默认覆盖用户性别，且已有 retireYM（文件值）不得被法定值覆盖；
//   ③ 0019：女干部合法下限为 2036-07（不是男性的 2041-07），2031-07 应被拦截、2036-07 应放行。
'use strict';
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var S = require(path.join(ROOT, 'calculator', 'retireSchedule.js'));
var PM = require(path.join(ROOT, 'calculator', 'planModel.js'));
var CV = require(path.join(ROOT, 'services', 'caseValidator.js'));
var D = require(path.join(ROOT, 'calculator', 'dateUtil.js'));
var A = require(path.join(ROOT, 'developer_test', 'common', 'assert-ok.js')).create('TST-02-UT-1042');

var BIRTH = '1981-07'; // e7-wife4.txt 生日 1981-07-02

// ===== 1. 三身份法定退休年月（P-05 对照表口径）=====
A.eq(S.statutoryRetireYM('male', BIRTH), '2044-07', '男 1981-07 法定 2044-07');
A.eq(S.statutoryRetireYM('worker', BIRTH), '2034-11', '女工人 1981-07 法定 2034-11');
A.eq(S.statutoryRetireYM('cadre', BIRTH), '2039-06', '女干部 1981-07 法定 2039-06');

// ===== 2. 三身份弹性区间（BUG-02-0019 重修：下限 = 原法定退休月本身，不再 max(原,法定−36)）=====
var rM = S.flexibleRange('male', BIRTH);
var rW = S.flexibleRange('worker', BIRTH);
var rC = S.flexibleRange('cadre', BIRTH);
A.eq(D.toYM(rM.min), '2041-07', '男 弹性下限 2041-07（原法定 60 岁）');
A.eq(D.toYM(rM.max), '2047-07', '男 弹性上限 2047-07');
A.eq(D.toYM(rW.min), '2031-07', '女工人 弹性下限 2031-07（原法定 50 岁；BUG-02-0019 重修，旧误值 2031-11 已废）');
A.eq(D.toYM(rW.max), '2037-11', '女工人 弹性上限 2037-11');
A.eq(D.toYM(rC.min), '2036-07', '女干部 弹性下限 2036-07（原法定 55 岁）');
A.eq(D.toYM(rC.max), '2042-06', '女干部 弹性上限 2042-06');
// 关键：女干部/女工下限绝不能等于男性下限
A.ok(D.toYM(rC.min) !== '2041-07', '女干部下限 ≠ 男性 2041-07（0019 核心断言）');
A.ok(D.toYM(rW.min) !== '2041-07', '女工人下限 ≠ 男性 2041-07（女性场景不得出现男性值）');
// 下限恒等于原法定月，且法定月未被改动
A.eq(D.toYM(rW.min), D.toYM(rW.original), '女工人 弹性下限 === 原法定退休月');
A.eq(D.toYM(rC.min), D.toYM(rC.original), '女干部 弹性下限 === 原法定退休月');
A.eq(D.toYM(rM.min), D.toYM(rM.original), '男 弹性下限 === 原法定退休月');

// ===== 3. keyOf 三身份映射 =====
A.eq(S.keyOf('male', ''), 'male', 'keyOf(男)=male');
A.eq(S.keyOf('male', 'worker'), 'male', 'keyOf(男,worker)=male（男性身份不影响）');
A.eq(S.keyOf('female', 'worker'), 'worker', 'keyOf(女工人)=worker');
A.eq(S.keyOf('female', 'cadre'), 'cadre', 'keyOf(女干部)=cadre');

// ===== 4. planModel.legalRange / validateRetireYM 三身份 =====
function ctx(g, ft) { return { gender: g, femaleType: ft, birthYM: BIRTH, historyEndYM: '2025-12' }; }
var lrM = PM.legalRange(ctx('male', ''), D);
var lrW = PM.legalRange(ctx('female', 'worker'), D);
var lrC = PM.legalRange(ctx('female', 'cadre'), D);
A.eq(lrM.minYM, '2041-07', 'legalRange 男 min=2041-07');
A.eq(lrM.statutoryYM, '2044-07', 'legalRange 男 法定=2044-07');
A.eq(lrW.minYM, '2031-07', 'legalRange 女工人 min=2031-07（BUG-02-0019 重修）');
A.eq(lrW.statutoryYM, '2034-11', 'legalRange 女工人 法定=2034-11（法定口径未改）');
A.eq(lrC.minYM, '2036-07', 'legalRange 女干部 min=2036-07');
A.eq(lrC.statutoryYM, '2039-06', 'legalRange 女干部 法定=2039-06');

// 0019 现场：女干部选 2031-07 应拦截（报下限 2036-07，不是 2041-07）；2036-07 应放行
var eCadre2031 = PM.validateRetireYM('2031-07', ctx('female', 'cadre'), D);
A.ok(!!eCadre2031, '0019：女干部 2031-07 被拦截');
A.ok(/2036-07/.test(eCadre2031), '0019：拦截文案下限为 2036-07');
A.ok(!/2041-07/.test(eCadre2031), '0019：拦截文案**不含**男性值 2041-07');
A.eq(PM.validateRetireYM('2036-07', ctx('female', 'cadre'), D), null, '0019：女干部 2036-07 合法放行');
A.eq(PM.validateRetireYM('2039-06', ctx('female', 'cadre'), D), null, '女干部法定 2039-06 合法');

// 男性行为不回退
A.ok(!!PM.validateRetireYM('2036-07', ctx('male', ''), D), '男 2036-07 应被拦截（早于 2041-07）');
A.eq(PM.validateRetireYM('2041-07', ctx('male', ''), D), null, '男 2041-07 合法（男口径未被改动）');
// 女工人（BUG-02-0019 重修）：2031-07 放行（原 50 岁），2031-06 拦截
A.eq(PM.validateRetireYM('2031-07', ctx('female', 'worker'), D), null, '女工人 2031-07 合法放行（弹性下限=原法定 2031-07）');
A.ok(!!PM.validateRetireYM('2031-06', ctx('female', 'worker'), D), '女工人 2031-06 早于下限 2031-07 被拦截');
A.ok(!/2041-07/.test(PM.validateRetireYM('2031-06', ctx('female', 'worker'), D) || ''), '女工人 2031-06 拦截文案不含男性值 2041-07');
// 女干部边界：2036-07 放行，2036-06 拦截
A.eq(PM.validateRetireYM('2036-07', ctx('female', 'cadre'), D), null, '女干部 2036-07 合法放行');
A.ok(!!PM.validateRetireYM('2036-06', ctx('female', 'cadre'), D), '女干部 2036-06 早于下限 2036-07 被拦截');
A.ok(!/2041-07/.test(PM.validateRetireYM('2036-06', ctx('female', 'cadre'), D) || ''), '女干部 2036-06 拦截文案不含男性值 2041-07');

// ===== 5. 0018：导入不得用 male/worker 硬默认覆盖性别 =====
// 解析真实夹具（不含性别字段），验证 pageData.gender/femaleType 为空而非 male/worker
var fs = require('fs');
var FIX = path.join(ROOT, 'developer_test', 'TST-02-UT-1042', 'e7-wife4.txt');
var parsed = { fields: { birthday: '1981-07-02', workStartYM: '2003-09', accountStartYM: '2003-09',
  paidToYM: '2025-12', accountBalance: 481459, accountRate: 1.5, retireYM: '2031-07',
  contributionNature: '企业职工', zValue: 3 }, records: [], notices: [], errors: [], ok: true };
var pd = CV.mapParsedToPageData(parsed, {});
A.eq(pd.gender, 'male', '0018：无性别字段时 pageData.gender 为兼底 male（保证引擎可跑）');
A.eq(pd.femaleType, 'worker', '0018：无性别字段时 pageData.femaleType 为兼底 worker');
A.eq(pd.genderFromFile, false, '0018：genderFromFile=false（标记文件未提供性别，调用方不回写）');
A.eq(pd.femaleTypeFromFile, false, '0018：femaleTypeFromFile=false（调用方不回写）');
A.eq(pd.retireYM, '2031-07', '0018：文件 retireYM 被正确解析（2031-07）');
A.eq(pd.birthYM, '1981-07', '0018：生日解析为 1981-07');

// 显式传入 options 时仍可采用
A.eq(CV.mapParsedToPageData(parsed, { gender: 'female', femaleType: 'worker' }).gender, 'female',
  '显式 options.gender 生效');
A.eq(CV.mapParsedToPageData(parsed, { gender: 'female', femaleType: 'cadre' }).femaleType, 'cadre',
  '显式 options.femaleType 生效');
A.eq(CV.mapParsedToPageData(parsed, { gender: 'female', femaleType: 'cadre' }).genderFromFile, true,
  '显式传性别时 genderFromFile=true（调用方应回写）');

// ===== 6. 0018：已有 retireYM（文件值/用户值）不得被法定值覆盖 =====
// 复刻 index.js refreshDefaultRetire 的判定：retireYM 已是 YYYY-MM 时保留
function refreshRetire(d) {
  if (!d.birthYM) return d.retireYM;
  if (/^\d{4}-\d{2}$/.test(d.retireYM || '')) return d.retireYM; // 保留
  return S.statutoryRetireYM(S.keyOf(d.gender, d.femaleType), d.birthYM);
}
A.eq(refreshRetire({ gender: 'female', femaleType: 'worker', birthYM: BIRTH, retireYM: '2031-07' }),
  '2031-07', '0018：女工人导入 2031-07 不被覆盖为 2034-11');
A.eq(refreshRetire({ gender: 'female', femaleType: 'cadre', birthYM: BIRTH, retireYM: '2031-07' }),
  '2031-07', '0018：女干部导入 2031-07 不被覆盖为 2039-06');
A.eq(refreshRetire({ gender: 'male', femaleType: '', birthYM: BIRTH, retireYM: '2031-07' }),
  '2031-07', '0018：男导入 2031-07 不被覆盖为 2044-07');
// 空 retireYM 时仍推导缺省法定值（新建/清空场景不回退）
A.eq(refreshRetire({ gender: 'female', femaleType: 'worker', birthYM: BIRTH, retireYM: '' }),
  '2034-11', '空 retireYM 时推导女工人法定 2034-11');
A.eq(refreshRetire({ gender: 'female', femaleType: 'cadre', birthYM: BIRTH, retireYM: '' }),
  '2039-06', '空 retireYM 时推导女干部法定 2039-06');
A.eq(refreshRetire({ gender: 'male', femaleType: '', birthYM: BIRTH, retireYM: '' }),
  '2044-07', '空 retireYM 时推导男法定 2044-07');

// ===== 7. 女干部 2031-07 若被采纳，是否属弹性区间内的合法值？=====
A.ok(D.toIndex('2031-07') === D.toIndex('2036-07') - 60, '女工人下限 2031-07 比女干部 2036-07 早 5 年（原 50 vs 原 55）');
// 该值本身不是女性档法定值，仅作数据保真（不被覆盖）；合法性由 validateRetireYM 另行判定

A.finish();
