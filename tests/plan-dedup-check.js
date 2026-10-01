// tests/plan-dedup-check.js
// D9/UT-1008（REQ-01-DUP-000~002）node 断言：方案去重 / 比较触发。
//  1) 差异指纹=(退休年月,Z,缴费性质)，三项一致即同方案；任一项不同即不同方案（DUP-000）；
//     trim 归一；Z 数值归一（'0.60' 与 '0.6' 同指纹），非数字 Z 回退原串；
//  2) dedupPlans 保留首次出现、重复项进 duplicates(含 index/fingerprint)，供相同方案置灰（DUP-001）；
//  3) 去重后须 >=2 个不同方案才可比较（canCompareDistinct）（DUP-002）；
//  4) 空/null 安全、顺序保持。
'use strict';
var PM = require('../calculator/planModel.js');

var pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } }
function plan(retireYM, z, segType) { return { retireYM: retireYM, z: z, segType: segType, retireTouched: true }; }

// =====================================================================
// DUP-000：指纹识别
// =====================================================================
(function () {
  // 三项一致 => 同指纹
  var a = plan('2036-09', '1.0', 'enterprise');
  var b = plan('2036-09', '1.0', 'enterprise');
  ok(PM.planFingerprint(a) === PM.planFingerprint(b), '三项完全一致 => 同指纹');

  // 任一项不同 => 不同指纹
  ok(PM.planFingerprint(plan('2036-09', '1.0', 'enterprise')) !==
     PM.planFingerprint(plan('2038-09', '1.0', 'enterprise')), '退休年月不同 => 不同指纹');
  ok(PM.planFingerprint(plan('2036-09', '1.0', 'enterprise')) !==
     PM.planFingerprint(plan('2036-09', '1.2', 'enterprise')), 'Z 不同 => 不同指纹');
  ok(PM.planFingerprint(plan('2036-09', '1.0', 'enterprise')) !==
     PM.planFingerprint(plan('2036-09', '1.0', 'flexible')), '缴费性质不同 => 不同指纹');

  // trim 归一：前后空白不影响指纹
  ok(PM.planFingerprint(plan(' 2036-09 ', ' 1.0 ', ' enterprise ')) ===
     PM.planFingerprint(plan('2036-09', '1.0', 'enterprise')), 'trim 归一 => 同指纹');

  // Z 数值归一：'0.60' 与 '0.6'、'1.20' 与 '1.2' 视为同一方案
  ok(PM.planFingerprint(plan('2036-09', '0.60', 'enterprise')) ===
     PM.planFingerprint(plan('2036-09', '0.6', 'enterprise')), "Z '0.60'='0.6' 数值归一 => 同指纹");
  ok(PM.planFingerprint(plan('2036-09', '1.20', 'flexible')) ===
     PM.planFingerprint(plan('2036-09', '1.2', 'flexible')), "Z '1.20'='1.2' 数值归一 => 同指纹");

  // 非数字 Z 回退原串：'abc' 与 'abc' 同、与 '1.0' 不同
  ok(PM.planFingerprint(plan('2036-09', 'abc', 'enterprise')) ===
     PM.planFingerprint(plan('2036-09', 'abc', 'enterprise')), "非数字 Z 同串 => 同指纹");
  ok(PM.planFingerprint(plan('2036-09', 'abc', 'enterprise')) !==
     PM.planFingerprint(plan('2036-09', 'abd', 'enterprise')), "非数字 Z 串不同 => 不同指纹");

  // 指纹结构可读：退休年月|Z|性质
  ok(PM.planFingerprint(plan('2036-09', '1.0', 'enterprise')) === '2036-09|1|enterprise',
     '指纹串=退休年月|Z|性质');
})();

