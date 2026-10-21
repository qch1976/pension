'use strict';
// diag-flow.js — 逐步骤计时复刻 bug1718-case 前半段，定位卡死的 RPC。
const G = require('./lib-gui.js');
const path = require('path');
const sleep = G.sleep;

const hist = [
  [2000,6142,2],[2001,41328],[2002,47184],[2003,58434],[2004,69645],[2005,81816],
  [2006,95079],[2007,105822],[2008,116766],[2009,130500],[2010,142533],[2011,149760],
  [2012,163953],[2013,183069],[2014,198288],[2015,220608],[2016,243882],[2017,266256],
  [2018,291114],[2019,293796],[2020,300636],[2021,328572],[2022,360630],[2023,394650],
  [2024,415044],[2025,426564],[2026,287562,8]
];
function buildSegments(z, type){
  const segs=[];
  hist.forEach(([y,annual,mo])=>{
    const months=mo||12; const base=Math.round((annual/months)*100)/100;
    let s,e;
    if(y===2000){s='2000-11';e='2000-12';}
    else if(y===2026){s='2026-01';e='2026-08';}
    else {s=y+'-01';e=y+'-12';}
    segs.push({type:'enterprise',startYM:s,endYM:e,baseMonthly:String(base)});
  });
  const fb=Math.round(z*11937*100)/100;
  segs.push({type,startYM:'2026-09',endYM:'2033-06',baseMonthly:String(fb)});
  return segs;
}

(async () => {
  const mp = await G.connect(20);
  const t = (label, fn) => new Promise(async resolve => {
    const t0 = Date.now();
    try { const r = await fn(); console.log('OK  [' + (Date.now()-t0) + 'ms] ' + label); resolve(r); }
    catch (e) { console.log('ERR [' + (Date.now()-t0) + 'ms] ' + label + ' :: ' + e.message); resolve(null); }
  });
  try {
    let page = await t('clearStorageSync', () => mp.callWxMethod('clearStorageSync'));
    await t('reLaunch index', () => mp.reLaunch('/pages/index/index'));
    await sleep(6000);
    const idx = await t('currentPage', () => mp.currentPage());
    if (idx) await t('page.data keys', async () => Object.keys(await idx.data()).length);

    const payload = {
      gender:'male',femaleType:'worker',birthYM:'1973-07',workStartYM:'1995-07',retireYM:'2033-07',
      deemedStartYM:'1995-07',deemedEndYM:'2000-10',entryMode:'month',segments:buildSegments(0.6,'flexible'),
      accountBalanceManual:'672920',manualBalanceYM:'2026-08',futureMonthlyRatePct:'1.5',
      doc31Eligible:true,doc31TransferYM:'2000-11',enterpriseInsuredYM:'2000-11',
      subsidyExcludedText:'',baseYearIndex:0,cPingOverride:'',customCYearText:'',boundWarnings:[],errorMsg:''
    };
    if (idx) await t('setData(payload)', () => idx.setData(payload));
    if (idx) await t('callMethod onCalculate', () => idx.callMethod('onCalculate'));
    await sleep(4000);
    const rp = await t('currentPage after calc', () => mp.currentPage());
    if (rp) {
      console.log('page path=' + rp.path);
      await t('result page.data', async () => {
        const d = await rp.data();
        return 'keys=' + Object.keys(d).length + ' hasR=' + !!d.r;
      });
    }
  } finally { try { await mp.disconnect(); } catch (e) {} }
  process.exit(0);
})().catch(e => { console.log('FATAL ' + e.message); process.exit(1); });
