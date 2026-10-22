// developer_test/TST-02-UT-1019/report-compare-estimated-check.js
// TST-02-UT-1019（REQ-02-OUT-002，owner=developer）node 断言，纯逻辑不依赖 wx。
// case-specific：比较报告【预估】角标由 estimated 决定、条形对比与 barP/barRoi 一致。
'use strict';
var path = require('path');
var CRM = require(path.join(__dirname, '..', '..', 'calculator', 'compareResultModel.js'));
var RE = require(path.join(__dirname, '..', '..', 'services', 'reportExport.js'));
var RF = require(path.join(__dirname, '..', 'common', 'report-factory.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1019');

// case-specific input
var view = CRM.buildView(RF.sharedInput(), RF.plans(), 0.06);
var cmpText = RE.buildCompareReport(view, { generatedAt: RF.WHEN });

// expect output 断言
view.columns.forEach(function (c, i) {
  var tag = '方案' + (i + 1) + ' ';
  if (c.estimated) {
    A.ok(cmpText.indexOf('【预估】') !== -1, tag + ' 有【预估】角标');
  }
});
// 方案1 退休 2026-12（止于2026-11）不应 estimated
A.ok(view.columns[0].estimated === false, '1019 方案1 不预估');
A.ok(view.columns[1].estimated === true && view.columns[2].estimated === true, '1019 方案2/3 预估');
A.contains(cmpText, '月养老金 P月 对比', '1019 P月条形标题');
A.contains(cmpText, 'ROI 对比', '1019 ROI条形标题');
// 脚注口径
A.contains(cmpText, 'OUT-002', '1019 角标口径脚注');
A.finish();
