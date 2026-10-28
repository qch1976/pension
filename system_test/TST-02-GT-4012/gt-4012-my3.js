/* GT-4012 独立 GUI 验收（task-79 重建 · my3）
 * 单一入口；流程 helper ../common/gui-conn-lib.js（零 case 值）。external：40215 只 connect/disconnect。
 *
 * case-specific：my3 compare Z=3.0【上限方案】。
 * 导入 My-Case common → 界面设两卡（退休2033-07/灵活；z=0.6 与 z=3.0）→ 开始比较 → compare-result。
 * 期望（tester 本次独立重算；账户利率随导入 common=1.5%）：
 *   Z 上界：validateZ('3.0')=null（合法）、'3.01' 拦；两卡 isValidPlan=true；
 *   列 P月 card1=13290.66(z0.6)、card2=15904.33(z3.0)；GUI=node <0.01。
 * 产物：logs/result-GT4012.json + GT4012.png；运行 node gt-4012-my3.js 40215 external 2a61e71
 */
'use strict';
const fs = require('fs'), path = require('path');
const L = require('../common/gui-conn-lib.js');
const PM = require('../../calculator/planModel.js');
const D = require('../../calculator/dateUtil.js');
const CRM = require('../../calculator/compareResultModel.js');

const PORT = parseInt(process.argv[2] || '40215', 10);
const BASELINE = process.argv[4] || 'unknown';
const FIXTURE = 'My-Case.md';
const LOGDIR = path.join(__dirname, 'logs');
fs.mkdirSync(LOGDIR, { recursive: true });
const rec = L.makeRecorder();
function tr(m){ try { fs.appendFileSync(path.join(LOGDIR,'run-trace.log'), new Date().toISOString()+' '+m+'\n'); } catch(e){} console.log(m); }
function ck(id,title,pass,actual,expected){ rec.ck(id,title,pass,actual,expected); tr((pass?'PASS ':'FAIL ')+id+' '+title+' :: actual='+actual+' expected='+expected); }
const sleep=L.sleep, round2=n=>Math.round(Number(n)*100)/100;
const close2=(a,b)=>isFinite(a)&&isFinite(b)&&Math.abs(a-b)<0.01;
process.on('unhandledRejection',e=>tr('REJ '+(e&&e.message)));
process.on('uncaughtException',e=>tr('EXC '+(e&&e.message)));

const C0 = { retireYM:'2033-07', retireTouched:true, z:'0.6', segType:'flexible', windowStartYM:'' };
const C1 = { retireYM:'2033-07', retireTouched:true, z:'3.0', segType:'flexible', windowStartYM:'' };
const EXP_P = [13290.66, 15904.33];

(async () => {
  let mp=null, fatal=false;
  const dump = { at:new Date().toISOString(), testcase:'TST-02-GT-4012', tag:'my3', baseline:BASELINE, port:PORT, gui:null, node:null };
  try {
    mp = await L.connectExisting(PORT);
    const landed0=await L.waitLanded(mp); if(!landed0){tr('NO_PAGE');process.exit(4);}
    await L.clearCompareDrafts(mp);
    const cmp=await L.gotoCompare(mp); if(!cmp){tr('COMPARE_NOT_READY');process.exit(3);}
    const fileName=await L.importFixture(mp,FIXTURE,'gt4012');
    ck('4012-1','真实文件导入 common 成功', !!(fileName&&String(fileName).indexOf(FIXTURE)>=0), fileName, FIXTURE);

    // Z 上界纯函数校验（node 侧同一 validateZ）
    ck('4012-2','Z=3.0 上限合法（validateZ=null）', PM.validateZ('3.0')===null, PM.validateZ('3.0'), 'null');
    ck('4012-3','Z=3.01 超上限被拦', PM.validateZ('3.01')!==null, PM.validateZ('3.01'), 'red error');

    await L.patchPlanCard(mp,0,C0);
    await L.patchPlanCard(mp,1,C1);
    const sF=await L.readCompare(mp); dump.filled=sF;
    ck('4012-4','两卡含 Z=3.0 上限方案按界面落库',
       sF.plans[0].z==='0.6'&&sF.plans[1].z==='3.0'&&sF.plans.every(p=>p.retireYM==='2033-07'&&p.segType==='flexible'),
       sF.plans.map(p=>'z'+p.z+'/'+p.segType).join(' ; '), 'z0.6 ; z3.0');
    ck('4012-5','两卡 isValidPlan=true（3.0 方案有效）', sF.plans.every(p=>PM.isValidPlan(p,sF.ctx,D)),
       sF.plans.map(p=>PM.isValidPlan(p,sF.ctx,D)).join(','), 'true,true');

    const res=await L.compareStartAndWait(mp);
    dump.gui=res;
    ck('4012-6','进入 compare-result 且2列', res.landed&&res.columns.length===2, 'landed='+res.landed+' n='+res.columns.length, 'landed,2');
    const guiP=res.columns.map(c=>Number(c.P));
    ck('4012-7','GUI 列 P月=期望（含 Z3.0=15904.33）', res.landed&&close2(guiP[0],EXP_P[0])&&close2(guiP[1],EXP_P[1]), guiP.map(round2).join(','), EXP_P.join(','));

    const ref=L.buildFixtureInput(FIXTURE,0.015);
    const pre=CRM.buildViewSafe(ref.sharedInput,[C0,C1],0);
    const nodeP=(pre.view.columns||[]).map(c=>Number(c.pMonthly));
    dump.node={ok:pre.ok,P:nodeP};
    ck('4012-8','node 与 GUI 列一致', pre.ok&&close2(nodeP[0],guiP[0])&&close2(nodeP[1],guiP[1]), nodeP.map(round2).join(','), guiP.map(round2).join(','));

    await mp.screenshot({path:path.join(LOGDIR,'GT4012.png')}).catch(()=>{});
    dump.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-GT4012.json'), JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  } catch(e){ fatal=true; tr('ABORT '+(e&&e.message));
    try{ dump.finishedAt=new Date().toISOString(); fs.writeFileSync(path.join(LOGDIR,'result-GT4012.json'), JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2)); }catch(x){}
  } finally { await L.disconnectQuiet(mp); }
  const t=rec.totals(); tr('=== GT-4012(my3) pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail?1:(fatal?2:0));
})();
