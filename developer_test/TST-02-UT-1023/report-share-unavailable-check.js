// developer_test/TST-02-UT-1023/report-share-unavailable-check.js
// TST-02-UT-1023（REQ-02-OUT-003，owner=developer）node 断言（依赖注入 fake wx/store）。
// case-specific：shareFileMessage 缺失 -> shareUnavailable=true，不报错，报告仍存沙箱。
'use strict';
var path = require('path');
var reportShare = require(path.join(__dirname, '..', '..', 'services', 'reportShare.js'));
var SF = require(path.join(__dirname, '..', 'common', 'share-fake.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1023');

var store = SF.fakeStore();
var fw = SF.fakeWx({ share: 'absent', disk: 'absent' });
reportShare.exportAndShare('compare', { columns: [] }, {
  store: store, wxApi: fw.wxApi, now: function () { return SF.FIXED; }
}).then(function (st) {
  A.ok(st.shareUnavailable === true, '1023 shareUnavailable=true');
  A.ok(fw.calls.share.length === 0, '1023 未调用分享');
  A.ok(store.writes.length === 1 && store.writes[0].mode === 'compare', '1023 报告仍存沙箱 compare');
  A.finish();
}).catch(function (e) {
  console.log('  FATAL: ' + (e && e.stack || e));
  process.exit(1);
});
