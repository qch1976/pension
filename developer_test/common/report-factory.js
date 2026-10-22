// developer_test/common/report-factory.js
// 报告导出/分享系列共享的计算输入与构造件（testcase-structure SKILL 公共逻辑入 common/）。
// 抽取自 report-export-check.js / report-share-check.js。
'use strict';

// 基本计算 engine 输入（与 Phase-0 buildInput 形态一致）
function basicInput() {
  return {
    gender: 'male', femaleType: null, birthYM: '1976-09', workStartYM: '1998-08',
    retireYM: '2036-09',
    deemedStartYM: null, deemedEndYM: null,
    segments: [{ type: 'enterprise', startYM: '1998-08', endYM: '2026-08', baseMonthly: 12116 }],
    accountBalanceManual: 250000, accountBalanceManualYM: '2026-08', futureMonthlyRate: 0.015,
    baseYearOverride: 2025, cPingOverride: null, customCYear: {},
    doc31Eligible: false, doc31TransferYM: null, enterpriseInsuredYM: null,
    subsidyExcludedRanges: []
  };
}

// 比较视图 shared 输入
function sharedInput() {
  return {
    gender: 'male', femaleType: null, birthYM: '1976-09', workStartYM: '1998-08',
    retireYM: null, deemedStartYM: null, deemedEndYM: null,
    segments: [{ type: 'enterprise', startYM: '1998-08', endYM: '2026-08', baseMonthly: 12116 }],
    accountBalanceManual: 250000, accountBalanceManualYM: '2026-08', futureMonthlyRate: null,
    baseYearOverride: 2025, cPingOverride: null, customCYear: {},
    doc31Eligible: false, doc31TransferYM: null, enterpriseInsuredYM: null, subsidyExcludedRanges: []
  };
}

// 三方案（A/B/C）
function plans() {
  return [
    { id: 'A', retireYM: '2026-12', z: '1.0', segType: 'enterprise' },
    { id: 'B', retireYM: '2033-09', z: '1.4', segType: 'enterprise' },
    { id: 'C', retireYM: '2031-09', z: '1.2', segType: 'flexible' }
  ];
}

// 两位小数
function f2(n) { return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2); }

var WHEN = '2026-10-09 23:10:00';

module.exports = { basicInput: basicInput, sharedInput: sharedInput, plans: plans, f2: f2, WHEN: WHEN };
