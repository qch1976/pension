// services/caseImport.js
// E4 编排：chooseMessageFile -> readFile -> fileStore 持久化 -> caseFile.parseCaseFile -> caseValidator.validate。
// 运行期依赖 wx；解析/校验仍走 E2/E3 纯逻辑。供 基本计算(index) 与 方案比较(compare) 复用。
'use strict';
var caseFile = require('./caseFile.js');
var caseValidator = require('./caseValidator.js');

// 选择会话文件（.md/.txt）。取消时安静返回 {cancelled:true}。
function chooseCaseFile() {
  return new Promise(function (resolve) {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['md', 'txt'],
      success: function (res) {
        var f = res.tempFiles && res.tempFiles[0];
        if (!f) return resolve({ cancelled: true });
        resolve({ cancelled: false, tempFilePath: f.path, name: f.name, size: f.size });
      },
      fail: function (err) {
        var msg = (err && err.errMsg) || '';
        if (/cancel/.test(msg)) return resolve({ cancelled: true });
        resolve({ cancelled: false, error: msg || '选择文件失败' });
      }
    });
  });
}

function readUtf8(filePath) {
  return new Promise(function (resolve, reject) {
    wx.getFileSystemManager().readFile({
      filePath: filePath,
      encoding: 'utf8',
      success: function (r) { resolve(r.data); },
      fail: function (e) { reject(e); }
    });
  });
}

// 完整链路。mode: 'basic'|'compare'。
// 返回 {ok, cancelled, parsed, validation, savedName, error}
function importFromConversation(mode, store) {
  return chooseCaseFile().then(function (chosen) {
    if (chosen.cancelled) return { cancelled: true };
    if (chosen.error) return { error: chosen.error };

    return readUtf8(chosen.tempFilePath).then(function (text) {
      // 非 UTF-8 / 不可读在 parse/validate 阶段暴露；空串按 VAL-001。
      var parsed = caseFile.parseCaseFile(text, mode);
      var validation = caseValidator.validate(parsed, mode);

      // 持久化输入副本（Q3 跨界面补齐需要原文），失败不阻断导入。
      var savedName = null;
      if (store) {
        try {
          savedName = store.saveInput(chosen.tempFilePath, chosen.name);
        } catch (e) { savedName = null; }
      }

      return {
        ok: validation.ok,
        cancelled: false,
        parsed: parsed,
        validation: validation,
        savedName: savedName
      };
    }).catch(function (e) {
      var reason = (e && e.errMsg) ? e.errMsg : ((e && e.message) || '文件读取失败');
      // 统一成 VAL-001 风格结果
      var parsed = { fields: {}, records: [], errors: [{ line: 0, reason: '文件不可读或非 UTF-8：' + reason }] };
      var validation = caseValidator.validate(parsed, mode);
      return { ok: false, parsed: parsed, validation: validation, error: reason };
    });
  });
}

module.exports = {
  chooseCaseFile: chooseCaseFile,
  readUtf8: readUtf8,
  importFromConversation: importFromConversation
};
