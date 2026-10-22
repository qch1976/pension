// developer_test/common/plan-factory.js
// BUG-02-0004/0005/0006/0007 系列共享的测试数据工厂（pageData / aPlan）。
// 抽取自 developer_test/TST-02-UT-1025/bug02-0004-0007-check.js（testcase-structure SKILL 公共逻辑入 common/）。
'use strict';

// 共享区（手工录入形态），段录至 histEnd（缺省 2026-08），记账利率 ratePct（字符串）。
function pageData(ratePct, histEnd) {
  var end = histEnd || '2026-08';
  return {
    gender: 'male', femaleType: '', birthYM: '1976-09', workStartYM: '1998-08',
    hasDeemed: false, deemedStartYM: '', deemedEndYM: '', entryMode: 'seg',
    segments: [
      { type: 'enterprise', startYM: '1998-08', endYM: '2010-12', baseMonthly: '5000' },
      { type: 'enterprise', startYM: '2011-01', endYM: end, baseMonthly: '12116' }
    ],
    yearRows: [], accountBalanceManual: '250000', manualBalanceYM: end,
    futureMonthlyRatePct: ratePct, baseYearOptions: ['2025'], baseYearIndex: 0,
    cPingOverride: '', customCYearText: '',
    doc31Eligible: false, doc31TransferYM: '', enterpriseInsuredYM: '', subsidyExcludedText: ''
  };
}

// 方案卡：z（月缴费指数）、退休月、可选手改起始月（'' = 取动态缺省）。
function aPlan(z, retireYM, windowStartYM) {
  return { id: 'A', retireYM: retireYM, z: String(z), segType: 'enterprise',
    windowStartYM: windowStartYM == null ? '' : windowStartYM };
}

module.exports = { pageData: pageData, aPlan: aPlan };
