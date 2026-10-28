/* GT-4015 独立 GUI 验收（task-79 重建 · wife6）
 * 单一入口；helper ../common/gui-conn-lib.js + st-case-lib.js。external：40215 connect/disconnect，零 RDP。
 *
 * case-specific：wife6 导出/分享后沙箱文件仍在（OUT-003：分享结果不影响已落盘文件）。
 * 手工妻子结果 → 导出1落盘 f1 → 触发分享动作（成功/取消/不可用均不影响）→ 再导出2落盘 f2。
 * 期望（tester 独立取值，不引用 README 54项/旧 summary）：
 *   f1 落盘；分享后 f1 仍在；f2 落盘；f1/f2 并存（不删旧）；f1 内容仍含独立 P月；node 报告交叉含同值。
 * 产物：logs/result-GT4015.json + GT4015.png；运行 node gt-4015-wife6.js 40215 external 2a61e71
 */
'use strict';
const fs=require('fs'),path=require('path');
const L=require('../common/gui-conn-lib.js');
const st=require('../common/st-case-lib.js');
const Engine=require('../../calculator/pensionEngine.js');
const reportExport=require('../../services/reportExport.js');

const PORT=parseInt(process.argv[2]||'40215',10);
const BASELINE=process.argv[4]||'unknown';
const LOGDIR=path.join(__dirname,'logs');fs.mkdirSync(LOGDIR,{recursive:true});
const rec=L.makeRecorder();
function tr(m){try{fs.appendFileSync(path.join(LOGDIR,'run-trace.log'),new Date().toISOString()+' '+m+'\n');}catch(e){}console.log(m);}
function ck(id,title,pass,actual,expected){rec.ck(id,title,pass,actual,expected);tr((pass?'PASS ':'FAIL ')+id+' '+title+' :: actual='+actual+' expected='+expected);}
const sleep=L.sleep;
const isBasic=f=>/^basic-\d{8}-\d{6}\.txt$/.test(f);
process.on('unhandledRejection',e=>tr('REJ '+(e&&e.message)));
process.on('uncaughtException',e=>tr('EXC '+(e&&e.message)));

