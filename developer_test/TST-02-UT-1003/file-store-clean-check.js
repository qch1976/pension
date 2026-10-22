// developer_test/TST-02-UT-1003/file-store-clean-check.js
// TST-02-UT-1003（REQ-02-STORE-003，owner=developer）node 断言，不依赖真实 wx。
// case-specific：listStoredFiles 列清单、cleanList 跳过 pension 外路径、_contained 边界、cleanAll 清空。
'use strict';
var path = require('path');
var FS = require(path.join(__dirname, '..', '..', 'services', 'fileStore.js'));
var MEMFS = require(path.join(__dirname, '..', 'common', 'memfs-mock.js'));
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1003');

var env = MEMFS.makeStoreEnv(FS);
var R = env.R;

(async function () {
  await env.store.ensureDirs();
  // 准备：2 个 inputs + 1 个 outputs
  env.env.files[env.ROOT + '/temp/a.txt'] = 'A';
  env.env.files[env.ROOT + '/temp/b.txt'] = 'B';
  var dest = await env.store.saveInput(env.ROOT + '/temp/a.txt', 'a.md');
  await env.store.saveInput(env.ROOT + '/temp/b.txt', 'b.md');
  var rep = await env.store.writeOutput('basic', 'R');

  // STORE-003：列清单
  var list = await env.store.listStoredFiles();
  A.ok(list.inputs.length === 2 && list.outputs.length === 1 && list.all.length === 3,
     'STORE-003 列清单：inputs=2 outputs=1 all=3');
  A.ok(list.inputs.indexOf(dest) >= 0 && list.outputs.indexOf(rep) >= 0, 'STORE-003 清单含具体文件路径');

  // cleanList 的包含校验：pension 外路径被跳过，不删除
  var res = await env.store.cleanList([rep, env.ROOT + '/other/secret.txt']);
  A.ok(res.removed.length === 1 && res.skipped.length === 1, 'STORE-003 pension 内被删、外部路径跳过');
  A.ok(!(rep in env.env.files), 'STORE-003 指定报告已删除');

  // 边界：同级目录 pension-other 不得通过包含校验
  A.ok(env.store._contained(env.ROOT + '/pension-other/x.txt') === false, '包含校验拒绝 pension-other 同级目录');
  A.ok(env.store._contained(R + '/outputs/a.txt') === true, '包含校验放行 pension 内文件');

  // 剩余：2 个 inputs。cleanAll 清掉并尝试移空目录
  var res2 = await env.store.cleanAll();
  A.ok(res2.removed.length === 2 && res2.skipped.length === 0, 'STORE-003 cleanAll 删除剩余2文件');
  var listAfter = await env.store.listStoredFiles();
  A.ok(listAfter.all.length === 0, 'STORE-003 cleanAll 后清单为空');
  A.finish();
})().catch(function (e) {
  console.log('  FATAL: ' + (e && e.stack || e));
  process.exit(1);
});
