'use strict';
/*
 * diag-trigger.js — discriminate what makes the result page navigate back:
 *   Round A: reach result -> wait 8s with ONLY page.data() polls -> 1 screenshot
 *   Round B: reach result -> 8s of DOM queries ($/$$/.text())   -> 1 screenshot
 * Screenshots are pixel-checked by vision afterwards.
 * Fresh cli auto ports 9655 (A) / 9657 (B). All polling in-script.
 */
const fs = require('fs');
const path = require('path');
const net = require('net');
const cp = require('child_process');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const OUT = PROJECT + '\\autotest\\output\\gui';
const automator = require('C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator');
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
function discoverCli() {
  const root = 'C:\\Program Files (x86)\\Tencent';
  for (const d of fs.readdirSync(root)) {
    const c = path.join(root, d, 'cli.bat');
    if (fs.existsSync(c)) return c;
  }
  throw new Error('cli.bat not found');
}
const CLI = discoverCli();
function listening(p) {
  return new Promise(res => {
    const s = net.createConnection({ port: p, host: '127.0.0.1' });
    const d = v => { try { s.destroy(); } catch (e) {} res(v); };
    s.once('connect', () => d(true)); s.once('error', () => d(false));
    setTimeout(() => d(false), 1000);
  });
}
async function freshAuto(port) {
  const child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + port,
    { shell: true, stdio: 'ignore', windowsHide: true });
  const t0 = Date.now();
  while (!(await listening(port)) && Date.now()-t0 < 120000) await sleep(1200);
  await sleep(1500);
  return child;
}
async function rr(fn,n){let e;for(let i=0;i<(n||3);i++){try{return await fn();}catch(x){e=x;await sleep(600*(i+1));}}throw e;}

async function reachResult(mp) {
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
  const t2=Date.now();
  while (Date.now()-t2<15000) {
    const dd = await rr(()=>rp.data()).catch(()=>null);
    if (dd && dd.ready && dd.vm) return rp;
    await sleep(300);
  }
  return rp;
}
async function shot(mp, name) {
  const p = path.join(OUT, name);
  try{fs.unlinkSync(p);}catch(e){}
  await mp.screenshot({ path: p });
  await sleep(300);
  return { path: p, bytes: fs.statSync(p).size };
}

(async () => {
  const report = { A: {}, B: {} };
  // ---- Round A: data-only waits, port 9655
  let cliChild = await freshAuto(9655);
  let mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9655' });
  try {
    const rp = await reachResult(mp);
    const t0 = Date.now();
    while (Date.now()-t0 < 8000) {
      const cur = await rr(()=>mp.currentPage());
      await rr(()=>cur.data()).catch(()=>{});
      await sleep(1000);
    }
    let before = await rr(()=>mp.currentPage());
    report.A.pathBeforeShot = before.path;
    report.A.shot = await shot(mp, 'diag-trigger-A.png');
    await sleep(1500);
    let after = await rr(()=>mp.currentPage());
    report.A.pathAfterShot = after.path;
  } catch(e){ report.A.fatal = String(e && e.stack || e); }
  finally { try{await mp.disconnect();}catch(e){} try{cliChild.kill();}catch(e){} }
  await sleep(4000);
  // ---- Round B: DOM-heavy waits, port 9657
  cliChild = await freshAuto(9657);
  mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9657' });
  try {
    const rp = await reachResult(mp);
    const t0 = Date.now();
    while (Date.now()-t0 < 8000) {
      const cur = await rr(()=>mp.currentPage());
      const els = await rr(()=>cur.$$('.muted,.warn,.note,.total-card .total'));
      for (const el of els.slice(0,6)) { try { await el.text(); } catch(e){} }
      await sleep(1000);
    }
    let before = await rr(()=>mp.currentPage());
    report.B.pathBeforeShot = before.path;
    report.B.shot = await shot(mp, 'diag-trigger-B.png');
    await sleep(1500);
    let after = await rr(()=>mp.currentPage());
    report.B.pathAfterShot = after.path;
  } catch(e){ report.B.fatal = String(e && e.stack || e); }
  finally { try{await mp.disconnect();}catch(e){} try{cliChild.kill();}catch(e){} }
  fs.writeFileSync(path.join(OUT,'diag-trigger.json'), JSON.stringify(report,null,2),'utf8');
  console.log('TRIGGER A:'+report.A.pathBeforeShot+'->'+report.A.pathAfterShot+
    ' B:'+report.B.pathBeforeShot+'->'+report.B.pathAfterShot);
  process.exit(0);
})();
