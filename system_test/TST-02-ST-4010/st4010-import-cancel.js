/* ST-4010 — 选择取消/空 tempFiles 安静返回、读错归不可读 独立入口（testcase-structure SKILL）
 * input: caseImport.chooseCaseFile（全局 mock wx.chooseMessageFile）；expect:
 *        ① 用户取消(errMsg cancel)→{cancelled:true} ② 空 tempFiles→{cancelled:true} 安静返回
 *        ③ 读文件失败→{cancelled:false,error} 归不可读 ④ 全程不抛异常
 * 公共: system_test/common/st-case-lib.js；运行: node st4010-import-cancel.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const caseImport = require('../../services/caseImport.js');
const { ck, end } = L.makeChecker('ST-4010');

function withWx(mock, fn) { global.wx = mock; return Promise.resolve().then(fn).finally(() => { delete global.wx; }); }

(async () => {
  // 1) 用户取消（fail errMsg 含 cancel）
  let r = await withWx({ chooseMessageFile: o => o.fail({ errMsg: 'chooseMessageFile:fail cancel' }) }, () => caseImport.chooseCaseFile());
  ck('用户取消 chooseCaseFile 返回 cancelled=true', r && r.cancelled === true, JSON.stringify(r));

  // 2) 空 tempFiles（success 但 tempFiles 空数组）
  r = await withWx({ chooseMessageFile: o => o.success({ tempFiles: [] }) }, () => caseImport.chooseCaseFile());
  ck('空 tempFiles 返回 cancelled=true（安静返回）', r && r.cancelled === true, JSON.stringify(r));

  // 3) tempFiles undefined
  r = await withWx({ chooseMessageFile: o => o.success({}) }, () => caseImport.chooseCaseFile());
  ck('tempFiles undefined 返回 cancelled=true', r && r.cancelled === true, JSON.stringify(r));

  // 4) 非取消类选择失败（如权限拒）→ cancelled=false + error（不归取消）
  r = await withWx({ chooseMessageFile: o => o.fail({ errMsg: 'chooseMessageFile:fail auth deny' }) }, () => caseImport.chooseCaseFile());
  ck('非取消失败 cancelled=false 且带 error', r && r.cancelled === false && !!r.error, JSON.stringify(r));

  // 5) importFromConversation：选择取消 → 整体 {cancelled:true}（不进读取/解析）
  r = await withWx({ chooseMessageFile: o => o.fail({ errMsg: 'chooseMessageFile:fail cancel' }) }, () => caseImport.importFromConversation());
  ck('importFromConversation 选择取消 返回 cancelled=true', r && r.cancelled === true, JSON.stringify(r));

  process.exit(end() ? 1 : 0);
})().catch(e => { console.log('FATAL ' + (e && e.message)); process.exit(2); });
