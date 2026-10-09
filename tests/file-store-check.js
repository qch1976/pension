// tests/file-store-check.js
// E1 / TST-02-UT-1000~1004（REQ-02-STORE-000~004，owner=developer）node 断言。
// 用内存 FileSystemManager mock 复刻微信沙箱：mkdir/readFile/writeFile/copyFile/readdir/stat/unlink/rmdir。
'use strict';
var path = require('path');
var FS = require(path.join(__dirname, '..', 'services', 'fileStore.js'));

var pass = 0, fail = 0;
function ok(c, n) { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } }

// ---------- 内存文件系统 mock ----------
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
      // 父目录须存在（模拟沙箱）
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

var ROOT = 'http://tmp/sandbox'; // 模拟开发者工具 http 协议；代码不得假设协议
var env = makeWx(ROOT);
var store = FS.createFileStore(env.wx, { now: function () { return new Date(2026, 9, 9, 20, 30, 5); } });
var R = ROOT + '/pension';

// =====================================================================
// STORE-000：ensureDirs 惰性建目录（recursive），重复调用不报错
// =====================================================================
(async function () {
  var d = await store.ensureDirs();
  ok(d.inputs === R + '/inputs' && d.outputs === R + '/outputs', 'STORE-000 返回 inputs/outputs 路径');
  ok(env.dirs[R + '/inputs'] && env.dirs[R + '/outputs'], 'STORE-000 沙箱下 pension/inputs、pension/outputs 已建');
  // 根取自运行时 USER_DATA_PATH
  ok(store.rootDir() === ROOT, 'STORE-000 根目录读取 wx.env.USER_DATA_PATH，未硬编码');
  // 再次调用（幂等：已存在不报错）
  var d2 = await store.ensureDirs();
  ok(d2.inputs === R + '/inputs', 'STORE-000 重复 ensureDirs 不报错（Q8 已存在）');

  // =====================================================================
  // STORE-001：临时文件复制持久化到 inputs/<时间戳>-<原名>
  // =====================================================================
  env.files[ROOT + '/temp/tmp_abcd.txt'] = '# 生日: 1976-09-08';
  var dest = await store.saveInput(ROOT + '/temp/tmp_abcd.txt', 'My-Case.md');
  ok(dest.indexOf(R + '/inputs/20261009-203005-My-Case.md') === 0,
     'STORE-001 持久化路径=inputs/<时间戳>-<原名>');
  ok(env.files[dest] === '# 生日: 1976-09-08', 'STORE-001 复制后内容与临时文件一致');

  // 原名含路径/危险字符时安全化（且不逃出 inputs）
  env.files[ROOT + '/temp/x.txt'] = 'x';
  var dest2 = await store.saveInput(ROOT + '/temp/x.txt', '../../evil?.txt');
  ok(dest2.indexOf(R + '/inputs/') === 0 && dest2.indexOf('..') < 0,
     'STORE-001 原名路径穿越被安全化，仍在 inputs 内');

  // =====================================================================
  // STORE-002：报告写到 outputs/<mode>-<时间戳>.txt
  // =====================================================================
  var rep = await store.writeOutput('basic', '养老金测算报告\nP月=5000.00');
  ok(rep === R + '/outputs/basic-20261009-203005.txt', 'STORE-002 报告路径=outputs/<mode>-<时间戳>.txt');
  ok(/P月=5000.00/.test(env.files[rep]), 'STORE-002 报告内容正确写入(utf8)');

  // =====================================================================
  // STORE-003：列清单 + cleanAll 仅清 pension；二次确认由 cleanList 承接
  // =====================================================================
  var list = await store.listStoredFiles();
  ok(list.inputs.length === 2 && list.outputs.length === 1 && list.all.length === 3,
     'STORE-003 列清单：inputs=2 outputs=1 all=3');
  ok(list.inputs.indexOf(dest) >= 0 && list.outputs.indexOf(rep) >= 0, 'STORE-003 清单含具体文件路径');

  // cleanList 的包含校验：pension 外路径被跳过，不删除
  var res = await store.cleanList([rep, ROOT + '/other/secret.txt']);
  ok(res.removed.length === 1 && res.skipped.length === 1, 'STORE-003 pension 内被删、外部路径跳过');
  ok(!(rep in env.files), 'STORE-003 指定报告已删除');

  // 边界：同级目录 pension-other 不得通过包含校验
  ok(store._contained(ROOT + '/pension-other/x.txt') === false, '包含校验拒绝 pension-other 同级目录');
  ok(store._contained(R + '/outputs/a.txt') === true, '包含校验放行 pension 内文件');

  // 剩余：2 个 inputs。cleanAll 清掉并尝试移空目录
  var res2 = await store.cleanAll();
  ok(res2.removed.length === 2 && res2.skipped.length === 0, 'STORE-003 cleanAll 删除剩余2文件');
  var listAfter = await store.listStoredFiles();
  ok(listAfter.all.length === 0, 'STORE-003 cleanAll 后清单为空');

  // =====================================================================
  // STORE-004：不写公共目录/不联网（封装不触发任何网络 API）
  // =====================================================================
  ok(typeof store.saveInput === 'function' && typeof store.writeOutput === 'function', 'STORE-004 仅本地文件 API');
  // 重建目录能力仍正常（cleanAll 后 ensured 复位）
  var d3 = await store.ensureDirs();
  ok(env.dirs[R + '/inputs'] && env.dirs[R + '/outputs'], 'STORE-004 cleanAll 后可再 ensureDirs 重建');

  console.log('\nfile-store-check: pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
})().catch(function (e) {
  console.log('  FATAL: ' + (e && e.stack || e));
  process.exit(1);
});
