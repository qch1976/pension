// developer_test/TST-02-UT-1021/report-share-success-check.js
// TST-02-UT-1021（REQ-02-OUT-003，owner=developer）node 断言（依赖注入 fake wx/store）。
// case-specific：shareFileMessage 成功 -> shared=true，且文件先于分享落盘。
'use strict';
var path = require('path');
var reportShare = require(path.join(__dirname, '..', '..', 'services', 'reportShare.js'));
var SF = require(path.join(__dirname, '..', 'common', 'share-fake.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1021');

var store = SF.fakeStore();
var fw = SF.fakeWx({ share: 'success', disk: 'absent' });
reportShare.exportAndShare('basic', SF.DATA, {
  store: store, wxApi: fw.wxApi, now: function () { return SF.FIXED; }
}).then(function (st) {
  A.ok(fw.calls.share.length === 1, '1021 shareFileMessage 调用1次');
  A.ok(fw.calls.share[0].filePath === st.filePath, '1021 分享 filePath=落盘路径');
  A.ok(fw.calls.share[0].fileName === st.fileName, '1021 分享 fileName');
  A.ok(st.shared === true, '1021 shared=true');
  // 顺序：writeOutput 的 promise resolve 后才 share
  A.ok(store.writes[0].order === 0 && fw.calls.share.length === 1, '1021 文件先落盘再分享');
  A.finish();
}).catch(function (e) {
  console.log('  FATAL: ' + (e && e.stack || e));
  process.exit(1);
});
