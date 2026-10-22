/* ST-4103 — 默认手工、setInputMode 按 dataset.v 切换 独立入口（testcase-structure SKILL）
 * input: 以 mock global.Page 捕获 compare.js 与 index.js 页面对象；expect:
 *        ① 两页 data.inputMode 默认='manual'（手工，手工流程零差异）
 *        ② setInputMode(e) 按 e.currentTarget.dataset.v 切换 inputMode（manual/file 来回）
 * 公共: system_test/common/st-case-lib.js；运行: node st4103-inputmode-toggle.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const path = require('path');
const { ck, end } = L.makeChecker('ST-4103');

// 捕获页面对象（mock Page/getApp/wx 最小环境）
function loadPage(rel) {
  let captured = null;
  global.Page = cfg => { captured = cfg; };
  global.getApp = () => ({ globalData: {} });
  global.wx = {
    env: { USER_DATA_PATH: '/mock' },
    getFileSystemManager: () => ({}),
    setStorageSync: () => {}, getStorageSync: () => null,
    showLoading: () => {}, hideLoading: () => {}, showModal: () => {}, showToast: () => {},
    navigateTo: () => {}, redirectTo: () => {}, reLaunch: () => {}
  };
  const mod = path.join(L.ROOT, rel);
  delete require.cache[require.resolve(mod)];
  try { require(mod); } catch (e) { /* 页面顶层副作用可忽略，仅需 Page 配置 */ }
  delete global.Page; delete global.getApp; delete global.wx;
  return captured;
}

// 实例化 page 上下文（this.setData 合并到 data）
function instantiate(pageCfg) {
  const inst = Object.assign({}, pageCfg);
  inst.data = JSON.parse(JSON.stringify(pageCfg.data || {}));
  inst.setData = function (patch) { Object.assign(this.data, patch); };
  return inst;
}

const pages = [
  ['compare 页', 'pages/compare/compare.js'],
  ['basic(index) 页', 'pages/index/index.js']
];
for (const [name, rel] of pages) {
  const cfg = loadPage(rel);
  ck(name + ' 可被捕获且含 setInputMode', !!(cfg && cfg.setInputMode), rel);
  if (!cfg) continue;
  const inst = instantiate(cfg);
  ck(name + ' 默认 inputMode=manual（默认手工）', inst.data.inputMode === 'manual', inst.data.inputMode);
  // 切到 file
  inst.setInputMode({ currentTarget: { dataset: { v: 'file' } } });
  ck(name + ' setInputMode 切到 file', inst.data.inputMode === 'file', inst.data.inputMode);
  // 切回 manual
  inst.setInputMode({ currentTarget: { dataset: { v: 'manual' } } });
  ck(name + ' setInputMode 切回 manual', inst.data.inputMode === 'manual', inst.data.inputMode);
  // dataset.v 透传（按值切换，不硬编码）
  inst.setInputMode({ currentTarget: { dataset: { v: 'file' } } });
  ck(name + ' dataset.v 透传按值切换（file）', inst.data.inputMode === 'file', inst.data.inputMode);
}

process.exit(end() ? 1 : 0);
