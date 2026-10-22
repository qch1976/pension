/* t47-c-planstart.js — ② plan-card 缴费起始月"像素闭环"（真实 picker change，非 onCardChange 注入）
 * argv[2]=port argv[3]=fixtureFile argv[4]=tag [argv[5]=external]
 * 单连接完成：清draft → entry → compare → 真实文件导入 → #planList 下钻 plan-card
 *  缺省起始月(历史末月+1)断言 → 真实 picker(fields=month) 的 change 事件改月 → 逐卡回读
 *  数据双轨：真实 DOM（.plan-card picker[1] 文本/value、.plan-err） + 全路径组件实例 + 父层 plans
 */
'use strict';
const fs = require('fs'), path = require('path'), net = require('net'), cp = require('child_process');
const PORT = parseInt(process.argv[2] || '40215', 10);
const FIX = process.argv[3] || 'My-Case.md';
const TAG = process.argv[4] || 'my';
const EXTERNAL = process.argv[5] === 'external';
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const SDK = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const CARD_SEL = '/components/plan-card/plan-card';
const OUT = path.join(PROJECT, 'autotest', 'output', 't47');
fs.mkdirSync(OUT, { recursive: true });
const TRACE = path.join(OUT, 'c-' + TAG + '-trace.log');
const SUM = path.join(OUT, 'c-' + TAG + '-summary.json');
function tr(m){ try{ fs.appendFileSync(TRACE, new Date().toISOString()+' '+m+'\n'); }catch(e){} console.log(m); }
const automator = require(SDK);
const sleep = ms => new Promise(r => setTimeout(r, ms));
process.on('unhandledRejection', e => tr('REJ ' + (e && e.message)));
process.on('uncaughtException', e => tr('EXC ' + (e && e.message)));
function discoverCli(){ const root='C:\\Program Files (x86)\\Tencent'; for(const d of fs.readdirSync(root)){ const c=path.join(root,d,'cli.bat'); if(fs.existsSync(c)) return c; } }
function portUp(p){ return new Promise(res => { const s=net.createConnection({port:p,host:'127.0.0.1'}); const d=v=>{try{s.destroy();}catch(e){}res(v);}; s.once('connect',()=>d(true)); s.once('error',()=>d(false)); setTimeout(()=>d(false),1000); }); }
async function waitPort(p,ms){ const t=Date.now(); while(Date.now()-t<ms){ if(await portUp(p)) return true; await sleep(1500); } return false; }
async function ev(mp,fn){ for(let i=0;i<5;i++){ try{ return await mp.evaluate(fn); }catch(e){ await sleep(700); } } return null; }
function commonBlock(raw){ const lines=raw.replace(/\r\n/g,'\n').split('\n'); const out=[]; for(let i=1;i<lines.length;i++){ if(lines[i].trim().indexOf('```')===0) break; out.push(lines[i]); } return out.join('\n'); }
function addMonths(ym,delta){ const [y,m]=ym.split('-').map(Number); let t=y*12+(m-1)+delta; return Math.floor(t/12)+'-'+String((t%12)+1).padStart(2,'0'); }

const checks=[]; const ck=(n,ok,x)=>{checks.push({name:n,ok:!!ok,extra:x==null?'':String(x)}); tr((ok?'PASS ':'FAIL ')+n+(x?' :: '+x:''));};

