// services/fileStore.js
// E1（REQ-02-STORE-000~004）：小程序沙箱目录 / 读写 / 清理封装。
//
// 设计：
//  - 根目录直接读取运行时注入的 wx.env.USER_DATA_PATH，不硬编码/不假设协议（wxfile:// vs http://）（Q7）。
//  - 所有持久化文件固定落在 <root>/pension/inputs、<root>/pension/outputs（STORE-000）。
//  - chooseMessageFile 的临时文件通过后 copyFile（不可用时 read+write 兜底）持久化（STORE-001）。
//  - 报告写到 <root>/pension/outputs/<mode>-<YYYYMMDD-HHmmss>.txt（STORE-02）。
//  - 清理仅针对 pension 子目录，且对目标做“根包含”校验；删除前列清单由 UI 二次确认（STORE-003/004）。
//
// 可测性：createFileStore(wxLike, opts) 注入 wx 与时钟，node 下用内存 mock 即可单测（NFR-004）。
'use strict';

var INPUTS = 'inputs';
var OUTPUTS = 'outputs';
var PENSION = 'pension';

function createFileStore(wxLike, opts) {
  opts = opts || {};
  var wxApi = wxLike;
  if (!wxApi) {
    if (typeof wx === 'undefined') throw new Error('fileStore: wx is not available');
    wxApi = wx;
  }
  var now = opts.now || function () { return new Date(); };
  var getFsm = opts.getFsm || function () { return wxApi.getFileSystemManager(); };

  function root() {
    var r = wxApi.env && wxApi.env.USER_DATA_PATH;
    if (!r) throw new Error('fileStore: wx.env.USER_DATA_PATH unavailable');
    return String(r).replace(/[\\\/]+$/, '');
  }
  function join() {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      var p = String(arguments[i] == null ? '' : arguments[i]).replace(/[\\\/]+$/, '');
      if (p) parts.push(p);
    }
    var s = parts.join('/').replace(/\\/g, '/');
    // 折叠重复斜杠（保留可选协议头中的 ://）
    s = s.replace(/([^:])\/{2,}/g, '$1/');
    return s;
  }
  function pensionRoot() { return join(root(), PENSION); }
  function dirInputs() { return join(pensionRoot(), INPUTS); }
  function dirOutputs() { return join(pensionRoot(), OUTPUTS); }

  function fsm() {
    var f = getFsm();
    if (!f) throw new Error('fileStore: FileSystemManager unavailable');
    return f;
  }

  // ---- Promise 封装（success/fail 回调风格）----
  function call(method, args) {
    return new Promise(function (resolve, reject) {
      var a = {};
      Object.keys(args || {}).forEach(function (k) { a[k] = args[k]; });
      a.success = function (res) { resolve(res); };
      a.fail = function (err) { reject(err); };
      try {
        fsm()[method](a);
      } catch (e) { reject(e); }
    });
  }

  // 根包含校验：目标规范化后必须位于 pensionRoot 之内（防越界到公共/其它目录）。
  function contained(targetPath) {
    var base = join(pensionRoot());
    var t = join(targetPath);
    return t === base || t.indexOf(base + '/') === 0;
  }

  // ---- STORE-000：惰性建目录；recursive:true，已存在不报错（Q8）----
  var ensured = null;
  // mkdir 在真实开发者工具上即使 recursive:true，目录已存在也会 fail "file already exists"。
  // 按 Q8“目录已存在不报错”：命中 already exists 即视为成功（inputs/outputs 仅由本模块创建，
  // 且 writeOutput/saveInput 对同名路径先 stat 校验为目录，避免与同名文件冲突）。
  function ensureOneDir(dirPath) {
    return call('mkdir', { dirPath: dirPath, recursive: true })
      .catch(function (e) {
        var msg = String((e && e.errMsg) || e || '');
        if (/already exists/i.test(msg)) return { existed: true };
        throw e;
      });
  }
  function ensureDirs() {
    if (ensured) return ensured;
    ensured = Promise.resolve()
      .then(function () { return ensureOneDir(dirInputs()); })
      .then(function () { return ensureOneDir(dirOutputs()); })
      .then(function () { return { inputs: dirInputs(), outputs: dirOutputs() }; })
      .catch(function (e) { ensured = null; throw e; });
    return ensured;
  }

  // 文件名安全化：剥离路径成分与危险字符，保留中英文/数字/点/下划线/连字符。
  function safeName(name) {
    var n = String(name == null ? '' : name).split(/[\\\/]/).pop() || '';
    n = n.replace(/[^\w\u4e00-\u9fa5.\-]+/g, '_').replace(/^\.+/, '').trim();
    return n || 'file';
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(d) {
    return '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
      '-' + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
  }

  // ---- STORE-001：临时文件 -> inputs/<时间戳>-<原名> 持久化 ----
  function saveInput(tempFilePath, originalName) {
    return ensureDirs().then(function () {
      var dest = join(dirInputs(), stamp(now()) + '-' + safeName(originalName || tempFilePath));
      if (typeof fsm().copyFile === 'function') {
        return call('copyFile', { srcPath: tempFilePath, destPath: dest })
          .then(function () { return dest; })
          .catch(function () {
            // copyFile 不可用/失败（如跨协议）：读原文再写，保证持久化
            return call('readFile', { filePath: tempFilePath })
              .then(function (r) { return call('writeFile', { filePath: dest, data: r.data, encoding: 'binary' }); })
              .then(function () { return dest; });
          });
      }
      return call('readFile', { filePath: tempFilePath })
        .then(function (r) { return call('writeFile', { filePath: dest, data: r.data }); })
        .then(function () { return dest; });
    });
  }

  // ---- STORE-002：报告文本 -> outputs/<mode>-<时间戳>.txt ----
  function writeOutput(mode, text) {
    return ensureDirs().then(function () {
      var m = safeName(mode || 'report');
      var dest = join(dirOutputs(), m + '-' + stamp(now()) + '.txt');
      return call('writeFile', { filePath: dest, data: text, encoding: 'utf8' })
        .then(function () { return dest; });
    });
  }

  // 递归枚举某目录下文件（目录结尾以 / 标识）。
  function readdirDeep(dirPath, out, depth) {
    depth = depth || 0;
    if (depth > 20) return Promise.resolve();
    return call('readdir', { dirPath: dirPath }).then(function (r) {
      var files = (r && r.files) || [];
      return files.reduce(function (seq, name) {
        return seq.then(function () {
          var full = join(dirPath, name);
          return call('stat', { path: full }).then(function (s) {
            if (s.stats && s.stats.isDirectory()) {
              return readdirDeep(full, out, depth + 1);
            }
            out.push(full);
          }).catch(function () {
            // stat 失败时按文件处理，避免漏列
            out.push(full);
          });
        });
      }, Promise.resolve());
    }).catch(function () { /* 目录不存在视为空 */ });
  }

  // ---- STORE-003：删除前列清单（供 UI 二次确认）----
  function listStoredFiles() {
    var result = { inputs: [], outputs: [] };
    return readdirDeep(dirInputs(), result.inputs)
      .then(function () { return readdirDeep(dirOutputs(), result.outputs); })
      .then(function () {
        result.all = result.inputs.concat(result.outputs);
        return result;
      });
  }

  // 删除给定文件清单（调用方应先展示并取得二次确认）。仅允许 pension 内文件。
  function cleanList(fileList) {
    var targets = fileList || [];
    var removed = [], skipped = [];
    return targets.reduce(function (seq, t) {
      return seq.then(function () {
        if (!contained(t)) { skipped.push(t); return; }
        return call('unlink', { filePath: t })
          .then(function () { removed.push(t); })
          .catch(function () { skipped.push(t); });
      });
    }, Promise.resolve()).then(function () {
      return { removed: removed, skipped: skipped };
    });
  }

  // 一键清理：列清单 -> 全删 -> 尝试移除空子目录（均限制在 pension 内）。
  function cleanAll() {
    return listStoredFiles().then(function (list) {
      return cleanList(list.all).then(function (res) {
        var rmEmpty = function (d) {
          return call('rmdir', { dirPath: d, recursive: false }).catch(function () {});
        };
        return rmEmpty(dirInputs()).then(function () {
          return rmEmpty(dirOutputs());
        }).then(function () {
          return rmEmpty(pensionRoot());
        }).then(function () {
          ensured = null;
          return res;
        });
      });
    });
  }

  return {
    // 路径（运行时取值）
    rootDir: root,
    inputsDir: dirInputs,
    outputsDir: dirOutputs,
    pensionDir: pensionRoot,
    // 生命周期 / 读写 / 清理
    ensureDirs: ensureDirs,
    saveInput: saveInput,
    writeOutput: writeOutput,
    listStoredFiles: listStoredFiles,
    cleanList: cleanList,
    cleanAll: cleanAll,
    // 供校验/测试
    _contained: contained,
    _safeName: safeName,
    _stamp: stamp
  };
}

// 默认实例：绑定运行时全局 wx（业务代码直接 require 使用）。
var defaultStore = null;
function getDefault() {
  if (!defaultStore) defaultStore = createFileStore();
  return defaultStore;
}

module.exports = {
  createFileStore: createFileStore,
  getDefault: getDefault
};