// =====================================================================
// DUP-001：去重保留首次、重复项标记
// =====================================================================
(function () {
  var p0 = plan('2036-09', '1.0', 'enterprise');
  var p1 = plan('2038-09', '1.2', 'flexible');
  var p2 = plan('2036-09', '1.00', 'enterprise'); // 与 p0 等价（Z 数值归一）

  var r = PM.dedupPlans([p0, p1, p2]);
  ok(r.distinct.length === 2, '3 方案含1重复 => distinct=2');
  ok(r.distinct[0] === p0 && r.distinct[1] === p1, '保留首次出现的 2 个方案');
  ok(r.duplicates.length === 1, 'duplicates=1');
  ok(r.duplicates[0].index === 2, '重复项 index=2（第三个）');
  ok(r.duplicates[0].fingerprint === PM.planFingerprint(p2), '重复项携带 fingerprint');

  // 多个重复
  var r2 = PM.dedupPlans([p0, p0, p1, p0]);
  ok(r2.distinct.length === 2 && r2.duplicates.length === 2, '4 方案含2重复 => distinct=2 dup=2');
  ok(r2.duplicates[0].index === 1 && r2.duplicates[1].index === 3, '重复 index=1,3');

  // 无重复：duplicates 为空
  var r3 = PM.dedupPlans([p0, p1]);
  ok(r3.distinct.length === 2 && r3.duplicates.length === 0, '无重复 => distinct=2 dup=0');

  // 顺序保持
  var x0 = plan('2036-09', '1.0', 'enterprise');
  var x1 = plan('2037-09', '1.1', 'enterprise');
  var x2 = plan('2038-09', '1.2', 'enterprise');
  var r4 = PM.dedupPlans([x0, x1, x2]);
  ok(r4.distinct[0] === x0 && r4.distinct[1] === x1 && r4.distinct[2] === x2, '去重保持原顺序');
})();

// =====================================================================
// DUP-002：去重后 >=2 才触发比较
// =====================================================================
(function () {
  var p0 = plan('2036-09', '1.0', 'enterprise');
  var p1 = plan('2038-09', '1.2', 'flexible');

  // 2 个不同方案 => 可比较
  ok(PM.canCompareDistinct([p0, p1]) === true, '2 不同方案 => 可比较');

  // 3 个不同方案 => 可比较
  var p2 = plan('2040-08', '1.4', 'enterprise');
  ok(PM.canCompareDistinct([p0, p1, p2]) === true, '3 不同方案 => 可比较');

  // 仅 1 个方案 => 不可比较
  ok(PM.canCompareDistinct([p0]) === false, '仅1方案 => 不可比较');

  // 3 方案但两两内容相同（实际仅1种） => 不可比较
  ok(PM.canCompareDistinct([p0, p0, p0]) === false, '3方案全相同 => 不可比较');

  // 3 方案含1重复（实际2种） => 可比较（去重后>=2）
  ok(PM.canCompareDistinct([p0, p1, p0]) === true, '3方案含1重复实际2种 => 可比较');

  // 2 方案内容相同 => 不可比较（对应“方案内容相同”toast 场景）
  ok(PM.canCompareDistinct([p0, p0]) === false, '2方案相同 => 不可比较');
})();

// =====================================================================
// 空/null 安全
// =====================================================================
(function () {
  ok(PM.planFingerprint(null) === '||', 'null 方案指纹不抛错');
  ok(PM.planFingerprint(undefined) === '||', 'undefined 方案指纹不抛错');
  var r0 = PM.dedupPlans(null);
  ok(r0.distinct.length === 0 && r0.duplicates.length === 0, 'dedup(null) => 空');
  var r1 = PM.dedupPlans([]);
  ok(r1.distinct.length === 0 && r1.duplicates.length === 0, 'dedup([]) => 空');
  ok(PM.canCompareDistinct(null) === false, 'canCompareDistinct(null) => false');
  ok(PM.canCompareDistinct([]) === false, 'canCompareDistinct([]) => false');
})();

console.log('\nplan-dedup-check: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
