'use strict';
/*
 * diag-poll-only.js — reach MY3 result page, then poll currentPage().path
 * for 40s WITHOUT any screenshot calls. Determines whether the result page
 * auto-navigates back on a timer, or whether mp.screenshot() triggers it.
 * Fresh one-shot cli auto port 9653. All polling in-script.
 */
const fs = require('fs');
const path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const OUT = PROJECT + '\\autotest\\output\\gui';
const automator = require('C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator');
const PORT = 9653;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const YEAR_ROWS = [
  ['2003','9','4','10000'],['2004','1','12','39000'],['2005','1','7','27892'],
  ['2006','1','9','38700'],['2007','1','12','59493'],['2008','1','12','71160'],
  ['2009','1','12','89202'],['2010','1','12','101340'],['2011','1','12','121005'],
  ['2012','1','12','137451'],['2013','1','12','160677'],['2014','1','12','170562'],
  ['2015','1','12','190428'],['2016','1','12','212370'],['2017','1','12','210678'],
  ['2018','1','12','215538'],['2019','1','12','224748'],['2020','1','12','222000'],
  ['2021','1','12','236418'],['2022','1','12','345994'],['2023','1','12','394650'],
  ['2024','1','12','415044'],['2025','1','12','426564']
];
const toYM = idx => Math.floor(idx/12) + '-' + String(idx%12+1).padStart(2,'0');
async function rr(fn,n){let e;for(let i=0;i<(n||3);i++){try{return await fn();}catch(x){e=x;await sleep(600*(i+1));}}throw e;}

(async () => {
  const report = { reachedResultAt: null, samples: [] };
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT });
  try {
    try { await mp.callWxMethod('clearStorageSync'); } catch (e) {}
    await mp.reLaunch('/pages/index/index').catch(()=>{});
    let page=null; const t0=Date.now();
    while (Date.now()-t0<60000) {
      page = await rr(()=>mp.currentPage());
      if (page.path && page.path.indexOf('pages/index/index')>=0) {
        const dd = await rr(()=>page.data());
        if (Object.keys(dd).length>5) break;
      }
      await sleep(800);
    }
    const segs = YEAR_ROWS.map(r=>{
      const y=+r[0],sm=+r[1],k=+r[2], si=y*12+(sm-1);
      return {type:'enterprise',startYM:toYM(si),endYM:toYM(si+k-1),baseMonthly:String(Math.round((+r[3]/k)*100)/100)};
    });
    segs.push({type:'enterprise',startYM:'2026-01',endYM:'2031-06',baseMonthly:'36348'});
    const d = await rr(()=>page.data());
    Object.assign(d,{gender:'female',femaleType:'worker',birthYM:'1981-07',workStartYM:'2003-09',
      retireYM:'2031-07',hasDeemed:false,deemedStartYM:'',deemedEndYM:'',entryMode:'month',
      segments:segs,yearRows:[],accountBalanceManual:'481459',manualBalanceYM:'2025-12',
      futureMonthlyRatePct:'1.5',doc31Eligible:false,doc31TransferYM:'',enterpriseInsuredYM:'',
      subsidyExcludedText:'',cPingOverride:'',customCYearText:'',boundWarnings:[],errorMsg:''});
    await rr(()=>page.setData(d));
    await sleep(300);
    await rr(()=>page.callMethod('onCalculate'));
    const t1=Date.now(); let rp=null;
    while (Date.now()-t1<30000) {
      rp = await rr(()=>mp.currentPage());
      if (rp.path && rp.path.indexOf('pages/result/result')>=0) break;
      await sleep(200);
    }
    report.reachedResultAt = rp.path;
    // pure polling, NO screenshots, 40s
    const t2 = Date.now();
    while (Date.now()-t2 < 40000) {
      const cur = await rr(()=>mp.currentPage());
      const dd = await rr(()=>cur.data()).catch(()=>null);
      report.samples.push({
        t: Date.now()-t2, path: cur.path,
        ready: !!(dd && dd.ready),
        totalDisplay: dd && dd.totalDisplay
      });
      await sleep(1000);
    }
  } catch(e) { report.fatal = String(e && e.stack || e); }
  finally { try{await mp.disconnect();}catch(e){} }
  fs.writeFileSync(path.join(OUT,'diag-poll-only.json'), JSON.stringify(report,null,2),'utf8');
  const changed = report.samples.filter(s=>s.path.indexOf('pages/result')<0);
  console.log('POLLONLY DONE samples='+report.samples.length+' leftResult='+changed.length+
    (report.fatal?' fatal='+report.fatal:''));
  process.exit(0);
})();
