'use strict';
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const GUI = PROJECT + '\\autotest\\gui';
const OUT = PROJECT + '\\autotest\\output\\gui';
const CLI = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const PORT = parseInt(process.env.GUI_AUTO_PORT || '9582', 10);
const G = require(GUI + '\\lib-gui.js');
const automator = require('C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const listening = p => new Promise(res => { const s = net.createConnection({ port: p, host: '127.0.0.1' }); const d = v => { try { s.destroy(); } catch (e) {} res(v); }; s.once('connect', () => d(true)); s.once('error', () => d(false)); setTimeout(() => d(false), 1000); });

(async () => {
  const rep = { trail: [] };
  let child;
  try {
    if (!(await listening(PORT))) child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + PORT, { shell: true, stdio: 'ignore', windowsHide: true });
    let up = false; const t0 = Date.now();
    while (Date.now() - t0 < 120000) { if (await listening(PORT)) { up = true; break; } await sleep(1200); }
    rep.portUp = up;
    const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT });
    const idx = await G.relaunchIndex(mp);
    await idx.setData(G.baseInput());
    await sleep(400);
    await idx.callMethod('onCalculate');
    for (let i = 0; i < 6; i++) { await sleep(1000); const c = await mp.currentPage(); rep.trail.push((i + 1) + 's:' + c.path); const dd = await c.data(); if (dd && dd.errorMsg) rep.errorAt = (i + 1) + 's ' + dd.errorMsg; if (c.path.indexOf('result') >= 0) { rep.autoNav = true; break; } }
    if (!rep.autoNav) {
      // explicit navigate
      await mp.navigateTo('/pages/result/result').catch(e => { rep.navErr = e.message; });
      await sleep(1800);
      const c = await mp.currentPage();
      rep.afterManualNavPath = c.path;
      const dd = await c.data();
      rep.afterManualKeys = Object.keys(dd || {}).slice(0, 40);
      rep.ready = dd.ready;
      if (dd.r) { rep.hasR = true; rep.rBu = dd.r.intermediates && dd.r.intermediates['R储']; rep.total = dd.r.pension && dd.r.pension.total; }
      else rep.rShape = dd.r === undefined ? 'r undefined' : typeof dd.r;
    } else {
      const c = await mp.currentPage(); const dd = await c.data();
      rep.ready = dd.ready; rep.hasR = !!dd.r;
    }
    await mp.close().catch(() => {});
  } catch (e) { rep.fatal = String(e && e.message || e); rep.stack = String(e && e.stack || '').slice(0, 700); }
  try { if (child) child.kill(); } catch (e) {}
  fs.writeFileSync(OUT + '\\diag-nav2.json', JSON.stringify(rep, null, 2), 'utf8');
  console.log('DIAG2 ' + JSON.stringify(rep).slice(0, 1000));
  process.exit(0);
})();
