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

module.exports = {
  PROJECT, SDK, automator, sleep,
  discoverCli, portUp, waitPort, ev,
  launchAndConnect, waitLanded, resetToEntry, gotoCompare,
  commonBlock, importFixture, compareCtx, waitCardsReady, addMonths
};
