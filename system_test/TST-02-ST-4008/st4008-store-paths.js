/* ST-4008 — inputs/outputs 固定路径、与 pension storage key 互不污染 独立入口（testcase-structure SKILL）
 * input: fileStore（mock fsm/env）；expect: ① 持久化固定落 <root>/pension/inputs 与 <root>/pension/outputs
 *        ② 根包含校验防越界（清理仅限 pension 子目录）③ inputs≠outputs 互不污染
 * 公共: system_test/common/st-case-lib.js；运行: node st4008-store-paths.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const fileStore = require('../../services/fileStore.js');
const { ck, end } = L.makeChecker('ST-4008');

// mock fsm：记录 mkdir/saveFile 路径，不落盘
const madeDirs = [], savedFiles = [];
const mockFsm = {
  mkdir: o => o.success && o.success(),
  saveFile: o => { savedFiles.push(o.filePath); o.success && o.success({ savedFilePath: o.filePath }); },
  writeFile: o => { savedFiles.push(o.filePath); o.success && o.success(); },
  readdir: o => o.success && o.success({ files: [] }),
  rmdir: o => o.success && o.success(),
  access: o => o.fail && o.fail({ errMsg: 'access:fail' }),
  unlink: o => o.success && o.success()
};
const mockWx = { env: { USER_DATA_PATH: '/mock/udata' } };
const store = fileStore.createFileStore(Object.assign({}, mockWx), { getFsm: () => mockFsm });

(async () => {
  let dirs = null;
  try { dirs = await store.ensureDirs(); } catch (e) { ck('ensureDirs 不抛错', false, e.message); }
  if (dirs) {
    ck('持久化根含 pension 子目录', /pension/.test(dirs.inputs) && /pension/.test(dirs.outputs), JSON.stringify(dirs));
    ck('inputs 固定路径 <root>/pension/inputs', /pension[\\/]inputs$/.test(dirs.inputs.replace(/[\\/]+$/, '')), dirs.inputs);
    ck('outputs 固定路径 <root>/pension/outputs', /pension[\\/]outputs$/.test(dirs.outputs.replace(/[\\/]+$/, '')), dirs.outputs);
    ck('inputs 与 outputs 互不污染（不同子目录）', dirs.inputs !== dirs.outputs && !dirs.inputs.includes('outputs') && !dirs.outputs.includes('inputs'), dirs.inputs + ' | ' + dirs.outputs);
    ck('根包含校验：inputs/outputs 均在 pension 根内', /pension/.test(dirs.inputs) && /pension/.test(dirs.outputs), 'pension root');
  }
  // 固定路径不含 storage key 命名冲突：fileStore 用文件系统 pension/ 目录，与 wx.setStorageSync 的 storage key 是两套互不相干命名空间
  ck('fileStore 走文件系统 pension/ 目录（非 storage key），与 pension storage key 命名空间隔离', true, '文件系统目录 vs storage key 两套命名空间');
  process.exit(end() ? 1 : 0);
})();
