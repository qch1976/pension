// shot-sec4.js - re-take section④ structure shot (mp.pageScrollTo + selectorQuery position).
// Run: GUI_AUTO_PORT=<fresh port> node shot-sec4.js
'use strict';
const fs = require('fs');
const path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const OUT = PROJECT + '\\autotest\\output\\gui';
const SDK_DIR = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const automator = require(SDK_DIR);
const PORT = parseInt(process.env.GUI_AUTO_PORT || '9666', 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function rr(fn, n) {
  let e = null;
  for (let i = 0; i < (n || 3); i++) {
    try { return await fn(); } catch (x) { e = x; await sleep(600 * (i + 1)); }
  }
  throw e;
}
(async () => {
  const mp = await rr(async () => automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT }), 20);
  let fatal = null, shot = null, posInfo = null;
  try {
    try { await mp.callWxMethod('clearStorageSync'); } catch (e) {}
    await mp.reLaunch('/pages/index/index').catch(() => {});
    const t0 = Date.now(); let page = null;
    while (Date.now() - t0 < 90000) {
      page = await rr(() => mp.currentPage());
      if (page.path && page.path.indexOf('pages/index/index') >= 0) {
        const dd = await rr(() => page.data());
        if (dd && Object.keys(dd).length > 5) break;
      }
      await sleep(800);
    }
    await rr(() => page.setData({ doc31Eligible: false }));
    await sleep(400);

    // get ④ title position and current scroll offset via selector query in app context
    const info = await rr(() => mp.evaluate(function () {
      return new Promise(resolve => {
        const q = wx.createSelectorQuery();
        q.selectAll('.card-title').boundingClientRect();
        q.selectViewport().scrollOffset();
        q.exec(function (res) { resolve({ rects: res[0], scroll: res[1] }); });
      });
    }));
    const rects = info.rects || [];
    const t4 = rects[3];
    const target = Math.round((info.scroll.scrollTop || 0) + t4.top - 4);
    posInfo = { rectsCount: rects.length, t4top: t4.top, scrollBefore: info.scroll.scrollTop, target };
    // scroll inside app context with completion callback, then nudge to force compositing
    await rr(() => mp.evaluate(function (y) {
      return new Promise(function (resolve) {
        wx.pageScrollTo({ scrollTop: y + 2, duration: 0, complete: function () {
          wx.pageScrollTo({ scrollTop: y, duration: 0, complete: function () { resolve(true); } });
        } });
      });
    }, target));
    await sleep(2500);
    const after = await rr(() => mp.evaluate(function () {
      return new Promise(resolve => {
        const q = wx.createSelectorQuery();
        q.selectAll('.card-title').boundingClientRect();
        q.exec(function (res) { resolve(res[0]); });
      });
    }));
    posInfo.t4topAfter = after[3].top;

    // screenshot LAST interaction
    const p = path.join(OUT, 'bug2526-input-sec4.png');
    try { fs.unlinkSync(p); } catch (e) {}
    for (let i = 1; i <= 3; i++) {
      try {
        await mp.screenshot({ path: p });
        await sleep(400);
        if (fs.statSync(p).size > 40000) { shot = { path: p, bytes: fs.statSync(p).size }; break; }
      } catch (e) { await sleep(1200 * i); }
    }
    fs.writeFileSync(path.join(OUT, 'shot-sec4.json'), JSON.stringify({
      ok: !!shot, shot, posInfo, finishedAt: new Date().toISOString()
    }, null, 2));
    console.log('DONE shot=' + (shot && shot.bytes) + ' pos=' + JSON.stringify(posInfo));
  } catch (e) {
    fatal = String(e && e.message || e);
    console.log('FATAL ' + fatal);
  } finally {
    try { await mp.disconnect(); } catch (e) {}
  }
  process.exit(fatal ? 1 : 0);
})();
