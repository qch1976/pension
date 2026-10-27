/* GT-4030 独立入口（testcase-structure 铁律）— 编译门禁 + entry/basic/compare/compare-result 四页可打开无报错渲染
 * case input : 四页路由集合；compile 门禁 common/compile-gate/compile-exit.js；白屏/报错判定
 * expect     : DevTools compile 无新增错误（exit=0 + √preview 标记 + 无 error 行）；
 *              四页逐页 reLaunch 落地、页面根节点可渲染（非白屏）、全程无 pageError
 * common     : system_test/common/gui-conn-lib.js（连接/导航）
 * run        : node gt-4030.js [port] [--skip-compile]   （dev box 40215 常驻口, 只 connect/disconnect）
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const L = require('../common/gui-conn-lib.js');
const PORT = parseInt(process.argv[2] || '40215', 10);
const SKIP_COMPILE = process.argv.includes('--skip-compile');
const LOG = path.join(__dirname, 'logs'); fs.mkdirSync(LOG, { recursive: true });

// ===== case-specific input: 四页 =====
const PAGES = [
  ['/pages/entry/entry', 'pages/entry/entry', 'entry 数据通道选择页'],
  ['/pages/index/index', 'pages/index/index', 'basic 基本信息录入页'],
  ['/pages/compare/compare', 'pages/compare/compare', 'compare 方案比较页'],
  ['/pages/compare-result/compare-result', 'pages/compare-result/compare-result', 'compare 结果页']
];
const COMPILE_EXIT = path.join(__dirname, '..', 'common', 'compile-gate', 'compile-exit.js');

function runCompileGate() {
  return new Promise(resolve => {
    const child = cp.spawn(process.execPath, [COMPILE_EXIT], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    child.stdout.on('data', d => { buf += d; });
    child.stderr.on('data', () => {});
    child.on('close', code => {
      let marker = null;
      try { marker = JSON.parse(buf.trim().split(/\r?\n/).pop()); } catch (e) {}
      resolve({ code, marker });
    });
  });
}

(async () => {
  const startedAt = new Date().toISOString();
  const rec = L.makeRecorder();
  let mp = null, compile = null, shot = null; const pageRows = []; let pageErrors = [];
  try {
    // ---- 段1 compile 门禁 ----
    if (!SKIP_COMPILE) {
      const cg = await runCompileGate(); compile = cg.marker;
      rec.ck('compile exit=0', 'DevTools compile exit', !!(cg.marker && cg.marker.exitCode === 0), cg.marker && cg.marker.exitCode, 0);
      rec.ck('compile √preview', '真实 preview 标记', !!(cg.marker && cg.marker.previewMark), cg.marker && cg.marker.previewMark, true);
      rec.ck('compile 无 error 行', '无新增错误', !!(cg.marker && (cg.marker.errorLines || []).length === 0), cg.marker && cg.marker.errorLines, []);
    }

    // ---- 段2 四页渲染：复用 common reLaunchReady（路径命中即返回 page）----
    mp = await L.connectExisting(PORT);
    try { mp.on('pageError', e => { pageErrors.push(String(e && (e.message || e))); }); } catch (e) {}

    for (const [route, want, desc] of PAGES) {
      const r = await L.reLaunchReady(mp, route, want, null, { retries: 2, perMs: 15000 });
      const open = !!(r.ok && r.path && r.path.indexOf(want) >= 0);
      let nodeCount = 0, dataKeys = 0;
      if (open && r.page) {
        const d = await L.safeAttempt(() => r.page.data());
        if (d.ok && d.v) dataKeys = Object.keys(d.v).length;
        // automator 不暴露 <page> 标签选择器：统计真实组件 view/button/text 节点判定非白屏
        let elems = [];
        for (const sel of ['view', 'button', 'text']) {
          const q = await L.safeAttempt(() => r.page.$$(sel));
          if (q.ok && Array.isArray(q.v)) elems = elems.concat(q.v);
        }
        nodeCount = elems.length;
      }
      const render = open && nodeCount > 0 && dataKeys > 0;
      rec.ck(desc + ' 可打开', 'reLaunch 落地路由', open, r.path, want);
      rec.ck(desc + ' 非白屏渲染', '根节点可渲染且有数据', render, 'nodes=' + nodeCount + ' keys=' + dataKeys, 'nodes>=1 keys>0');
      pageRows.push({ route, desc, open, nodeCount, dataKeys });
      if (want === 'pages/entry/entry') {
        shot = path.join(LOG, 'GT4030-entry.png');
        await L.safeAttempt(() => mp.screenshot({ path: shot }));
      }
    }
    rec.ck('四页全程无 pageError', '无 JS 报错', pageErrors.length === 0, pageErrors.slice(0, 5), []);
  } catch (e) { rec.ck('FATAL', String((e && e.message) || e), false, String((e && e.message) || e), ''); }
  finally { await L.disconnectQuiet(mp); }

  const t = rec.totals(); const ok = t.fail === 0;
  fs.writeFileSync(path.join(LOG, 'result-GT4030.json'), JSON.stringify({
    case: 'GT-4030', type: 'compile gate + four-page render', ok, startedAt, finishedAt: new Date().toISOString(),
    input: { pages: PAGES.map(p => p[1]), skipCompile: SKIP_COMPILE }, compile, pages: pageRows,
    pageErrors, screenshot: fs.existsSync(shot || '') ? shot : null, totals: t, assertions: rec.list }, null, 2));
  console.log('GT4030 ' + (ok ? 'PASS' : 'FAIL') + ' ' + t.pass + '/' + (t.pass + t.fail) + ' compile=' + JSON.stringify(compile && { exit: compile.exitCode, preview: compile.previewMark, errLines: compile.errorLines.length }));
  process.exit(ok ? 0 : 1);
})();