(async () => {
  let ch=null;
  if(!EXTERNAL){
    const cli=discoverCli();
    ch=cp.spawn('"'+cli+'" auto --project "'+PROJECT+'" --auto-port '+PORT,{shell:true,stdio:'ignore',windowsHide:true});
    await sleep(8000);
  } else { tr('external cli mode port='+PORT); await sleep(300); }
  if(!(await waitPort(PORT,120000))){ tr('PORT_NOT_UP'); process.exit(2); }
  const mp = await automator.connect({ wsEndpoint:'ws://127.0.0.1:'+PORT });
  const dump={ fixture:FIX, tag:TAG, port:PORT, at:new Date().toISOString(), cards:[], fired:[] };
  try {
    let landed=null; const tL=Date.now();
    while(Date.now()-tL<90000){ try{ const p=await mp.currentPage(); if(p&&p.path){landed=p.path;break;} }catch(e){} await sleep(2000); }
    tr('landed='+landed);
    if(!landed){ tr('NO_PAGE'); process.exit(4); }

    // 干净基线：回到 entry 并清除方案草稿，确保 plan-list 用 initialPlans(2张) 且 windowStartYM 全空
    await mp.reLaunch('/pages/entry/entry').catch(()=>{}); await sleep(2500);
    await ev(mp,()=>{ try{wx.removeStorageSync('pension_plans_v1');}catch(e){} return true; });
    await sleep(300);

    await ev(mp,()=>{ getCurrentPages().slice(-1)[0].goCompare(); return true; });
    let cmp=false;
    for(let i=0;i<24;i++){ const c=await ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0]; return p&&p.route==='pages/compare/compare'&&p.selectComponent('#planList')?true:null; }); if(c){cmp=true;break;} await sleep(1200); }
    tr('compare='+cmp);
    if(!cmp){ tr('COMPARE_NOT_READY'); process.exit(3); }
    await sleep(1000);

    // 真实文件导入（USER_DATA_PATH 真实文件 + chooseMessageFile mock 同历史口径）
    for(let k=0;k<6;k++){ await ev(mp,()=>{ getCurrentPages().slice(-1)[0].setInputMode({currentTarget:{dataset:{v:'file'}}}); return true; }); await sleep(400); if(await ev(mp,()=>getCurrentPages().slice(-1)[0].data.inputMode)==='file') break; }
    const fixtureRaw=fs.readFileSync(path.join(PROJECT,'docs',FIX),'utf8');
    const common=commonBlock(fixtureRaw), rel='t47-c-'+TAG+'.txt';
    await mp.evaluate((r,txt)=>new Promise((res,rej)=>{ wx.getFileSystemManager().writeFile({filePath:wx.env.USER_DATA_PATH+'/'+r,data:txt,encoding:'utf8',success:res,fail:rej}); }),rel,common);
    const udp=await mp.evaluate(()=>wx.env.USER_DATA_PATH);
    const abs=(''+udp).replace(/[\\/]+$/,'')+'/'+rel;
    await mp.mockWxMethod('chooseMessageFile',{errMsg:'chooseMessageFile:ok',tempFiles:[{path:abs,name:FIX,size:Buffer.byteLength(common),createTime:Math.floor(Date.now()/1000)}]});
    await ev(mp,()=>{ getCurrentPages().slice(-1)[0].onChooseCaseFile(); return true; });
    await sleep(4000);
    await mp.restoreWxMethod('chooseMessageFile').catch(()=>{});
    dump.fileName=await ev(mp,()=>getCurrentPages().slice(-1)[0].data.fileName);
    tr('imported fileName='+dump.fileName);
    await sleep(1000);

    const ctxInfo=await ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0]; const pl=p.selectComponent('#planList'); return { ctx:p.data.ctx, planCount:(pl.data.plans||[]).length, plans:pl.getPlans().map(x=>({windowStartYM:x.windowStartYM,retireYM:x.retireYM,z:x.z,segType:x.segType})) }; });
    tr('ctx='+JSON.stringify(ctxInfo.ctx)+' count='+ctxInfo.planCount);
    dump.ctx=ctxInfo.ctx; dump.beforePlans=ctxInfo.plans;
    ck('真实文件导入成功 fileName 含 '+FIX, !!(dump.fileName&&String(dump.fileName).indexOf(FIX)>=0), dump.fileName);
    ck('共享上下文 historyEndYM 合法', /^\d{4}-\d{2}$/.test((ctxInfo.ctx||{}).historyEndYM||''), ctxInfo.ctx&&ctxInfo.ctx.historyEndYM);
    const N=ctxInfo.planCount;
    const expectDefault=addMonths(ctxInfo.ctx.historyEndYM,1);
    dump.defaultExpect=expectDefault;
    const LEGAL = TAG==='wife' ? '2026-01' : '2026-10';
    dump.legal=LEGAL;

    // 等子卡就绪：全路径组件实例数 == DOM .plan-card 数 == plans.length，且实例 startText 非空
    let ready=false;
    for(let w=0;w<24;w++){
      ready=await ev(mp,(sel,n)=>{ const p=getCurrentPages().slice(-1)[0];const pl=p.selectComponent('#planList');
        let cs=[]; try{cs=pl.selectAllComponents(sel)||[];}catch(e){cs=[];}
        return cs.length===n && n>0 && !!(cs[0].data.startText);
      },CARD_SEL,N);
      if(ready) break; await sleep(600);
    }
    tr('cardsReady='+ready+' (N='+N+')');
    ck('plan-card 子组件实例就绪(全路径选择器) count='+N, ready, 'ready='+ready);

    const pageEl=await mp.currentPage();
    async function domCards(){ const plEl=await pageEl.$('#planList'); return await plEl.$$('.plan-card'); }
    let dc0=await domCards();
    tr('DOM .plan-card='+(dc0?dc0.length:'null'));
    ck('真实 DOM .plan-card 节点数='+N, !!(dc0&&dc0.length===N), dc0?dc0.length:'null');

    for(let i=0;i<N;i++){
      // before：实例 + 真实 DOM picker
      const before=await ev(mp,(sel,idx)=>{ const p=getCurrentPages().slice(-1)[0];const pl=p.selectComponent('#planList');const c=pl.selectAllComponents(sel)[idx];
        return { windowStartYM:c.data.plan.windowStartYM, startText:c.data.startText, errors:c.data.errors }; },CARD_SEL,i);
      let cards=await domCards(); let picks=await cards[i].$$('picker'); const domStartText=((await picks[1].text()).replace(/[›\s]+$/,'')).trim();
      const domStartValue=await picks[1].attribute('value');
      tr('card'+(i+1)+' before inst='+JSON.stringify(before)+' domText='+JSON.stringify(domStartText)+' domValue='+JSON.stringify(domStartValue));
      ck('卡'+(i+1)+' 缺省 windowStartYM 为空(动态缺省)', before.windowStartYM==='', String(before.windowStartYM));
      ck('卡'+(i+1)+' 缺省起始月 startText='+expectDefault, before.startText===expectDefault, before.startText);
      ck('卡'+(i+1)+' 真实DOM起始picker显示='+expectDefault, domStartText===expectDefault, domStartText);

      // 真实 picker change（卡片自身 bindchange=onWindowStart；非 plan-list onCardChange）
      await picks[1].triggerEvent('change',{detail:{value:LEGAL}});
      await sleep(700);

      const after=await ev(mp,(sel,idx)=>{ const p=getCurrentPages().slice(-1)[0];const pl=p.selectComponent('#planList');const c=pl.selectAllComponents(sel)[idx];
        return { windowStartYM:c.data.plan.windowStartYM, startText:c.data.startText, errors:c.data.errors, parentVal:pl.data.plans[idx].windowStartYM }; },CARD_SEL,i);
      cards=await domCards(); picks=await cards[i].$$('picker');
      const domAfterText=((await picks[1].text()).replace(/[›\s]+$/,'')).trim();
      const errs=await cards[i].$$('.plan-err'); const errTexts=[]; for(let e2=0;e2<errs.length;e2++) errTexts.push((await errs[e2].text()).trim());
      tr('card'+(i+1)+' after inst='+JSON.stringify(after)+' domText='+JSON.stringify(domAfterText)+' planErr='+JSON.stringify(errTexts));
      ck('卡'+(i+1)+' [真实picker change] 卡plan.windowStartYM='+LEGAL, after.windowStartYM===LEGAL, after.windowStartYM);
      ck('卡'+(i+1)+' 父层 plans['+i+'].windowStartYM 同步='+LEGAL, after.parentVal===LEGAL, after.parentVal);
      ck('卡'+(i+1)+' 真实DOM起始picker显示='+LEGAL, domAfterText===LEGAL, domAfterText);
      const hasStartErr=(after.errors||[]).some(s=>/缴费起始时间/.test(s))||errTexts.some(s=>/缴费起始时间/.test(s));
      ck('卡'+(i+1)+' 合法起始月无起始时间红字', !hasStartErr, JSON.stringify({inst:after.errors,dom:errTexts}));
      dump.cards.push({i:i+1,before,after,domStartText,domAfterText,domErr:errTexts,fired:'picker.triggerEvent(change)'});
    }

    // PM 层独立判定：起始月本身不引入错误
    const validity=await ev(mp,()=>{ const p=getCurrentPages().slice(-1)[0];const pl=p.selectComponent('#planList');const PM=require('/calculator/planModel.js');const D=require('/calculator/dateUtil.js');
      return pl.getPlans().map(x=>({windowStartYM:x.windowStartYM,startErrs:(PM.planErrors(x,p.data.ctx,D)||[]).filter(s=>/缴费起始时间/.test(s)),isValid:PM.isValidPlan(x,p.data.ctx,D)})); });
    dump.validity=validity; tr('validity='+JSON.stringify(validity));
    validity.forEach((v,i)=>ck('卡'+(i+1)+' PM.planErrors 无起始月错误',(v.startErrs||[]).length===0,JSON.stringify(v.startErrs)));

    await mp.screenshot({path:path.join(OUT,'c-'+TAG+'-planstart.png')}).catch(()=>{});
    fs.writeFileSync(SUM,JSON.stringify({at:dump.at,head:'b64f5d6',fixture:FIX,ctx:dump.ctx,cardCount:N,defaultExpect:expectDefault,legal:LEGAL,cards:dump.cards,validity,checks},null,2));
  } finally {
    try{await mp.disconnect();}catch(e){}
    if(!EXTERNAL){ try{ch.kill();}catch(e){} try{cp.exec('powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort '+PORT+' -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"');}catch(e){} }
  }
  const fail=checks.filter(c=>!c.ok).length;
  tr('=== C('+TAG+') pass='+(checks.length-fail)+'/'+checks.length+' fail='+fail+' ===');
  process.exit(fail?1:0);
})();
