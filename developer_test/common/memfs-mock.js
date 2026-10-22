// developer_test/common/memfs-mock.js
// 内存 FileSystemManager mock（复刻微信沙箱），供 file-store 系列独立入口复用。
// 抽取自 developer_test/TST-02-UT-1000/file-store-check.js（testcase-structure SKILL 公共逻辑入 common/）。
'use strict';
var path = require('path');

// 构造一套内存 FS + wx.getFileSystemManager mock。
// rootPath：模拟 wx.env.USER_DATA_PATH（可为 http 协议沙箱路径）。
// 返回 { wx, fsm, files, dirs }：files/dirs 可被断言直接读取。
function makeWx(rootPath) {
  var files = {};   // path -> string (binary/utf8 as string)
  var dirs = {};    // path -> true
  function norm(p) { return String(p).replace(/\\/g, '/').replace(/\/+$/, ''); }
  dirs[norm(rootPath)] = true;

  var fsm = {
    mkdir: function (o) {
      var p = norm(o.dirPath);
      if (o.recursive) {
        var chain = p.split('/');
        var acc = '';
        for (var i = 0; i < chain.length; i++) {
          acc = i === 0 ? chain[0] : acc + '/' + chain[i];
          if (acc.indexOf(rootPath) === 0) dirs[acc] = true;
        }
        o.success && o.success({});
      } else {
        if (!dirs[norm(path.posix.dirname(p))]) return o.fail(new Error('enoent parent'));
        dirs[p] = true; o.success && o.success({});
      }
    },
    copyFile: function (o) {
      var s = norm(o.srcPath), d = norm(o.destPath);
      if (!(s in files)) return o.fail(new Error('src missing'));
      files[d] = files[s]; o.success && o.success({});
    },
    writeFile: function (o) {
      var p = norm(o.filePath);
      if (!dirs[norm(path.posix.dirname(p))]) return o.fail(new Error('no dir'));
      files[p] = String(o.data); o.success && o.success({});
    },
    readFile: function (o) {
      var p = norm(o.filePath);
      if (!(p in files)) return o.fail(new Error('missing'));
      o.success && o.success({ data: files[p] });
    },
    readdir: function (o) {
      var p = norm(o.dirPath);
      if (!dirs[p]) return o.fail(new Error('not a dir'));
      var names = {};
      Object.keys(files).forEach(function (f) {
        var f2 = norm(f);
        if (f2.indexOf(p + '/') === 0) names[f2.slice(p.length + 1).split('/')[0]] = 1;
      });
      Object.keys(dirs).forEach(function (d) {
        var d2 = norm(d);
        if (d2 !== p && d2.indexOf(p + '/') === 0) names[d2.slice(p.length + 1).split('/')[0]] = 1;
      });
      o.success && o.success({ files: Object.keys(names) });
    },
    stat: function (o) {
      var p = norm(o.path);
      if (files[p] != null) return o.success({ stats: { isDirectory: function () { return false; } } });
      if (dirs[p]) return o.success({ stats: { isDirectory: function () { return true; } } });
      o.fail(new Error('no stat'));
    },
    unlink: function (o) {
      var p = norm(o.filePath);
      if (!(p in files)) return o.fail(new Error('no file'));
      delete files[p]; o.success && o.success({});
    },
    rmdir: function (o) {
      var p = norm(o.dirPath);
      if (o.recursive === false) {
        var hasChild = Object.keys(files).some(function (f) { return norm(f).indexOf(p + '/') === 0; }) ||
          Object.keys(dirs).some(function (d) { var d2 = norm(d); return d2 !== p && d2.indexOf(p + '/') === 0; });
        if (hasChild) return o.fail(new Error('dir not empty'));
      }
      delete dirs[p]; o.success && o.success({});
    }
  };
  var wxApi = {
    env: { USER_DATA_PATH: rootPath },
    getFileSystemManager: function () { return fsm; }
  };
  return { wx: wxApi, fsm: fsm, files: files, dirs: dirs };
}

// 便捷构造：固定时间戳 2026-10-09 20:30:05 的 fileStore 测试环境。
// 返回 { ROOT, R, env, store }，R=ROOT+'/pension'。
function makeStoreEnv(FS, rootPath) {
  var ROOT = rootPath || 'http://tmp/sandbox';
  var env = makeWx(ROOT);
  var store = FS.createFileStore(env.wx, { now: function () { return new Date(2026, 9, 9, 20, 30, 5); } });
  return { ROOT: ROOT, R: ROOT + '/pension', env: env, store: store };
}

module.exports = { makeWx: makeWx, makeStoreEnv: makeStoreEnv };
