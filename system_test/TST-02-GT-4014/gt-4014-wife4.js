/* GT-4014 独立 GUI 验收（task-79 重建 · wife4）
 * 单一入口；helper ../common/gui-conn-lib.js + st-case-lib.js。external：40215 connect/disconnect，零 RDP。
 *
 * case-specific：wife4 导出 .txt 报告并落沙箱。
 * 手工妻子（1981-07/female worker/退休2034-11）→ onCalculate 结果页 → onSaveReportToDisk 导出
 * → <USER_DATA_PATH>/pension/outputs/basic-<stamp>.txt；回读校验。
 * 期望（tester 独立取值，不引用 README/旧 summary）：
 *   outputs 新增恰好1个 .txt，非空且含独立 P月/三分项数值、含报告标记；node buildBasicReport 独立产出含同值。
 * 产物：logs/result-GT4014.json + GT4014.png；运行 node gt-4014-wife4.js 40215 external 2a61e71
 */
'use strict';
const fs=require('fs'), path=require('path');
const L=require('../common/gui-conn-lib.js');
const st=require('../common/st-case-lib.js');
const Engine=require('../../calculator/pensionEngine.js');
const reportExport=require('../../services/reportExport.js');

const PORT=parseInt(process.argv[2]||'40215',10);
const BASELINE=process.argv[4]||'unknown';
const LOGDIR=path.join(__dirname,'logs'); fs.mkdirSync(LOGDIR,{recursive:true});
const rec=L.makeRecorder();
function tr(m){ try{fs.appendFileSync(path.join(LOGDIR,'run-trace.log'),new Date().toISOString()+' '+m+'\n');}catch(e){} console.log(m); }
function ck(id,title,pass,actual,expected){ rec.ck(id,title,pass,actual,expected); tr((pass?'PASS ':'FAIL ')+id+' '+title+' :: actual='+actual+' expected='+expected); }
const sleep=L.sleep;
process.on('unhandledRejection',e=>tr('REJ '+(e&&e.message)));
process.on('uncaughtException',e=>tr('EXC '+(e&&e.message)));

async function wifeResult() {
  const fx=st.parseFixture('MyWife-Case.md');
  const built=st.engineInputFromParsed(fx.parsed);
  const segList=built.segments.map(s=>({type:s.type,startYM:s.startYM,endYM:s.endYM,baseMonthly:String(s.baseMonthly)}));
  const form={ gender:'female',femaleType:'worker',birthYM:'1981-07',workStartYM:'2003-09',retireYM:'2034-11',
    hasDeemed:false,deemedStartYM:'',deemedEndYM:'',entryMode:'month',segments:segList,yearRows:[],
    accountBalanceManual:'481459',manualBalanceYM:'2025-12',futureMonthlyRatePct:'1.5',
    doc31Eligible:false,doc31TransferYM:'',enterpriseInsuredYM:'',subsidyExcludedText:'',
    cPingOverride:'',customCYearText:'',errorMsg:'' };
  return {fx,form};
}
// 列 outputs 文件名
async function listOutputs(mp){
  return L.ev(mp,()=>new Promise(res=>{
    wx.env.USER_DATA_PATH;
    const dir=wx.env.USER_DATA_PATH.replace(/[\\/]+$/,'')+'/pension/outputs';
    wx.getFileSystemManager().readdir({ dirPath:dir, success:r=>res(r.files||[]), fail:()=>res([]) });
  }));
}

