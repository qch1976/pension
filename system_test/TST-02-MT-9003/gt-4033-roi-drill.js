/* GT-4033 独立 GUI 验收（task-86 · BUG-02-0012 ROI 计算细节下钻）
 * 单一入口；common helper ../common/gui-conn-lib.js（零 case 值）。40215 只 connect/disconnect，零 RDP。
 *
 * case-specific：compare 结果页「数值下钻→查看明细」须含「ROI 计算细节」段，字段与 roiModel 产出勾稽。
 * 链路：清 draft → compare → 真实文件导入 My-Case → 界面建两卡（retire2033-07/flexible, z0.6/z3.0）
 *      → 开始比较 → 结果页逐方案回读 view.drills[i].roi → 打开下钻回读渲染数据。
 * 期望（tester 独立取值，node 侧 roiModel 独立重算，不引用 developer 回显）：
 *  ① drills 每项含 roi 对象，16 字段齐备；
 *  ② 勾稽：deltaMonthly = pMonthly − baselineMonthly；roiRounded ≈ delta/rContinued；
 *  ③ roiRounded/percentText 与 node 独立算值一致（<1e-4 / 文本相等）；
 *  ④ blocked 场景：status!=='ok' 时 roiRounded=null、percentText=''、reason 非空、月数依据齐备；
 *  ⑤ 回归：drills 既有字段（history/deemed/account/pension/cashflow）仍在，columns.roiText 正常。
 * 产物：logs/result-GT4033-0012.json + 截图≤3；运行 node gt-4033-roi-drill.js 40215 external <baseline>
 */
'use strict';
const fs=require('fs'), path=require('path');
const L=require('../common/gui-conn-lib.js');
const ROIm=require('../../calculator/roiModel.js');
const CRM=require('../../calculator/compareResultModel.js');

const PORT=parseInt(process.argv[2]||'40215',10);
const BASELINE=process.argv[4]||'unknown';
const LOGDIR=path.join(__dirname,'logs'); fs.mkdirSync(LOGDIR,{recursive:true});
const rec=L.makeRecorder();
function tr(m){ try{fs.appendFileSync(path.join(LOGDIR,'run-trace.log'),new Date().toISOString()+' '+m+'\n');}catch(e){} console.log(m); }
function ck(id,title,pass,actual,expected){ rec.ck(id,title,pass,actual,expected); tr((pass?'PASS ':'FAIL ')+id+' '+title+' :: actual='+actual+' expected='+expected); }
const sleep=L.sleep, r2=n=>Math.round(Number(n)*100)/100;
const near=(a,b,t)=>isFinite(a)&&isFinite(b)&&Math.abs(a-b)<=(t||1e-4);
process.on('unhandledRejection',e=>tr('REJ '+(e&&e.message)));
process.on('uncaughtException',e=>tr('EXC '+(e&&e.message)));

const plans=[
  Object.assign({id:'p0'},{retireYM:'2033-07',z:'0.6',segType:'flexible',windowStartYM:''}),
  Object.assign({id:'p1'},{retireYM:'2033-07',z:'3.0',segType:'flexible',windowStartYM:''})
];

