// services/reportShare.js
// E6：导出/分享编排（wx 依赖集中在本层）。
// 链路：reportExport 生成 UTF-8 txt → fileStore.writeOutput 写沙箱 pension/outputs
//      → wx.shareFileMessage 分享到所选会话（成功/取消均不影响已落盘文件，OUT-003）
//      → saveFileToDisk 仅在可用（PC/开发工具）时作附加入口，缺失即安静降级（NFR-003）。
// 纯逻辑（reportExport/fileStore）不变；本模块通过依赖注入可在 node 单测中用 fake wx 验证。
'use strict';

var reportExport = require('./reportExport.js');
var fileStore = require('./fileStore.js');

function pad2(n) { return (n < 10 ? '0' : '') + n; }
function stampNow(d) {
  return '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
    '-' + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
}
function fmtNow(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
}

// mode：'basic' | 'compare'
// data：basic=engine result；compare=compareResultModel.buildView 的 view
// opts.store 可注入 fileStore 实例（测试）；opts.wxApi 可注入 wx（测试）；opts.now 可注入时钟。
function exportAndShare(mode, data, opts) {
  opts = opts || {};
  var wxApi = opts.wxApi || (typeof wx !== 'undefined' ? wx : null);
  var store = opts.store || fileStore.getDefault();
  var nowFn = opts.now || function () { return new Date(); };

  var d = nowFn();
  var when = fmtNow(d);
  var text = mode === 'compare'
    ? reportExport.buildCompareReport(data, { generatedAt: when })
    : reportExport.buildBasicReport(data, { generatedAt: when });

  var baseName = mode === 'compare' ? 'compare' : 'basic';
  var fileName = 'pension-' + baseName + '-' + stampNow(d) + '.txt';

  var stage = { mode: mode, generatedAt: when, fileName: fileName, filePath: '', shared: false,
    shareCancelled: false, savedToDisk: false, diskAvailable: false };

  // 1) 写沙箱（报告本体，先于分享；OUT-003：分享结果不影响该文件）
  return store.writeOutput(baseName, text).then(function (filePath) {
    stage.filePath = filePath;

    // 2) 分享（可能缺失/被取消；均不视为错误，不影响已生成文件）
    var canShare = opts.share === false ? false : wxApi && typeof wxApi.shareFileMessage === 'function';
    if (!canShare) {
      stage.shareUnavailable = true;
      return null;
    }
    return new Promise(function (resolve) {
      wxApi.shareFileMessage({
        filePath: filePath,
        fileName: fileName,
        success: function () { stage.shared = true; resolve(); },
        fail: function (err) {
          // 用户取消在部分端走 fail（errMsg 含 cancel）；记为取消而非失败
          if (err && /cancel/i.test(String(err.errMsg || ''))) {
            stage.shareCancelled = true;
          } else {
            stage.shareError = err ? (err.errMsg || 'share failed') : 'share failed';
          }
          resolve();
        }
      });
    });
  }).then(function () {
    // 3) saveFileToDisk：仅在可用时作为附加入口；不可用/失败均安静降级（NFR-003）
    var canDisk = wxApi && typeof wxApi.saveFileToDisk === 'function';
    stage.diskAvailable = !!canDisk;
    if (!canDisk || !opts.askSaveToDisk) return stage;
    return new Promise(function (resolve) {
      wxApi.saveFileToDisk({
        filePath: stage.filePath,
        fileName: fileName,
        success: function () { stage.savedToDisk = true; resolve(stage); },
        fail: function () { resolve(stage); } // 降级：不报错
      });
    });
  });
}

module.exports = {
  exportAndShare: exportAndShare,
  _stampNow: stampNow,
  _fmtNow: fmtNow
};