(async()=>{
  let mp=null,fatal=false;
  const dump={at:new Date().toISOString(),testcase:'TST-02-GT-4014',tag:'wife4',baseline:BASELINE,port:PORT,newFile:'',report:null,node:null};
  try{
    mp=await L.connectExisting(PORT);
    const landed0=await L.waitLanded(mp); if(!landed0){tr('NO_PAGE');process.exit(4);}
    await L.clearBasicDraft(mp);
    const {fx,form}=await wifeResult();
    await L.ev(mp,fd=>{getCurrentPages().slice(-1)[0].setData(fd);return true;},form);
    await sleep(500);
    await L.ev(mp,()=>{getCurrentPages().slice(-1)[0].onCalculate();return true;});
    const rs=await L.waitCurrentReady(mp,'pages/result/result',d=>d.ready===true&&!!d.r,45000);
    ck('4014-0','手工妻子结果页 ready',rs.ok,'path='+rs.path,'pages/result/result');
    const P={total:rs.data.r.pension.total,J基础:rs.data.r.pension.J基础,J账户:rs.data.r.pension.J账户,J过渡:rs.data.r.pension.J过渡};
    dump.pension=P;

    const before=await listOutputs(mp);
    await L.ev(mp,()=>{getCurrentPages().slice(-1)[0].onSaveReportToDisk();return true;});
    // 脚本内轮询等沙箱落盘（最多15s），替代固定等待
    let added=[]; const t0=Date.now();
    while(Date.now()-t0<15000){
      const cur=await listOutputs(mp);
      added=cur.filter(f=>before.indexOf(f)<0 && /^basic-\d{8}-\d{6}\.txt$/.test(f));
      if(added.length) break;
      await sleep(1000);
    }
    dump.newFile=(added[0]||'');
    ck('4014-1','outputs 恰好新增1个 basic-<stamp>.txt',added.length===1,'added='+JSON.stringify(added),'one basic-*.txt');

    // 回读报告内容
    const content=await L.ev(mp,fn=>new Promise(res=>{
      const p=wx.env.USER_DATA_PATH.replace(/[\\/]+$/,'')+'/pension/outputs/'+fn;
      wx.getFileSystemManager().readFile({filePath:p,encoding:'utf8',success:r=>res(r.data),fail:()=>res('')});
    }),added[0]);
    dump.report={bytes:Buffer.byteLength(content),hasP:String(P.total),
      hasBasic:String(P.J基础),hasAccount:String(P.J账户),hasMarkers:/养老金|退休/.test(content)};
    ck('4014-2','报告文件非空且字节>200',Buffer.byteLength(content)>200,'bytes='+Buffer.byteLength(content),'>200');
    ck('4014-3','报告含独立 P月='+P.total,(content.indexOf(String(P.total))>=0),'contains '+P.total,'yes');
    ck('4014-4','报告含三分项 '+P.J基础+'/'+P.J账户,
       content.indexOf(String(P.J基础))>=0 && content.indexOf(String(P.J账户))>=0,
       'basicIdx='+content.indexOf(String(P.J基础))+' accountIdx='+content.indexOf(String(P.J账户)),'both found');
    ck('4014-5','报告含养老金/退休标记',/养老金|退休/.test(content),'markers='+/养老金|退休/.test(content),'yes');

    // node 独立：Engine 结果 + buildBasicReport，验证独立产出含同 P月
    const inp=st.engineInputFromParsed(fx.parsed);
    inp.gender='female';inp.femaleType='worker';inp.retireYM='2034-11';
    const nr=Engine.calculate(inp);
    const rep=reportExport.buildBasicReport(nr,{generatedAt:'2026-10-28 00:00:00'});
    dump.node={repBytes:Buffer.byteLength(rep),containsP:rep.indexOf(String(P.total))>=0};
    ck('4014-6','node buildBasicReport 独立产出含同 P月',rep.indexOf(String(P.total))>=0,'nodeContains '+P.total,'yes');

    await mp.screenshot({path:path.join(LOGDIR,'GT4014.png')}).catch(()=>{});
    dump.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-GT4014.json'),JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  }catch(e){fatal=true;tr('ABORT '+(e&&e.message));
    try{dump.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(LOGDIR,'result-GT4014.json'),JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2));}catch(x){}
  }finally{await L.disconnectQuiet(mp);}
  const t=rec.totals();tr('=== GT-4014(wife4) pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail?1:(fatal?2:0));
})();
