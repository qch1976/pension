/* GT-4013 独立 GUI 验收（task-79 重建 · wife1）
 * 单一入口；helper ../common/gui-conn-lib.js + st-case-lib.js。external：40215 只 connect/disconnect，零 RDP。
 *
 * case-specific：wife1 历史【手工】流程 fresh 独立用例 GUI 零回归（NFR-004 测试侧唯一行；非文件导入）。
 * 用页面手工 month 表单装载妻子真实缴费 23 段（数据取自 MyWife 用例，走 index.setData 手工表单而非 onChooseCaseFile），
 * 性别 female/worker、退休 2034-11 → 真实 onCalculate → result 页。
 * 期望（tester 独立取值/重算，不引用 README/旧 summary）：
 *   结果页 ready、P月/三分项有限、GUI 与 node Engine 同输入重算一致（<0.01）。
 * 产物：logs/result-GT4013.json + GT4013.png；运行 node gt-4013-wife1.js 40215 external 2a61e71
 */
'use strict';
const fs=require('fs'), path=require('path');
const L=require('../common/gui-conn-lib.js');
const st=require('../common/st-case-lib.js');
const Engine=require('../../calculator/pensionEngine.js');

const PORT=parseInt(process.argv[2]||'40215',10);
const BASELINE=process.argv[4]||'unknown';
const LOGDIR=path.join(__dirname,'logs'); fs.mkdirSync(LOGDIR,{recursive:true});
const rec=L.makeRecorder();
function tr(m){ try{fs.appendFileSync(path.join(LOGDIR,'run-trace.log'),new Date().toISOString()+' '+m+'\n');}catch(e){} console.log(m); }
function ck(id,title,pass,actual,expected){ rec.ck(id,title,pass,actual,expected); tr((pass?'PASS ':'FAIL ')+id+' '+title+' :: actual='+actual+' expected='+expected); }
const sleep=L.sleep, round2=n=>Math.round(Number(n)*100)/100;
const close2=(a,b)=>isFinite(a)&&isFinite(b)&&Math.abs(a-b)<0.01;
process.on('unhandledRejection',e=>tr('REJ '+(e&&e.message)));
process.on('uncaughtException',e=>tr('EXC '+(e&&e.message)));

(async()=>{
  let mp=null, fatal=false;
  const dump={at:new Date().toISOString(),testcase:'TST-02-GT-4013',tag:'wife1',baseline:BASELINE,port:PORT,gui:null,node:null};
  try{
    mp=await L.connectExisting(PORT);
    const landed0=await L.waitLanded(mp); if(!landed0){tr('NO_PAGE');process.exit(4);}
    await L.clearBasicDraft(mp); // reLaunch index + 清 pension_input_v1

    // node 侧取妻子真实缴费段（引擎入参形态），手工装载到页面 month 表单
    const fx=st.parseFixture('MyWife-Case.md');
    const built=st.engineInputFromParsed(fx.parsed);
    const segList=built.segments.map(s=>({type:s.type,startYM:s.startYM,endYM:s.endYM,baseMonthly:String(s.baseMonthly)}));
    // 页面手工表单（female/worker 妻子，法定退休 2034-11）
    const form={ gender:'female', femaleType:'worker', birthYM:'1981-07', workStartYM:'2003-09', retireYM:'2034-11',
      hasDeemed:false, deemedStartYM:'', deemedEndYM:'', entryMode:'month', segments:segList, yearRows:[],
      accountBalanceManual:'481459', manualBalanceYM:'2025-12', futureMonthlyRatePct:'1.5',
      doc31Eligible:false, doc31TransferYM:'', enterpriseInsuredYM:'', subsidyExcludedText:'',
      cPingOverride:'', customCYearText:'', errorMsg:'' };
    await L.ev(mp,fd=>{ getCurrentPages().slice(-1)[0].setData(fd); return true; },form);
    await sleep(600);

    // 真实 onCalculate → result 页
    await L.ev(mp,()=>{ getCurrentPages().slice(-1)[0].onCalculate(); return true; });
    const rs=await L.waitCurrentReady(mp,'pages/result/result',d=>d.ready===true&&!!d.r,45000);
    ck('4013-1','手工妻子结果页 ready（非白屏/报错）',rs.ok,'path='+rs.path,'pages/result/result');
    let guiP=null;
    if(rs.ok) guiP={ total:rs.data.r.pension.total, J基础:rs.data.r.pension.J基础, J账户:rs.data.r.pension.J账户, J过渡:rs.data.r.pension.J过渡 };
    dump.gui=guiP;
    ck('4013-2','GUI P月有限正值',!!guiP&&isFinite(guiP.total)&&guiP.total>0,guiP&&guiP.total,'finite >0');
    ck('4013-3','GUI 三分项有限非负',!!guiP&&[guiP.J基础,guiP.J账户,guiP.J过渡].every(v=>isFinite(v)&&v>=0),
       guiP&&[round2(guiP.J基础),round2(guiP.J账户),round2(guiP.J过渡)].join('/'),'finite >=0');

    // node Engine 同输入独立重算（female/worker/2034-11 + 同段）
    const inp=st.engineInputFromParsed(fx.parsed);
    inp.gender='female'; inp.femaleType='worker'; inp.retireYM='2034-11';
    const nr=Engine.calculate(inp);
    const nodeP={total:nr.pension.total,J基础:nr.pension.J基础,J账户:nr.pension.J账户,J过渡:nr.pension.J过渡};
    dump.node=nodeP;
    ck('4013-4','node 独立重算 P月有限正值',isFinite(nodeP.total)&&nodeP.total>0,nodeP.total,'finite >0');
    ck('4013-5','GUI=node P月',!!guiP&&close2(guiP.total,nodeP.total),guiP&&round2(guiP.total),round2(nodeP.total));
    ck('4013-6','GUI=node 三分项',
       !!guiP&&close2(guiP.J基础,nodeP.J基础)&&close2(guiP.J账户,nodeP.J账户)&&close2(guiP.J过渡,nodeP.J过渡),
       guiP&&[round2(guiP.J基础),round2(guiP.J账户),round2(guiP.J过渡)].join('/'),
       [round2(nodeP.J基础),round2(nodeP.J账户),round2(nodeP.J过渡)].join('/'));

    await mp.screenshot({path:path.join(LOGDIR,'GT4013.png')}).catch(()=>{});
    dump.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-GT4013.json'),JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  } catch(e){ fatal=true; tr('ABORT '+(e&&e.message));
    try{ dump.finishedAt=new Date().toISOString(); fs.writeFileSync(path.join(LOGDIR,'result-GT4013.json'),JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2)); }catch(x){}
  } finally{ await L.disconnectQuiet(mp); }
  const t=rec.totals(); tr('=== GT-4013(wife1) pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail?1:(fatal?2:0));
})();