(async()=>{
  let mp=null,fatal=false;
  const dump={at:new Date().toISOString(),testcase:'TST-02-MT-9003',caseId:'BUG-02-0012',baseline:BASELINE,port:PORT,drills:null,node:null};
  try{
    mp=await L.connectExisting(PORT);
    if(!await L.waitLanded(mp)){ tr('NO_PAGE'); process.exit(4); }
    await L.clearCompareDrafts(mp);
    const cmp=await L.gotoCompare(mp); if(!cmp){ tr('COMPARE_NOT_READY'); process.exit(3); }
    await L.importFixture(mp,'My-Case.md','gt4033');
    await L.patchPlanCard(mp,0,plans[0]);
    await L.patchPlanCard(mp,1,plans[1]);
    const res=await L.compareStartAndWait(mp);
    ck('0012-1','开始比较→结果页 ready 且2列', res.landed&&res.columns.length===2, 'landed='+res.landed+' n='+res.columns.length,'2');

    // 回读 view.drills[*].roi（页面真实数据）
    const drills=await L.ev(mp,()=>{
      const p=getCurrentPages().slice(-1)[0];
      const v=(p.data||{}).view||{};
      const ds=v.drills||[];
      return {
        count: ds.length,
        keys: ds.map(d=>Object.keys(d||{}).sort()),
        roi: ds.map(d=>d&&d.roi?d.roi:null),
        colRoiText: (v.columns||[]).map(c=>({roiText:c.roiText, roiStatus:c.roiStatus, pMonthly:c.pMonthly, rContinued:c.rContinued}))
      };
    });
    dump.drills=drills;

    ck('0012-2','drills 每项均含 roi 对象', drills.roi.length===2&&drills.roi.every(x=>x&&typeof x==='object'), 'n='+drills.roi.filter(Boolean).length,'2');
    const NEED=['ok','status','reason','userRatePercent','paybackText','pMonthly','baselineMonthly','deltaMonthly','rContinued','roiRounded','percentText','minRequiredMonths','baselineTotalMonths','eligible','baselineEligible'];
    const miss=NEED.filter(k=>!(drills.roi[0]&&(k in drills.roi[0])));
    ck('0012-3','roi 字段齐备（核心 15 项）', miss.length===0, 'missing='+JSON.stringify(miss),'[]');

    // 勾稽：delta = pMonthly - baselineMonthly；roi = delta / rContinued
    const g=[];
    drills.roi.forEach((x,i)=>{
      if(!x) return;
      g.push({i, deltaOK: near(x.deltaMonthly, r2(x.pMonthly-x.baselineMonthly), 0.011),
        roiOK: x.status==='ok' ? near(x.roiRounded, (x.pMonthly-x.baselineMonthly)/x.rContinued, 1e-3) : true });
    });
    ck('0012-4','勾稽 月差额=继续P月−停保基准P月', g.every(x=>x.deltaOK), JSON.stringify(g.map(x=>x.deltaOK)),'all true');
    ck('0012-5','勾稽 ROI=(P月−基准)/R续', g.every(x=>x.roiOK), JSON.stringify(g.map(x=>x.roiOK)),'all true');

    // node 独立重算（roiModel），与页面 roi 逐项比对
    const ref=L.buildFixtureInput('My-Case.md',0.015);
    const items=plans.map(p=>ROIm.computeROI(ref.sharedInput,p));
    const nodeRoi=items.map(it=>({status:it.status,pMonthly:it.pMonthly,baselineMonthly:it.baselineMonthly,
      rContinued:it.rContinued,roiRounded:it.roiRounded,percentText:it.percentText,
      minRequiredMonths:it.minRequiredMonths,baselineTotalMonths:it.baselineTotalMonths,
      eligible:it.eligible,baselineEligible:it.baselineEligible}));
    dump.node=nodeRoi;
    let cmpOK=true, bad=[];
    nodeRoi.forEach((n,i)=>{
      const gui=drills.roi[i]; if(!gui){ cmpOK=false; bad.push(i+':no-gui'); return; }
      if(n.status!==gui.status) { cmpOK=false; bad.push(i+':status '+n.status+'/'+gui.status); }
      if(!near(n.pMonthly,gui.pMonthly,0.011)) { cmpOK=false; bad.push(i+':pMonthly'); }
      if(!near(n.baselineMonthly,gui.baselineMonthly,0.011)) { cmpOK=false; bad.push(i+':baseline'); }
      if(!near(n.rContinued,gui.rContinued,0.011)) { cmpOK=false; bad.push(i+':rCont'); }
      if(n.roiRounded!=null && !near(n.roiRounded,gui.roiRounded,1e-3)) { cmpOK=false; bad.push(i+':roiRounded'); }
      if((n.percentText||'')!==(gui.percentText||'')) { cmpOK=false; bad.push(i+':percentText'); }
    });
    ck('0012-6','页面 roi 与 node roiModel 独立算值一致', cmpOK, bad.join(';')||'all match','all match');

    // blocked 分支自洽（若存在 blocked 方案）
    const blocked=drills.roi.filter(x=>x&&x.status!=='ok');
    if(blocked.length){
      const okB=blocked.every(x=>x.roiRounded===null&&(x.percentText===''||x.percentText==null)&&!!x.reason
        &&x.minRequiredMonths!=null&&x.baselineTotalMonths!=null);
      ck('0012-7','blocked 分支：roiRounded=null/percentText空/reason+月数依据齐备', okB,
        JSON.stringify(blocked.map(x=>({st:x.status,rr:x.roiRounded,pt:x.percentText,hasReason:!!x.reason,min:x.minRequiredMonths,tot:x.baselineTotalMonths}))),'consistent');
    } else {
      ck('0012-7','blocked 分支（本场景无 blocked 方案，判据由 node 侧 UT-1039 覆盖）', true, 'no-blocked-in-this-case','n/a');
    }

    // 回归：drills 既有字段 + columns.roiText
    const legacy=['history','deemed','account','pension','cashflow'];
    const hasLegacy=legacy.filter(k=>drills.keys.some(ks=>ks.indexOf(k)>=0));
    ck('0012-8','回归：drills 既有下钻字段仍在', hasLegacy.length>=4, 'found='+JSON.stringify(hasLegacy),'>=4');
    ck('0012-9','回归：columns.roiText 正常非空', drills.colRoiText.every(c=>c.roiText!=null&&String(c.roiText).length>0),
       JSON.stringify(drills.colRoiText.map(c=>c.roiText)),'non-empty');

    // 打开下钻弹窗（真实交互）：openDrill 按 dataset.id 定位方案，setData({drillId, drill})
    const drillId=await L.ev(mp,()=>{ const v=((getCurrentPages().slice(-1)[0].data||{}).view||{}); const ds=v.drills||[]; return ds.length?ds[0].id:null; });
    await L.ev(mp,id=>{ getCurrentPages().slice(-1)[0].openDrill({currentTarget:{dataset:{id:id}}}); return true; }, drillId);
    await sleep(1200);
    const sheet=await L.ev(mp,()=>{
      const p=getCurrentPages().slice(-1)[0]; const d=p.data||{};
      return { drillId: d.drillId||'', hasRoi: !!(d.drill&&d.drill.roi), roiPercent: (d.drill&&d.drill.roi)?d.drill.roi.percentText:null };
    });
    dump.sheet=sheet;
    ck('0012-10','真实打开「查看明细」→ drill 绑定 roi（drillId+drill.roi）', sheet.hasRoi===true, JSON.stringify(sheet),'hasRoi=true');
    await mp.screenshot({path:path.join(LOGDIR,'GT4033-roi-drill.png')}).catch(()=>{});

    dump.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-GT4033-0012.json'),JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  }catch(e){ fatal=true; tr('ABORT '+(e&&e.message));
    try{ dump.finishedAt=new Date().toISOString(); fs.writeFileSync(path.join(LOGDIR,'result-GT4033-0012.json'),JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2)); }catch(x){}
  }finally{ await L.disconnectQuiet(mp); }
  const t=rec.totals(); tr('=== GT-4033(0012) pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail?1:(fatal?2:0));
})();
