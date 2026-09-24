'use strict';
// diag-scroll.js — 测试 annual-scroll 的 scrollTo 是否生效：调用前后读 scrollTop。
const G = require('./lib-gui.js');
const fs = require('fs');
const path = require('path');
const sleep = G.sleep;
const hist = [
  [2000,6142,2],[2001,41328],[2002,47184],[2003,58434],[2004,69645],[2005,81816],
  [2006,95079],[2007,105822],[2008,116766],[2009,130500],[2010,142533],[2011,149760],
  [2012,163953],[2013,183069],[2014,198288],[2015,220608],[2016,243882],[2017,266256],
  [2018,291114],[2019,293796],[2020,300636],[2021,328572],[2022,360630],[2023,394650],
  [2024,415044],[2025,426564],[2026,287562,8]
];
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
  segs.push({type:'flexible',startYM:'2026-09',endYM:'2033-06',baseMonthly:'7162.2'});
  return segs;
}
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
    await mp.callWxMethod('pageScrollTo', { scrollTop: 2750, duration: 0 });
    await sleep(1100);
    const p = await mp.currentPage();
    const sv = await p.$('.annual-scroll');
    const ctor = sv.constructor && sv.constructor.name;
    let before='?';
    try { before = await Promise.race([sv.property('scrollTop'), sleep(3000).then(()=>'timeout')]); } catch(e){ before='err:'+e.message; }
    console.log('ctor=' + ctor + ' before=' + before);
    let scRes='?';
    try { scRes = await Promise.race([sv.scrollTo(1566).then(()=>'ok'), sleep(6000).then(()=>'timeout')]); } catch(e){ scRes='err:'+e.message; }
    await sleep(1000);
    let after='?';
    try { after = await Promise.race([sv.property('scrollTop'), sleep(3000).then(()=>'timeout')]); } catch(e){ after='err:'+e.message; }
    console.log('scrollTo=' + scRes + ' after=' + after);
    let geom='?';
    try { geom = await Promise.race([sv.domProperty(['scrollHeight','clientHeight','offsetHeight']), sleep(3000).then(()=>'timeout')]); } catch(e){ geom='err:'+e.message; }
    console.log('geom=' + JSON.stringify(geom));
    const file = path.join(G.OUT_DIR, 'diag-scroll.png');
    await mp.screenshot({ path: file });
    console.log('bytes=' + fs.statSync(file).size);
  } finally { try { await mp.disconnect(); } catch (e) {} }
  process.exit(0);
})().catch(e => { console.log('FATAL ' + (e && e.message)); process.exit(1); });
