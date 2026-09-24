'use strict';
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const GUI = PROJECT + '\\autotest\\gui';
const OUT = PROJECT + '\\autotest\\output\\gui';
const CLI = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const PORT = parseInt(process.env.GUI_AUTO_PORT || '9581', 10);
const G = require(GUI + '\\lib-gui.js');
const automator = require('C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const listening = p => new Promise(res => { const s = net.createConnection({ port: p, host: '127.0.0.1' }); const d = v => { try { s.destroy(); } catch (e) {} res(v); }; s.once('connect', () => d(true)); s.once('error', () => d(false)); setTimeout(() => d(false), 1000); });

(async () => {
  const rep = {};
  let child;
  try {
    if (!(await listening(PORT))) { child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + PORT, { shell: true, stdio: 'ignore', windowsHide: true }); }
    let up = false; const t0 = Date.now();
    while (Date.now() - t0 < 120000) { if (await listening(PORT)) { up = true; break; } await sleep(1200); }
    rep.portUp = up;
    const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT });
    const idx = await G.relaunchIndex(mp);
    const input = G.baseInput();
    rep.inputKeys = Object.keys(input);
    rep.segCount = input.segments.length;
    await idx.setData(input);
    await sleep(400);
    // call onCalculate directly (same as openResult) and observe
    await idx.callMethod('onCalculate');
    await sleep(1800);
    let cur = await mp.currentPage();
    rep.pathAfterCalc = cur.path;
    const d0 = await cur.data();
    rep.errorMsg = d0.errorMsg;
    rep.boundWarnings = d0.boundWarnings;
    if (cur.path && cur.path.indexOf('pages/result') >= 0) {
      rep.resultTopKeys = Object.keys(d0);
      rep.hasR = !!d0.r;
      if (d0.r) { rep.rKeys = Object.keys(d0.r); rep.intermediatesKeys = d0.r.intermediates ? Object.keys(d0.r.intermediates).slice(0, 40) : null; }
    } else {
      // still on index; report what onCalculate needs / whether storage route
      rep.indexTopKeysSample = Object.keys(d0).slice(0, 50);
    }
    await mp.close().catch(() => {});
  } catch (e) { rep.fatal = String(e && e.message || e); rep.stack = String(e && e.stack || '').slice(0, 600); }
  try { if (child) child.kill(); } catch (e) {}
  fs.writeFileSync(OUT + '\\diag-nav.json', JSON.stringify(rep, null, 2), 'utf8');
  console.log('DIAG_DONE ' + JSON.stringify(rep).slice(0, 900));
  process.exit(0);
})();
