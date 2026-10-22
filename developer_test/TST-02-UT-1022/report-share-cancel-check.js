// developer_test/TST-02-UT-1022/report-share-cancel-check.js
// TST-02-UT-1022（REQ-02-OUT-003，owner=developer）node 断言（依赖注入 fake wx/store）。
// case-specific：分享取消（fail errMsg cancel）-> shareCancelled=true，已落盘文件不受影响。
'use strict';
var path = require('path');
var reportShare = require(path.join(__dirname, '..', '..', 'services', 'reportShare.js'));
var SF = require(path.join(__dirname, '..', 'common', 'share-fake.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1022');

var store = SF.fakeStore();
var fw = SF.fakeWx({ share: 'cancel', disk: 'absent' });
reportShare.exportAndShare('basic', SF.DATA, {
  store: store, wxApi: fw.wxApi, now: function () { return SF.FIXED; }
}).then(function (st) {
  A.ok(st.shareCancelled === true, '1022 shareCancelled=true');
  A.ok(st.shared === false, '1022 shared=false');
  A.ok(store.writes.length === 1 && st.filePath === store.writes[0].dest, '1022 文件仍落盘');
  A.finish();
}).catch(function (e) {
  console.log('  FATAL: ' + (e && e.stack || e));
  process.exit(1);
});
