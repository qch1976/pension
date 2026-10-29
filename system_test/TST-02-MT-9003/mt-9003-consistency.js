/* MT-9003 基本计算 vs 方案比较 一致性（task-86 · 严格同构注入版）
 * 口径（Manager 裁定 A）：两页同一份输入、同一引擎 → P月/三分项 应一致（Δ<0.01）。
 * 不做 7270/1454 取整比对（0011 已 cnn 作废）。
 *
 * 严格同构注入（A）：
 *   1) node 侧用产品 assemblePlanInput(sharedInput, plan) 取【完整段数组】（历史段+自动段，逐字段
 *      startYM/endYM/baseMonthly/type）；
 *   2) basic 页：先把 sharedInput 的全部标量字段（gender/femaleType/birthYM/workStartYM/retireYM/
 *      accountBalanceManual/manualBalanceYM/futureMonthlyRatePct 等）对齐，再 setData 该完整段数组
 *      （entryMode='month'），不使用 expandYearRows 猜测；
 *   3) 回读 basic 页 buildInput() 的真实入参，与 compare 侧入参逐字段 diff 打印到 trace；
 *   4) 断言 P月 与三分项 Δ<0.01。
 * 产物：logs/result-MT9003.json + 入参 diff + 截图；运行 node mt-9003-consistency.js 40215 external <baseline>
 */
'use strict';
const fs=require('fs'), path=require('path');
const L=require('../common/gui-conn-lib.js');
const Asm=require('../../calculator/planAssembler.js');
const CRM=require('../../calculator/compareResultModel.js');

const PORT=parseInt(process.argv[2]||'40215',10);
const BASELINE=process.argv[4]||'unknown';
const LOGDIR=path.join(__dirname,'logs'); fs.mkdirSync(LOGDIR,{recursive:true});
const rec=L.makeRecorder();
function tr(m){ try{fs.appendFileSync(path.join(LOGDIR,'run-trace.log'),new Date().toISOString()+' '+m+'\n');}catch(e){} console.log(m); }
function ck(id,title,pass,actual,expected){ rec.ck(id,title,pass,actual,expected); tr((pass?'PASS ':'FAIL ')+id+' '+title+' :: actual='+actual+' expected='+expected); }
const sleep=L.sleep, r2=n=>Math.round(Number(n)*100)/100;
const near=(a,b,t)=>isFinite(a)&&isFinite(b)&&Math.abs(a-b)<=(t||0.01);
process.on('unhandledRejection',e=>tr('REJ '+(e&&e.message)));
process.on('uncaughtException',e=>tr('EXC '+(e&&e.message)));

const Z='0.6', RETIRE='2033-07';
const PLAN={retireYM:RETIRE,z:Z,segType:'flexible',windowStartYM:''};

function segKey(s){ return [s.type||'',s.startYM||'',s.endYM||'',String(Number(s.baseMonthly).toFixed(6))].join('|'); }
function diffSegs(a,b){
  const A=(a||[]).map(segKey), B=(b||[]).map(segKey);
  const out={nA:A.length,nB:B.length,onlyA:[],onlyB:[],mismatch:[]};
  const setB=B.slice();
  A.forEach(k=>{ const i=setB.indexOf(k); if(i<0) out.onlyA.push(k); else setB.splice(i,1); });
  out.onlyB=setB;
  if(A.length===B.length){ for(let i=0;i<A.length;i++){ if(A[i]!==B[i]) out.mismatch.push(i+': '+A[i]+' <> '+B[i]); } }
  return out;
}

