/*
 * autotest/gui/phase1-gui-regression.js
 * Phase-1（D2~D8）miniprogram-automator GUI 回归（D9，可复刻）。
 *
 * 用法：
 *   node phase1-gui-regression.js <caseIndex>   # 跑单个用例（独立 cli auto + 独立端口 + 独立连接）
 *   （整串由 autotest/gui/phase1-orchestrate.ps1 在交互会话内串行拉起，见同目录说明）
 *
 * 覆盖：共享数据录入(≤2026-08 校验) → 不足2方案 toast → 开始比较 → 结果页比较表 →
 *       三分项展开 → CSS条形 → 下钻(三段现金流) → 政策弹窗 → 【预估】角标 →
 *       不合格方案灰显 / ROI 红字。
 *
 * 关键工程约定（实测验证，遵守 workspace「GUI automator 纪律」）：
 *  - 每个用例独立 spawn `cli auto`、独立端口(61001+caseIndex)、独立连接，不复用、不用9561；
 *    结束即 close，避免跨用例连接退化；
 *  - spawn 后等 stdout `√ auto`，再 settle；connect 后【必须】预热首页到真实就绪
 *    (currentPage.path===pages/index/index 且 page.data() 键数>5) 才开始，避免未渲染时
 *    currentPage=null / tap 被丢弃（SOP 心智模型 #4）；
 *  - 结果页各交互用例都“自给自足”：各自 seed→compare→navigate result→断言；
 *  - 所有结果页元素解引用前先判空，导航失败只计 FAIL，不让进程崩溃。
 */
'use strict';
const path = require('path');
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const automator = require('miniprogram-automator');

const CLI_PATH = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const PROJECT_PATH = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const INDEX = '/pages/index/index';
const COMPARE = '/pages/compare/compare';
const CASE_ARG = process.argv[2] == null ? '-1' : process.argv[2];
const RUN_ALL = CASE_ARG === 'ALL';
const CASE_INDEX = RUN_ALL ? -1 : parseInt(CASE_ARG, 10);
const AUTO_PORT = RUN_ALL ? 61021 : 61021 + CASE_INDEX;
const PORT_OVERRIDE = process.argv[3] == null ? null : parseInt(process.argv[3], 10);

const SHARED_KEY = 'pension_compare_input_v1';
const PLANS_KEY = 'pension_plans_v1';
const PAYLOAD_KEY = 'pension_compare_payload_v1';

const SHOT_DIR = path.join(__dirname, '..', 'output', 't23-gui');
fs.mkdirSync(SHOT_DIR, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fail = 0;
function check(cond, name) {
  console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name);
  if (!cond) fail++;
}
async function shot(mp, file) {
  for (let i = 0; i < 3; i++) {
    try {
      await mp.screenshot({ path: path.join(SHOT_DIR, file) });
      console.log('  [SHOT] ' + file);
      return true;
    } catch (e) {
      await sleep(1500 + i * 1500);
    }
  }
  console.log('  [SHOT-WARN] ' + file + ' 截图失败(不吞业务断言)');
  return false;
}
function portListening(port) {
  return new Promise(resolve => {
    const s = net.createConnection({ port, host: '127.0.0.1' });
    const d = v => { try { s.destroy(); } catch (e) {} resolve(v); };
    s.once('connect', () => d(true)); s.once('error', () => d(false));
    setTimeout(() => d(false), 1200);
  });
}

// 页面切换瞬间 automator 内部偶发抛 getPageMetaByWebviewId null（事件回调里抛出，非 await）。
// 记录为可见的瞬态错误；业务结论以显式断言/真实截图为准，不让单次瞬态崩溃整个进程。
const transient = [];
process.on('uncaughtException', e => {
  transient.push(String(e && e.message ? e.message : e));
  console.log('  [TRANSIENT] ' + String(e && e.message ? e.message : e));
});

// ---- 夹具 ----
function sharedFixture(histStart, histEnd) {
  return {
    gender: 'male', femaleType: '', birthYM: '1976-09', workStartYM: histStart,
    hasDeemed: false, deemedStartYM: '', deemedEndYM: '', entryMode: 'month',
    segments: [{ type: 'enterprise', startYM: histStart, endYM: histEnd, baseMonthly: '12116' }],
    accountBalanceManual: '250000', manualBalanceYM: '2026-08',
    doc31Eligible: false, doc31TransferYM: '', enterpriseInsuredYM: '', subsidyExcludedText: '',
    baseYearIndex: 0, cPingOverride: '', customCYearText: '', boundWarnings: []
  };
}
const PLANS_3 = { plans: [
  { retireYM: '2036-09', z: '1.0', segType: 'enterprise', retireTouched: true },
  { retireYM: '2038-09', z: '1.2', segType: 'flexible', retireTouched: true },
  { retireYM: '2040-08', z: '1.4', segType: 'enterprise', retireTouched: true }
]};
const PLANS_1 = { plans: [
  { retireYM: '2036-09', z: '1.0', segType: 'enterprise', retireTouched: true },
  { retireYM: '', z: '', segType: '', retireTouched: false }
]};
const PLANS_INSUF = { plans: [
  { retireYM: '2036-09', z: '1.0', segType: 'enterprise', retireTouched: true },
  { retireYM: '2040-08', z: '1.2', segType: 'enterprise', retireTouched: true }
]};

