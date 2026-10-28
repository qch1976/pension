/* system_test/common/gui-conn-lib.js — pension GUI 测试公共连接/导航库（testcase-structure SKILL）
 * 公共逻辑：automator 连接/cli 生命周期、端口等待、清 draft、entry→compare 导航、
 *           真实文件导入（chooseMessageFile mock）、evaluate 重试、月份工具。
 * 不依赖任何具体 testcase 的 input；被 GT-40xx 独立入口脚本 require。
 * 运行环境：dev box (微信开发者工具 automator 常驻口, 只 connect/disconnect, 不杀 IDE)。
 */
'use strict';
const fs = require('fs'), path = require('path'), net = require('net'), cp = require('child_process');

const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const SDK = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const automator = require(SDK);

const sleep = ms => new Promise(r => setTimeout(r, ms));

function discoverCli() {
  const root = 'C:\\Program Files (x86)\\Tencent';
  for (const d of fs.readdirSync(root)) {
    const c = path.join(root, d, 'cli.bat');
    if (fs.existsSync(c)) return c;
  }
  throw new Error('cli.bat not found under ' + root);
}
function portUp(p) {
  return new Promise(res => {
    const s = net.createConnection({ port: p, host: '127.0.0.1' });
    const d = v => { try { s.destroy(); } catch (e) {} res(v); };
    s.once('connect', () => d(true)); s.once('error', () => d(false));
    setTimeout(() => d(false), 1000);
  });
}
async function waitPort(p, ms) {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await portUp(p)) return true; await sleep(1500); }
  return false;
}
async function ev(mp, fn, ...args) {
  for (let i = 0; i < 5; i++) {
    try { return await mp.evaluate(fn, ...args); } catch (e) { await sleep(700); }
  }
  return null;
}

/* 启动 cli auto（非 external 模式）并等端口就绪；返回 {ch}。external 模式只 connect。 */
async function launchAndConnect(port, external) {
  let ch = null;
  if (!external) {
    const cli = discoverCli();
    ch = cp.spawn('"' + cli + '" auto --project "' + PROJECT + '" --auto-port ' + port, { shell: true, stdio: 'ignore', windowsHide: true });
    await sleep(8000);
  } else { await sleep(300); }
  if (!(await waitPort(port, 120000))) throw new Error('PORT_NOT_UP');
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + port });
  return { mp, ch };
}

/* 等任意页落地，返回 page.path；90s 超时返回 null。 */
async function waitLanded(mp) {
  const t = Date.now();
  while (Date.now() - t < 90000) {
    try { const p = await mp.currentPage(); if (p && p.path) return p.path; } catch (e) {}
    await sleep(2000);
  }
  return null;
}

/* 干净基线：回 entry 并清除方案草稿（plan-list 用 initialPlans、windowStartYM 全空）。 */
async function resetToEntry(mp) {
  await mp.reLaunch('/pages/entry/entry').catch(() => {});
  await sleep(2500);
  await ev(mp, () => { try { wx.removeStorageSync('pension_plans_v1'); } catch (e) {} return true; });
  await sleep(300);
}

/* entry→compare 并等 #planList 就绪；返回 true/false。 */
async function gotoCompare(mp) {
  await ev(mp, () => { getCurrentPages().slice(-1)[0].goCompare(); return true; });
  for (let i = 0; i < 24; i++) {
    const c = await ev(mp, () => {
      const p = getCurrentPages().slice(-1)[0];
      return p && p.route === 'pages/compare/compare' && p.selectComponent('#planList') ? true : null;
    });
    if (c) { await sleep(1000); return true; }
    await sleep(1200);
  }
  return false;
}

/* 提取夹具 .md 的 common 块（第 2 行至首个 ``` 之间）。 */
function commonBlock(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim().indexOf('```') === 0) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

/* 真实文件导入：切 file 模式→写 USER_DATA_PATH 真实文件→mock chooseMessageFile→触发 onChooseCaseFile。
 * fixtureFile 为 docs/ 下文件名（如 'My-Case.md'）。返回导入后的 fileName。 */
