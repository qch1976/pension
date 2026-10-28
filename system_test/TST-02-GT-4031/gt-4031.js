/* GT-4031 独立 GUI 验收（task-79 重建 · 缴费表5列解析）
 * 单一入口；helper ../common/gui-conn-lib.js + st-case-lib.js。external：40215 connect/disconnect，零 RDP。
 *
 * case-specific：缴费表5列（年内起始月+缴费身份）解析/中文身份映射/旧3列向后兼容（BUG-02-0010）。
 * 期望（tester 独立取值/重算，不引用 README/旧 summary；账户利率随 common=1.5%）：
 *  GUI My：built ok、27段、首段2000-11~12 enterprise/3071、全enterprise、rate0.015；
 *  GUI Wife：23段、跨度2003-09~12/2005-01~07/2006-04~12、全enterprise、bal481459；
 *    共享区切 female/worker，两卡 z0.6/z3 retire2034-11 → 比较列 P=8465.41/11179.12；
 *  node 解析：临时5列「灵活」2010-03~04→flexible、「单位」→enterprise；旧3列 startMonth缺省1/type缺省enterprise；
 *    非法身份「外包」报错；起始月13报错。
 * 产物：logs/result-GT4031.json；运行 node gt-4031.js 40215 external 2a61e71
 */
'use strict';
const fs=require('fs'),path=require('path');
const L=require('../common/gui-conn-lib.js');
const st=require('../common/st-case-lib.js');
const CRM=require('../../calculator/compareResultModel.js');
const caseFile=require('../../services/caseFile.js');
const caseValidator=require('../../services/caseValidator.js');

const PORT=parseInt(process.argv[2]||'40215',10);
const BASELINE=process.argv[4]||'unknown';
const LOGDIR=path.join(__dirname,'logs');fs.mkdirSync(LOGDIR,{recursive:true});
const rec=L.makeRecorder();
function tr(m){try{fs.appendFileSync(path.join(LOGDIR,'run-trace.log'),new Date().toISOString()+' '+m+'\n');}catch(e){}console.log(m);}
function ck(id,title,pass,actual,expected){rec.ck(id,title,pass,actual,expected);tr((pass?'PASS ':'FAIL ')+id+' '+title+' :: actual='+actual+' expected='+expected);}
const sleep=L.sleep, round2=n=>Math.round(Number(n)*100)/100;
const close2=(a,b)=>isFinite(a)&&isFinite(b)&&Math.abs(a-b)<0.01;
process.on('unhandledRejection',e=>tr('REJ '+(e&&e.message)));
process.on('uncaughtException',e=>tr('EXC '+(e&&e.message)));

async function realBuilt(mp){
  return L.ev(mp,()=>{const p=getCurrentPages().slice(-1)[0];const b=p.selectComponent('#sharedData').buildValidatedInput();
    return {ok:!!b.ok,error:b.error||'',input:b.input};});
}