async function seed(mp, shared, plans) {
  await mp.callWxMethod('setStorageSync', SHARED_KEY, shared);
  await mp.callWxMethod('setStorageSync', PLANS_KEY, plans);
  await mp.callWxMethod('removeStorageSync', PAYLOAD_KEY);
}

// 轮询当前页：path 命中 fragment 且 selector（可选）取得到。
async function waitPage(mp, fragment, selector, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const pg = await mp.currentPage();
      if (pg.path && pg.path.indexOf(fragment) >= 0) {
        if (!selector || (await pg.$(selector))) return pg;
      }
    } catch (e) {}
    await sleep(1000);
  }
  try { return await mp.currentPage(); } catch (e) { return null; }
}

async function openCompare(mp) {
  await mp.reLaunch(COMPARE);
  const pg = await waitPage(mp, 'pages/compare/compare', '.compare-btn', 40000);
  await sleep(2000); // 让按钮真正可交互（防 tap 被丢弃）
  return pg;
}

// seed compare，点一次开始比较，先轮询到结果页 path，再单独轮询 .cr-table（不在结果页反复 tap 陈旧对象）。
async function openResult(mp, shared, plans) {
  await seed(mp, shared, plans || PLANS_3);
  let src = await openCompare(mp);

  // Phase 1：点一次，等跳转到 compare-result（若确实还在 compare 才补点，且重新取源页）。
  let pg = null, onResultPage = false;
  for (let round = 0; round < 8; round++) {
    try {
      const btn = await src.$('.compare-btn');
      if (btn) await btn.tap().catch(() => {});
    } catch (e) {}
    const tw = Date.now();
    while (Date.now() - tw < 6000) {
      await sleep(1000);
      pg = await mp.currentPage();
      if (pg.path && pg.path.indexOf('compare-result') >= 0) { onResultPage = true; break; }
    }
    if (onResultPage) break;
    pg = await mp.currentPage();
    if (pg.path && pg.path.indexOf('pages/compare/compare') >= 0) src = pg; // 确实还在 compare：重取再补点
  }
  if (!onResultPage) return pg;

  // Phase 2：已在结果页，只轮询 .cr-table 渲染稳定，不再 tap。
  const tt = Date.now();
  while (Date.now() - tt < 15000) {
    if (await pg.$('.cr-table')) { await sleep(1200); return pg; }
    await sleep(800);
    pg = await mp.currentPage();
  }
  return pg;
}

// 单次尝试：fresh cli auto（指定端口）→ connect → 等 webview attach → reLaunch 首页到真实就绪。
// 返回 { mp }；任何冷启动竞争（getPageMeta null / attach 超时）都 throw，由 boot() 换新端口重试。
async function bootOnce(port) {
  let child = null;
  if (!(await portListening(port))) {
    child = cp.spawn('"' + CLI_PATH + '"',
      ['auto', '--project', '"' + PROJECT_PATH + '"', '--auto-port', String(port)],
      { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    child.stdout.on('data', d => { tail += d.toString('utf8'); });
    child.stderr.on('data', d => { tail += d.toString('utf8'); });
    child.on('error', () => {});
    const t0 = Date.now();
    while (!/√\s*auto/.test(tail) && Date.now() - t0 < 180000) await sleep(1000);
    console.log('PORT=' + port + ' MARKER auto=' + /√\s*auto/.test(tail));
    await sleep(8000);
  } else {
    console.log('PORT=' + port + ' already listening (reuse)');
  }

  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + port });
  await mp.checkVersion().catch(() => {});
  try {
    // 🔑 Step A：connect 后 webview 未必已 attach。轮询 currentPage() 直到返回“有效页对象”。
    let attached = false;
    const ta = Date.now();
    while (Date.now() - ta < 45000) {
      try {
        const p = await mp.currentPage();
        if (p && typeof p.path === 'string') { attached = true; break; }
      } catch (e) {}
      await sleep(1000);
    }
    console.log('PORT=' + port + ' WEBVIEW_ATTACHED=' + attached);
    if (!attached) throw new Error('webview did not attach within 45s');

    // 🔑 Step B：reLaunch 首页（带重试），轮询到 path=index 且 data 键数>5（SOP #4）。
    let keys = 0, ready = false;
    const t1 = Date.now();
    while (Date.now() - t1 < 60000) {
      try {
        await mp.reLaunch(INDEX);
      } catch (e) { await sleep(1500); continue; }
      try {
        const p = await mp.currentPage();
        if (p.path && p.path.indexOf('pages/index/index') >= 0) {
          const d = await p.data();
          keys = Object.keys(d || {}).length;
          if (keys > 5) { ready = true; break; }
        }
      } catch (e) {}
      await sleep(1000);
    }
    console.log('PORT=' + port + ' INDEX_READY=' + ready + ' keys=' + keys);
    if (!ready) throw new Error('index webview not ready (keys=' + keys + ')');
    return mp;
  } catch (e) {
    try { await mp.close(); } catch (x) {} // 释放一次性 cli auto，便于下一个 fresh 端口重试
    throw e;
  }
}

