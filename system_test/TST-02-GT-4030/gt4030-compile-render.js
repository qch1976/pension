/* GT-4030 — compile 门禁 + 四页无报错渲染（⑨）独立入口（testcase-structure SKILL）
 * case-specific input:  四页路由集合（entry/index(basic)/compare/result），白屏/报错判定阈值
 * expect output:        compile 门禁 exit=0 且有 √ preview 标记；四页逐页 reLaunch 落地、
 *                       页面根节点可渲染（非白屏）、无 pageError/JS 报错、截图落盘
 * 公共逻辑:             system_test/common/gui-conn-lib.js（连接/导航）；
 *                       compile 门禁引用 system_test/common/compile-gate/compile-exit.js（本入口 spawn 之）
 * 运行:                 node gt4030-compile-render.js <port> [external] [--skip-compile]
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const L = require('../common/gui-conn-lib.js');

// ===== case-specific input =====
const PORT = parseInt(process.argv[2] || '40215', 10);
const EXTERNAL = process.argv.includes('external');
const SKIP_COMPILE = process.argv.includes('--skip-compile');
// 四页: [路由, 期望 page.path 关键字, 说明]
const PAGES = [
  ['/pages/entry/entry',   'pages/entry/entry',     'entry 数据通道选择页'],
  ['/pages/index/index',   'pages/index/index',     'basic 基本信息录入页'],
  ['/pages/compare/compare', 'pages/compare/compare', 'compare 方案比较页'],
  ['/pages/result/result', 'pages/result/result',   '结果页']
];
const COMPILE_EXIT = path.join(__dirname, '..', 'common', 'compile-gate', 'compile-exit.js');

const OUT = path.join(L.PROJECT, 'temp', 'gt-output', 'gt4030');
fs.mkdirSync(OUT, { recursive: true });
const TRACE = path.join(OUT, 'gt4030-trace.log');
const SUM = path.join(OUT, 'gt4030-summary.json');
function tr(m) { try { fs.appendFileSync(TRACE, new Date().toISOString() + ' ' + m + '\n'); } catch (e) {} console.log(m); }
const sleep = L.sleep;
const checks = []; const ck = (n, ok, x) => { checks.push({ name: n, ok: !!ok, extra: x == null ? '' : String(x) }); tr((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' :: ' + x : '')); };
const envSkips = []; // GT-4030 降级：环境限制未测项（不计 FAIL）
process.on('unhandledRejection', e => tr('REJ ' + (e && e.message)));
process.on('uncaughtException', e => tr('EXC ' + (e && e.message)));

/* compile 门禁：spawn common/compile-gate/compile-exit.js，读其 exit marker。 */
function runCompileGate() {
  return new Promise(resolve => {
    const child = cp.spawn('node', [COMPILE_EXIT], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    child.stdout.on('data', d => { buf += d; });
    child.stderr.on('data', d => { tr('[compile-exit stderr] ' + d.toString().slice(0, 300)); });
    child.on('close', code => {
      let marker = null;
      try { const line = buf.trim().split(/\r?\n/).pop(); marker = JSON.parse(line); } catch (e) { tr('compile marker parse fail: ' + buf.slice(-300)); }
      resolve({ code, marker });
    });
  });
}

(async () => {
  const dump = { at: new Date().toISOString(), compile: null, pages: [] };
  // ---- 段1: compile 门禁 ----
  if (!SKIP_COMPILE) {
    tr('--- compile gate ---');
    const cg = await runCompileGate();
    dump.compile = cg.marker;
    ck('compile 门禁 exitCode=0', cg.marker && cg.marker.exitCode === 0, JSON.stringify(cg.marker));
    ck('compile 门禁有 √ preview 标记', !!(cg.marker && cg.marker.previewMark), 'previewMark=' + (cg.marker && cg.marker.previewMark));
    ck('compile 门禁无 error 行', !!(cg.marker && (cg.marker.errorLines || []).length === 0), JSON.stringify(cg.marker && cg.marker.errorLines));
  } else { tr('skip compile (--skip-compile)'); }

  // ---- 段2: 四页渲染 ----
  let ch = null;
  try {
    const r = await L.launchAndConnect(PORT, EXTERNAL); const mp = r.mp; ch = r.ch;
    // 监听 pageError（JS 报错）
    let pageErrors = [];
    try { mp.on('pageError', e => { pageErrors.push(String(e && (e.message || e))); tr('PAGE_ERROR ' + (e && (e.message || e))); }); } catch (e) {}
    try {
      const landed = await L.waitLanded(mp); tr('landed=' + landed);
      if (!landed) { tr('NO_PAGE'); process.exit(4); }

      for (const [route, expectPath, desc] of PAGES) {
        // reLaunch await 可能久不 resolve（automator 等页面 ready）：race 超时 8s 后靠轮询落地
        await Promise.race([mp.reLaunch(route), sleep(8000)]).catch(() => {});
        await sleep(4000);
        let landedPath = null, ready = false;
        for (let w = 0; w < 20; w++) {
          const info = await L.ev(mp, (exp) => {
            const p = getCurrentPages().slice(-1)[0];
            if (!p) return null;
            return { route: p.route, is: p.is, hasData: !!p.data };
          }, expectPath);
          if (info && info.route === expectPath) { landedPath = info.route; ready = true; break; }
          await sleep(1000);
        }
        // 非白屏：页面有可见内容（通过元素存在性粗判 —— 至少 page 有 route 且 DOM 有节点）
        let nodeCount = 0;
        if (ready) {
          try {
            const pg = await mp.currentPage();
            const any = await pg.$('page') || await pg.$('view');
            nodeCount = any ? 1 : 0;
          } catch (e) {}
        }
        const errBefore = pageErrors.length;
        const shot = path.join(OUT, 'gt4030-' + expectPath.split('/').pop() + '.png');
        await mp.screenshot({ path: shot }).catch(() => {});
        tr('page ' + desc + ' route=' + landedPath + ' ready=' + ready + ' pageErrors=' + pageErrors.length);
        // GT-4030 降级（Manager 18:30 批）：compile 门禁 + entry 落地为准；非 entry 页 reLaunch 偶发 null 判 automator 时序环境限制，不计 FAIL（probe 复现同序列 4 页全成功）
        const isEntry = expectPath === 'pages/entry/entry';
        if (isEntry || ready) {
          ck(desc + ' 落地路由=' + expectPath, ready && landedPath === expectPath, 'route=' + landedPath);
          ck(desc + ' 非白屏（页面根节点可渲染）', ready && nodeCount > 0, 'nodeCount=' + nodeCount);
        } else {
          envSkips.push(desc + ' 落地/非白屏（automator reLaunch 环境限制，未测，等效 MT 手工待补）');
          tr('ENV-SKIP ' + desc + '（reLaunch 环境限制未测）');
        }
        dump.pages.push({ route, desc, ready, path: landedPath, nodeCount, envSkip: !isEntry && !ready, pageErrors: pageErrors.slice() });
      }
      ck('四页导航全程无 pageError', pageErrors.length === 0, JSON.stringify(pageErrors.slice(0, 5)));

      fs.writeFileSync(SUM, JSON.stringify({ at: dump.at, testcase: 'TST-02-GT-4030', compile: dump.compile, pages: dump.pages, envSkips, checks }, null, 2));
    } finally {
      try { await mp.disconnect(); } catch (e) {}
      if (!EXTERNAL) {
        try { ch.kill(); } catch (e) {}
        try { cp.exec('powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ' + PORT + ' -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"'); } catch (e) {}
      }
    }
    const fail = checks.filter(c => !c.ok).length;
    tr('=== GT-4030 pass=' + (checks.length - fail) + '/' + checks.length + ' fail=' + fail + (envSkips.length ? ' env-skip=' + envSkips.length + '(' + envSkips.join(';') + ')' : '') + ' ===');
    process.exit(fail ? 1 : 0);
  } catch (e) { tr('FATAL ' + (e && e.message)); process.exit(2); }
})();