async function importFixture(mp, fixtureFile, tag) {
  for (let k = 0; k < 6; k++) {
    await ev(mp, () => { getCurrentPages().slice(-1)[0].setInputMode({ currentTarget: { dataset: { v: 'file' } } }); return true; });
    await sleep(400);
    if (await ev(mp, () => getCurrentPages().slice(-1)[0].data.inputMode) === 'file') break;
  }
  const fixtureRaw = fs.readFileSync(path.join(PROJECT, 'docs', 'customer_usecases', fixtureFile), 'utf8');
  const common = commonBlock(fixtureRaw), rel = 't47-c-' + tag + '.txt';
  await mp.evaluate((r, txt) => new Promise((res, rej) => {
    wx.getFileSystemManager().writeFile({ filePath: wx.env.USER_DATA_PATH + '/' + r, data: txt, encoding: 'utf8', success: res, fail: rej });
  }), rel, common);
  const udp = await mp.evaluate(() => wx.env.USER_DATA_PATH);
  const abs = ('' + udp).replace(/[\\/]+$/, '') + '/' + rel;
  await mp.mockWxMethod('chooseMessageFile', { errMsg: 'chooseMessageFile:ok', tempFiles: [{ path: abs, name: fixtureFile, size: Buffer.byteLength(common), createTime: Math.floor(Date.now() / 1000) }] });
  await ev(mp, () => { getCurrentPages().slice(-1)[0].onChooseCaseFile(); return true; });
  await sleep(4000);
  await mp.restoreWxMethod('chooseMessageFile').catch(() => {});
  const fileName = await ev(mp, () => getCurrentPages().slice(-1)[0].data.fileName);
  await sleep(1000);
  return fileName;
}

/* compare 页上下文：ctx + planCount + plans(windowStartYM/retireYM/z/segType)。 */
async function compareCtx(mp) {
  return await ev(mp, () => {
    const p = getCurrentPages().slice(-1)[0]; const pl = p.selectComponent('#planList');
    return { ctx: p.data.ctx, planCount: (pl.data.plans || []).length, plans: pl.getPlans().map(x => ({ windowStartYM: x.windowStartYM, retireYM: x.retireYM, z: x.z, segType: x.segType })) };
  });
}

/* 等 plan-card 子组件实例就绪（全路径选择器，实例数==n 且首卡 startText 非空）。 */
async function waitCardsReady(mp, cardSel, n) {
  for (let w = 0; w < 24; w++) {
    const ready = await ev(mp, (sel, nn) => {
      const p = getCurrentPages().slice(-1)[0]; const pl = p.selectComponent('#planList');
      let cs = []; try { cs = pl.selectAllComponents(sel) || []; } catch (e) { cs = []; }
      return cs.length === nn && nn > 0 && !!(cs[0].data.startText);
    }, cardSel, n);
    if (ready) return true;
    await sleep(600);
  }
  return false;
}

/* 月份加 delta：'2026-08',+1 -> '2026-09'。 */
function addMonths(ym, delta) {
  const [y, m] = ym.split('-').map(Number); let t = y * 12 + (m - 1) + delta;
  return Math.floor(t / 12) + '-' + String((t % 12) + 1).padStart(2, '0');
}

/* ===== task-55 Z0.6 parity 公共：夹具输入 / compare结果页装载 / basic month 驱动 / 安全reLaunch =====
 * 仍不内置任何 testcase 的 input/expect；夹具文件、plan、利率由各独立入口传入。 */
const stlib = require(path.join(__dirname, 'st-case-lib.js'));
const CV = stlib.caseValidator;
const Asm = require(path.join(PROJECT, 'calculator', 'planAssembler.js'));

// compare-result 页 onLoad 读取的 storage key（含省略号字符，作为 evaluate 参数传入，避免源码编码问题）
const COMPARE_RESULT_KEY = 'pension_compare_payload_v1';

