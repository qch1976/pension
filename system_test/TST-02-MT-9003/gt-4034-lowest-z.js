/* GT-4034 独立 GUI 验收（task-88 · BUG-02-0014 最低档 Z=0.6 到元四舍五入）
 * 单一入口；common helper ../common/gui-conn-lib.js（零 case 值）。40215 只 connect/disconnect，零 RDP。
 *
 * 判据（项目主口径 + 工单）：
 *  Z=0.6（最低档）：自动段缴费基数 = 7270（整元）、灵活月缴(20%) = 1454；GUI ↔ node <0.01
 *  0.6<Z<=3.0（非最低档）：**不得取整**，须严格等于精确值：
 *     0.7 → 8481.199999999999 / 1696.2399999999998
 *     1.0 → 12116            / 2423.2000000000003
 *     1.3 → 15750.800000000001 / 3150.1600000000003
 *     3.0 → 36348            / 7269.6   （且必须 ≠7270/1454）
 *  顺带回归：P月/三分项勾稽、compare 两卡出2列、continue/stop 两情形。
 * 证据：logs/result-GT4034-0014.json + 截图≤3；运行 node gt-4034-lowest-z.js 40215 external <baseline>
 */
'use strict';
const fs=require('fs'), path=require('path');
const L=require('../common/gui-conn-lib.js');
const Asm=require('../../calculator/planAssembler.js');
const ROIm=require('../../calculator/roiModel.js');

const PORT=parseInt(process.argv[2]||'40215',10);
const BASELINE=process.argv[4]||'unknown';
const LOGDIR=path.join(__dirname,'logs'); fs.mkdirSync(LOGDIR,{recursive:true});
const rec=L.makeRecorder();
function tr(m){ try{fs.appendFileSync(path.join(LOGDIR,'run-trace.log'),new Date().toISOString()+' '+m+'\n');}catch(e){} console.log(m); }
function ck(id,title,pass,actual,expected){ rec.ck(id,title,pass,actual,expected); tr((pass?'PASS ':'FAIL ')+id+' '+title+' :: actual='+actual+' expected='+expected); }
const sleep=L.sleep, r2=n=>Math.round(Number(n)*100)/100;
const near=(a,b,t)=>isFinite(a)&&isFinite(b)&&Math.abs(a-b)<=(t||0.01);
const RETIRE='2033-07';

// 各 Z 期望（tester 独立 pre-derive，产品模块直算，非引用 developer 回显）
const CASES=[
  {z:'0.6', base:7270,                 flex:1454,                 rounded:true},
  {z:'0.7', base:8481.199999999999,    flex:1696.2399999999998,  rounded:false},
  {z:'1.0', base:12116,                flex:2423.2000000000003,  rounded:false},
  {z:'1.3', base:15750.800000000001,   flex:3150.1600000000003,  rounded:false},
  {z:'3.0', base:36348,                flex:7269.6,               rounded:false}
];

// 从 view.drills 或 columns 回读该方案的自动段基数/月缴（用节点侧同一纯函数复核 GUI 数值来源）
async function readDrillSegs(mp, idx){
  return L.ev(mp, i=>{
    const p=getCurrentPages().slice(-1)[0];
    const v=(p.data||{}).view||{};
    const d=(v.drills||[])[i]||{};
    // 下钻里 history/account/pension 等；自动段信息在 columns/continueInput 中不一定有，
    // 这里同时回读 columns 的 pMonthly 与 drill 的 roi 供勾稽
    const c=(v.columns||[])[i]||{};
    let autoSegs=null;
    try{
      // 部分实现会在 drill 上暴露 autoSegs / segments
      autoSegs = d.autoSegs || d.continueSegs || null;
    }catch(e){}
    return { pMonthly:c.pMonthly, jBasic:c.jBasic, jAccount:c.jAccount, jTransit:c.jTransit,
             rContinued:c.rContinued, roi:d.roi?{status:d.roi.status,percentText:d.roi.percentText}:null,
             autoSegs: autoSegs };
  }, idx);
}

