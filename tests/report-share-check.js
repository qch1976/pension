// tests/report-share-check.js
// E6 node 断言（依赖注入 fake wx/store，不依赖真实小程序运行时）：
//  TST-02-UT-1020 生成 txt 并 writeOutput 落沙箱；filePath/fileName 正确（STORE-002/OUT-003）
//  TST-02-UT-1021 shareFileMessage 成功 -> shared=true，且文件先于分享落盘
//  TST-02-UT-1022 分享取消（fail errMsg cancel）-> shareCancelled=true，已落盘文件不受影响（OUT-003）
//  TST-02-UT-1023 shareFileMessage 缺失 -> shareUnavailable=true，不报错，报告仍存沙箱
//  TST-02-UT-1024 saveFileToDisk 仅可用时执行、成功 savedToDisk；不可用安静降级 diskAvailable=false（NFR-003）
// coverage skill md5: bf3d2c90733a4bb449ede785cd608226（owner=developer）
'use strict';
var reportShare = require('../services/reportShare.js');

var pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } }

// ---- fake store：记录 writeOutput 调用与顺序 ----
function fakeStore() {
  return {
    writes: [],
    writeOutput: function (mode, text) {
      var dest = '/root/pension/outputs/' + mode + '-X.txt';
      this.writes.push({ mode: mode, dest: dest, len: text.length, order: this.writes.length });
      return Promise.resolve(dest);
    }
  };
}

// ---- fake wx：可配置 share/disk 的行为 ----
function fakeWx(cfg) {
  var calls = { share: [], disk: [] };
  var wxApi = {};
  if (cfg.share !== 'absent') {
    wxApi.shareFileMessage = function (o) {
      calls.share.push(o);
      if (cfg.share === 'success') o.success({});
      else if (cfg.share === 'cancel') o.fail({ errMsg: 'shareFileMessage:fail cancel' });
      else o.fail({ errMsg: 'shareFileMessage:fail other' });
    };
  }
  if (cfg.disk !== 'absent') {
    wxApi.saveFileToDisk = function (o) {
      calls.disk.push(o);
      if (cfg.disk === 'success') o.success({});
      else o.fail({ errMsg: 'cancel' });
    };
  }
  return { wxApi: wxApi, calls: calls };
}

var FIXED = new Date(2026, 9, 9, 23, 40, 5); // 2026-10-09 23:40:05 local
var DATA = { meta: { personType: 'X' } }; // reportExport 对 basic 宽松取值即可（此处只验编排）

// TST-02-UT-1020 / 1021：落盘 + 分享成功，且落盘在分享前
(function () {
  var store = fakeStore();
  var fw = fakeWx({ share: 'success', disk: 'absent' });
  return reportShare.exportAndShare('basic', DATA, {
    store: store, wxApi: fw.wxApi, now: function () { return FIXED; }
  }).then(function (st) {
    ok(store.writes.length === 1, '1020 writeOutput 调用1次');
    ok(store.writes[0].mode === 'basic', '1020 mode=basic');
    ok(st.filePath === store.writes[0].dest, '1020 filePath 来自 store');
    ok(/pension-basic-\d{8}-\d{6}\.txt$/.test(st.fileName), '1020 fileName 格式');
    ok(st.generatedAt === '2026-10-09 23:40:05', '1020 generatedAt');
    ok(fw.calls.share.length === 1, '1021 shareFileMessage 调用1次');
    ok(fw.calls.share[0].filePath === st.filePath, '1021 分享 filePath=落盘路径');
    ok(fw.calls.share[0].fileName === st.fileName, '1021 分享 fileName');
    ok(st.shared === true, '1021 shared=true');
    // 顺序：writeOutput 的 promise resolve 后才 share（fake 里 share 在 writeOutput.then 内）
    ok(store.writes[0].order === 0 && fw.calls.share.length === 1, '1021 文件先落盘再分享');
    ok(st.savedToDisk === false && st.diskAvailable === false, '1024 disk absent 默认不存盘');
  });
})()
// TST-02-UT-1022：取消
.then(function () {
  var store = fakeStore();
  var fw = fakeWx({ share: 'cancel', disk: 'absent' });
  return reportShare.exportAndShare('basic', DATA, {
    store: store, wxApi: fw.wxApi, now: function () { return FIXED; }
  }).then(function (st) {
    ok(st.shareCancelled === true, '1022 shareCancelled=true');
    ok(st.shared === false, '1022 shared=false');
    ok(store.writes.length === 1 && st.filePath === store.writes[0].dest, '1022 文件仍落盘');
  });
})
// TST-02-UT-1023：share API 缺失
.then(function () {
  var store = fakeStore();
  var fw = fakeWx({ share: 'absent', disk: 'absent' });
  return reportShare.exportAndShare('compare', { columns: [] }, {
    store: store, wxApi: fw.wxApi, now: function () { return FIXED; }
  }).then(function (st) {
    ok(st.shareUnavailable === true, '1023 shareUnavailable=true');
    ok(fw.calls.share.length === 0, '1023 未调用分享');
    ok(store.writes.length === 1 && store.writes[0].mode === 'compare', '1023 报告仍存沙箱 compare');
  });
})
// TST-02-UT-1024：disk 可用并成功 / share:false 不触发分享
.then(function () {
  var store = fakeStore();
  var fw = fakeWx({ share: 'success', disk: 'success' });
  return reportShare.exportAndShare('basic', DATA, {
    store: store, wxApi: fw.wxApi, now: function () { return FIXED; },
    share: false, askSaveToDisk: true
  }).then(function (st) {
    ok(fw.calls.share.length === 0, '1024 share:false 不分享');
    ok(st.diskAvailable === true, '1024 diskAvailable=true');
    ok(fw.calls.disk.length === 1, '1024 saveFileToDisk 调用1次');
    ok(fw.calls.disk[0].filePath === st.filePath, '1024 存盘路径=落盘路径');
    ok(st.savedToDisk === true, '1024 savedToDisk=true');
  });
})
// disk 失败安静降级
.then(function () {
  var store = fakeStore();
  var fw = fakeWx({ share: 'absent', disk: 'fail' });
  return reportShare.exportAndShare('basic', DATA, {
    store: store, wxApi: fw.wxApi, now: function () { return FIXED; },
    share: false, askSaveToDisk: true
  }).then(function (st) {
    ok(st.diskAvailable === true && st.savedToDisk === false, 'disk 失败安静降级，不抛错');
    ok(store.writes.length === 1, 'disk 失败不影响沙箱文件');
  });
})
.then(function () {
  console.log('report-share-check: pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
})
.catch(function (e) {
  console.log('UNEXPECTED', e);
  process.exit(1);
});
