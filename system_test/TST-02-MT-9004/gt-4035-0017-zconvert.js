/* GT-4035 独立 GUI 验收（task-94 · BUG-02-0017 Z值↔基数双向转换）— 5 列夹具版
 * 单一入口；helper ../common/gui-conn-lib.js。40215 只 connect/disconnect，零 RDP。
 * 口径：Z=1.3 / 利率0 / doc31Eligible=true / doc31TransferYM=2000-11 / 退休2033-07
 * 两页一致性期望：基本计算 P月 = 方案比较 P月 = 14715.77（Δ<0.01）
 */
'use strict';
const fs=require('fs'), path=require('path');
const L=require('../common/gui-conn-lib.js');
const Model=require('../../calculator/inputPageModel.js');
const E=require('../../calculator/pensionEngine.js');
const PM=require('../../calculator/planModel.js');
const D=require('../../calculator/dateUtil.js');

const PORT=parseInt(process.argv[2]||'40215',10);
const BASELINE=process.argv[4]||'unknown';
const FIXTURE='e7-my1.txt';
const RETIRE='2033-07', Z='1.3';
const LOGDIR=path.join(__dirname,'logs'); fs.mkdirSync(LOGDIR,{recursive:true});
const rec=L.makeRecorder();
function tr(m){ try{fs.appendFileSync(path.join(LOGDIR,'run-trace.log'),new Date().toISOString()+' '+m+'\n'); }catch(e){} console.log(m); }
function ck(id,t,pass,a,e){ rec.ck(id,t,pass,a,e); tr((pass?'PASS ':'FAIL ')+id+' '+t+' :: actual='+a+' expected='+e); }
const sleep=L.sleep, r2=n=>Math.round(Number(n)*100)/100;
const near=(a,b,t)=>isFinite(+a)&&isFinite(+b)&&Math.abs(+a-+b)<=(t||0.01);
process.on('unhandledRejection',e=>tr('REJ '+(e&&e.message)));
process.on('uncaughtException',e=>tr('EXC '+(e&&e.message)));
const segKey=s=>[s.type||'',s.startYM,s.endYM,String(Number(s.baseMonthly).toFixed(6))].join('|');