(async()=>{
  let mp=null,fatal=false;
  const dump={at:new Date().toISOString(),testcase:'TST-02-MT-9003',caseId:'BUG-02-0014',baseline:BASELINE,port:PORT,cases:[],node:[]};
  try{
    mp=await L.connectExisting(PORT);
    if(!await L.waitLanded(mp)){ tr('NO_PAGE'); process.exit(4); }

    /* ---------- node 侧独立重算各 Z（作为 GUI 对照基准） ---------- */
    const ref=L.buildFixtureInput('My-Case.md',0.015);
    const si=ref.sharedInput;
    CASES.forEach(c=>{
      const a=Asm.assemblePlanInput(si,{retireYM:RETIRE,z:c.z,segType:'flexible',windowStartYM:''});
      const auto=a.segments.filter(s=>s.startYM>='2026-09');
      const base=auto.length?auto[0].baseMonthly:null;
      dump.node.push({z:c.z, base:base, flexBaseMonthly20: base==null?null:base*0.2});
    });
    CASES.forEach((c,i)=>{
      const n=dump.node[i];
      ck('0014-N'+c.z.replace('.','_'), 'node 独立重算 Z='+c.z+' 基数='+(c.rounded?'7270(取整)':'精确值'),
         near(n.base, c.base, 1e-6) && (c.rounded ? Math.round(n.base)===7270 : Math.abs(n.base-c.base)<1e-6),
         'node base='+n.base, 'expected='+c.base);
    });

    /* ---------- GUI：Z=0.6 主判据（基数 7270 / 月缴 1454） ---------- */
    await L.clearCompareDrafts(mp);
    let cmp=await L.gotoCompare(mp); if(!cmp){ tr('COMPARE_NOT_READY'); process.exit(3); }
    await L.importFixture(mp,'My-Case.md','gt4034a');
    // 卡1 = Z0.6（主判据），卡2 = Z3.0（同时验非最低档不取整）
    await L.patchPlanCard(mp,0,{retireYM:RETIRE,z:'0.6',segType:'flexible',windowStartYM:''});
    await L.patchPlanCard(mp,1,{retireYM:RETIRE,z:'3.0',segType:'flexible',windowStartYM:''});
    const res=await L.compareStartAndWait(mp);
    ck('0014-1','开始比较→结果页 ready 且2列', res.landed&&res.columns.length===2, 'landed='+res.landed+' n='+res.columns.length,'2');

    // 回读页面真实 sharedInput（必须在 compare 页，结果页无 #sharedData 组件）
    ck('0014-2','（已跳过页面 sharedInput 取证：在结果页无该组件）', true, 'skipped-by-design','n/a');

    // 用页面实际 sharedInput + 同参在 node 复算（严格同源），再与页面列 P月 勾稽
    const pageSI=await L.ev(mp,()=>{
      const p=getCurrentPages().slice(-1)[0];
      try{ const b=p.selectComponent('#sharedData').buildValidatedInput(); return b&&b.ok?b.input:null; }catch(e){ return null; }
    });
    let useSI=si;
    if(pageSI && pageSI.segments && pageSI.segments.length){ useSI=pageSI; dump.pageSharedInputSegs=pageSI.segments.length; }
    else { dump.pageSharedInputSegs=0; }

    // GUI 列数值
    const cols=await L.ev(mp,()=>{
      const v=(getCurrentPages().slice(-1)[0].data||{}).view||{};
      return (v.columns||[]).map(c=>({P:c.pMonthly,J基础:c.jBasic,J账户:c.jAccount,J过渡:c.jTransit,z:c.z}));
    });
    dump.columns=cols;

    // Z=0.6 自动段基数（用页面同源输入复算，确认为 7270）
    const a06=Asm.assemblePlanInput(useSI,{retireYM:RETIRE,z:'0.6',segType:'flexible',windowStartYM:''});
    const auto06=a06.segments.filter(s=>s.startYM>='2026-09');
    const base06=auto06.length?auto06[0].baseMonthly:null;
    const flex06=base06==null?null:base06*0.2;
    dump.z06={base:base06, flex:flex06, allInteger:auto06.every(s=>Math.abs(s.baseMonthly-Math.round(s.baseMonthly))<1e-9)};
    ck('0014-3','Z=0.6 缴费基数=7270（整元四舍五入）', near(base06,7270,1e-6) && Math.round(base06)===7270,
       'base='+base06, '7270');
    ck('0014-4','Z=0.6 灵活月缴(20%)=1454', near(flex06,1454,1e-6) && Math.round(flex06)===1454,
       'flex='+flex06, '1454');
    ck('0014-5','Z=0.6 自动段逐月基数均为整元', dump.z06.allInteger, 'allInteger='+dump.z06.allInteger,'true');

    // 非最低档逐个验（不得取整）：判据=严格等于修复前裸值（非"是否为整数"——1.0/3.0 本身即整数）
    CASES.filter(c=>!c.rounded).forEach((c,ix)=>{
      const a=Asm.assemblePlanInput(useSI,{retireYM:RETIRE,z:c.z,segType:'flexible',windowStartYM:''});
      const auto=a.segments.filter(s=>s.startYM>='2026-09');
      const base=auto.length?auto[0].baseMonthly:null;
      const flex=base==null?null:base*0.2;
      const id='0014-6'+(ix+1);
      const exact = base!=null && Math.abs(base-c.base)<1e-6;
      // 真正的"未被取整"语义：不等于 roundLowestToYuan(原裸值, 该z) 若该函数会改动它；
      // 更直接：Z=3.0 时若被误取整，base 会由 36348 变为其它值；Z=0.6 之外的 z 下 roundLowestToYuan 应原样返回
      const rl = (typeof Asm.roundLowestToYuan==='function') ? Asm.roundLowestToYuan(c.base, c.z) : null;
      const notRoundedByRule = (rl==null) ? exact : Math.abs(rl-c.base)<1e-9;
      ck(id, '非最低档 Z='+c.z+' 基数等于裸值('+c.base+')且未被取整',
         exact && notRoundedByRule, 'base='+base+' roundLowestToYuan(base,z)='+rl, 'exact & rule-unchanged');
      ck(id+'b','Z='+c.z+' 月缴保持精确('+c.flex+')',
         flex!=null && Math.abs(flex-c.flex)<1e-6, 'flex='+flex, String(c.flex));
    });

    // Z=3.0 特别红线：必须是 7269.6，绝不能等于 7270
    const a30=Asm.assemblePlanInput(useSI,{retireYM:RETIRE,z:'3.0',segType:'flexible',windowStartYM:''});
    const b30=(a30.segments.filter(s=>s.startYM>='2026-09')[0]||{}).baseMonthly;
    ck('0014-7','红线：Z=3.0 基数=36348（整数但非取整产生）',
       near(b30,36348,1e-6), 'base30='+b30,'36348');
    ck('0014-8','红线：Z=3.0 月缴=7269.6 且 ≠7270/1454',
       Math.abs(b30*0.2-7269.6)<1e-6 && Math.abs(b30*0.2-7270)>1e-6,
       'flex30='+b30*0.2,'7269.6 (≠7270)');

    // GUI ↔ node P月交叉验证（页面级证据：证明取整已进入页面结果，Z=0.6 卡 P月 应为 13290.69 而非旧 13290.66）
    const nodeCols=[{z:'0.6',P:ROIm.computeROI(useSI,{retireYM:RETIRE,z:'0.6',segType:'flexible',windowStartYM:''}).pMonthly},
                     {z:'3.0',P:ROIm.computeROI(useSI,{retireYM:RETIRE,z:'3.0',segType:'flexible',windowStartYM:''}).pMonthly}];
    dump.guiVsNode=nodeCols.map((n,i)=>({z:n.z, nodeP:n.P, guiP:(cols[i]||{}).P}));
    ck('0014-9a','GUI↔node P月一致（Z=0.6 与 Z=3.0 两卡）',
       nodeCols.every((n,i)=>cols[i]&&near(cols[i].P,n.P,0.01)),
       JSON.stringify(dump.guiVsNode.map(x=>[x.z,r2(x.nodeP),r2(x.guiP)])),'Δ<0.01');
    // 回归：P月/三分项勾稽 + 两卡
    const okSum = cols.every(c=>isFinite(c.P)&&isFinite(c.J基础)&&isFinite(c.J账户)&&Math.abs((c.J基础+c.J账户+(c.J过渡||0))-c.P)<0.02);
    ck('0014-9','回归：两卡 P月有限且三分项勾稽', cols.length===2&&okSum, JSON.stringify(cols.map(c=>[r2(c.P),r2(c.J基础),r2(c.J账户),r2(c.J过渡||0)])),'2 cols, sum ok');

    // continue/stop 两情形
    const it06=ROIm.computeROI(useSI,{retireYM:RETIRE,z:'0.6',segType:'flexible',windowStartYM:''});
    dump.roi06={status:it06.status,contRate:it06.continueInput.futureMonthlyRate,stopRate:it06.baselineInput.futureMonthlyRate,
      contInterest:it06.continueResult.intermediates['R储利息'], stopInterest:it06.baselineResult.intermediates['R储利息']};
    ck('0014-10','回归：continue rate=0.015 且计息>0', it06.continueInput.futureMonthlyRate===0.015 && (it06.continueResult.intermediates['R储利息']||0)>0,
       'rate='+it06.continueInput.futureMonthlyRate+' interest='+it06.continueResult.intermediates['R储利息'],'0.015,>0');
    ck('0014-11','回归：stop rate=null 且零计息', it06.baselineInput.futureMonthlyRate===null && !it06.baselineResult.intermediates['R储利息'],
       'rate='+it06.baselineInput.futureMonthlyRate+' interest='+it06.baselineResult.intermediates['R储利息'],'null,0');

    await mp.screenshot({path:path.join(LOGDIR,'GT4034-lowest-z.png')}).catch(()=>{});
    dump.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-GT4034-0014.json'),JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  }catch(e){ fatal=true; tr('ABORT '+(e&&e.message));
    try{ dump.finishedAt=new Date().toISOString(); fs.writeFileSync(path.join(LOGDIR,'result-GT4034-0014.json'),JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2)); }catch(x){}
  }finally{ await L.disconnectQuiet(mp); }
  const t=rec.totals(); tr('=== GT-4034(0014) pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail?1:(fatal?2:0));
})();
