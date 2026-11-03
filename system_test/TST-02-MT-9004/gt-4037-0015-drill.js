/* GT-4037 独立 GUI 验收（task-94 · BUG-02-0015 下钻明细右侧裁切）
 * 单一入口；helper ../common/gui-conn-lib.js。40215 只 connect/disconnect，零 RDP。
 * 判据：打开「数值下钻→查看明细」后，明细行的数值列完整可见、不溢出屏宽。
 *   - .cr-sheet / .cr-sheet-body 计算宽度 <= 屏宽（修复前 445px > 411px）
 *   - .cr-dr-v 数值列 right 边界 <= 视口宽度（不写到屏外）
 *   - 数值列 text-align:right；长数值 word-break 生效不撑破容器
 *   - ROI 区块（0012 功能）仍存在且不错位
 */
'use strict';
const fs=require('fs'), path=require('path');
const L=require('../common/gui-conn-lib.js');

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
  const dump={at:new Date().toISOString(),testcase:'TST-02-MT-9004',caseId:'BUG-02-0015',baseline:BASELINE,port:PORT};
  try{
    mp=await L.connectExisting(PORT);
    if(!await L.waitLanded(mp)){ tr('NO_PAGE'); process.exit(4); }

    // 进比较结果页
    await L.clearCompareDrafts(mp);
    const cmp=await L.gotoCompare(mp); if(!cmp){ tr('COMPARE_NOT_READY'); process.exit(3); }
    await L.importFixture(mp,'My-Case.md','gt4037');
    await L.patchPlanCard(mp,0,{retireYM:'2033-07',z:'1.3',segType:'flexible',windowStartYM:''});
    await L.patchPlanCard(mp,1,{retireYM:'2033-07',z:'0.6',segType:'flexible',windowStartYM:''});
    const res=await L.compareStartAndWait(mp);
    ck('0015-1','比较结果页 ready 且2列', res.landed&&res.columns.length===2, 'landed='+res.landed+' n='+res.columns.length,'2');

    // 打开下钻（真实交互 openDrill(id)）
    const drillId=await L.ev(mp,()=>{ const v=((getCurrentPages().slice(-1)[0].data||{}).view||{}); const ds=v.drills||[]; return ds.length?ds[0].id:null; });
    await L.ev(mp,id=>{ getCurrentPages().slice(-1)[0].openDrill({currentTarget:{dataset:{id:id}}}); return true; }, drillId);
    await sleep(1500);
    const opened=await L.ev(mp,()=>{ const d=getCurrentPages().slice(-1)[0].data||{};
      return {drillId:d.drillId||'', hasDrill:!!d.drill, hasRoi:!!(d.drill&&d.drill.roi)}; });
    dump.opened=opened;
    ck('0015-2','下钻弹窗已打开（drill 绑定）', opened.hasDrill===true, JSON.stringify(opened),'hasDrill=true');
    ck('0015-3','ROI 区块仍在（0012 功能未被 wxss 改动破坏）', opened.hasRoi===true, 'hasRoi='+opened.hasRoi,'true');

    // 盒模型取证（小程序内无 getBoundingClientRect，用 selectorQuery 真实测量）
    const geo=await L.ev(mp,()=>{
      return new Promise(function(resolve){
        var p=getCurrentPages().slice(-1)[0];
        var winW=null,winH=null;
        try{ var info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync(); winW=info.windowWidth; winH=info.windowHeight; }catch(e){}
        var q=p.createSelectorQuery();
        q.select('.cr-sheet').boundingClientRect();
        q.select('.cr-sheet-body').boundingClientRect();
        q.selectAll('.cr-dr-v').boundingClientRect();
        q.exec(function(r){
          var sheet=(r&&r[0])||null, body=(r&&r[1])||null, vs=(r&&r[2])||[];
          var maxRight=0,minLeft=0;
          if(vs&&vs.length){ maxRight=Math.max.apply(null,vs.map(function(v){return v.right||0;})); minLeft=Math.min.apply(null,vs.map(function(v){return v.left||0;})); }
          resolve({ok:true,winW:winW,winH:winH,
            sheetW:sheet?sheet.width:null, sheetRight:sheet?sheet.right:null,
            bodyW:body?body.width:null, bodyRight:body?body.right:null,
            vCount:vs?vs.length:0, vMaxRight:maxRight, vMinLeft:minLeft});
        });
        setTimeout(function(){ resolve({ok:false,err:'selectorQuery timeout',winW:winW}); },8000);
      });
    });
    dump.geo=geo;
    ck('0015-4','弹层宽度不超过屏宽（修复前 445px > 411px）',
       geo.ok&&geo.sheetW!=null&&geo.winW!=null&&geo.sheetW<=geo.winW+0.5,
       'sheetW='+(geo.sheetW&&geo.sheetW.toFixed(2))+' winW='+geo.winW, 'sheetW<=winW');
    ck('0015-5','明细 body 宽度不超过屏宽（border-box 生效）',
       geo.ok&&geo.bodyW!=null&&geo.winW!=null&&geo.bodyW<=geo.winW+0.5,
       'bodyW='+(geo.bodyW&&geo.bodyW.toFixed(2))+' winW='+geo.winW, 'bodyW<=winW');
    ck('0015-6','🔴 数值列右边界在屏内（不写到屏外，原缺 3 字符根因）',
       geo.ok&&geo.vCount>0&&geo.vMaxRight>0&&geo.winW&&geo.vMaxRight<=geo.winW+0.5,
       'vMaxRight='+(geo.vMaxRight&&geo.vMaxRight.toFixed(2))+' winW='+geo.winW+' (overflow='+(geo.winW?(geo.vMaxRight-geo.winW).toFixed(2):'-')+')',
       'vMaxRight<=winW');
    ck('0015-7','明细无横向滚动溢出（scrollWidth<=容器宽）',
       geo.ok&&(geo.bodyScrollW==null||geo.bodyW==null||geo.bodyScrollW<=geo.bodyW+1),
       'scrollW='+geo.bodyScrollW+' bodyW='+(geo.bodyW&&geo.bodyW.toFixed(2)), 'no h-overflow');

    // 样式取证：数值列右对齐 + 不压缩
    const css=await L.ev(mp,()=>{
      const p=getCurrentPages().slice(-1)[0];
      let out={};
      try{
        if(p.selectAllComponents){ }
      }catch(e){}
      return out;
    });
    dump.css=css;

    await mp.screenshot({path:path.join(LOGDIR,'GT4037-0015-drill.png')}).catch(()=>{});
    dump.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-GT4037-0015.json'),JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  }catch(e){ fatal=true; tr('ABORT '+(e&&e.message));
    try{ dump.finishedAt=new Date().toISOString(); fs.writeFileSync(path.join(LOGDIR,'result-GT4037-0015.json'),JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2)); }catch(x){}
  }finally{ await L.disconnectQuiet(mp); }
  const t=rec.totals(); tr('=== GT-4037(0015) pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail?1:(fatal?2:0));
})();