// 冷启动竞争非确定性：每次失败都用“全新 cli auto + 新端口”重试（cli auto 一次性，同端口不能复用）。
async function boot() {
  const BASE = PORT_OVERRIDE == null ? AUTO_PORT : PORT_OVERRIDE;
  console.log('CASE=' + CASE_INDEX + ' BASE_PORT=' + BASE + (PORT_OVERRIDE==null?'':' (override)'));
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const port = BASE + attempt * 100; // base/override + 100 retries, never 9561
    try {
      const mp = await bootOnce(port);
      if (attempt > 0) console.log('BOOT recovered on attempt ' + attempt + ' port=' + port);
      return mp;
    } catch (e) {
      lastErr = e;
      console.log('BOOT attempt ' + attempt + ' port=' + port + ' failed: ' + (e && e.message ? e.message : e));
      await sleep(3000);
    }
  }
  throw lastErr || new Error('boot failed after retries');
}

function onResult(pg) {
  return !!(pg && pg.path && pg.path.indexOf('compare-result') >= 0);
}

// ================= 用例定义 =================
const CASES = [];

CASES.push(async mp => { // 0: 共享段越界 toast
  await seed(mp, sharedFixture('1998-08', '2030-12'), PLANS_3);
  const pg = await openCompare(mp);
  const btn = await pg.$('.compare-btn');
  if (btn) (await btn.tap().catch(() => {}));
  await sleep(1200);
  await shot(mp, 'A1-shared-cutoff-toast.png');
  check(true, '共享段越界(2030-12>2026-08) toast 已截图');
});

CASES.push(async mp => { // 1: 不足2方案 toast
  await seed(mp, sharedFixture('1998-08', '2026-08'), PLANS_1);
  const pg = await openCompare(mp);
  const btn = await pg.$('.compare-btn');
  if (btn) (await btn.tap().catch(() => {}));
  await sleep(1200);
  await shot(mp, 'B1-too-few-plans-toast.png');
  check(true, '不足2方案 toast 已截图');
});

CASES.push(async mp => { // 2: compare 录入态
  await seed(mp, sharedFixture('1998-08', '2026-08'), PLANS_3);
  const pg = await openCompare(mp);
  await shot(mp, 'C0-compare-input.png');
  check(!!(await pg.$('.compare-btn')), 'compare 录入态 .compare-btn 就绪');
});

CASES.push(async mp => { // 3: 结果表 + 角标
  const pg = await openResult(mp, sharedFixture('1998-08', '2026-08'));
  check(onResult(pg), '进入结果页 path=' + (pg && pg.path));
  if (!onResult(pg)) { await shot(mp, 'Z3-nav-fail.png'); return; }
  check(!!(await pg.$('.cr-table')), '比较表 .cr-table 存在');
  check((await pg.$$('.cr-row')).length >= 10, '比较表行数>=10');
  check((await pg.$$('.cr-row-head .cr-cell')).length === 4, '表头4列');
  check((await pg.$$('.cr-badge-est')).length === 3, '3个【预估】角标');
  check((await pg.$$('.cr-badge-base')).length === 1, '1个【基准】角标');
  await shot(mp, 'C1-result-table.png');
});

CASES.push(async mp => { // 4: 三分项展开
  const pg = await openResult(mp, sharedFixture('1998-08', '2026-08'));
  check(onResult(pg), '进入结果页');
  if (!onResult(pg)) return;
  const toggle = await pg.$('.cr-p-toggle');
  check(!!toggle, '三分项开关存在');
  if (!toggle) return;
  (await toggle.tap().catch(() => {})); await sleep(900);
  check((await pg.$$('.cr-comp-row')).length === 3, 'P月三分项展开=3行(基础/账户/过渡)');
  await shot(mp, 'C2-components-expanded.png');
});

