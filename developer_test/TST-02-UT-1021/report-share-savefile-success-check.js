// developer_test/TST-02-UT-1021/report-share-savefile-success-check.js
// TST-02-UT-1021（REQ-02-STORE-002, REQ-02-OUT-003，owner=developer）node 断言（依赖注入 fake wx/store）。
// 口径①（Manager 裁定 2026-10-23）：report-share 组矩阵 1021~1024，1021 吸收源脚本 1020+1021 两组断言。
// case-specific 分段：生成txt落沙箱(1020) / 分享成功文件先落盘(1021)。
'use strict';
var path = require('path');
var reportShare = require(path.join(__dirname, '..', '..', 'services', 'reportShare.js'));
var SF = require(path.join(__dirname, '..', 'common', 'share-fake.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1021');

// ========== 分段① 1020：生成 txt 并 writeOutput 落沙箱（share:'absent'+share:false 不分享）==========
var store1 = SF.fakeStore();
var fw1 = SF.fakeWx({ share: 'absent', disk: 'absent' });
reportShare.exportAndShare('basic', SF.DATA, {
  store: store1, wxApi: fw1.wxApi, now: function () { return SF.FIXED; }, share: false
}).then(function (st1) {
  A.ok(store1.writes.length === 1, '1020 writeOutput 调用1次');
  A.ok(store1.writes[0].mode === 'basic', '1020 mode=basic');
  A.ok(st1.filePath === store1.writes[0].dest, '1020 filePath 来自 store');
  A.ok(/pension-basic-\d{8}-\d{6}\.txt$/.test(st1.fileName), '1020 fileName 格式');
  A.ok(st1.generatedAt === '2026-10-09 23:40:05', '1020 generatedAt');

  // ========== 分段② 1021：shareFileMessage 成功 -> shared=true，文件先于分享落盘 ==========
  var store2 = SF.fakeStore();
  var fw2 = SF.fakeWx({ share: 'success', disk: 'absent' });
  return reportShare.exportAndShare('basic', SF.DATA, {
    store: store2, wxApi: fw2.wxApi, now: function () { return SF.FIXED; }
  }).then(function (st2) {
    A.ok(fw2.calls.share.length === 1, '1021 shareFileMessage 调用1次');
    A.ok(fw2.calls.share[0].filePath === st2.filePath, '1021 分享 filePath=落盘路径');
    A.ok(fw2.calls.share[0].fileName === st2.fileName, '1021 分享 fileName');
    A.ok(st2.shared === true, '1021 shared=true');
    A.ok(store2.writes[0].order === 0 && fw2.calls.share.length === 1, '1021 文件先落盘再分享');
    A.finish();
  });
}).catch(function (e) {
  console.log('  FATAL: ' + (e && e.stack || e));
  process.exit(1);
});
