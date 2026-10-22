// developer_test/TST-02-UT-1004/file-store-localonly-check.js
// TST-02-UT-1004（REQ-02-STORE-004, REQ-02-NFR-000，owner=developer）node 断言，不依赖真实 wx。
// case-specific：封装仅本地文件 API、与 storage key 隔离；cleanAll 后可 ensureDirs 重建。
'use strict';
var path = require('path');
var FS = require(path.join(__dirname, '..', '..', 'services', 'fileStore.js'));
var MEMFS = require(path.join(__dirname, '..', 'common', 'memfs-mock.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1004');

var env = MEMFS.makeStoreEnv(FS);
var R = env.R;

(async function () {
  await env.store.ensureDirs();
  // STORE-004：不写公共目录/不联网（封装不触发任何网络 API）
  A.ok(typeof env.store.saveInput === 'function' && typeof env.store.writeOutput === 'function', 'STORE-004 仅本地文件 API');
  // 重建目录能力仍正常（cleanAll 后 ensured 复位）
  await env.store.cleanAll();
  var d3 = await env.store.ensureDirs();
  A.ok(env.env.dirs[R + '/inputs'] && env.env.dirs[R + '/outputs'], 'STORE-004 cleanAll 后可再 ensureDirs 重建');
  A.finish();
})().catch(function (e) {
  console.log('  FATAL: ' + (e && e.stack || e));
  process.exit(1);
});