(async()=>{
  let mp=null,fatal=false;
  const dump={at:new Date().toISOString(),testcase:'TST-02-GT-4015',tag:'wife6',baseline:BASELINE,port:PORT,steps:{}};
  // 等一个新 basic 文件（相对 before）
  async function waitNew(before,ms){
    const t=Date.now();
    while(Date.now()-t<ms){ const cur=await L.listOutputFiles(mp); const add=cur.filter(f=>before.indexOf(f)<0&&isBasic(f)); if(add.length)return add; await sleep(1000); }
    return [];
  }
  try{
    mp=await L.connectExisting(PORT);
    const landed0=await L.waitLanded(mp);if(!landed0){tr('NO_PAGE');process.exit(4);}
    await L.clearBasicDraft(mp);
    // 手工妻子结果
    const fx=st.parseFixture('MyWife-Case.md');
    const built=st.engineInputFromParsed(fx.parsed);
    const segList=built.segments.map(s=>({type:s.type,startYM:s.startYM,endYM:s.endYM,baseMonthly:String(s.baseMonthly)}));
    const form={gender:'female',femaleType:'worker',birthYM:'1981-07',workStartYM:'2003-09',retireYM:'2034-11',
      hasDeemed:false,deemedStartYM:'',deemedEndYM:'',entryMode:'month',segments:segList,yearRows:[],
      accountBalanceManual:'481459',manualBalanceYM:'2025-12',futureMonthlyRatePct:'1.5',
      doc31Eligible:false,doc31TransferYM:'',enterpriseInsuredYM:'',subsidyExcludedText:'',cPingOverride:'',customCYearText:'',errorMsg:''};
    await L.ev(mp,fd=>{getCurrentPages().slice(-1)[0].setData(fd);return true;},form);
    await sleep(500);
    await L.ev(mp,()=>{getCurrentPages().slice(-1)[0].onCalculate();return true;});
    const rs=await L.waitCurrentReady(mp,'pages/result/result',d=>d.ready===true&&!!d.r,45000);
    ck('4015-0','手工妻子结果页 ready',rs.ok,'path='+rs.path,'pages/result/result');
    const Ptotal=rs.data.r.pension.total; dump.pension={total:Ptotal};

    // 动作1：导出1（onSaveReportToDisk）
    const b1=await L.listOutputFiles(mp);
    await L.ev(mp,()=>{getCurrentPages().slice(-1)[0].onSaveReportToDisk();return true;});
    const a1=await waitNew(b1,15000);
    const f1=a1[0]||''; dump.steps.export1=f1;
    ck('4015-1','导出1 沙箱落盘 basic 文件',!!f1,'f1='+f1,'basic-*.txt');

    // 动作2：模拟分享成功（mock shareFileMessage:ok，不真实外发/不挂起；OUT-003 核心是文件不受分享影响）
    await mp.mockWxMethod('shareFileMessage', { errMsg: 'shareFileMessage:ok' }).catch(()=>{});
    await L.ev(mp,()=>{getCurrentPages().slice(-1)[0].onShareReport();return true;});
    await sleep(4000); // 导出+分享链路一次（mock 成功）
    await mp.restoreWxMethod('shareFileMessage').catch(()=>{});
    const afterShare=await L.listOutputFiles(mp);
    dump.steps.f1AfterShare=afterShare.indexOf(f1)>=0;
    ck('4015-2','分享动作后 f1 仍在 outputs（OUT-003）',afterShare.indexOf(f1)>=0,'present='+(afterShare.indexOf(f1)>=0),'present');

    // 动作3：再导出2
    const b2=await L.listOutputFiles(mp);
    await L.ev(mp,()=>{getCurrentPages().slice(-1)[0].onSaveReportToDisk();return true;});
    const a2=await waitNew(b2,15000);
    const f2=a2[0]||''; dump.steps.export2=f2;
    const after2=await L.listOutputFiles(mp);
    ck('4015-3','导出2 落盘 basic 文件',!!f2,'f2='+f2,'basic-*.txt');
    ck('4015-4','f1/f2 并存（多次导出不删旧文件）',after2.indexOf(f1)>=0&&after2.indexOf(f2)>=0,
       'f1='+(after2.indexOf(f1)>=0)+' f2='+(after2.indexOf(f2)>=0),'both present');

    // f1 内容仍完整含 P月（未被后续动作损坏/覆盖）
    const c1=await L.readOutputFile(mp,f1);
    dump.steps.f1Bytes=Buffer.byteLength(c1);
    ck('4015-5','f1 内容仍含独立 P月='+Ptotal+' 且非空',c1.indexOf(String(Ptotal))>=0&&Buffer.byteLength(c1)>200,
       'bytes='+Buffer.byteLength(c1)+' containsP='+(c1.indexOf(String(Ptotal))>=0),'yes');

    // node 独立报告交叉
    const inp=st.engineInputFromParsed(fx.parsed);
    inp.gender='female';inp.femaleType='worker';inp.retireYM='2034-11';
    const nr=Engine.calculate(inp);
    const rep=reportExport.buildBasicReport(nr,{generatedAt:'2026-10-28 00:00:00'});
    ck('4015-6','node buildBasicReport 含同 P月（独立交叉）',rep.indexOf(String(Ptotal))>=0,'nodeContains '+Ptotal,'yes');

    await mp.screenshot({path:path.join(LOGDIR,'GT4015.png')}).catch(()=>{});
    dump.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-GT4015.json'),JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  }catch(e){fatal=true;tr('ABORT '+(e&&e.message));
    try{dump.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(LOGDIR,'result-GT4015.json'),JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2));}catch(x){}
  }finally{await L.disconnectQuiet(mp);}
  const t=rec.totals();tr('=== GT-4015(wife6) pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail?1:(fatal?2:0));
})();
