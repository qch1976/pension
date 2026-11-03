/* GT-4039 独立 GUI 验收（task-94 · BUG-02-0018 补充项：warning 不阻断计算）
 * 项目主口径：保留文件值 2031-07 + 提示超出弹性范围，但该提示只是 warning，
 * **不得阻断**「开始计算/开始比较」与后续计算。本脚本逐项取证。
 * 单一入口；helper ../common/gui-conn-lib.js。40215 只 connect/disconnect。
 */
'use strict';
const fs=require('fs'), path=require('path');
const L=require('../common/gui-conn-lib.js');
const PM=require('../../calculator/planModel.js');
const D=require('../../calculator/dateUtil.js');

const PORT=parseInt(process.argv[2]||'40215',10);
const BASELINE=process.argv[4]||'unknown';
const FIXTURE='e7-wife4.txt';
const LOGDIR=path.join(__dirname,'logs'); fs.mkdirSync(LOGDIR,{recursive:true});
const rec=L.makeRecorder();
function tr(m){ try{fs.appendFileSync(path.join(LOGDIR,'run-trace.log'),new Date().toISOString()+' '+m+'\n'); }catch(e){} console.log(m); }
function ck(id,t,pass,a,e){ rec.ck(id,t,pass,a,e); tr((pass?'PASS ':'FAIL ')+id+' '+t+' :: actual='+a+' expected='+e); }
const sleep=L.sleep;
process.on('unhandledRejection',e=>tr('REJ '+(e&&e.message)));
process.on('uncaughtException',e=>tr('EXC '+(e&&e.message)));

(async()=>{
  let mp=null,fatal=false;
  const dump={at:new Date().toISOString(),testcase:'TST-02-MT-9005',caseId:'BUG-02-0018-supp',baseline:BASELINE,port:PORT};
  try{
    mp=await L.connectExisting(PORT);
    if(!await L.waitLanded(mp)){ tr('NO_PAGE'); process.exit(4); }

    /* ---- 基本计算：选女，文件值 2031-07 保留（早于女工人下限 2031-11）→ 应有提示但不阻断计算 ---- */
    await L.clearBasicDraft(mp);
    await L.importFixture(mp, FIXTURE, 'gt4039');
    // 先复位 31 号文等残留开关（跨轮次脏状态；与 0018 无关）
    await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0];
      p.setData({doc31Eligible:false, doc31TransferYM:'', enterpriseInsuredYM:'', subsidyExcludedText:''});
      return true; });
    await sleep(200);
    await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0]; p.setGender({currentTarget:{dataset:{v:'female'}}}); return true; });
    await sleep(600);
    const st=await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0]; const d=p.data;
      return {gender:d.gender, ft:d.femaleType, retireYM:d.retireYM,
              hint:(d.retireHint||d.retireHintText||''), boundWarnings:(d.boundWarnings||[]),
              errorMsg:d.errorMsg||''}; });
    dump.basicAfterFemale=st;
    ck('0018s-1','保留文件值 2031-07（未被法定值覆盖）', String(st.retireYM)==='2031-07', 'retireYM='+st.retireYM,'2031-07');

    // 该值早于女工人下限 2031-11 → 期望有提示（warning）
    const rW=PM.legalRange({gender:'female',femaleType:'worker',birthYM:'1981-07'},D);
    dump.rangeWorker=rW;
    const isEarly = D.toIndex('2031-07') < rW.minIdx;
    ck('0018s-2','2031-07 早于女工人弹性下限 2031-11（应给出提示）', isEarly,
       '2031-07 idx='+D.toIndex('2031-07')+' min='+rW.minYM+'('+rW.minIdx+')','early');

    // 🔴 核心：该提示不阻断计算 —— 直接点计算，必须能出结果页
    await L.ev(mp,()=>{ getCurrentPages().slice(-1)[0].onCalculate(); return true; });
    const rs=await L.waitCurrentReady(mp,'pages/result/result',d=>d.ready===true&&!!d.r,45000);
    dump.basicResult={ok:rs.ok, path:rs.path, P:rs.ok?rs.data.r.pension.total:null};
    ck('0018s-3','🔴 warning 不阻断：点计算仍能出结果页', rs.ok===true, 'path='+rs.path+' P='+(rs.ok?rs.data.r.pension.total:null),'pages/result/result');
    ck('0018s-4','结果 P月 为有限正值（计算真实完成）', rs.ok&&isFinite(rs.data.r.pension.total)&&rs.data.r.pension.total>0,
       rs.ok?rs.data.r.pension.total:null,'finite >0');
    await mp.screenshot({path:path.join(LOGDIR,'GT4039-0018-warning-not-block.png')}).catch(()=>{});

    /* ---- 方案比较：女干部 2031-07（早于 2036-07）→ 该卡报错阻止比较（属正确拦截，非本项） ---- */
    await L.clearCompareDrafts(mp);
    const cmp=await L.gotoCompare(mp);
    if(cmp){
      await L.importFixture(mp, FIXTURE, 'gt4039c');
      await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0]; const s=p.selectComponent('#sharedData');
        if(s&&s.setGender) s.setGender({currentTarget:{dataset:{v:'female'}}});
        if(s&&s.setFemaleType) s.setFemaleType({currentTarget:{dataset:{v:'cadre'}}}); return true; });
      await sleep(300);
      await L.ev(mp,()=>{ getCurrentPages().slice(-1)[0].syncCtx(); return true; });
      await sleep(800);
      const ctx=await L.ev(mp,()=>getCurrentPages().slice(-1)[0].data.ctx);
      dump.ctx=ctx;
      const e31=PM.planErrors({retireYM:'2031-07',z:'1.0',segType:'enterprise',windowStartYM:''},ctx,D).filter(s=>/退休/.test(s));
      ck('0018s-5','女干部 2031-07 在比较页被判早于下限（合规拦截，文案 2036-07）',
         e31.length>0 && e31.join(' ').indexOf('2036-07')>=0, JSON.stringify(e31),'contains 2036-07');
      ck('0018s-6','该文案不含 2041-07（男性值）', e31.join(' ').indexOf('2041-07')<0, JSON.stringify(e31),'NOT 2041-07');
    }

    dump.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-GT4039-0018-supp.json'),JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  }catch(e){ fatal=true; tr('ABORT '+(e&&e.message));
    try{ dump.finishedAt=new Date().toISOString(); fs.writeFileSync(path.join(LOGDIR,'result-GT4039-0018-supp.json'),JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2)); }catch(x){}
  }finally{ await L.disconnectQuiet(mp); }
  const t=rec.totals(); tr('=== GT-4039(0018-supp) pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail?1:(fatal?2:0));
})();
