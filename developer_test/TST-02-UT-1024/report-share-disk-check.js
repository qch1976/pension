// developer_test/TST-02-UT-1024/report-share-disk-check.js
// TST-02-UT-1024（REQ-02-NFR-003，owner=developer）node 断言（依赖注入 fake wx/store）。
// case-specific：saveFileToDisk 仅可用时执行、成功 savedToDisk；不可用安静降级 diskAvailable=false。
'use strict';
var path = require('path');
var reportShare = require(path.join(__dirname, '..', '..', 'services', 'reportShare.js'));
var SF = require(path.join(__dirname, '..', 'common', 'share-fake.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1024');

// 情形1：disk 可用并成功 / share:false 不触发分享
var store1 = SF.fakeStore();
var fw1 = SF.fakeWx({ share: 'success', disk: 'success' });
reportShare.exportAndShare('basic', SF.DATA, {
  store: store1, wxApi: fw1.wxApi, now: function () { return SF.FIXED; },
  share: false, askSaveToDisk: true
}).then(function (st) {
  A.ok(fw1.calls.share.length === 0, '1024 share:false 不分享');
  A.ok(st.diskAvailable === true, '1024 diskAvailable=true');
  A.ok(fw1.calls.disk.length === 1, '1024 saveFileToDisk 调用1次');
  A.ok(fw1.calls.disk[0].filePath === st.filePath, '1024 存盘路径=落盘路径');
  A.ok(st.savedToDisk === true, '1024 savedToDisk=true');

  // 情形2：disk 失败安静降级（不抛错、不影响沙箱文件）
  var store2 = SF.fakeStore();
  var fw2 = SF.fakeWx({ share: 'absent', disk: 'fail' });
  return reportShare.exportAndShare('basic', SF.DATA, {
    store: store2, wxApi: fw2.wxApi, now: function () { return SF.FIXED; },
    share: false, askSaveToDisk: true
  }).then(function (st2) {
    A.ok(st2.diskAvailable === true && st2.savedToDisk === false, 'disk 失败安静降级，不抛错');
    A.ok(store2.writes.length === 1, 'disk 失败不影响沙箱文件');
    A.finish();
  });
}).catch(function (e) {
  console.log('  FATAL: ' + (e && e.stack || e));
  process.exit(1);
});
