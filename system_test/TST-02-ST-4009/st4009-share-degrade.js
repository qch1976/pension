/* ST-4009 — 分享取消/缺失/存盘失败安静降级、报告仍落盘 独立入口（testcase-structure SKILL）
 * input: reportShare.exportAndShare（mock store.writeOutput + wxApi 各降级分支）；expect:
 *        ① 分享取消(cancel)→shareCancelled=true、报告 filePath 仍写盘 ② 分享 API 缺失→shareUnavailable
 *        ③ 存盘 saveFileToDisk 失败/缺失→savedToDisk=false 安静降级 ④ 全程不抛错
 * 公共: system_test/common/st-case-lib.js；运行: node st4009-share-degrade.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const reportShare = require('../../services/reportShare.js');
const { ck, end } = L.makeChecker('ST-4009');

// mock store：writeOutput 成功返回固定路径（报告落盘）
const mockStore = { writeOutput: (base, text) => Promise.resolve('/mock/udata/pension/outputs/' + base + '-x.txt') };
// 最小 data（basic 报告模型容忍空 data，buildBasicReport 返回字符串）
const data = {};

(async () => {
  // 1) 分享取消（errMsg 含 cancel）→ shareCancelled + 报告仍落盘
  let stage = await reportShare.exportAndShare('basic', data, {
    store: mockStore,
    wxApi: { shareFileMessage: o => o.fail({ errMsg: 'shareFileMessage:fail cancel' }), saveFileToDisk: o => o.success({ savedFilePath: '/x' }) },
    now: () => new Date(2026, 9, 22, 1, 2, 3)
  });
  ck('分享取消 shareCancelled=true', stage.shareCancelled === true, JSON.stringify(stage));
  ck('分享取消但报告仍落盘 filePath 非空', !!stage.filePath, stage.filePath);
  ck('分享取消未置 shared=true', stage.shared === false, stage.shared);

  // 2) 分享 API 缺失（wxApi 无 shareFileMessage）→ shareUnavailable 安静降级
  stage = await reportShare.exportAndShare('basic', data, { store: mockStore, wxApi: {}, now: () => new Date() });
  ck('分享 API 缺失 shareUnavailable=true', stage.shareUnavailable === true, JSON.stringify(stage));
  ck('分享缺失报告仍落盘', !!stage.filePath, stage.filePath);

  // 3) 存盘 saveFileToDisk 失败 → savedToDisk=false 安静降级（不抛错）
  stage = await reportShare.exportAndShare('basic', data, {
    store: mockStore,
    wxApi: { shareFileMessage: o => o.success(), saveFileToDisk: o => o.fail({ errMsg: 'saveFileToDisk:fail' }) },
    now: () => new Date()
  });
  ck('分享成功 shared=true', stage.shared === true, JSON.stringify(stage));
  ck('存盘失败 savedToDisk=false（安静降级）', stage.savedToDisk === false, stage.savedToDisk);
  ck('存盘失败不阻断（报告仍落盘 filePath 非空）', !!stage.filePath, stage.filePath);

  // 4) saveFileToDisk API 缺失 → diskAvailable=false 安静降级
  stage = await reportShare.exportAndShare('basic', data, { store: mockStore, wxApi: { shareFileMessage: o => o.success() }, now: () => new Date() });
  ck('存盘 API 缺失 savedToDisk=false（安静降级）', stage.savedToDisk === false, JSON.stringify(stage));

  process.exit(end() ? 1 : 0);
})().catch(e => { console.log('FATAL ' + (e && e.message)); process.exit(2); });
