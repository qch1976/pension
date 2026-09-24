'use strict';
// swipe-shot.js <CASE> <tag> <pageScroll> <swipeCount>
// pageScroll 定位年表卡，在 scroll-view 区域内做多次触摸上滑，露出 2019 行后截图。
const G = require('./lib-gui.js');
const fs = require('fs');
const path = require('path');
const sleep = G.sleep;
const CASE = process.argv[2], TAG = process.argv[3];
const PAGE_SC = parseInt(process.argv[4], 10), SWIPES = parseInt(process.argv[5], 10);

const hist = [
  [2000,6142,2],[2001,41328],[2002,47184],[2003,58434],[2004,69645],[2005,81816],
  [2006,95079],[2007,105822],[2008,116766],[2009,130500],[2010,142533],[2011,149760],
  [2012,163953],[2013,183069],[2014,198288],[2015,220608],[2016,243882],[2017,266256],
  [2018,291114],[2019,293796],[2020,300636],[2021,328572],[2022,360630],[2023,394650],
  [2024,415044],[2025,426564],[2026,287562,8]
];
const cfg = CASE === 'MY2' ? { z: 3.0, type: 'enterprise' } : { z: 0.6, type: 'flexible' };
function buildSegments(){
  const segs=[];
  hist.forEach(([y,annual,mo])=>{
    const months=mo||12; const base=Math.round((annual/months)*100)/100;
    let s,e;
    if(y===2000){s='2000-11';e='2000-12';}
    else if(y===2026){s='2026-01';e='2026-08';}
    else {s=y+'-01';e=y+'-12';}
    segs.push({type:'enterprise',startYM:s,endYM:e,baseMonthly:String(base)});
  });
  const fb=Math.round(cfg.z*11937*100)/100;
  segs.push({type:cfg.type,startYM:'2026-09',endYM:'2033-06',baseMonthly:String(fb)});
  return segs;
}
function pt(id, x, y){ return { identifier: id, clientX: x, clientY: y, pageX: x, pageY: y }; }

(async () => {
  const mp = await G.connect(15);
  try {
    const indexPage = await G.relaunchIndex(mp);
    await sleep(700);
    await indexPage.setData({
      gender:'male',femaleType:'worker',birthYM:'1973-07',workStartYM:'1995-07',retireYM:'2033-07',
      deemedStartYM:'1995-07',deemedEndYM:'2000-10',entryMode:'month',segments:buildSegments(),
      accountBalanceManual:'672920',manualBalanceYM:'2026-08',futureMonthlyRatePct:'1.5',
      doc31Eligible:true,doc31TransferYM:'2000-11',enterpriseInsuredYM:'2000-11',
      subsidyExcludedText:'',baseYearIndex:0,cPingOverride:'',customCYearText:'',boundWarnings:[],errorMsg:''
    });
    await sleep(300);
    await G.openResult(mp, indexPage);
    await sleep(1300);
    await mp.callWxMethod('pageScrollTo', { scrollTop: PAGE_SC, duration: 0 });
    await sleep(1100);
    const p = await mp.currentPage();
    const sv = await p.$('.annual-scroll');
    if (sv) {
      // scroll-view 在屏幕中部，触摸上滑（clientY 从 ~520 到 ~180，x=200）
      const X = 200, Y0 = 520, Y1 = 180;
      for (let s = 0; s < SWIPES; s++) {
        await sv.touchstart({ touches: [pt(1, X, Y0)], changedTouches: [pt(1, X, Y0)] });
        const steps = 6;
        for (let i = 1; i <= steps; i++) {
          const y = Math.round(Y0 + (Y1 - Y0) * i / steps);
          await sv.touchmove({ touches: [pt(1, X, y)], changedTouches: [pt(1, X, y)] });
          await sleep(16);
        }
        await sv.touchend({ touches: [], changedTouches: [pt(1, X, Y1)] });
        await sleep(350);
      }
      await sleep(900);
    }
    const file = path.join(G.OUT_DIR, 'bug1718-' + CASE + '-' + TAG + '.png');
    await mp.screenshot({ path: file });
    const bytes = fs.statSync(file).size;
    console.log('SWIPESHOT ' + CASE + ' ' + TAG + ' bytes=' + bytes + ' sv=' + !!sv);
  } finally { try { await mp.disconnect(); } catch (e) {} }
  process.exit(0);
})().catch(e => { console.log('FATAL ' + (e && e.message)); process.exit(1); });
