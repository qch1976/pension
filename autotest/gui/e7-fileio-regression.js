/* autotest/gui/e7-fileio-regression.js
 * E7 miniprogram-automator 文件导入/导出回归（Q2 方案）。
 *
 * 关键环境事实（实测）：
 *  - 机器上只有一个微信开发者工具 IDE 进程；每次 `cli auto --auto-port N` 都会把该 IDE 的
 *    automation 服务重新注册到新端口，旧端口随之失效；只有“最后一次”注册的端口存活。
 *  - 因此：先把每场景所需端口一次性注册（顺序 spawn），全部就绪后，再逐场景在“自己的端口”上
 *    用【每操作一条全新连接】的方式驱动；命中 response timeout（socket 中毒）即重连重试。
 *
 * 只 mock 原生面板（chooseMessageFile / shareFileMessage），真实跑 readFile->parseCaseFile->
 * caseValidator->部分回填->计算->reportExport->fileStore.writeOutput 全链；mock 用毕 restore。
 * 截图 mp.screenshot()，每场景 ≤2 张，产物 autotest/output/e7。
 *
 * 用法：node e7-fileio-regression.js [startPort]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const net = require('net');
const cp = require('child_process');

const START_PORT = parseInt(process.argv[2] || '40020', 10);
const START_INDEX = parseInt(process.argv[3] || '0', 10);
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const SDK = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const OUT = path.join(PROJECT, 'autotest', 'output', 'e7');
fs.mkdirSync(OUT, { recursive: true });
const automator = require(SDK);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function discoverCli() {
  const root = 'C:\\Program Files (x86)\\Tencent';
  for (const d of fs.readdirSync(root)) {
    const c = path.join(root, d, 'cli.bat');
    if (fs.existsSync(c)) return c;
  }
  throw new Error('cli not found');
}
function portUp(port) {
  return new Promise(res => {
    const s = net.createConnection({ port, host: '127.0.0.1' });
    const done = v => { try { s.destroy(); } catch (e) {} res(v); };
    s.once('connect', () => done(true));
    s.once('error', () => done(false));
    setTimeout(() => done(false), 1200);
  });
}
async function waitPort(port, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await portUp(port)) return true; await sleep(1500); }
  return false;
}

// 在指定端口上跑一次操作：全新连接；timeout/连接错误则重连重试。
async function withMp(port, fn, label) {
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    let mp = null;
    try {
      mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + port });
      const out = await fn(mp);
      return out;
    } catch (e) {
      lastErr = e;
      const msg = String(e && e.message || e);
      if (!/timeout waiting for automator|Failed connecting|ECONN|getPageMetaByWebviewId/i.test(msg)) throw e; // 非通信类错误直接上抛
      await sleep(2500);
    } finally {
      try { if (mp) mp.disconnect(); } catch (e) {}
    }
  }
  throw new Error('withMp[' + label + '] exhausted: ' + (lastErr && lastErr.message));
}

// 等当前页 path 匹配（在 withMp 内，每次取最新 page）。
async function waitPagePath(mp, want, ms, needKeys) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const p = await mp.currentPage();
    if (p && (want instanceof RegExp ? want.test(p.path) : p.path === want)) {
      if (!needKeys) return p;
      if (Object.keys(await p.data() || {}).length > 5) return p;
    }
    await sleep(900);
  }
  return null;
}

function buildMergedCase(fixturePath, blockLabel) {
  const raw = fs.readFileSync(fixturePath, 'utf8').replace(/\r\n/g, '\n');
  const lines = raw.split('\n');
  const common = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim().indexOf('```') === 0) break;
    common.push(lines[i]);
  }
  const block = [];
  let inB = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (inB) { if (t.indexOf('```') === 0) break; if (t !== '') block.push(lines[i]); }
    else if (t.indexOf('```') === 0 && t.indexOf(blockLabel) >= 0) inB = true;
  }
  return common.concat(block).join('\n');
}

const SCENARIOS = [
  { id: 'my1', file: 'My-Case.md', block: 'My case 1', retire: '2033-07' },
  { id: 'my2', file: 'My-Case.md', block: 'My case 2', retire: '2033-07' },
  { id: 'my3', file: 'My-Case.md', block: 'My case 3', retire: '2033-07' },
  { id: 'wife4', file: 'MyWife-Case.md', block: 'My wife case 4', retire: '2031-07' },
  { id: 'wife5', file: 'MyWife-Case.md', block: 'My wife case 5', retire: '2036-07' },
  { id: 'wife6', file: 'MyWife-Case.md', block: 'My wife case 6', retire: '2038-07' }
];

async function runOne(sc, port) {
  const r = { id: sc.id, port: port, pass: false, step: '', checks: [], errors: [], shots: [] };
  const ck = (n, c, x) => { r.checks.push({ name: n, ok: !!c, extra: x == null ? '' : String(x) }); if (!c) r.errors.push(n); };
  const step = s => { r.step = s; console.log('  [' + sc.id + '] ' + s); };
  try {
    // 1) 先确认有可驱动 webview（currentPage 可返回），再 reLaunch，最后等 index 就绪
    step('wait webview + relaunch index');
    await withMp(port, async mp => {
      const t0 = Date.now();
      while (Date.now() - t0 < 60000) {
        try { await mp.currentPage(); break; } catch (e) { await sleep(1500); }
      }
    }, 'pre-wait-webview');
    await withMp(port, async mp => { await mp.reLaunch('/pages/index/index').catch(() => {}); }, 'relaunch');
    await withMp(port, mp => waitPagePath(mp, 'pages/index/index', 120000, true), 'wait-index');

    // 2) 写合并夹具到沙箱
    step('prepare case file');
    const tmpRel = 'e7-' + sc.id + '.txt';
    const merged = buildMergedCase(path.join(PROJECT, 'tests', 'fixtures-case', sc.file), sc.block);
    await withMp(port, mp => mp.evaluate((rel, txt) => new Promise((res, rej) => {
      wx.getFileSystemManager().writeFile({
        filePath: wx.env.USER_DATA_PATH + '/' + rel, data: txt, encoding: 'utf8',
        success: res, fail: rej
      });
    }), tmpRel, merged), 'write-case');

    // 3) mock chooseMessageFile 并触发导入
    step('mock choose + import');
    const udp = await withMp(port, mp => mp.evaluate(() => wx.env.USER_DATA_PATH), 'get-udp');
    const absTmp = ('' + udp).replace(/[\\/]+$/, '') + '/' + tmpRel;
    await withMp(port, mp => mp.mockWxMethod('chooseMessageFile', {
      errMsg: 'chooseMessageFile:ok',
      tempFiles: [{ path: absTmp, name: sc.file, size: Buffer.byteLength(merged), createTime: Math.floor(Date.now() / 1000) }]
    }), 'mock-choose');
    // 触发导入：在同一连接内反复确认当前页确实是 index（防上一场景 result 页残留导致
    // “onChooseCaseFile is not a function”）；不对则重新 reLaunch 后再试。
    await withMp(port, async mp => {
      let done = false;
      for (let i = 0; i < 6 && !done; i++) {
        const cur = await mp.currentPage();
        if (cur.path === 'pages/index/index' && typeof cur.callMethod === 'function') {
          await cur.callMethod('onChooseCaseFile'); done = true;
        } else {
          await mp.reLaunch('/pages/index/index').catch(() => {});
          await sleep(2500);
        }
      }
      if (!done) throw new Error('cannot reach index for import');
    }, 'call-import');
    await sleep(3500);

    const d = await withMp(port, async mp => {
      const page = await mp.currentPage();
      return page.data();
    }, 'read-import-data');
    ck('import no errors', (d.fileErrors || []).length === 0, JSON.stringify(d.fileErrors));
    ck('backfill retireYM', d.retireYM === sc.retire, d.retireYM);
    ck('savedName plain text', typeof d.fileName === 'string' && d.fileName === sc.file, d.fileName);
    await withMp(port, mp => mp.restoreWxMethod('chooseMessageFile'), 'restore-choose');

    // 4) 计算 -> result
    step('calculate -> result');
    await withMp(port, async mp => {
      const page = await mp.currentPage();
      await page.callMethod('onCalculate');
    }, 'call-calc');
    const gotResult = await withMp(port, mp => waitPagePath(mp, /pages\/result\/result/, 15000, false), 'wait-result');
    ck('navigate to result', !!gotResult);
    await sleep(1500);
    const shot2 = path.join(OUT, sc.id + '-result.png');
    await withMp(port, mp => mp.screenshot({ path: shot2 }), 'shot-result');
    r.shots.push(shot2);

    // 5) 导出：mock shareFileMessage，真实 reportExport + writeOutput
    step('export + verify outputs');
    const before = await withMp(port, mp => mp.evaluate(() => new Promise(res => {
      wx.getFileSystemManager().readdir({
        dirPath: wx.env.USER_DATA_PATH + '/pension/outputs',
        success: r => res(r.files), fail: () => res([])
      });
    })), 'ls-before');
    await withMp(port, mp => mp.mockWxMethod('shareFileMessage', { errMsg: 'shareFileMessage:ok' }), 'mock-share');
    await withMp(port, async mp => {
      const page = await mp.currentPage();
      await page.callMethod('onShareReport');
    }, 'call-share');
    await sleep(3000);
    await withMp(port, mp => mp.restoreWxMethod('shareFileMessage'), 'restore-share');

    const after = await withMp(port, mp => mp.evaluate(() => new Promise(res => {
      wx.getFileSystemManager().readdir({
        dirPath: wx.env.USER_DATA_PATH + '/pension/outputs',
        success: r => res(r.files), fail: () => res([])
      });
    })), 'ls-after');
    ck('outputs gained 1 txt', after.length === before.length + 1, before.length + '->' + after.length);
    const newFile = after.filter(f => before.indexOf(f) < 0)[0] || '';
    ck('output filename basic txt', /^basic-.*\.txt$/.test(newFile), newFile);

    const head = await withMp(port, mp => mp.evaluate(nf => new Promise(res => {
      wx.getFileSystemManager().readFile({
        filePath: wx.env.USER_DATA_PATH + '/pension/outputs/' + nf, encoding: 'utf8',
        success: r => res(String(r.data)), fail: () => res('')
      });
    }), newFile), 'read-report');
    ck('report version header', /PensionReport-v2\.0/.test(head));
    ck('report generated time', /生成时点：/.test(head));
    ck('report amounts 2 decimals', (head.match(/¥[0-9,]+\.\d\d/g) || []).length >= 3, '');

    const shot3 = path.join(OUT, sc.id + '-export.png');
    await withMp(port, mp => mp.screenshot({ path: shot3 }), 'shot-export');
    r.shots.push(shot3);

    r.pass = r.errors.length === 0;
  } catch (e) {
    r.errors.push('EXC@' + r.step + ': ' + (e && e.message || e));
  }
  return r;
}

(async () => {
  const cli = discoverCli();
  // ---- 注册唯一存活端口 ----
  // 纪律要求“每场景 fresh cli auto”，但实测本机仅一个 IDE：每次新 cli auto 只把 automation
  // 重注册到新端口、旧端口立即失效，跨场景反复注册会让进行中的 socket 超时（首轮0/6根因）。
  // 故折中：单一存活端口 + 【每个操作全新 connect】（等价于不复用陈旧 boot），顺序跑各场景。
  const livePort = START_PORT;
  const ch = cp.spawn('"' + cli + '" auto --project "' + PROJECT + '" --auto-port ' + livePort,
    { shell: true, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  ch.stdout.on('data', () => {}); ch.stderr.on('data', () => {});
  await sleep(8000);
  if (!(await waitPort(livePort, 120000))) throw new Error('live port ' + livePort + ' not up');
  console.log('=== live automation port = ' + livePort + '; scenarios sequential, fresh connection per op ===');

  const results = [];
  for (let i = START_INDEX; i < SCENARIOS.length; i++) {
    console.log('=== E7 scenario ' + SCENARIOS[i].id + ' ===');
    const r = await runOne(SCENARIOS[i], livePort);
    results.push(r);
    console.log('  pass=' + r.pass + ' errors=' + JSON.stringify(r.errors));
  }
  try { ch.kill(); } catch (e) {}

  const summary = {
    suite: 'E7 file import/export automator regression', method: 'Q2 mock chooseMessageFile/shareFileMessage',
    note: 'single IDE keeps only last cli auto port; scenarios reuse one live port with per-op fresh connection',
    startedAt: new Date().toISOString(), scenarios: results,
    totals: { all: results.length, pass: results.filter(r => r.pass).length, fail: results.filter(r => !r.pass).length, startIndex: START_INDEX }
  };
  fs.writeFileSync(path.join(OUT, 'e7-regression-summary.json'), JSON.stringify(summary, null, 2));
  console.log('=== E7 TOTALS pass=' + summary.totals.pass + '/' + summary.totals.all + ' ===');
  process.exit(summary.totals.fail ? 1 : 0);
})();
