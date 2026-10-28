/* GT-4029 独立 GUI 验收（task-79 重建 · continue/stop 两情形）
 * 单一入口；helper ../common/gui-conn-lib.js。external：40215 connect/disconnect，零 RDP。
 *
 * case-specific：continue（继续缴费，账户利率透传计息）/stop（停保，仅历史段、rate=null、零计息）两情形接通 + GUI 零回归。
 * 导入 My-Case common（账户利率1.5%）→ 界面建两卡（retire2033-07/flexible，z0.6/z1.0）→ 开始比较 → compare-result。
 * 期望（tester 独立取值，不引用 README/旧 summary；账户利率随 common=1.5%）：
 *   GUI：结果页 ready/2列，列 P月=13290.66/13726.27；
 *   node：continueResult 账户利息>0、自动段2026-09~2035-08；stop baselineInput rate=null、仅历史段≤2026-08、利息=0、eligible；
 *   buildViewSafe 列 P 与 GUI 一致。
 * 产物：logs/result-GT4029.json；运行 node gt-4029.js 40215 external 2a61e71
 */
'use strict';
const fs=require('fs'),path=require('path');
const L=require('../common/gui-conn-lib.js');
const ROIm=require('../../calculator/roiModel.js');
const CRM=require('../../calculator/compareResultModel.js');

const PORT=parseInt(process.argv[2]||'40215',10);
const BASELINE=process.argv[4]||'unknown';
const FIXTURE='My-Case.md';
const LOGDIR=path.join(__dirname,'logs');fs.mkdirSync(LOGDIR,{recursive:true});
const rec=L.makeRecorder();
function tr(m){try{fs.appendFileSync(path.join(LOGDIR,'run-trace.log'),new Date().toISOString()+' '+m+'\n');}catch(e){}console.log(m);}
function ck(id,title,pass,actual,expected){rec.ck(id,title,pass,actual,expected);tr((pass?'PASS ':'FAIL ')+id+' '+title+' :: actual='+actual+' expected='+expected);}
const sleep=L.sleep, round2=n=>Math.round(Number(n)*100)/100;
const close2=(a,b)=>isFinite(a)&&isFinite(b)&&Math.abs(a-b)<0.01;
process.on('unhandledRejection',e=>tr('REJ '+(e&&e.message)));
process.on('uncaughtException',e=>tr('EXC '+(e&&e.message)));

const plans=[
  Object.assign({id:'p0'},{retireYM:'2033-07',z:'0.6',segType:'flexible',windowStartYM:''}),
  Object.assign({id:'p1'},{retireYM:'2033-07',z:'1.0',segType:'flexible',windowStartYM:''})
];
const EXP_P=[13290.66,13726.27];

(async()=>{
  let mp=null,fatal=false;
  const dump={at:new Date().toISOString(),testcase:'TST-02-GT-4029',baseline:BASELINE,port:PORT,gui:null,items:null};
  try{
    mp=await L.connectExisting(PORT);
    const landed0=await L.waitLanded(mp);if(!landed0){tr('NO_PAGE');process.exit(4);}
    await L.clearCompareDrafts(mp);
    const cmp=await L.gotoCompare(mp);if(!cmp){tr('NO_CMP');process.exit(3);}
    const fileName=await L.importFixture(mp,FIXTURE,'gt4029');
    ck('4029-0','真实文件导入 common 成功',!!(fileName&&String(fileName).indexOf(FIXTURE)>=0),fileName,FIXTURE);

    // 界面建两卡
    await L.patchPlanCard(mp,0,plans[0]);
    await L.patchPlanCard(mp,1,plans[1]);
    const res=await L.compareStartAndWait(mp);
    dump.gui=res;
    ck('4029-1','开始比较→compare-result ready 且2列（GUI 零回归/不再白屏）',res.landed&&res.columns.length===2,'landed='+res.landed+' n='+res.columns.length,'landed,2');
    const guiP=res.columns.map(c=>Number(c.P));
    ck('4029-2','GUI 列 P月=期望',res.landed&&close2(guiP[0],EXP_P[0])&&close2(guiP[1],EXP_P[1]),guiP.map(round2).join(','),EXP_P.join(','));

    // node 独立：真实 shared input（rate=0.015）
    const ref=L.buildFixtureInput(FIXTURE,0.015);
    const si=ref.sharedInput;
    const items=plans.map(p=>ROIm.computeROI(si,p));
    dump.items=items.map(it=>({status:it.status,continueP:it.pMonthly,stopP:it.baselineMonthly,
      contInterest:it.continueResult.intermediates.R储利息, stopInterest:it.baselineResult.intermediates.R储利息,
      contSegs:it.continueInput.segments.length, stopSegs:it.baselineInput.segments.length,
      stopRate:it.baselineInput.futureMonthlyRate, stopEndMax:it.baselineInput.segments.map(s=>s.endYM).sort().slice(-1)[0],
      contAutoFirst:it.continueInput.segments.map(s=>s.startYM).sort().find(ym=>ym>='2026-09'),
      contAutoLast:it.continueInput.segments.map(s=>s.endYM).sort().filter(ym=>ym>='2026-09').slice(-1)[0],
      stopEligible:it.baselineEligible}));

    items.forEach((it,i)=>{
      ck('4029-C'+i,'方案'+(i+1)+' continue 账户利息>0（利率透传计息）',it.continueResult.intermediates.R储利息>0,'interest='+round2(it.continueResult.intermediates.R储利息),'>0');
      ck('4029-A'+i,'方案'+(i+1)+' continue 自动段首=2026-09 末=2033-06（retire2033-07前月）',
         it.continueInput.segments.some(s=>s.startYM==='2026-09')&&it.continueInput.segments.some(s=>s.endYM==='2033-06'),
         'first='+dump.items[i].contAutoFirst+' last='+dump.items[i].contAutoLast,'2026-09,2033-06');
      ck('4029-S'+i,'方案'+(i+1)+' stop rate=null（停保）',it.baselineInput.futureMonthlyRate===null,'rate='+it.baselineInput.futureMonthlyRate,'null');
      ck('4029-H'+i,'方案'+(i+1)+' stop 仅历史段 maxEnd=2026-08',dump.items[i].stopEndMax==='2026-08','maxEnd='+dump.items[i].stopEndMax,'2026-08');
      const stopInt=it.baselineResult.intermediates.R储利息;
      ck('4029-I'+i,'方案'+(i+1)+' stop 零计息且 eligible',
         !stopInt&&it.baselineEligible===true,'interest='+stopInt+' eligible='+it.baselineEligible,'0,true');
    });

    // buildViewSafe 与 GUI 一致
    const pre=CRM.buildViewSafe(si,plans,0);
    const nodeP=(pre.view.columns||[]).map(c=>Number(c.pMonthly));
    ck('4029-X','node buildViewSafe 列 P=GUI',pre.ok&&close2(nodeP[0],guiP[0])&&close2(nodeP[1],guiP[1]),nodeP.map(round2).join(','),guiP.map(round2).join(','));

    await mp.screenshot({path:path.join(LOGDIR,'GT4029.png')}).catch(()=>{});
    dump.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-GT4029.json'),JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  }catch(e){fatal=true;tr('ABORT '+(e&&e.message));
    try{dump.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(LOGDIR,'result-GT4029.json'),JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2));}catch(x){}
  }finally{await L.disconnectQuiet(mp);}
  const t=rec.totals();tr('=== GT-4029 pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail?1:(fatal?2:0));
})();