// 由夹具构造 sharedInput(buildInputLike) + pageIndex(mapParsedToPageData)，覆写个人账户【月利率】
function buildFixtureInput(fixtureFile, futureMonthlyRate) {
  const fx = stlib.parseFixture(fixtureFile);
  const pageIndex = CV.mapParsedToPageData(fx.parsed, {});
  const sharedInput = CV.buildInputLike(pageIndex);
  sharedInput.futureMonthlyRate = futureMonthlyRate;
  return { sharedInput, pageIndex };
}

// 与 compare planAssembler 同源的完整段（历史段 + 未来 Z 段），供 basic month 模式喂入
function fullMonthSegments(sharedInput, plan) {
  return Asm.assemblePlanInput(sharedInput, plan).segments;
}

// Node 侧安全包裹一个 automator 动作（吞 "timeout waiting for automator response" 等全局超时）
async function safeAttempt(fn) {
  try { return { ok: true, v: await fn() }; }
  catch (e) { return { ok: false, err: String((e && e.message) || e) }; }
}

// reLaunch 到 url，确认 currentPage().path 命中且 Node 侧 readyFn(data) 为真；导航超时则整轮重试
async function reLaunchReady(mp, url, pathPart, readyFn, opts) {
  opts = opts || {};
  const retries = opts.retries || 3, perMs = opts.perMs || 20000;
  let page = null, data = null, landed = '';
  for (let gi = 0; gi < retries; gi++) {
    await safeAttempt(() => mp.reLaunch(url));
    const t0 = Date.now();
    while (Date.now() - t0 < perMs) {
      const cp = await safeAttempt(() => mp.currentPage());
      if (cp.ok && cp.v) { page = cp.v; landed = page.path || ''; }
      if (page && landed.indexOf(pathPart) >= 0) {
        if (!readyFn) return { ok: true, page, path: landed, data: null };
        const dr = await safeAttempt(() => page.data());
        if (dr.ok && dr.v && readyFn(dr.v)) return { ok: true, page, path: landed, data: dr.v };
      }
      await sleep(700);
    }
  }
  return { ok: false, page, path: landed, data };
}

// 不触发导航，只轮询当前页 path 命中 + readyFn(data)（用于产品自身 navigateTo 后的结果页）
async function waitCurrentReady(mp, pathPart, readyFn, perMs) {
  const t0 = Date.now(); let page = null, data = null, landed = '';
  while (Date.now() - t0 < (perMs || 40000)) {
    const cp = await safeAttempt(() => mp.currentPage());
    if (cp.ok && cp.v) { page = cp.v; landed = page.path || ''; }
    if (page && landed.indexOf(pathPart) >= 0) {
      if (!readyFn) return { ok: true, page, path: landed, data: null };
      const dr = await safeAttempt(() => page.data());
      if (dr.ok && dr.v && readyFn(dr.v)) return { ok: true, page, path: landed, data: dr.v };
    }
    await sleep(700);
  }
  return { ok: false, page, path: landed, data };
}

async function injectStorage(mp, key, payload) {
  const v = await ev(mp, function (k, p) { wx.setStorageSync(k, p); return true; }, key, payload);
  return v === true;
}

// compare 结果页（多方案）：先回中性页(防残留) -> 装载同构【输入】(plans 可为 1~3) -> reLaunch 页面自渲染，返回全部列 [{R,JA,P}]
async function openCompareResultN(mp, sharedInput, plans) {
  const neutral = await reLaunchReady(mp, '/pages/entry/entry', 'pages/entry/entry', null, { retries: 3, perMs: 15000 });
  if (!neutral.ok) throw new Error('neutral entry not ready path=' + neutral.path);
  let ok = false;
  for (let i = 0; i < 5; i++) {
    if (await injectStorage(mp, COMPARE_RESULT_KEY, { sharedInput, plans })) { ok = true; break; }
    await sleep(1200);
  }
  if (!ok) throw new Error('inject compare payload failed');
  // 起点是 entry，path 能变为 compare-result 即证明注入后真实导航加载（不会读到残留旧页）
  const r = await reLaunchReady(mp, '/pages/compare-result/compare-result', 'compare-result',
    d => d.ready === true && d.view, { retries: 3, perMs: 20000 });
  if (!r.ok) throw new Error('compare-result not ready path=' + r.path);
  return (r.data.view.columns || []).map(c => ({ R: Number(c.rContinued), JA: Number(c.jAccount), P: Number(c.pMonthly) }));
}

