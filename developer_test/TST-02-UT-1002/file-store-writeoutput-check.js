// developer_test/TST-02-UT-1002/file-store-writeoutput-check.js
// TST-02-UT-1002（REQ-02-NFR-004，owner=developer）node 断言，不依赖真实 wx。
// case-specific：报告写到 outputs/<mode>-<时间戳>.txt，utf8 写入，不影响既有 storage。
'use strict';
var path = require('path');
var FS = require(path.join(__dirname, '..', '..', 'services', 'fileStore.js'));
var MEMFS = require(path.join(__dirname, '..', 'common', 'memfs-mock.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1002');

var env = MEMFS.makeStoreEnv(FS);
var R = env.R;

(async function () {
  await env.store.ensureDirs();
  // STORE-002：报告写到 outputs/<mode>-<时间戳>.txt
  var rep = await env.store.writeOutput('basic', '养老金测算报告\nP月=5000.00');
  A.ok(rep === R + '/outputs/basic-20261009-203005.txt', 'STORE-002 报告路径=outputs/<mode>-<时间戳>.txt');
  A.ok(/P月=5000.00/.test(env.env.files[rep]), 'STORE-002 报告内容正确写入(utf8)');
  A.finish();
})().catch(function (e) {
  console.log('  FATAL: ' + (e && e.stack || e));
  process.exit(1);
});
