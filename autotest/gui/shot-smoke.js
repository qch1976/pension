'use strict';
// shot-smoke.js — fresh cli auto 上验证 screenshot 通道；脚本内轮询，只回一行。
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const OUT = PROJECT + '\\autotest\\output\\gui';
const CLI_DIR = 'C:\\Program Files (x86)\\Tencent';
const PORT = 9761;
const SDK = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function discoverCli() {
  for (const d of fs.readdirSync(CLI_DIR)) {
    const c = path.join(CLI_DIR, d, 'cli.bat');
    if (fs.existsSync(c)) return c;
  }
}
function listening(p) {
  return new Promise(res => {
    const s = net.createConnection({ port: p, host: '127.0.0.1' });
    const d = v => { try { s.destroy(); } catch (e) {} res(v); };
    s.once('connect', () => d(true)); s.once('error', () => d(false));
    setTimeout(() => d(false), 1000);
  });
}
(async () => {
  const CLI = discoverCli();
  const logFile = path.join(OUT, 'cli-auto-shotsmoke-' + PORT + '.log');
  const lf = fs.openSync(logFile, 'w');
  const child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + PORT,
    { shell: true, stdio: ['ignore', lf, lf], windowsHide: true });
  const t0 = Date.now();
  while (!(await listening(PORT)) && Date.now() - t0 < 120000) await sleep(1000);
  try { lf.close(); } catch (e) {}
  await sleep(3000);
  const automator = require(SDK);
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT });
  await mp.checkVersion().catch(e => {});
  await sleep(8000);
  let page = await mp.currentPage();
  const line1 = 'currentPage path=' + page.path;
  let shot1 = null, err1 = null;
  try {
    const p1 = path.join(OUT, 'shotsmoke-1.png');
    await mp.screenshot({ path: p1 });
    await sleep(500);
    shot1 = fs.statSync(p1).size;
  } catch (e) { err1 = e.message; }
  // reLaunch index 再截一张
  await mp.reLaunch('/pages/index/index').catch(e => {});
  await sleep(6000);
  page = await mp.currentPage();
  const line2 = 'after relaunch path=' + page.path;
  let shot2 = null, err2 = null;
  try {
    const p2 = path.join(OUT, 'shotsmoke-2.png');
    await mp.screenshot({ path: p2 });
    await sleep(500);
    shot2 = fs.statSync(p2).size;
  } catch (e) { err2 = e.message; }
  try { await mp.disconnect(); } catch (e) {}
  try { cp.execSync('taskkill /PID ' + child.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {}
  console.log(line1 + ' | shot1=' + (shot1 || ('ERR:' + err1)) + ' | ' + line2 + ' | shot2=' + (shot2 || ('ERR:' + err2)));
  process.exit(0);
})().catch(e => { console.log('SMOKE-FATAL ' + (e && e.message || e)); process.exit(1); });
