// developer_test/TST-02-UT-1001/file-store-saveinput-check.js
// TST-02-UT-1001（REQ-02-STORE-001，owner=developer）node 断言，不依赖真实 wx。
// case-specific：临时文件复制持久化到 inputs/<时间戳>-<原名>；原名路径穿越安全化。
'use strict';
var path = require('path');
var FS = require(path.join(__dirname, '..', '..', 'services', 'fileStore.js'));
var MEMFS = require(path.join(__dirname, '..', 'common', 'memfs-mock.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1001');

var env = MEMFS.makeStoreEnv(FS);
var R = env.R;

(async function () {
  await env.store.ensureDirs();
  // STORE-001：临时文件复制持久化到 inputs/<时间戳>-<原名>
  env.env.files[env.ROOT + '/temp/tmp_abcd.txt'] = '# 生日: 1976-09-08';
  var dest = await env.store.saveInput(env.ROOT + '/temp/tmp_abcd.txt', 'My-Case.md');
  A.ok(dest.indexOf(R + '/inputs/20261009-203005-My-Case.md') === 0,
     'STORE-001 持久化路径=inputs/<时间戳>-<原名>');
  A.ok(env.env.files[dest] === '# 生日: 1976-09-08', 'STORE-001 复制后内容与临时文件一致');

  // 原名含路径/危险字符时安全化（且不逃出 inputs）
  env.env.files[env.ROOT + '/temp/x.txt'] = 'x';
  var dest2 = await env.store.saveInput(env.ROOT + '/temp/x.txt', '../../evil?.txt');
  A.ok(dest2.indexOf(R + '/inputs/') === 0 && dest2.indexOf('..') < 0,
     'STORE-001 原名路径穿越被安全化，仍在 inputs 内');
  A.finish();
})().catch(function (e) {
  console.log('  FATAL: ' + (e && e.stack || e));
  process.exit(1);
});
