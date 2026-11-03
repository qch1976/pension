/* GT-4036 独立 GUI 验收（task-94 · BUG-02-0018/0019 女性口径）
 * 单一入口；helper ../common/gui-conn-lib.js。40215 只 connect/disconnect，零 RDP。
 *
 * 0018（基本计算，性别女/女干部不得被文件覆盖、retireYM 保留文件值 2031-07）
 * 0019（方案比较，女干部 2031-07 报下限 2036-07 且绝不含 2041-07；2036-07 放行；男口径不回退）
 * 期望（tester 独立用产品模块 pre-derive，不引用 developer 回显）：
 *   法定：男 2044-07 / 女工人 2034-11 / 女干部 2039-06
 *   弹性下限：男 2041-07 / 女工人 2031-11 / 女干部 2036-07
 * 证据：logs/result-GT4036-0018-0019.json + 截图≤3
 */
'use strict';
const fs=require('fs'), path=require('path');
const L=require('../common/gui-conn-lib.js');
const Schedule=require('../../calculator/retireSchedule.js');
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

// 独立 pre-derive（产品模块，非 developer 回显）
const stat=(g,ft)=>Schedule.statutoryRetireYM(Schedule.keyOf(g,ft||''),'1981-07');
const ctx=(g,ft)=>({gender:g,femaleType:ft||'',birthYM:'1981-07'});
const range=(g,ft)=>PM.legalRange({gender:g,femaleType:ft||'',birthYM:'1981-07'},D);