(async()=>{
  let mp=null,fatal=false;
  const dump={at:new Date().toISOString(),testcase:'TST-02-GT-4031',baseline:BASELINE,port:PORT};
  try{
    mp=await L.connectExisting(PORT);
    let landed=await L.waitLanded(mp);if(!landed){tr('NO_PAGE');process.exit(4);}

    // ---- GUI My ----
    await L.clearCompareDrafts(mp);
    let cmp=await L.gotoCompare(mp);if(!cmp){tr('NO_CMP');process.exit(3);}
    await L.importFixture(mp,'My-Case.md','g4031');
    const bm=await realBuilt(mp);
    ck('4031-1','My built ok 且27段',bm.ok&&bm.input.segments.length===27,'ok='+bm.ok+' n='+(bm.input&&bm.input.segments.length),'ok,27');
    const f0=bm.input.segments[0];
    ck('4031-2','My 首段 2000-11~2000-12 enterprise/3071',
       f0.startYM==='2000-11'&&f0.endYM==='2000-12'&&f0.type==='enterprise'&&f0.baseMonthly===3071,
       JSON.stringify(f0),'2000-11,2000-12,enterprise,3071');
    ck('4031-3','My 全 enterprise',bm.input.segments.every(s=>s.type==='enterprise'),'allEnt','true');
    ck('4031-4','My rate=0.015 且 fileErrors0',bm.input.futureMonthlyRate===0.015,'rate='+bm.input.futureMonthlyRate,'0.015');

    // ---- GUI Wife ----
    await L.clearCompareDrafts(mp);
    cmp=await L.gotoCompare(mp);
    await L.importFixture(mp,'MyWife-Case.md','w4031');
    const bw=await realBuilt(mp);
    ck('4031-5','Wife built ok 且23段',bw.ok&&bw.input.segments.length===23,'ok='+bw.ok+' n='+(bw.input&&bw.input.segments.length),'ok,23');
    const S=bw.input.segments;
    ck('4031-6','Wife 跨度 2003-09~12/2005-01~07/2006-04~12',
       S.some(s=>s.startYM==='2003-09'&&s.endYM==='2003-12')&&
       S.some(s=>s.startYM==='2005-01'&&s.endYM==='2005-07')&&
       S.some(s=>s.startYM==='2006-04'&&s.endYM==='2006-12'),'spans','three spans');
    ck('4031-7','Wife 全enterprise 且账户余额481459',
       S.every(s=>s.type==='enterprise')&&bw.input.accountBalanceManual===481459,
       'allEnt='+S.every(s=>s.type==='enterprise')+' bal='+bw.input.accountBalanceManual,'true,481459');

    // 共享区切 female/worker（birth 已1981-07），建两卡 z0.6/z3 retire2034-11 → 比较
    await L.setSharedCtx(mp,{gender:'female',femaleType:'worker'});
    await L.patchPlanCard(mp,0,{retireYM:'2034-11',z:'0.6',segType:'flexible',windowStartYM:''});
    await L.patchPlanCard(mp,1,{retireYM:'2034-11',z:'3.0',segType:'flexible',windowStartYM:''});
    const res=await L.compareStartAndWait(mp);
    const guiP=res.columns.map(c=>Number(c.P));
    ck('4031-8','Wife 比较结果2列 P=8465.41/11179.12',
       res.landed&&close2(guiP[0],8465.41)&&close2(guiP[1],11179.12),'landed='+res.landed+' P='+guiP.map(round2).join('/'),'8465.41/11179.12');

    // ---- node 解析层 F9-F12（独立，临时文本不入库）----
    function parseTable(rows){
      const text=[
        '``` c ```','# 生日: 2010-01','# 养老保险目前交到: 2010-12','# 缴费记录',
        '| 年份 | 养老缴纳基数(年) | 年内起始月份 | 年内缴纳月数 | 缴费身份'].concat(rows,['```']).join('\n');
      const parsed=caseFile.parseCaseFile(text,'compare');
      const val=caseValidator.validate(parsed,'compare');
      return {parsed,val};
    }
    const flex=parseTable(['| 2010 | 1000 | 3 | 2 | 灵活 |']);
    const fr=flex.parsed.records[0]||{};
    ck('4031-9','临时5列「灵活」→type=flexible，段2010-03~04',
       fr.type==='flexible'&&fr.startMonth===3&&fr.months===2,
       JSON.stringify(fr)+' err='+JSON.stringify(flex.parsed.errors),'flexible,start3,2months');
    const ent=parseTable(['| 2010 | 1000 | 6 | 1 | 单位 |']);
    ck('4031-10','临时5列「单位」→type=enterprise',ent.parsed.records[0].type==='enterprise',
       JSON.stringify(ent.parsed.records[0]),'enterprise');

    // 旧3列
    const text3=['``` c ','# 生日: 2010-01','# 养老保险目前交到: 2010-12','# 缴费记录',
      '| 年份 | 养老缴纳基数(年) | 年内缴纳月数 |','| 2010 | 1000 | 5 |','```'].join('\n');
    const p3=caseFile.parseCaseFile(text3,'compare');
    const r3=p3.records[0];
    ck('4031-11','旧3列 startMonth缺省=1 type缺省=enterprise（向后兼容）',
       r3.startMonth===1&&r3.type==='enterprise'&&r3.months===5,JSON.stringify(r3),'1,enterprise,5');

    // 非法身份
    const bad=parseTable(['| 2010 | 1000 | 1 | 1 | 外包 |']);
    ck('4031-12','非法身份「外包」逐行拦截（validate ok=false）',
       bad.val.ok===false&&bad.parsed.errors.some(e=>/无法识别|外包/.test(e.reason)),
       JSON.stringify(bad.parsed.errors),'blocked');

    // 起始月13
    const bad2=parseTable(['| 2010 | 1000 | 13 | 1 | 单位 |']);
    ck('4031-13','起始月13（非1~12）逐行拦截',
       bad2.val.ok===false&&bad2.parsed.errors.some(e=>/起始月|1~12/.test(e.reason)),
       JSON.stringify(bad2.parsed.errors),'blocked');

    await mp.screenshot({path:path.join(LOGDIR,'GT4031.png')}).catch(()=>{});
    dump.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-GT4031.json'),JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  }catch(e){fatal=true;tr('ABORT '+(e&&e.message));
    try{dump.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(LOGDIR,'result-GT4031.json'),JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2));}catch(x){}
  }finally{await L.disconnectQuiet(mp);}
  const t=rec.totals();tr('=== GT-4031 pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail?1:(fatal?2:0));
})();
