/* GT-4011 独立 GUI 验收（task-79 重建 · my2）
 * 单一入口；流程 helper ../common/gui-conn-lib.js（零 case 值）。external：40215 只 connect/disconnect，零 RDP。
 *
 * case-specific：my2 compare 差异项【以界面为准】。
 * 导入 My-Case common（两卡默认法定 2035-09/false）→ 用户在界面为两卡设差异（手选退休2033-07 + z0.6/1.0 + 灵活）
 * → 开始比较 → compare-result。
 * 期望（tester 本次独立重算；账户利率随导入 common=1.5%，onLoad rebuild(0) 不覆盖 sharedInput 利率；不引用旧数字）：
 *   两卡 isValidPlan=true；列 P月 card1=13290.66(z0.6)、card2=13726.27(z1.0)；GUI=node buildViewSafe <0.01。
 * 产物：logs/result-GT4011.json + GT4011.png；运行 node gt-4011-my2.js 40215 external 2a61e71
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
const sleep = L.sleep, round2 = n => Math.round(Number(n)*100)/100;
const close2 = (a,b) => isFinite(a)&&isFinite(b)&&Math.abs(a-b)<0.01;
process.on('unhandledRejection', e => tr('REJ '+(e&&e.message)));
process.on('uncaughtException', e => tr('EXC '+(e&&e.message)));

// case-specific 卡差异（界面设置）
const C0 = { retireYM:'2033-07', retireTouched:true, z:'0.6', segType:'flexible', windowStartYM:'' };
const C1 = { retireYM:'2033-07', retireTouched:true, z:'1.0', segType:'flexible', windowStartYM:'' };
const EXP_P = [13290.66, 13726.27];

(async () => {
  let mp=null, fatal=false;
  const dump = { at:new Date().toISOString(), testcase:'TST-02-GT-4011', tag:'my2', baseline:BASELINE, port:PORT, afterImport:null, gui:null, node:null };
  try {
    mp = await L.connectExisting(PORT);
    const landed0 = await L.waitLanded(mp); if(!landed0){tr('NO_PAGE');process.exit(4);}
    await L.clearCompareDrafts(mp);
    const cmp = await L.gotoCompare(mp); if(!cmp){tr('COMPARE_NOT_READY');process.exit(3);}
    const fileName = await L.importFixture(mp, FIXTURE, 'gt4011');
    ck('4011-1','真实文件导入 common 成功', !!(fileName&&String(fileName).indexOf(FIXTURE)>=0), fileName, FIXTURE);
    const sI = await L.readCompare(mp); dump.afterImport=sI;
    ck('4011-2','导入后两卡默认法定退休=2035-09/touched=false', sI.plans.length===2&&sI.plans.every(p=>p.retireYM==='2035-09'&&p.retireTouched===false),
       sI.plans.map(p=>p.retireYM+'/'+p.retireTouched).join(','), '2035-09/false,...');

    // 界面设差异（父层真实 onCardChange；退休手选→touched=true）
    await L.patchPlanCard(mp, 0, C0);
    await L.patchPlanCard(mp, 1, C1);
    const sF = await L.readCompare(mp); dump.filled=sF;
    ck('4011-3','两卡差异按界面落库（退休/z/性质）',
       sF.plans[0].z==='0.6'&&sF.plans[1].z==='1.0'&&sF.plans.every(p=>p.retireYM==='2033-07'&&p.segType==='flexible'&&p.retireTouched===true),
       sF.plans.map(p=>p.retireYM+'/z'+p.z+'/'+p.segType+'/'+p.retireTouched).join(' ; '), 'two distinct cards');
    ck('4011-4','两卡 isValidPlan=true', sF.plans.every(p=>PM.isValidPlan(p,sF.ctx,D)),
       sF.plans.map(p=>PM.isValidPlan(p,sF.ctx,D)).join(','), 'true,true');

    // 开始比较 → 结果页
    const res = await L.compareStartAndWait(mp);
    dump.gui = res;
    ck('4011-5','进入 compare-result 且2列', res.landed&&res.columns.length===2, 'landed='+res.landed+' n='+res.columns.length, 'landed,2');
    const guiP = res.columns.map(c=>Number(c.P));
    ck('4011-6','GUI 列 P月=期望', res.landed&&close2(guiP[0],EXP_P[0])&&close2(guiP[1],EXP_P[1]), guiP.map(round2).join(','), EXP_P.join(','));

    // node 独立重算：账户利率随导入 common=1.5%（buildViewSafe 第3参 0 与 onLoad rebuild 一致）
    const ref = L.buildFixtureInput(FIXTURE, 0.015);
    const pre = CRM.buildViewSafe(ref.sharedInput, [C0,C1], 0);
    const nodeP = (pre.view.columns||[]).map(c=>Number(c.pMonthly));
    dump.node = { ok:pre.ok, P:nodeP };
    ck('4011-7','node buildViewSafe 与 GUI 列一致', pre.ok&&close2(nodeP[0],guiP[0])&&close2(nodeP[1],guiP[1]), nodeP.map(round2).join(','), guiP.map(round2).join(','));

    await mp.screenshot({ path:path.join(LOGDIR,'GT4011.png') }).catch(()=>{});
    dump.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-GT4011.json'), JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  } catch(e){ fatal=true; tr('ABORT '+(e&&e.message));
    try{ dump.finishedAt=new Date().toISOString(); fs.writeFileSync(path.join(LOGDIR,'result-GT4011.json'), JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2)); }catch(x){}
  } finally { await L.disconnectQuiet(mp); }
  const t=rec.totals(); tr('=== GT-4011(my2) pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail?1:(fatal?2:0));
})();
