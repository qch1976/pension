/* ST-4100 — 静态扫描 services/calculator/pages 无 wx.request/socket 等网络 API 独立入口（testcase-structure SKILL）
 * input: 扫描 services/ calculator/ pages/ 全部 .js 源码；expect:
 *        不出现 wx.request / wx.uploadFile / wx.downloadFile / wx.connectSocket / WebSocket / XMLHttpRequest / fetch(
 *        —— pension 为纯本地计算小程序，禁止任何网络/云调用（NFR-004 数据不出设备）
 * 公共: system_test/common/st-case-lib.js；运行: node st4100-no-network.js
 */
'use strict';
const L = require('../common/st-case-lib.js');
const fs = require('fs'), path = require('path');
const { ck, end } = L.makeChecker('ST-4100');

// case-specific input: 扫描目录与网络 API 黑名单
const SCAN_DIRS = ['services', 'calculator', 'pages'];
const NETWORK_APIS = [
  /\bwx\.request\s*\(/, /\bwx\.uploadFile\s*\(/, /\bwx\.downloadFile\s*\(/,
  /\bwx\.connectSocket\s*\(/, /\bwx\.sendSocketMessage\s*\(/,
  /\bWebSocket\s*\(/, /\bnew\s+WebSocket/, /\bXMLHttpRequest\b/,
  /\bfetch\s*\(/, /\bwx\.cloud\b/, /\bwx\.requestSubscribeMessage\s*\(/
];

function listJs(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.js$/.test(e.name)) out.push(p);
    }
  })(path.join(L.ROOT, dir));
  return out;
}

let totalFiles = 0; const hits = [];
for (const dir of SCAN_DIRS) {
  for (const file of listJs(dir)) {
    totalFiles++;
    const src = fs.readFileSync(file, 'utf8');
    // 去注释与字符串噪声（仅粗判：黑名单 API 调用形态）
    for (const re of NETWORK_APIS) {
      if (re.test(src)) hits.push(path.relative(L.ROOT, file) + ' <= ' + re.source);
    }
  }
}
ck('扫描 services/calculator/pages .js 文件数>0', totalFiles > 0, 'files=' + totalFiles);
ck('无 wx.request 调用', !hits.some(h => /wx\\?\.request/.test(h)), hits.filter(h => /request/.test(h)).join(';'));
ck('无 wx.uploadFile/downloadFile 调用', !hits.some(h => /uploadFile|downloadFile/.test(h)), '');
ck('无 socket/WebSocket 调用', !hits.some(h => /[Ss]ocket|WebSocket/.test(h)), '');
ck('无 XMLHttpRequest/fetch/cloud 调用', !hits.some(h => /XMLHttpRequest|fetch|cloud/.test(h)), '');
ck('全程零网络 API 命中', hits.length === 0, hits.slice(0, 8).join(' | '));

process.exit(end() ? 1 : 0);
