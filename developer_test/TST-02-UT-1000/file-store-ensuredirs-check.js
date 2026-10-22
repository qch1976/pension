// developer_test/TST-02-UT-1000/file-store-ensuredirs-check.js
// TST-02-UT-1000（REQ-02-STORE-000，owner=developer）node 断言，不依赖真实 wx。
// case-specific：ensureDirs 惰性建目录（recursive）、幂等、根取运行时 USER_DATA_PATH。
'use strict';
var path = require('path');
var FS = require(path.join(__dirname, '..', '..', 'services', 'fileStore.js'));
var MEMFS = require(path.join(__dirname, '..', 'common', 'memfs-mock.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1000');

// case-specific input：固定时间沙箱
var env = MEMFS.makeStoreEnv(FS);
var R = env.R;

// expect output 断言
(async function () {
  var d = await env.store.ensureDirs();
  A.ok(d.inputs === R + '/inputs' && d.outputs === R + '/outputs', 'STORE-000 返回 inputs/outputs 路径');
  A.ok(env.env.dirs[R + '/inputs'] && env.env.dirs[R + '/outputs'], 'STORE-000 沙箱下 pension/inputs、pension/outputs 已建');
  // 根取自运行时 USER_DATA_PATH
  A.ok(env.store.rootDir() === env.ROOT, 'STORE-000 根目录读取 wx.env.USER_DATA_PATH，未硬编码');
  // 再次调用（幂等：已存在不报错）
  var d2 = await env.store.ensureDirs();
  A.ok(d2.inputs === R + '/inputs', 'STORE-000 重复 ensureDirs 不报错（Q8 已存在）');
  A.finish();
})().catch(function (e) {
  console.log('  FATAL: ' + (e && e.stack || e));
  process.exit(1);
});
