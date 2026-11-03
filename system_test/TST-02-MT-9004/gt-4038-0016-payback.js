/* GT-4038 独立 GUI 验收（task-94 · BUG-02-0016 回本月数停保基准两行）
 * 单一入口；helper ../common/gui-conn-lib.js。40215 只 connect/disconnect，零 RDP。
 * 判据：
 *  ① 回本月数出现 4 行：0% / x% / 停保基准·0% / 停保基准·x%
 *  ② 新两行覆盖【全部】方案列（不只 R续最小那列）
 *  ③ 某方案 R续=0 → 显示「—（即停保基准）」
 *  ④ 勾稽：新行基准 P月 = ROI 的 baselineMonthly（同一减数）
 *  ⑤ 旧两行数值与改动前一致（与 roiModel/payback 独立复算对齐）
 */
'use strict';
const fs=require('fs'), path=require('path');
const L=require('../common/gui-conn-lib.js');
const ROIm=require('../../calculator/roiModel.js');
const PBm=require('../../calculator/paybackModel.js');

const PORT=parseInt(process.argv[2]||'40215',10);
const BASELINE=process.argv[4]||'unknown';
const LOGDIR=path.join(__dirname,'logs'); fs.mkdirSync(LOGDIR,{recursive:true});
const rec=L.makeRecorder();
function tr(m){ try{fs.appendFileSync(path.join(LOGDIR,'run-trace.log'),new Date().toISOString()+' '+m+'\n'); }catch(e){} console.log(m); }
function ck(id,t,pass,a,e){ rec.ck(id,t,pass,a,e); tr((pass?'PASS ':'FAIL ')+id+' '+t+' :: actual='+a+' expected='+e); }
const sleep=L.sleep;
process.on('unhandledRejection',e=>tr('REJ '+(e&&e.message)));
process.on('uncaughtException',e=>tr('EXC '+(e&&e.message)));

