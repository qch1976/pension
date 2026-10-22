// developer_test/TST-02-UT-1020/report-share-savefile-check.js
// TST-02-UT-1020（REQ-02-STORE-002/OUT-003，owner=developer）node 断言（依赖注入 fake wx/store）。
// case-specific：生成 txt 并 writeOutput 落沙箱；filePath/fileName/generatedAt 正确。
'use strict';
var path = require('path');
var reportShare = require(path.join(__dirname, '..', '..', 'services', 'reportShare.js'));
var SF = require(path.join(__dirname, '..', 'common', 'share-fake.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1020');

var store = SF.fakeStore();
var fw = SF.fakeWx({ share: 'absent', disk: 'absent' });
reportShare.exportAndShare('basic', SF.DATA, {
  store: store, wxApi: fw.wxApi, now: function () { return SF.FIXED; }, share: false
}).then(function (st) {
  A.ok(store.writes.length === 1, '1020 writeOutput 调用1次');
  A.ok(store.writes[0].mode === 'basic', '1020 mode=basic');
  A.ok(st.filePath === store.writes[0].dest, '1020 filePath 来自 store');
  A.ok(/pension-basic-\d{8}-\d{6}\.txt$/.test(st.fileName), '1020 fileName 格式');
  A.ok(st.generatedAt === '2026-10-09 23:40:05', '1020 generatedAt');
  A.finish();
}).catch(function (e) {
  console.log('  FATAL: ' + (e && e.stack || e));
  process.exit(1);
});
