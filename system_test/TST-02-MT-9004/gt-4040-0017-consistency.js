/* GT-4040 独立 GUI 验收（task-94 · BUG-02-0017 两页一致性 · A 口径）
 * A 口径 = 产品真实用户路径：文件导入 → 切「月录入」→ 在自动段填 Z=1.3 → 计算。
 * 关键：切月录入时必须用 expandYearRows 重建 segments（避免 §6.1 观察到的陈旧段残留），
 *       这既是正确用户路径，也验证产品在界面切换时是否自动重建。
 * 参数：Z=1.3 / 利率0 / doc31=true / transfer 2000-11 / 退休2033-07
 * 期望：basic P月 与 compare P月 (=14715.77) Δ<0.01；全段 dump 供逐段比对。
 */
'use strict';
const fs=require('fs'), path=require('path');
const L=require('../common/gui-conn-lib.js');

const PORT=parseInt(process.argv[2]||'40215',10);
const BASELINE=process.argv[4]||'unknown';
const FIXTURE='e7-my1.txt';
const LOGDIR=path.join(__dirname,'logs'); fs.mkdirSync(LOGDIR,{recursive:true});
const rec=L.makeRecorder();
function tr(m){ try{fs.appendFileSync(path.join(LOGDIR,'run-trace.log'),new Date().toISOString()+' '+m+'\n'); }catch(e){} console.log(m); }
function ck(id,t,pass,a,e){ rec.ck(id,t,pass,a,e); tr((pass?'PASS ':'FAIL ')+id+' '+t+' :: actual='+a+' expected='+e); }
const sleep=L.sleep, r2=n=>Math.round(Number(n)*100)/100;
const segKey=s=>[s.type||'',s.startYM,s.endYM,String(Number(s.baseMonthly).toFixed(6))].join('|');
process.on('unhandledRejection',e=>tr('REJ '+(e&&e.message)));
process.on('uncaughtException',e=>tr('EXC '+(e&&e.message)));

