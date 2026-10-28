/* GT-4026 独立 GUI 验收（task-79 重建 · 利率链路）
 * 单一入口；helper ../common/gui-conn-lib.js。external：40215 connect/disconnect，零 RDP。
 *
 * case-specific：common 账户利率链路（My-Case common 含「个人账户利率 1.5%」）。
 * 期望（tester 独立取值，不引用 README/旧 summary）：
 *   ①导入后 buildValidatedInput ok、input.futureMonthlyRate=0.015；
 *   ②node parseSharedRatePct：'1.5'→0.015、''→默认0.015(usedDefault)、'0'→0、'25'→抛错(0~20)；
 *   ③GUI onFutureRate 留空→0.015、录'0'→0、录'25'→built ok:false 且错误含 25/合理范围；
 *   ④利率只在共享区，两张方案卡无 futureMonthlyRate 字段。
 * 产物：logs/result-GT4026.json；运行 node gt-4026.js 40215 external 2a61e71
 */
'use strict';
const fs=require('fs'),path=require('path');
const L=require('../common/gui-conn-lib.js');
const V=require('../../calculator/inputValidator.js');

const PORT=parseInt(process.argv[2]||'40215',10);
const BASELINE=process.argv[4]||'unknown';
const FIXTURE='My-Case.md';
const LOGDIR=path.join(__dirname,'logs');fs.mkdirSync(LOGDIR,{recursive:true});
const rec=L.makeRecorder();
function tr(m){try{fs.appendFileSync(path.join(LOGDIR,'run-trace.log'),new Date().toISOString()+' '+m+'\n');}catch(e){}console.log(m);}
function ck(id,title,pass,actual,expected){rec.ck(id,title,pass,actual,expected);tr((pass?'PASS ':'FAIL ')+id+' '+title+' :: actual='+actual+' expected='+expected);}
const sleep=L.sleep;
process.on('unhandledRejection',e=>tr('REJ '+(e&&e.message)));
process.on('uncaughtException',e=>tr('EXC '+(e&&e.message)));

// GUI 改共享区利率并重新 buildValidatedInput
async function setRateAndBuild(mp,val){
  await L.ev(mp,v=>{const p=getCurrentPages().slice(-1)[0];p.selectComponent('#sharedData').onFutureRate({detail:{value:v}});return true;},val);
  await sleep(400);
  return L.ev(mp,()=>{const p=getCurrentPages().slice(-1)[0];const b=p.selectComponent('#sharedData').buildValidatedInput();
    return {ok:!!b.ok,error:b.error||'',rate:(b.input&&b.input.futureMonthlyRate)};});
}

(async()=>{
  let mp=null,fatal=false;
  const dump={at:new Date().toISOString(),testcase:'TST-02-GT-4026',baseline:BASELINE,port:PORT};
  try{
    mp=await L.connectExisting(PORT);
    const landed0=await L.waitLanded(mp);if(!landed0){tr('NO_PAGE');process.exit(4);}
    await L.clearCompareDrafts(mp);
    const cmp=await L.gotoCompare(mp);if(!cmp){tr('NO_CMP');process.exit(3);}
    const fileName=await L.importFixture(mp,FIXTURE,'gt4026');
    ck('4026-0','真实文件导入 common 成功',!!(fileName&&String(fileName).indexOf(FIXTURE)>=0),fileName,FIXTURE);

    // ① 导入后真实 built
    const b0=await L.ev(mp,()=>{const p=getCurrentPages().slice(-1)[0];const b=p.selectComponent('#sharedData').buildValidatedInput();return {ok:!!b.ok,error:b.error||'',rate:(b.input&&b.input.futureMonthlyRate)};});
    dump.builtAfterImport=b0;
    ck('4026-1','导入后 built ok 且 futureMonthlyRate=0.015',b0.ok&&b0.rate===0.015,'ok='+b0.ok+' rate='+b0.rate,'ok,0.015');

    // ② node 纯函数（独立）
    ck('4026-2',"parseSharedRatePct('1.5')=0.015",Math.abs(V.parseSharedRatePct('1.5').rate-0.015)<1e-12,V.parseSharedRatePct('1.5').rate,'0.015');
    const dflt=V.parseSharedRatePct('');
    ck('4026-3',"留空→默认0.015 且 usedDefault",Math.abs(dflt.rate-0.015)<1e-12&&dflt.usedDefault===true,dflt.rate+'/'+dflt.usedDefault,'0.015/true');
    ck('4026-4',"录'0'→0 不计息",V.parseSharedRatePct('0').rate===0,V.parseSharedRatePct('0').rate,'0');
    let threw25=false; try{V.parseSharedRatePct('25');}catch(e){threw25=/0~20|合理范围/.test(e.message)||/25/.test(e.message); dump.err25=e.message;}
    ck('4026-5',"录'25'→抛错（0~20 拦截）",threw25,dump.err25||'no throw','throws 0~20');

    // ③ GUI 真实交互
    const e3=await setRateAndBuild(mp,'');
    ck('4026-6','GUI 留空→built rate=0.015',e3.ok&&e3.rate===0.015,'ok='+e3.ok+' rate='+e3.rate,'ok,0.015');
    const e4=await setRateAndBuild(mp,'0');
    ck('4026-7',"GUI 录'0'→built rate=0",e4.ok&&e4.rate===0,'ok='+e4.ok+' rate='+e4.rate,'ok,0');
    const e5=await setRateAndBuild(mp,'25');
    dump.guiErr25=e5.error;
    ck('4026-8',"GUI 录'25'→built ok:false 且红错含25",e5.ok===false&&/25/.test(e5.error),'ok='+e5.ok+' err='+e5.error,'ok:false, contains 25');

    // 恢复合法利率，验方案卡无利率字段
    await setRateAndBuild(mp,'1.5');
    const plans=await L.ev(mp,()=>getCurrentPages().slice(-1)[0].selectComponent('#planList').getPlans());
    dump.planKeys=plans.map(p=>Object.keys(p).filter(k=>/rate/i.test(k)));
    ck('4026-9','两方案卡均无 futureMonthlyRate 字段（利率只在共享区 Q1=B）',
       plans.length===2&&plans.every(p=>!('futureMonthlyRate'in p)),JSON.stringify(dump.planKeys),'[[],[]]');

    await mp.screenshot({path:path.join(LOGDIR,'GT4026.png')}).catch(()=>{});
    dump.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-GT4026.json'),JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  }catch(e){fatal=true;tr('ABORT '+(e&&e.message));
    try{dump.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(LOGDIR,'result-GT4026.json'),JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2));}catch(x){}
  }finally{await L.disconnectQuiet(mp);}
  const t=rec.totals();tr('=== GT-4026 pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail?1:(fatal?2:0));
})();