// compare 单方案：返回首列 {R,JA,P,page}
async function openCompareResult(mp, sharedInput, plan) {
  const cols = await openCompareResultN(mp, sharedInput, [plan]);
  return Object.assign({}, cols[0], { page: null });
}

// basic：reLaunch index，month 模式喂与 compare 同源完整段，调页面真实 onCalculate（产品 buildInput+Engine），result 页只读取值
async function runBasicMonth(mp, ref, plan, ratePct, retireYM) {
  const segments = fullMonthSegments(ref.sharedInput, plan);
  const pd = JSON.parse(JSON.stringify(ref.pageIndex));
  pd.entryMode = 'month';
  pd.segments = segments.map(s => ({ type: s.type, startYM: s.startYM, endYM: s.endYM, baseMonthly: String(s.baseMonthly) }));
  pd.futureMonthlyRatePct = ratePct;
  pd.retireYM = retireYM;
  const ix = await reLaunchReady(mp, '/pages/index/index', 'pages/index/index', null, { retries: 3, perMs: 15000 });
  if (!ix.ok) throw new Error('index not ready path=' + ix.path);
  await safeAttempt(() => ix.page.setData(pd));
  await sleep(300);
  await safeAttempt(() => ix.page.callMethod('onCalculate'));
  const rs = await waitCurrentReady(mp, 'pages/result/result', d => d.ready === true && d.r, 40000);
  if (!rs.ok) throw new Error('basic result not ready path=' + rs.path);
  return { R: Number(rs.data.r.intermediates.R储), JA: Number(rs.data.r.pension.J账户), P: Number(rs.data.r.pension.total), page: rs.page };
}

async function disconnectQuiet(mp) { try { if (mp) await mp.disconnect(); } catch (e) {} }

// 只连接已由 keeper 拉起的常驻口（external：不 spawn cli、不杀端口）
async function connectExisting(port) { const r = await launchAndConnect(port, true); return r.mp; }

/* ===== task-79 通用 compare/basic 流程 helper（零 case-specific input/expect）=====
 * storage key 以 char code 构造，避免字面量转码。 */
const K_PLANS = String.fromCharCode(112,101,110,115,105,111,110,95,112,108,97,110,115,95,118,49);
const K_SHARED = String.fromCharCode(112,101,110,115,105,111,110,95,99,111,109,112,97,114,101,95,105,110,112,117,116,95,118,49);
const K_PAYLOAD = String.fromCharCode(112,101,110,115,105,111,110,95,99,111,109,112,97,114,101,95,112,97,121,108,111,97,100,95,118,49);
const K_BASIC = String.fromCharCode(112,101,110,115,105,111,110,95,105,110,112,117,116,95,118,49);

/* compare 干净基线：reLaunch entry + 清 plans/shared/payload 三 draft。 */
async function clearCompareDrafts(mp) {
  await mp.reLaunch('/pages/entry/entry').catch(() => {});
  await sleep(2200);
  await ev(mp, function (a, b, c) { [a, b, c].forEach(function (k) { try { wx.removeStorageSync(k); } catch (e) {} }); return true; }, K_PLANS, K_SHARED, K_PAYLOAD);
  await sleep(300);
}

/* basic 干净基线：reLaunch index + 清 pension_input_v1。 */
async function clearBasicDraft(mp) {
  await mp.reLaunch('/pages/index/index').catch(() => {});
  await sleep(2200);
  await ev(mp, function (k) { try { wx.removeStorageSync(k); } catch (e) {} return true; }, K_BASIC);
  await sleep(300);
}