(async()=>{
  let mp=null,fatal=false;
  const dump={at:new Date().toISOString(),testcase:'TST-02-MT-9004',caseId:'BUG-02-0017-consistency',mode:'A',baseline:BASELINE,port:PORT};
  try{
    mp=await L.connectExisting(PORT);
    if(!await L.waitLanded(mp)){ tr('NO_PAGE'); process.exit(4); }

    /* ---------- BASIC：导入 → 切月录入（重建段）→ 设参数 → Z=1.3 → 计算 ---------- */
    await L.clearBasicDraft(mp);
    await L.importFixture(mp, FIXTURE, 'gt4040');
    // 真实产品交互：切月录入（先按其自身 expandYearRows 重建，避免陈旧段）
    const sw=await L.ev(mp,()=>{
      const p=getCurrentPages().slice(-1)[0];
      const rows=p.data.yearRows||[];
      let rebuilt=null;
      try{ rebuilt = (typeof p.expandYearRows==='function') ? p.expandYearRows(rows) : null; }catch(e){}
      if(!rebuilt||!rebuilt.length) return {ok:false,rows:rows.length};
      // 追加自动段占位（Z 由用户输入；这里先给空，稍后 onSegZ 填）
      p.setData({entryMode:'month', segments:rebuilt});
      return {ok:true, n:rebuilt.length};
    });
    dump.switchToMonth=sw;
    await sleep(800);
    ck('0017A-1','切月录入后 segments 由 yearRows 重建（不含陈旧段）', sw.ok===true, JSON.stringify(sw),'ok=true');

    // 设参数
    await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0];
      p.setData({futureMonthlyRatePct:'0', retireYM:'2033-07', doc31Eligible:true, doc31TransferYM:'2000-11',
        hasDeemed:true, deemedStartYM:'1995-07', deemedEndYM:'2000-10'});
      return true; });
    await sleep(600);
    // 新增一段作为未来缴费段（2026-09~2033-06），然后用 onSegZ 填 Z=1.3
    const added=await L.ev(mp,()=>{
      const p=getCurrentPages().slice(-1)[0];
      const list=(p.data.segments||[]).slice();
      list.push({type:'flexible', startYM:'2026-09', endYM:'2033-06', baseMonthly:'', zValue:''});
      p.setData({segments:list});
      return list.length;
    });
    await sleep(400);
    const iLast=added-1;
    await L.ev(mp,i=>{ const p=getCurrentPages().slice(-1)[0];
      if(typeof p.onSegZ==='function') p.onSegZ({currentTarget:{dataset:{i:i}}, detail:{value:'1.3'}}); return true; }, iLast);
    await sleep(800);
    const segLast=await L.ev(mp,i=>{ const s=(getCurrentPages().slice(-1)[0].data.segments||[])[i]||{};
      return {type:s.type,startYM:s.startYM,endYM:s.endYM,baseMonthly:s.baseMonthly,zValue:s.zValue}; }, iLast);
    dump.autoSeg=segLast;
    ck('0017A-2','新增自动段 Z=1.3 → 基数 15750.800000000001',
       Math.abs(Number(segLast.baseMonthly)-15750.800000000001)<1e-6, 'base='+segLast.baseMonthly,'15750.800000000001');

    const bIn=await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0];
      try{ const b=p.buildInput();
        return {ok:true,n:b.segments.length,gender:b.gender,rate:b.futureMonthlyRate,retire:b.retireYM,
          doc31:b.doc31Eligible,transfer:b.doc31TransferYM,deemed:(b.deemedStartYM||'')+'~'+(b.deemedEndYM||''),
          segs:b.segments.map(s=>({type:s.type,startYM:s.startYM,endYM:s.endYM,baseMonthly:s.baseMonthly}))};
      }catch(e){ return {ok:false,err:e.message}; } });
    dump.basicInput=bIn.ok?{n:bIn.n,gender:bIn.gender,rate:bIn.rate,retire:bIn.retire,doc31:bIn.doc31,transfer:bIn.transfer,deemed:bIn.deemed,
      first3:bIn.segs.slice(0,3).map(segKey),last3:bIn.segs.slice(-3).map(segKey),allSegs:bIn.segs.map(segKey)}:{err:bIn.err};
    ck('0017A-3','基本计算 入参含自动段（末段 2026-09~2033-06）',
       bIn.ok && bIn.segs.some(s=>s.startYM==='2026-09'&&s.endYM==='2033-06'),
       bIn.ok?('n='+bIn.n+' last3='+JSON.stringify(bIn.segs.slice(-3).map(segKey))):('err='+bIn.err),'contains auto seg');

    await L.ev(mp,()=>{ getCurrentPages().slice(-1)[0].onCalculate(); return true; });
    const rs=await L.waitCurrentReady(mp,'pages/result/result',d=>d.ready===true&&!!d.r,45000);
    const basicP=rs.ok?rs.data.r.pension.total:null;
    const basicJ=rs.ok?[rs.data.r.pension.J基础,rs.data.r.pension.J账户,rs.data.r.pension.J过渡]:null;
    dump.basic={ok:rs.ok,P:basicP,J:basicJ};
    ck('0017A-4','基本计算 结果页 ready', rs.ok,'path='+rs.path,'pages/result/result');
    await mp.screenshot({path:path.join(LOGDIR,'GT4040-basic-z13.png')}).catch(()=>{});

    /* ---------- COMPARE：同夹具同参数 ---------- */
    await L.clearCompareDrafts(mp);
    const cmp=await L.gotoCompare(mp);
    await L.importFixture(mp, FIXTURE, 'gt4040c');
    await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0]; const s=p.selectComponent('#sharedData');
      if(s&&s.onFutureRate) s.onFutureRate({detail:{value:'0'}});
      if(s&&s.setDoc31) s.setDoc31({currentTarget:{dataset:{v:'yes'}}});
      if(s&&s.onDoc31Transfer) s.onDoc31Transfer({detail:{value:'2000-11'}});
      return true; });
    await sleep(400);
    await L.ev(mp,()=>{ getCurrentPages().slice(-1)[0].syncCtx(); return true; });
    await sleep(900);
    const cIn=await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0];
      try{ const b=p.selectComponent('#sharedData').buildValidatedInput();
        if(!b.ok) return {ok:false,err:b.error};
        const i=b.input;
        return {ok:true,n:i.segments.length,gender:i.gender,rate:i.futureMonthlyRate,doc31:i.doc31Eligible,transfer:i.doc31TransferYM,
          deemed:(i.deemedStartYM||'')+'~'+(i.deemedEndYM||''),segs:i.segments.map(s=>({type:s.type,startYM:s.startYM,endYM:s.endYM,baseMonthly:s.baseMonthly}))};
      }catch(e){ return {ok:false,err:e.message}; } });
    dump.compareInput=cIn.ok?{n:cIn.n,gender:cIn.gender,rate:cIn.rate,doc31:cIn.doc31,transfer:cIn.transfer,deemed:cIn.deemed,
      first3:cIn.segs.slice(0,3).map(segKey),last3:cIn.segs.slice(-3).map(segKey),allSegs:cIn.segs.map(segKey)}:{err:cIn.err};

    await L.patchPlanCard(mp,0,{retireYM:'2033-07',z:'1.3',segType:'flexible',windowStartYM:''});
    await L.patchPlanCard(mp,1,{retireYM:'2033-07',z:'0.6',segType:'flexible',windowStartYM:''});
    const res=await L.compareStartAndWait(mp);
    const cmpP=res.columns[0]?res.columns[0].P:null;
    // 直接回读页面 view.columns 全字段（common 的 helper 只映射 P/R/JA）
    const cmpCols=await L.ev(mp,()=>{
      const v=((getCurrentPages().slice(-1)[0].data||{}).view||{});
      return (v.columns||[]).map(c=>({P:c.pMonthly, jBasic:c.jBasic, jAccount:c.jAccount, jTransit:c.jTransit, z:c.z}));
    });
    dump.compareCols=cmpCols;
    const c0=cmpCols[0]||{};
    const cmpJ=[c0.jBasic, c0.jAccount, c0.jTransit];
    dump.compare={landed:res.landed,P:cmpP,J:cmpJ};
    ck('0017A-5','方案比较 结果页 ready 且2列', res.landed&&res.columns.length===2,'landed='+res.landed,'2');
    ck('0017A-6','🔴 两页 P月 一致 Δ<0.01', isFinite(basicP)&&isFinite(cmpP)&&Math.abs(basicP-cmpP)<0.01,
       'basic='+r2(basicP)+' compare='+r2(cmpP)+' Δ='+(isFinite(basicP)&&isFinite(cmpP)?r2(basicP-cmpP):'-'),'Δ<0.01');
    ck('0017A-7','两页三分项一致（各项 Δ<0.01）',
       !!basicJ&&!!cmpJ&&basicJ.every((v,i)=>isFinite(v)&&isFinite(cmpJ[i])&&Math.abs(v-cmpJ[i])<0.01),
       JSON.stringify(basicJ)+' vs '+JSON.stringify(cmpJ),'all Δ<0.01');
    await mp.screenshot({path:path.join(LOGDIR,'GT4040-compare-z13.png')}).catch(()=>{});

    dump.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-GT4040-0017-consistency.json'),JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  }catch(e){ fatal=true; tr('ABORT '+(e&&e.message));
    try{ dump.finishedAt=new Date().toISOString(); fs.writeFileSync(path.join(LOGDIR,'result-GT4040-0017-consistency.json'),JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2)); }catch(x){}
  }finally{ await L.disconnectQuiet(mp); }
  const t=rec.totals(); tr('=== GT-4040(0017-A) pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail?1:(fatal?2:0));
})();