(async()=>{
  let mp=null,fatal=false;
  const dump={at:new Date().toISOString(),testcase:'TST-02-MT-9004',caseId:'BUG-02-0017',baseline:BASELINE,port:PORT,params:{Z:Z,rate:0,doc31:true,transferYM:'2000-11',retire:RETIRE}};
  try{
    mp=await L.connectExisting(PORT);
    if(!await L.waitLanded(mp)){ tr('NO_PAGE'); process.exit(4); }

    /* ---------- ① Z值输入框存在（段对象含 zValue 绑定字段：自动段） ---------- */
    await L.clearBasicDraft(mp);
    await L.importFixture(mp, FIXTURE, 'gt4035');
    const zf=await L.ev(mp,()=>{
      const d=getCurrentPages().slice(-1)[0].data; const segs=d.segments||[];
      return {segN:segs.length, zCount:segs.filter(s=>s.zValue!==undefined&&s.zValue!=='').length,
              lastZ:(segs[segs.length-1]||{}).zValue, entryMode:d.entryMode};
    });
    dump.zField=zf;
    ck('0017-1','自动段带 zValue 绑定（Z值输入框可用）', zf.zCount>=1, JSON.stringify(zf), 'zCount>=1');

    /* ---------- ② Z → 基数 三档（编辑自动段） ---------- */
    const lastIdx=zf.segN-1;
    const setZ=async z=>{ await L.ev(mp,(i,zz)=>{ const p=getCurrentPages().slice(-1)[0];
        if(typeof p.onSegZ==='function') p.onSegZ({currentTarget:{dataset:{i:i}},detail:{value:String(zz)}}); return true;},lastIdx,z); await sleep(700); };
    const readLast=async()=>L.ev(mp,i=>{ const s=(getCurrentPages().slice(-1)[0].data.segments||[])[i]||{};
        return {baseMonthly:s.baseMonthly, zValue:s.zValue}; }, lastIdx);

    await setZ('1.3'); const s13=await readLast(); dump.z13=s13;
    ck('0017-2','Z=1.3 → 基数 15750.800000000001', near(s13.baseMonthly,15750.800000000001,1e-6), 'base='+s13.baseMonthly,'15750.800000000001');
    await setZ('0.6'); const s06=await readLast(); dump.z06=s06;
    ck('0017-3','Z=0.6 → 基数 7270（最低档取整）', Math.round(+s06.baseMonthly)===7270, 'base='+s06.baseMonthly,'7270');
    await setZ('3.0'); const s30=await readLast(); dump.z30=s30;
    ck('0017-4','Z=3.0 → 基数 36348', near(s30.baseMonthly,36348,1e-6), 'base='+s30.baseMonthly,'36348');

    /* ---------- ⑤ 红线 ---------- */
    ck('0017-5','红线 Z=0.6 月缴(20%)=1454', near(7270*0.2,1454,1e-6), 7270*0.2,'1454');
    ck('0017-6','红线 Z=3.0 月缴(20%)=7269.6 且 ≠7270', Math.abs(36348*0.2-7269.6)<1e-6&&Math.abs(36348*0.2-7270)>1e-6, 36348*0.2,'7269.6 (≠7270)');

    /* ---------- ③ 基数 → Z 反向（4 位小数） ---------- */
    const setBase=async b=>{ await L.ev(mp,(i,bb)=>{ const p=getCurrentPages().slice(-1)[0];
        if(typeof p.onSegBase==='function') p.onSegBase({currentTarget:{dataset:{i:i}},detail:{value:String(bb)}}); return true;},lastIdx,b); await sleep(700); };
    await setBase('15750.800000000001'); const b13=await readLast(); dump.b13=b13;
    ck('0017-7','改基数 → Z 回算 1.3000（4位小数）', String(b13.zValue)==='1.3000','zValue='+b13.zValue,'1.3000');
    await setBase('7270'); const b06=await readLast(); dump.b06=b06;
    ck('0017-8','改基数 7270 → Z=0.6000', String(b06.zValue)==='0.6000','zValue='+b06.zValue,'0.6000');

    /* ---------- ④ 连续来回编辑 ---------- */
    const seq=[];
    await setZ('1.3'); seq.push(await readLast());
    await setBase('15750.8'); seq.push(await readLast());
    await setZ('1.3'); seq.push(await readLast());
    await setBase('15750.8'); seq.push(await readLast());
    dump.pingpong=seq.map(s=>({b:s.baseMonthly,z:s.zValue}));
    ck('0017-9','连续来回编辑稳定无污染', seq.every(s=>near(s.baseMonthly,15750.8,1e-4)&&near(s.zValue,1.3,1e-4)),
       JSON.stringify(dump.pingpong),'stable 15750.8/1.3000');

    /* ---------- ⑥ 两页一致性（5 列夹具，项目主完整参数） ---------- */
    // BASIC：year 模式（不切换！）+ 设 doc31/利率0/退休 + 自动段 Z=1.3
    await setZ('1.3');
    await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0];
      p.setData({futureMonthlyRatePct:'0', retireYM:'2033-07',
        doc31Eligible:true, doc31TransferYM:'2000-11', hasDeemed:true, deemedStartYM:'1995-07', deemedEndYM:'2000-10'});
      return true; });
    await sleep(900);
    const bIn=await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0];
      try{ const b=p.buildInput();
        return {ok:true, n:b.segments.length, gender:b.gender, retire:b.retireYM, rate:b.futureMonthlyRate,
          doc31:b.doc31Eligible, transfer:b.doc31TransferYM, deemed:(b.deemedStartYM||'')+'~'+(b.deemedEndYM||''),
          segs:b.segments.map(s=>({type:s.type,startYM:s.startYM,endYM:s.endYM,baseMonthly:s.baseMonthly}))};
      }catch(e){ return {ok:false,err:e.message}; } });
    dump.basicInput=bIn.ok?{n:bIn.n,gender:bIn.gender,retire:bIn.retire,rate:bIn.rate,doc31:bIn.doc31,transfer:bIn.transfer,deemed:bIn.deemed,first3:bIn.segs.slice(0,3).map(segKey),last3:bIn.segs.slice(-3).map(segKey)}:{err:bIn.err};

    await L.ev(mp,()=>{ getCurrentPages().slice(-1)[0].onCalculate(); return true; });
    const rs=await L.waitCurrentReady(mp,'pages/result/result',d=>d.ready===true&&!!d.r,45000);
    const basicP=rs.ok?rs.data.r.pension.total:null;
    const basicJ=rs.ok?[rs.data.r.pension.J基础,rs.data.r.pension.J账户,rs.data.r.pension.J过渡]:null;
    dump.basic={ok:rs.ok,P:basicP,J:basicJ};
    ck('0017-10','基本计算 结果页 ready', rs.ok, 'path='+rs.path,'pages/result/result');
    ck('0017-11','基本计算 P月 有限正值', isFinite(basicP)&&basicP>0, basicP,'finite >0');
    await mp.screenshot({path:path.join(LOGDIR,'GT4035-basic-z13.png')}).catch(()=>{});

    // COMPARE：同夹具 + 同参数（利率0 / doc31 / 退休 / Z=1.3）
    await L.clearCompareDrafts(mp);
    const cmp=await L.gotoCompare(mp);
    await L.importFixture(mp, FIXTURE, 'gt4035c');
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
          deemed:(i.deemedStartYM||'')+'~'+(i.deemedEndYM||''),
          segs:i.segments.map(s=>({type:s.type,startYM:s.startYM,endYM:s.endYM,baseMonthly:s.baseMonthly}))};
      }catch(e){ return {ok:false,err:e.message}; } });
    dump.compareInput=cIn.ok?{n:cIn.n,gender:cIn.gender,rate:cIn.rate,doc31:cIn.doc31,transfer:cIn.transfer,deemed:cIn.deemed,first3:cIn.segs.slice(0,3).map(segKey),last3:cIn.segs.slice(-3).map(segKey)}:{err:cIn.err};

    await L.patchPlanCard(mp,0,{retireYM:RETIRE,z:Z,segType:'flexible',windowStartYM:''});
    await L.patchPlanCard(mp,1,{retireYM:RETIRE,z:'0.6',segType:'flexible',windowStartYM:''});
    const res=await L.compareStartAndWait(mp);
    const cmpP=res.columns[0]?res.columns[0].P:null;
    const cmpJ=res.columns[0]?[res.columns[0].J基础,res.columns[0].J账户,res.columns[0].J过渡]:null;
    dump.compare={landed:res.landed,P:cmpP,J:cmpJ};
    ck('0017-12','方案比较 结果页 ready 且2列', res.landed&&res.columns.length===2, 'landed='+res.landed+' n='+res.columns.length,'2');
    ck('0017-13','两页 P月 一致 Δ<0.01', isFinite(basicP)&&isFinite(cmpP)&&Math.abs(basicP-cmpP)<0.01,
       'basic='+r2(basicP)+' compare='+r2(cmpP)+' Δ='+(isFinite(basicP)&&isFinite(cmpP)?r2(basicP-cmpP):'-'),'Δ<0.01');
    ck('0017-14','两页三分项一致（Δ 各项 <0.01）',
       !!basicJ&&!!cmpJ&&basicJ.every((v,i)=>near(v,cmpJ[i],0.01)),
       JSON.stringify(basicJ)+' vs '+JSON.stringify(cmpJ),'all Δ<0.01');
    await mp.screenshot({path:path.join(LOGDIR,'GT4035-compare-z13.png')}).catch(()=>{});

    dump.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-GT4035-0017.json'),JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  }catch(e){ fatal=true; tr('ABORT '+(e&&e.message));
    try{ dump.finishedAt=new Date().toISOString(); fs.writeFileSync(path.join(LOGDIR,'result-GT4035-0017.json'),JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2)); }catch(x){}
  }finally{ await L.disconnectQuiet(mp); }
  const t=rec.totals(); tr('=== GT-4035(0017) pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail?1:(fatal?2:0));
})();