/* 回读 compare：page.ctx / plan-list.plans / storage plans。 */
async function readCompare(mp) {
  return await ev(mp, function (k) {
    const p = getCurrentPages().slice(-1)[0];
    const pl = p.selectComponent('#planList');
    let st = null; try { st = wx.getStorageSync(k); } catch (e) {}
    return {
      route: p.route,
      ctx: p.data.ctx,
      plans: pl.getPlans().map(function (x) { return { retireYM: x.retireYM, retireTouched: !!x.retireTouched, z: x.z, segType: x.segType, windowStartYM: x.windowStartYM }; }),
      storagePlans: (st && st.plans ? st.plans : []).map(function (x) { return { retireYM: x.retireYM, retireTouched: !!x.retireTouched }; })
    };
  }, K_PLANS);
}

/* 对第 idx(0基) 卡下发真实 patch（走 plan-list 真实 onCardChange→applyPlans/persist）。 */
async function patchPlanCard(mp, idx, patch) {
  await ev(mp, function (i, pp) {
    const p = getCurrentPages().slice(-1)[0]; const pl = p.selectComponent('#planList');
    pl.onCardChange({ detail: { index: i + 1, patch: pp } });
    return true;
  }, idx, patch);
  await sleep(700);
}

/* compare：共享区正规交互 setGender/setFemaleType/onBirth 后 syncCtx（触发 plan-list observer）。 */
async function setSharedCtx(mp, patch) {
  await ev(mp, function (pp) {
    const p = getCurrentPages().slice(-1)[0]; const s = p.selectComponent('#sharedData');
    if (pp.gender) s.setGender({ currentTarget: { dataset: { v: pp.gender } } });
    if (pp.femaleType) s.setFemaleType({ currentTarget: { dataset: { v: pp.femaleType } } });
    if (pp.birthYM) s.onBirth({ detail: { value: pp.birthYM } });
    return true;
  }, patch);
  await sleep(300);
  await ev(mp, () => { getCurrentPages().slice(-1)[0].syncCtx(); return true; });
  await sleep(1000);
}

/* compare 开始比较并等 compare-result；返回 {landed, columns:[{P,R,JA}]}。 */
async function compareStartAndWait(mp, perMs) {
  await ev(mp, () => { getCurrentPages().slice(-1)[0].startCompare(); return true; });
  const t0 = Date.now(); const ms = perMs || 30000;
  while (Date.now() - t0 < ms) {
    const r = await ev(mp, () => {
      const p = getCurrentPages().slice(-1)[0];
      if (p.route === 'pages/compare-result/compare-result') {
        const cols = (((p.data || {}).view || {}).columns || []).map(function (c) { return { P: c.pMonthly, R: c.rContinued, JA: c.jAccount, eligible: c.eligible }; });
        return { landed: true, columns: cols };
      }
      return { landed: false };
    });
    if (r && r.landed) return r;
    await sleep(800);
  }
  return { landed: false, columns: [] };
}

// case 级断言记录器（独立入口各自持有一个，公共的收集/统计逻辑）
function makeRecorder() {
  const list = [];
  return {
    ck: function (id, title, pass, actual, expected) { list.push({ id, title, pass: !!pass, actual, expected }); },
    list: list,
    totals: function () { return list.reduce(function (a, x) { x.pass ? a.pass++ : a.fail++; return a; }, { pass: 0, fail: 0 }); }
  };
}

module.exports = {
  PROJECT, SDK, automator, sleep,
  discoverCli, portUp, waitPort, ev,
  launchAndConnect, waitLanded, resetToEntry, gotoCompare,
  commonBlock, importFixture, compareCtx, waitCardsReady, addMonths,
  K_PLANS, K_SHARED, K_PAYLOAD, K_BASIC,
  clearCompareDrafts, clearBasicDraft, readCompare, patchPlanCard, setSharedCtx, compareStartAndWait,
  COMPARE_RESULT_KEY, buildFixtureInput, fullMonthSegments, safeAttempt,
  reLaunchReady, waitCurrentReady, injectStorage, openCompareResult, openCompareResultN, runBasicMonth,
  disconnectQuiet, connectExisting, makeRecorder
};