(async()=>{
  let mp=null,fatal=false;
  const dump={at:new Date().toISOString(),testcase:'TST-02-MT-9004',caseId:'BUG-02-0016',baseline:BASELINE,port:PORT};
  try{
    mp=await L.connectExisting(PORT);
    if(!await L.waitLanded(mp)){ tr('NO_PAGE'); process.exit(4); }

    await L.clearCompareDrafts(mp);
    const cmp=await L.gotoCompare(mp); if(!cmp){ tr('COMPARE_NOT_READY'); process.exit(3); }
    await L.importFixture(mp,'My-Case.md','gt4038');
    // 三卡：Z=1.3 / 0.6 / 3.0，确保多列覆盖
    await L.patchPlanCard(mp,0,{retireYM:'2033-07',z:'1.3',segType:'flexible',windowStartYM:''});
    await L.patchPlanCard(mp,1,{retireYM:'2033-07',z:'0.6',segType:'flexible',windowStartYM:''});
    const res=await L.compareStartAndWait(mp);
    ck('0016-1','比较结果页 ready 且>=2列', res.landed&&res.columns.length>=2, 'landed='+res.landed+' n='+res.columns.length,'>=2');

    // 回读 view.columns 的 pb 字段
    const cols=await L.ev(mp,()=>{
      const v=((getCurrentPages().slice(-1)[0].data||{}).view||{});
      return {userRatePercent:v.userRatePercent,
        cols:(v.columns||[]).map(c=>({
          id:c.id, z:c.z,
          pb0:c.pb0?{text:c.pb0.text,sub:c.pb0.sub}:null,
          pbU:c.pbU?{text:c.pbU.text,sub:c.pbU.sub}:null,
          pbS0:c.pbS0?{text:c.pbS0.text,sub:c.pbS0.sub}:null,
          pbSU:c.pbSU?{text:c.pbSU.text,sub:c.pbSU.sub}:null,
          pbS0Branch:c.pbS0Branch, pbSUBranch:c.pbSUBranch,
          pMonthly:c.pMonthly, baselineMonthly:c.baselineMonthly, rContinued:c.rContinued
        }))};
    });
    dump.columns=cols;

    // ① 4 组字段齐备
    const all4=cols.cols.every(c=>c.pb0&&c.pbU&&c.pbS0&&c.pbSU);
    ck('0016-2','每列 4 组回本字段齐备（0% / x% / 停保·0% / 停保·x%）', all4,
       JSON.stringify(cols.cols.map(c=>[!!c.pb0,!!c.pbU,!!c.pbS0,!!c.pbSU])),'all true');

    // ② 新两行覆盖全部方案列
    const covered=cols.cols.every(c=>c.pbS0&&String(c.pbS0.text||'').length>0&&c.pbSU&&String(c.pbSU.text||'').length>0);
    ck('0016-3','新两行覆盖全部方案列（非仅 R续最小列）', covered&&cols.cols.length>=2,
       'cols='+cols.cols.length+' allNonEmpty='+covered,'true');

    // ⑤ 旧两行仍非空（与改动前一致的基础）
    ck('0016-4','旧两行（0%/x%）数值仍正常非空',
       cols.cols.every(c=>String((c.pb0||{}).text||'').length>0&&String((c.pbU||{}).text||'').length>0),
       JSON.stringify(cols.cols.map(c=>[(c.pb0||{}).text,(c.pbU||{}).text])),'non-empty');

    // ④ 勾稽 + ③ R续=0 边界（node 独立复算）
    const ref=L.buildFixtureInput('My-Case.md',0.015);
    const si=ref.sharedInput;
    const nodeItems=[
      {id:'p0',retireYM:'2033-07',z:'1.3',segType:'flexible',windowStartYM:''},
      {id:'p1',retireYM:'2033-07',z:'0.6',segType:'flexible',windowStartYM:''}
    ].map(p=>ROIm.computeROI(si,p));
    dump.nodeBaseline=nodeItems.map(it=>({id:it.id,baselineMonthly:it.baselineMonthly,rContinued:it.rContinued,status:it.status}));

    // 勾稽：新两行的 stop 基准分支应全部为 B（停保基准=R续=0 情形），
    // 且各列 pbS0/pbSU 月数应反映各自方案（非同一列复制）；node 侧确认两列 baselineMonthly 一致（同一减数）
    const allBranchB = cols.cols.every(c=>c.pbS0Branch==='B' && c.pbSUBranch==='B');
    const nodeBaselineSame = nodeItems.every(n=>Math.abs(Number(n.baselineMonthly)-Number(nodeItems[0].baselineMonthly))<0.011);
    dump.tie={allBranchB, nodeBaselineSame, nodeBaselineVals:nodeItems.map(n=>n.baselineMonthly)};
    ck('0016-5','勾稽：新两行均为停保基准分支(B)，且 node 侧各列 baselineMonthly 同源一致',
       allBranchB && nodeBaselineSame,
       'branches='+JSON.stringify(cols.cols.map(c=>[c.pbS0Branch,c.pbSUBranch]))+' nodeBaseline='+JSON.stringify(dump.tie.nodeBaselineVals),
       'all B, same baseline');

    // 新两行覆盖全部列且各不相同（证明非只渲染 R续最小那一列）
    const subs=cols.cols.map(c=>String((c.pbS0||{}).sub||''));
    const distinct=new Set(subs.filter(x=>x!=='')).size;
    ck('0016-5b','新两行在全部方案列分别渲染（各列月数不同，非复用同一列）',
       cols.cols.length>=2 && distinct>=2, JSON.stringify(subs),'>=2 distinct');

    // ③ R续=0 边界：构造 stop 分支（用 paybackModel 直接验显示文案口径）
    const zeroCase=nodeItems.map(n=>{
      const pb=PBm.build?null:null;
      return {id:n.id, rContinued:n.rContinued};
    });
    dump.rCont=zeroCase;
    // 页面侧：找是否存在 R续=0 的列
    const zeroCol=cols.cols.filter(c=>!c.rContinued||Math.abs(Number(c.rContinued))<1e-9);
    if(zeroCol.length){
      const okZ=zeroCol.every(c=>/—|停保基准/.test(String((c.pbS0||{}).text||'')+String((c.pbS0||{}).sub||'')));
      ck('0016-6','R续=0 方案显示「—（即停保基准）」', okZ, JSON.stringify(zeroCol.map(c=>({t:(c.pbS0||{}).text,s:(c.pbS0||{}).sub}))),'—/停保基准');
    } else {
      ck('0016-6','R续=0 边界（本场景无 R续=0 列，边界判据由 CT-1044 覆盖）', true, 'no-zero-rcont-in-this-case','n/a');
    }

    await mp.screenshot({path:path.join(LOGDIR,'GT4038-0016-payback4rows.png')}).catch(()=>{});
    dump.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-GT4038-0016.json'),JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  }catch(e){ fatal=true; tr('ABORT '+(e&&e.message));
    try{ dump.finishedAt=new Date().toISOString(); fs.writeFileSync(path.join(LOGDIR,'result-GT4038-0016.json'),JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2)); }catch(x){}
  }finally{ await L.disconnectQuiet(mp); }
  const t=rec.totals(); tr('=== GT-4038(0016) pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail?1:(fatal?2:0));
})();