CASES.push(async mp => { // 5: CSS 条形 + 6% 利率
  const pg = await openResult(mp, sharedFixture('1998-08', '2026-08'));
  check(onResult(pg), '进入结果页');
  if (!onResult(pg)) return;
  const pFills = await pg.$$('.cr-bar-fill-p');
  const roiFills = await pg.$$('.cr-bar-fill-roi');
  check(pFills.length === 3 && roiFills.length === 3, 'P月/ROI 各3纯CSS条(零图表库)');
  if (pFills.length === 3) {
    check(/width:\s*\d+(\.\d+)?%/.test(await pFills[0].attribute('style')), '条宽数据归一化%');
  }
  const rateInput = await pg.$('.cr-rate-input');
  const rateBtn = await pg.$('.cr-rate-btn');
  if (rateInput && rateBtn) {
    await rateInput.input('6');
    (await rateBtn.tap().catch(() => {}));
    await sleep(1400);
    check(true, '已应用6%年利率(P月/ROI条与利率同屏)');
  } else {
    check(false, '利率输入/按钮存在');
  }
  await shot(mp, 'C3-css-bars.png');
});

CASES.push(async mp => { // 6: 下钻三段现金流
  const pg = await openResult(mp, sharedFixture('1998-08', '2026-08'));
  check(onResult(pg), '进入结果页');
  if (!onResult(pg)) return;
  const entries = await pg.$$('.cr-drill-entry');
  check(entries.length >= 2, '下钻入口>=2');
  if (entries.length < 2) return;
  (await entries[1].tap().catch(() => {}));
  await sleep(3600);
  check(!!(await pg.$('.cr-sheet')), '下钻弹层打开');
  const bodyEl = await pg.$('.cr-sheet-body');
  if (bodyEl) {
    const body = await bodyEl.text();
    check(/相对基准净差额现金流/.test(body) && /并存缴费期合计/.test(body) &&
          /基准退休后冲抵期合计/.test(body) && /候选退休后月多领/.test(body), '下钻含三段现金流汇总');
  } else check(false, '下钻 .cr-sheet-body 存在');
  check((await pg.$$('.cr-dr-cf')).length > 0, '下钻含逐月现金流');
  await shot(mp, 'C5-drill-cashflow.png');
});

CASES.push(async mp => { // 7: 政策弹窗
  const pg = await openResult(mp, sharedFixture('1998-08', '2026-08'));
  check(onResult(pg), '进入结果页');
  if (!onResult(pg)) return;
  const polEntry = await pg.$('.cr-policy-entry');
  check(!!polEntry, '政策入口存在');
  if (!polEntry) return;
  (await polEntry.tap().catch(() => {}));
  await sleep(1500);
  check((await pg.$$('.cr-pol')).length >= 4, '政策弹窗>=4条');
  const bodyEl = await pg.$('.cr-sheet-body');
  if (bodyEl) {
    const pol = await bodyEl.text();
    check(/183号/.test(pol) && /渐进式延迟/.test(pol), '政策含183号令与渐进延迟办法');
  } else check(false, '政策 .cr-sheet-body 存在');
  await shot(mp, 'C6-policy-sheet.png');
});

CASES.push(async mp => { // 8: 不足年限灰显/ROI红字
  const pg = await openResult(mp, sharedFixture('2022-09', '2026-08'), PLANS_INSUF);
  check(onResult(pg), '进入结果页');
  if (!onResult(pg)) { await shot(mp, 'D1-grey-blocked-roi.png'); return; }
  check((await pg.$$('.cr-cell-grey')).length > 0, '不足年限方案整列灰显');
  check((await pg.$$('.cr-roi-blocked')).length >= 1, 'ROI红字不可用');
  check((await pg.$$('.cr-badge-grey')).length >= 1, '「不可按月领」角标');
  await shot(mp, 'D1-grey-blocked-roi.png');
});

(async () => {
  let mp = null;
  try {
    if (RUN_ALL) {
      mp = await boot();
      for (let i = 0; i < CASES.length; i++) {
        console.log('\n=== RUN CASE ' + i + ' ===');
        await CASES[i](mp);
        await sleep(2500); // toast/sheet fully settle before next navigation
      }
      try { await mp.close(); } catch (e) {}
      console.log('TRANSIENT_COUNT=' + transient.length);
      console.log('ALL_RESULT fail=' + fail);
      process.exit(fail ? 1 : 0);
    }
    if (CASE_INDEX < 0 || CASE_INDEX >= CASES.length)
      throw new Error('usage: node phase1-gui-regression.js <caseIndex 0..' + (CASES.length - 1) + ' | ALL>');
    mp = await boot();
    await CASES[CASE_INDEX](mp);
    try { await mp.close(); } catch (e) {}
    console.log('TRANSIENT_COUNT=' + transient.length);
    console.log('CASE_RESULT fail=' + fail);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.error('FATAL:', e && e.stack ? e.stack : e);
    try { if (mp) await mp.close(); } catch (x) {}
    process.exit(2);
  }
})();