(async()=>{
  let mp=null,fatal=false;
  const dump={at:new Date().toISOString(),testcase:'TST-02-MT-9005',caseIds:['BUG-02-0018','BUG-02-0019'],baseline:BASELINE,port:PORT};
  try{
    // pre-derive
    dump.expected={
      maleStat: stat('male'), femaleWorkerStat: stat('female','worker'), femaleCadreStat: stat('female','cadre')
    };
    const rM=range('male'), rW=range('female','worker'), rC=range('female','cadre');
    dump.expected.rangeMale=rM; dump.expected.rangeWorker=rW; dump.expected.rangeCadre=rC;
    ck('0018-0', '独立 pre-derive：男2044-07/女工2034-11/女干2039-06',
       dump.expected.maleStat==='2044-07'&&dump.expected.femaleWorkerStat==='2034-11'&&dump.expected.femaleCadreStat==='2039-06',
       [dump.expected.maleStat,dump.expected.femaleWorkerStat,dump.expected.femaleCadreStat].join('/'), '2044-07/2034-11/2039-06');
    ck('0019-0', '独立 pre-derive：女干部弹性下限=2036-07 且 ≠男 2041-07',
       rC.minIdx===D.toIndex('2036-07') && rC.minIdx!==D.toIndex('2041-07'),
       'cadreMin='+rC.minYM+'('+rC.minIdx+') maleMin='+rM.minYM+'('+rM.minIdx+')', '2036-07 (≠2041-07)');

    mp=await L.connectExisting(PORT);
    if(!await L.waitLanded(mp)){ tr('NO_PAGE'); process.exit(4); }

    /* ================= 0018：基本计算 · 女性口径 ================= */
    for(const [tag,g,ft,expStat] of [['女','female','worker','2034-11'],['女干部','female','cadre','2039-06'],['男','male','worker','2044-07']]){
      await L.clearBasicDraft(mp);
      await L.importFixture(mp, FIXTURE, 'gt4036a');
      // 用户先选性别，再导入？按题面：导入后选性别 —— 用产品真实交互 setGender/setFemaleType
      const okSel=await L.ev(mp,(gg,ff)=>{
        const p=getCurrentPages().slice(-1)[0];
        if(p.setGender) p.setGender({currentTarget:{dataset:{v:gg}}});
        if(gg==='female' && p.setFemaleType) p.setFemaleType({currentTarget:{dataset:{v:ff}}});
        return true;
      }, g, ft);
      await sleep(700);
      const st1=await L.ev(mp,()=>{
        const p=getCurrentPages().slice(-1)[0]; const d=p.data;
        return {gender:d.gender, femaleType:d.femaleType, retireYM:d.retireYM,
                retireHint:d.retireHint||d.retireHintText||'', boundWarnings:d.boundWarnings||[]};
      });
      dump['basic_'+tag]=st1;
      ck('0018-'+tag+'-1', '基本计算 选'+tag+' 后 gender 未被文件覆盖', st1.gender===g, 'gender='+st1.gender, g);
      ck('0018-'+tag+'-2', '基本计算 选'+tag+' retireYM 保留文件值 2031-07（不被法定 '+expStat+' 覆盖）',
         String(st1.retireYM)==='2031-07', 'retireYM='+st1.retireYM, '2031-07');
    }

    /* 清空 retireYM 后重选性别 → 应推导对应身份法定值 */
    await L.clearBasicDraft(mp);
    await L.importFixture(mp, FIXTURE, 'gt4036b');
    await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0]; p.setData({retireYM:''}); if(p.refreshDefaultRetire) p.refreshDefaultRetire(); return true; });
    await sleep(400);
    await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0]; if(p.setGender) p.setGender({currentTarget:{dataset:{v:'female'}}}); if(p.setFemaleType) p.setFemaleType({currentTarget:{dataset:{v:'cadre'}}}); return true; });
    await sleep(700);
    const stC=await L.ev(mp,()=>({retireYM:getCurrentPages().slice(-1)[0].data.retireYM, gender:getCurrentPages().slice(-1)[0].data.gender, ft:getCurrentPages().slice(-1)[0].data.femaleType}));
    dump.basic_emptyRetire=stC;
    ck('0018-empty', '清空 retireYM 后选女干部 → 推导法定 2039-06', String(stC.retireYM)==='2039-06', JSON.stringify(stC), '2039-06');
    await mp.screenshot({path:path.join(LOGDIR,'GT4036-0018-female.png')}).catch(()=>{});

    /* ================= 0019：方案比较 · 女干部下限 ================= */
    await L.clearCompareDrafts(mp);
    const cmp=await L.gotoCompare(mp);
    ck('0019-1','方案比较页可用', !!cmp, 'gotoCompare='+cmp, 'true');
    if(cmp){
      await L.importFixture(mp, FIXTURE, 'gt4036c');
      // 共享区选 女 + 女干部（真实交互）
      await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0]; const s=p.selectComponent('#sharedData');
        if(s&&s.setGender) s.setGender({currentTarget:{dataset:{v:'female'}}});
        return true; });
      await sleep(250);
      await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0]; const s=p.selectComponent('#sharedData');
        if(s&&s.setFemaleType) s.setFemaleType({currentTarget:{dataset:{v:'cadre'}}});
        return true; });
      await sleep(250);
      await L.ev(mp,()=>{ getCurrentPages().slice(-1)[0].syncCtx(); return true; });
      await sleep(900);
      const g1=await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0]; return {gender:p.data.ctx&&p.data.ctx.gender, ft:p.data.ctx&&p.data.ctx.femaleType}; });
      dump.compareCtx=g1;
      ck('0019-2','共享区切女干部后 ctx 未被文件覆盖', g1.gender==='female'&&g1.ft==='cadre', JSON.stringify(g1),'female/cadre');

      // 卡1=2031-07（应报下限2036-07）、卡2=2036-07（应放行）
      await L.patchPlanCard(mp,0,{retireYM:'2031-07',z:'1.0',segType:'enterprise',windowStartYM:''});
      await L.patchPlanCard(mp,1,{retireYM:'2036-07',z:'1.0',segType:'enterprise',windowStartYM:''});
      // 用产品纯函数独立复算两卡的合法性/错误（同源，不读页面内部缓存）
      const chk=await L.ev(mp,()=>{
        const p=getCurrentPages().slice(-1)[0];
        const pl=p.selectComponent('#planList');
        return {plans:pl.getPlans().map(x=>x.retireYM), ctx:p.data.ctx};
      });
      dump.comparePlans=chk;
      const errs31=PM.planErrors({retireYM:'2031-07',z:'1.0',segType:'enterprise',windowStartYM:''},chk.ctx,D).filter(s=>/退休/.test(s));
      const errs36=PM.planErrors({retireYM:'2036-07',z:'1.0',segType:'enterprise',windowStartYM:''},chk.ctx,D).filter(s=>/退休/.test(s));
      dump.errs2031=errs31; dump.errs2036=errs36;

      ck('0019-3','女干部 2031-07 被判"早于合法下限"', errs31.length>0, JSON.stringify(errs31),'has error');
      ck('0019-4','下限文案 = 2036-07（含 2036-07）', errs31.join(' ').indexOf('2036-07')>=0, JSON.stringify(errs31),'contains 2036-07');
      ck('0019-5','🔴 下限文案绝不含 2041-07（男性值）', errs31.join(' ').indexOf('2041-07')<0, JSON.stringify(errs31),'NOT contains 2041-07');
      ck('0019-6','女干部 2036-07 放行（无退休红错）', errs36.length===0, JSON.stringify(errs36),'[]');

      // 男口径不回退：男 2041-07 放行、男 2036-07 被拦
      await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0]; const s=p.selectComponent('#sharedData');
        if(s&&s.setGender) s.setGender({currentTarget:{dataset:{v:'male'}}}); return true; });
      await sleep(250);
      await L.ev(mp,()=>{ getCurrentPages().slice(-1)[0].syncCtx(); return true; });
      await sleep(800);
      const ctxM=await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0]; return p.data.ctx; });
      dump.ctxMale=ctxM;
      const eM41=PM.planErrors({retireYM:'2041-07',z:'1.0',segType:'enterprise',windowStartYM:''},ctxM,D).filter(s=>/退休/.test(s));
      const eM36=PM.planErrors({retireYM:'2036-07',z:'1.0',segType:'enterprise',windowStartYM:''},ctxM,D).filter(s=>/退休/.test(s));
      dump.errsMale2041=eM41; dump.errsMale2036=eM36;
      ck('0019-7','男口径不回退：男 2041-07 放行', eM41.length===0&&ctxM.gender==='male', JSON.stringify({ctx:ctxM.gender,err:eM41}),'male, []');
      ck('0019-8','男口径不回退：男 2036-07 被拦', eM36.length>0, JSON.stringify(eM36),'has error');

      // 真实 startCompare 不应被 block（女干部两卡合法退休）
      await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0]; const s=p.selectComponent('#sharedData');
        if(s&&s.setGender) s.setGender({currentTarget:{dataset:{v:'female'}}}); return true; });
      await sleep(200);
      await L.ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0]; const s=p.selectComponent('#sharedData');
        if(s&&s.setFemaleType) s.setFemaleType({currentTarget:{dataset:{v:'cadre'}}}); return true; });
      await sleep(200);
      await L.ev(mp,()=>{ getCurrentPages().slice(-1)[0].syncCtx(); return true; });
      await sleep(700);
      await L.patchPlanCard(mp,0,{retireYM:'2039-06',z:'1.0',segType:'enterprise',windowStartYM:''});
      await L.patchPlanCard(mp,1,{retireYM:'2036-07',z:'3.0',segType:'enterprise',windowStartYM:''});
      const res=await L.compareStartAndWait(mp,30000);
      dump.startCompare=res;
      ck('0019-9','女干部合法退休（2039-06/2036-07）可开始比较不被 block', res.landed===true,
         'landed='+res.landed+' n='+res.columns.length,'landed=true');
      await mp.screenshot({path:path.join(LOGDIR,'GT4036-0019-cadre.png')}).catch(()=>{});
    }

    dump.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-GT4036-0018-0019.json'),JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  }catch(e){ fatal=true; tr('ABORT '+(e&&e.message));
    try{ dump.finishedAt=new Date().toISOString(); fs.writeFileSync(path.join(LOGDIR,'result-GT4036-0018-0019.json'),JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2)); }catch(x){}
  }finally{ await L.disconnectQuiet(mp); }
  const t=rec.totals(); tr('=== GT-4036(0018/0019) pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail?1:(fatal?2:0));
})();