(async()=>{
  let mp=null,fatal=false;
  const dump={at:new Date().toISOString(),testcase:'TST-02-MT-9003',baseline:BASELINE,port:PORT,plan:PLAN};
  try{
    mp=await L.connectExisting(PORT);
    if(!await L.waitLanded(mp)){ tr('NO_PAGE'); process.exit(4); }

    /* ---------- node 侧：compare 的完整入参（历史段+自动段） ---------- */
    const ref=L.buildFixtureInput('My-Case.md',0.015);
    const si=ref.sharedInput;
    const asm=Asm.assemblePlanInput(si,PLAN);
    const cmpIn=asm.segments;                    // 完整段数组（历史+自动）
    dump.compareInputSegs=cmpIn.map(s=>({type:s.type,startYM:s.startYM,endYM:s.endYM,baseMonthly:s.baseMonthly}));
    tr('compare input segs='+cmpIn.length+' last='+cmpIn[cmpIn.length-1].startYM+'~'+cmpIn[cmpIn.length-1].endYM);

    /* ---------- GUI compare 路径（真实交互） ---------- */
    await L.clearCompareDrafts(mp);
    const cmp=await L.gotoCompare(mp); if(!cmp){ tr('COMPARE_NOT_READY'); process.exit(3); }
    await L.importFixture(mp,'My-Case.md','mt9003c');
    await L.patchPlanCard(mp,0,PLAN);
    await L.patchPlanCard(mp,1,{retireYM:RETIRE,z:'3.0',segType:'flexible',windowStartYM:''});
    const res=await L.compareStartAndWait(mp);
    ck('MT-1','compare 结果页 ready 且2列', res.landed&&res.columns.length===2,'landed='+res.landed+' n='+res.columns.length,'2');
    const cols=await L.ev(mp,()=>{
      const v=(getCurrentPages().slice(-1)[0].data||{}).view||{};
      return (v.columns||[]).map(c=>({P:c.pMonthly,J基础:c.jBasic,J账户:c.jAccount,J过渡:c.jTransit,z:c.z,retire:c.retireYM}));
    });
    dump.compare=cols;
    const c0=cols[0]||{};

    /* ---------- GUI basic 路径：严格同构注入 ---------- */
    await L.clearBasicDraft(mp);
    const f=await L.importFixture(mp,'My-Case.md','mt9003b');
    ck('MT-2','基本页真实文件导入成功', !!(f&&String(f).indexOf('My-Case.md')>=0), f,'My-Case.md');
    // 标量字段全部对齐 sharedInput，再覆盖为完整同构段数组（不用 expandYearRows 猜）
    const inject=await L.ev(mp,(args)=>{
      const p=getCurrentPages().slice(-1)[0];
      const si=args.si, segs=args.segs;
      p.setData({
        gender: si.gender, femaleType: si.femaleType || 'worker',
        birthYM: si.birthYM, workStartYM: si.workStartYM,
        retireYM: args.retireYM,
        accountBalanceManual: String(si.accountBalanceManual == null ? '' : si.accountBalanceManual),
        manualBalanceYM: si.accountBalanceManualYM || '',
        futureMonthlyRatePct: String((si.futureMonthlyRate || 0) * 100),
        hasDeemed: false, deemedStartYM: '', deemedEndYM: '',
        // 关键1：导入可能携带 31 号文残留字段，必须显式复位，否则 buildInput 走 31 号文分支抛错
        doc31Eligible: false, doc31TransferYM: '', enterpriseInsuredYM: args.enterpriseInsuredYM || '', subsidyExcludedText: '',
        // 关键2：视同缴费段必须对齐 assemblePlanInput 的真实值（直接影响 J过渡/P月）
        hasDeemed: !!args.deemedStartYM, deemedStartYM: args.deemedStartYM || '', deemedEndYM: args.deemedEndYM || '',
        entryMode: 'month',
        segments: segs.map(s=>({type:s.type,startYM:s.startYM,endYM:s.endYM,baseMonthly:String(s.baseMonthly)})),
        yearRows: []
      });
      return {n: segs.length};
    }, {si:si, segs:dump.compareInputSegs, retireYM:RETIRE,
        deemedStartYM: asm.deemedStartYM, deemedEndYM: asm.deemedEndYM, enterpriseInsuredYM: asm.enterpriseInsuredYM});
    tr('injected segs='+inject.n);
    await sleep(900);
    // 回读 basic 页真实入参
    const basicIn=await L.ev(mp,()=>{
      const p=getCurrentPages().slice(-1)[0];
      let built=null,err='';
      try{ built=p.buildInput(); }catch(e){ err=e.message; }
      return { segs: built&&built.segments?built.segments.map(s=>({type:s.type,startYM:s.startYM,endYM:s.endYM,baseMonthly:s.baseMonthly})):[],
               retireYM: built?built.retireYM:null, rate: built?built.futureMonthlyRate:null, err: err };
    });
    dump.basicInput={count:basicIn.segs.length,retireYM:basicIn.retireYM,rate:basicIn.rate,err:basicIn.err};
    // 两页入参 diff 打印
    const df=diffSegs(dump.compareInputSegs, basicIn.segs);
    dump.inputDiff=df;
    tr('INPUT-DIFF nCompare='+df.nA+' nBasic='+df.nB+' onlyCompare='+df.onlyA.length+' onlyBasic='+df.onlyB.length+' mismatch='+df.mismatch.length);
    if(df.onlyA.length) tr('  onlyCompare: '+JSON.stringify(df.onlyA.slice(0,3)));
    if(df.onlyB.length) tr('  onlyBasic:   '+JSON.stringify(df.onlyB.slice(0,3)));
    if(df.mismatch.length) tr('  mismatch:    '+JSON.stringify(df.mismatch.slice(0,3)));
    ck('MT-3','两页入参逐字段同构（段数组完全一致）',
       df.nA===df.nB && df.onlyA.length===0 && df.onlyB.length===0 && df.mismatch.length===0,
       'nA='+df.nA+' nB='+df.nB+' diffs='+(df.onlyA.length+df.onlyB.length+df.mismatch.length),'0 diffs');

    await L.ev(mp,()=>{ getCurrentPages().slice(-1)[0].onCalculate(); return true; });
    const rs=await L.waitCurrentReady(mp,'pages/result/result',d=>d.ready===true&&!!d.r,45000);
    ck('MT-4','基本页结果页 ready', rs.ok, 'path='+rs.path,'pages/result/result');
    const basic=rs.ok?{P:rs.data.r.pension.total,J基础:rs.data.r.pension.J基础,J账户:rs.data.r.pension.J账户,J过渡:rs.data.r.pension.J过渡}:null;
    dump.basic=basic;

    ck('MT-5','基本页 P月 = compare P月（同源同口径 Δ<0.01）', !!basic&&near(basic.P,c0.P,0.01),
       'basic='+(basic&&r2(basic.P))+' compare='+r2(c0.P)+' Δ='+(basic?r2(basic.P-c0.P):'-'),'Δ<0.01');
    ck('MT-6','三分项一致（J基础/J账户/J过渡）',
       !!basic&&near(basic.J基础,c0.J基础)&&near(basic.J账户,c0.J账户)&&near(basic.J过渡,c0.J过渡),
       basic?[r2(basic.J基础),r2(basic.J账户),r2(basic.J过渡)].join('/'):'-',
       [r2(c0.J基础),r2(c0.J账户),r2(c0.J过渡)].join('/'));

    await mp.screenshot({path:path.join(LOGDIR,'MT9003-consistency.png')}).catch(()=>{});
    dump.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-MT9003.json'),JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  }catch(e){ fatal=true; tr('ABORT '+(e&&e.message));
    try{ dump.finishedAt=new Date().toISOString(); fs.writeFileSync(path.join(LOGDIR,'result-MT9003.json'),JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2)); }catch(x){}
  }finally{ await L.disconnectQuiet(mp); }
  const t=rec.totals(); tr('=== MT-9003 pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail?1:(fatal?2:0));
})();
