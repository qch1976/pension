// developer_test/common/share-fake.js
// report-share 系列共享的 fake store / fake wx 构造件（testcase-structure SKILL 公共逻辑入 common/）。
// 抽取自 report-share-check.js。
'use strict';

// fake store：记录 writeOutput 调用与顺序
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

// fake wx：可配置 share/disk 的行为（'success'|'cancel'|'other'|'absent' / 'success'|'fail'|'absent'）
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

module.exports = { fakeStore: fakeStore, fakeWx: fakeWx, FIXED: FIXED, DATA: DATA };
