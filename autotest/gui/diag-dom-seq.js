'use strict';
/*
 * diag-dom-seq.js — replay verify-wife's EXACT DOM assertion sequence (no
 * screenshots) and poll the current path for 20s, to check whether those DOM
 * calls (rather than screenshot) trigger the result->index fallback.
 * Fresh cli auto port 9659. All polling in-script.
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
async function rr(fn,n){let e;for(let i=0;i<(n||3);i++){try{return await fn();}catch(x){e=x;await sleep(600*(i+1));}}throw e;}
function discoverCli() {
  const root='C:\\Program Files (x86)\\Tencent';
  for (const d of fs.readdirSync(root)) { const c=path.join(root,d,'cli.bat'); if (fs.existsSync(c)) return c; }
  throw new Error('cli not found');
}
function listening(p){return new Promise(res=>{const s=net.createConnection({port:p,host:'127.0.0.1'});const d=v=>{try{s.destroy();}catch(e){}res(v);};s.once('connect',()=>d(true));s.once('error',()=>d(false));setTimeout(()=>d(false),1000);});}

(async () => {
  const report = { events: [] };
  const port = 9659;
  const cli = cp.spawn('"'+discoverCli()+'" auto --project "'+PROJECT+'" --auto-port '+port,
    { shell:true, stdio:'ignore', windowsHide:true });
  const tC=Date.now(); while(!(await listening(port))&&Date.now()-tC<120000) await sleep(1200);
  await sleep(1500);
  const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:'+port });
  try {
    try { await mp.callWxMethod('clearStorageSync'); } catch(e){}
    await mp.reLaunch('/pages/index/index').catch(()=>{});
    let page=null; const t0=Date.now();
    while(Date.now()-t0<60000){
      page=await rr(()=>mp.currentPage());
      if(page.path&&page.path.indexOf('pages/index/index')>=0){
        const dd=await rr(()=>page.data()); if(Object.keys(dd).length>5) break;
      }
      await sleep(800);
    }
    const segs=YEAR_ROWS.map(r=>{const y=+r[0],sm=+r[1],k=+r[2],si=y*12+(sm-1);
      return {type:'enterprise',startYM:toYM(si),endYM:toYM(si+k-1),baseMonthly:String(Math.round((+r[3]/k)*100)/100)};});
    segs.push({type:'enterprise',startYM:'2026-01',endYM:'2031-06',baseMonthly:'36348'});
    const d=await rr(()=>page.data());
    Object.assign(d,{gender:'female',femaleType:'worker',birthYM:'1981-07',workStartYM:'2003-09',
      retireYM:'2031-07',hasDeemed:false,deemedStartYM:'',deemedEndYM:'',entryMode:'month',
      segments:segs,yearRows:[],accountBalanceManual:'481459',manualBalanceYM:'2025-12',
      futureMonthlyRatePct:'1.5',doc31Eligible:false,doc31TransferYM:'',enterpriseInsuredYM:'',
      subsidyExcludedText:'',cPingOverride:'',customCYearText:'',boundWarnings:[],errorMsg:''});
    await rr(()=>page.setData(d));
    await sleep(300);
    await rr(()=>page.callMethod('onCalculate'));
    const t1=Date.now(); let rp=null;
    while(Date.now()-t1<30000){ rp=await rr(()=>mp.currentPage());
      if(rp.path&&rp.path.indexOf('pages/result/result')>=0) break; await sleep(200); }
    const t2=Date.now();
    while(Date.now()-t2<15000){ const dd=await rr(()=>rp.data()).catch(()=>null);
      if(dd&&dd.ready&&dd.vm) break; await sleep(300); }
    const readyAt = Date.now();
    // ---- exact DOM sequence from verify-wife section 8/8b, path checks between ----
    const check = async tag => { const cur=await rr(()=>mp.currentPage());
      report.events.push({tag, t:Date.now()-readyAt, path:cur.path}); };
    let el=await rp.$('.total-card .total'); const domTotal = el ? String(await el.text()) : null;
    await check('after .total query');
    const partEls = await rp.$$('.total-card .parts .strong');
    for(const e of partEls) await e.text();
    await check('after .parts query');
    await rp.$('.card.ok');
    await check('after .card.ok query');
    const noteEls = await rp.$$('.muted, .warn, .note');
    for(const e of noteEls) await e.text();
    await check('after notes query');
    report.domTotal = domTotal;
    // 12s pure path polling
    const t3=Date.now();
    while(Date.now()-t3<12000){ const cur=await rr(()=>mp.currentPage());
      report.events.push({tag:'poll', t:Date.now()-readyAt, path:cur.path}); await sleep(1500); }
  } catch(e){ report.fatal=String(e&&e.stack||e); }
  finally { try{await mp.disconnect();}catch(e){} try{cli.kill();}catch(e){} }
  fs.writeFileSync(path.join(OUT,'diag-dom-seq.json'), JSON.stringify(report,null,2),'utf8');
  const left=report.events.filter(e=>e.path.indexOf('pages/result')<0);
  console.log('DOMSEQ DONE events='+report.events.length+' leftResult='+left.length+
    (report.fatal?' fatal='+report.fatal:''));
  process.exit(0);
})();
