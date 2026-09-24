'use strict';
/*
 * diag-my3-shot.js — diagnose why mp.screenshot() pixels show the input page
 * while page.data()/DOM assertions pass on the result page.
 * Fresh one-shot cli auto port 9651, MY3 only. All polling in-script.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const OUT = PROJECT + '\\autotest\\output\\gui';
const SDK_DIR = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const automator = require(SDK_DIR);
const PORT = 9651;
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
  const report = { steps: [] };
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT });
  try {
    try { await mp.callWxMethod('clearStorageSync'); } catch (e) {}
    await mp.reLaunch('/pages/index/index').catch(()=>{});
    let page = null;
    const t0 = Date.now();
    while (Date.now()-t0 < 60000) {
      page = await rr(()=>mp.currentPage());
      if (page.path && page.path.indexOf('pages/index/index')>=0) {
        const dd = await rr(()=>page.data());
        if (Object.keys(dd).length>5) break;
      }
      await sleep(800);
    }
    const segs = YEAR_ROWS.map(r=>{
      const y=+r[0],sm=+r[1],k=+r[2];
      const si=y*12+(sm-1);
      return {type:'enterprise',startYM:toYM(si),endYM:toYM(si+k-1),baseMonthly:String(Math.round((+r[3]/k)*100)/100)};
    });
    segs.push({type:'enterprise',startYM:'2026-01',endYM:'2031-06',baseMonthly:'36348'});
    const d = await rr(()=>page.data());
    Object.assign(d, {
      gender:'female', femaleType:'worker', birthYM:'1981-07', workStartYM:'2003-09',
      retireYM:'2031-07', hasDeemed:false, deemedStartYM:'', deemedEndYM:'',
      entryMode:'month', segments:segs, yearRows:[],
      accountBalanceManual:'481459', manualBalanceYM:'2025-12', futureMonthlyRatePct:'1.5',
      doc31Eligible:false, doc31TransferYM:'', enterpriseInsuredYM:'',
      subsidyExcludedText:'', cPingOverride:'', customCYearText:'',
      boundWarnings:[], errorMsg:''
    });
    await rr(()=>page.setData(d));
    await sleep(300);
    await rr(()=>page.callMethod('onCalculate'));
    const t1 = Date.now(); let rp = null;
    while (Date.now()-t1 < 30000) {
      rp = await rr(()=>mp.currentPage());
      if (rp.path && rp.path.indexOf('pages/result/result')>=0) break;
      await sleep(350);
    }
    let rdata = null;
    const t2 = Date.now();
    while (Date.now()-t2 < 20000) {
      rdata = await rr(()=>rp.data());
      if (rdata.ready && rdata.vm && rdata.r) break;
      await sleep(400);
    }
    // 6 rounds: record path + totalDisplay + screenshot hash
    for (let i=0;i<6;i++) {
      const cur = await rr(()=>mp.currentPage());
      const dd = await rr(()=>cur.data()).catch(()=>null);
      const p = path.join(OUT, 'diag-my3-' + i + '.png');
      try { fs.unlinkSync(p); } catch(e){}
      let shotOk = false, bytes = 0, hash = null;
      try {
        await mp.screenshot({ path: p });
        await sleep(300);
        bytes = fs.statSync(p).size;
        hash = crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
        shotOk = bytes > 40000;
      } catch(e) { report.steps.push({i, shotError: String(e.message||e)}); }
      let domTotal = null;
      try { const el = await cur.$('.total-card .total'); domTotal = el ? String(await el.text()) : null; } catch(e){}
      report.steps.push({
        i, path: cur.path, ready: dd && dd.ready,
        totalDisplay: dd && dd.totalDisplay, domTotal,
        retireInResult: dd && dd.r && dd.r.inputs && dd.r.inputs.retireYM,
        shotBytes: bytes, shotMd5: hash
      });
      await sleep(1200);
    }
  } catch (e) {
    report.fatal = String(e && e.stack || e);
  } finally {
    try { await mp.disconnect(); } catch(e){}
  }
  fs.writeFileSync(path.join(OUT,'diag-my3-shot.json'), JSON.stringify(report,null,2),'utf8');
  console.log('DIAG DONE steps=' + report.steps.length + (report.fatal?' fatal='+report.fatal:''));
  process.exit(0);
})();
