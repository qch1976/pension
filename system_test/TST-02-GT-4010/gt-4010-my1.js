/* GT-4010 独立 GUI 验收（task-79 重建 · my1）
 * 单一入口；公共逻辑 ../common/gui-conn-lib.js + st-case-lib.js（零本 case 值）。
 * external：常驻 automator 口 40215 只 connect/disconnect，零 RDP。
 *
 * case-specific input：docs/customer_usecases/My-Case.md 的 common 块（basic 模式仅允许单数据块）。
 * 链路（项目主 2026-10-28 裁定 B）：清 pension_input_v1 → reLaunch basic(index) → 真实文件导入 common →
 *   经真实退休 picker 显式选定法定 2035-09（onRetire，非 setData 注入；导入后直 onCalculate 非受支持流程）→
 *   真实 onCalculate → result 页。
 * 期望（tester 本次独立重算，不引用 README 11228.94/旧 summary）：
 *   导入成功、结果页 ready、P月/三分项为有限值；GUI 结果与 node 侧 st-case-lib→Engine 独立重算一致（<0.01）。
 * 产物：logs/result-GT4010.json + GT4010.png；运行 node gt-4010-my1.js 40215 external 2a61e71
 */
'use strict';
const fs = require('fs'), path = require('path');
const L = require('../common/gui-conn-lib.js');
const stlib = require('../common/st-case-lib.js');
const Engine = require('../../calculator/pensionEngine.js');

const PORT = parseInt(process.argv[2] || '40215', 10);
const BASELINE = process.argv[4] || 'unknown';
const FIXTURE = 'My-Case.md';
const BASIC_DRAFT = 'pension_input_v1';

const LOGDIR = path.join(__dirname, 'logs');
fs.mkdirSync(LOGDIR, { recursive: true });
const rec = L.makeRecorder();
function tr(m){ try { fs.appendFileSync(path.join(LOGDIR,'run-trace.log'), new Date().toISOString()+' '+m+'\n'); } catch(e){} console.log(m); }
function ck(id,title,pass,actual,expected){ rec.ck(id,title,pass,actual,expected); tr((pass?'PASS ':'FAIL ')+id+' '+title+' :: actual='+actual+' expected='+expected); }
const sleep = L.sleep;
process.on('unhandledRejection', e => tr('REJ '+(e&&e.message)));
process.on('uncaughtException', e => tr('EXC '+(e&&e.message)));

const round2 = n => Math.round(Number(n) * 100) / 100;
const close2 = (a,b) => isFinite(Number(a)) && isFinite(Number(b)) && Math.abs(Number(a)-Number(b)) < 0.01;

(async () => {
  let mp = null;
  let fatal = false;
  const dump = { at: new Date().toISOString(), testcase:'TST-02-GT-4010', tag:'my1', baseline:BASELINE, port:PORT, gui:null, node:null };
  try {
    mp = await L.connectExisting(PORT);
    const landed0 = await L.waitLanded(mp); tr('landed='+landed0);
    if (!landed0) { tr('NO_PAGE'); process.exit(4); }

    // 干净 baseline：reLaunch basic 页并清 basic 草稿
    await mp.reLaunch('/pages/index/index').catch(()=>{});
    await sleep(2500);
    await L.ev(mp, k => { try { wx.removeStorageSync(k); } catch(e){} return true; }, BASIC_DRAFT);
    await sleep(300);

    // 真实文件导入 common（importFixture 自带切 file 模式 + mock chooseMessageFile + onChooseCaseFile）
    const fileName = await L.importFixture(mp, FIXTURE, 'gt4010');
    tr('imported='+fileName);
    ck('4010-1','真实文件导入 My-Case common 成功', !!(fileName && String(fileName).indexOf(FIXTURE)>=0), fileName, FIXTURE);

    // 项目主裁定 B：basic 文件导入后须经真实退休 picker 显式选定（onRetire=picker bindchange 处理器）。
    const EXP_RETIRE = '2035-09';
    await L.ev(mp, rv => { getCurrentPages().slice(-1)[0].onRetire({ detail: { value: rv } }); return true; }, EXP_RETIRE);
    await sleep(800);
    const retireSet = await L.ev(mp, () => getCurrentPages().slice(-1)[0].data.retireYM);
    ck('4010-1b','真实退休 picker 显式选定法定 '+EXP_RETIRE+'（非 setData 注入）', retireSet === EXP_RETIRE, retireSet, EXP_RETIRE);

    // 真实触发产品 onCalculate（异步跳转结果页）
    await L.ev(mp, () => { getCurrentPages().slice(-1)[0].onCalculate(); return true; });
    const rs = await L.waitCurrentReady(mp, 'pages/result/result', d => d.ready === true && !!d.r, 45000);
    if (!rs.ok) { tr('RESULT_NOT_READY path='+rs.path); }
    ck('4010-2','结果页渲染 ready（非白屏/报错）', rs.ok === true, 'path='+rs.path, 'pages/result/result');

    let guiP = null;
    if (rs.ok) {
      guiP = {
        total: rs.data.r.pension.total, J基础: rs.data.r.pension.J基础,
        J账户: rs.data.r.pension.J账户, J过渡: rs.data.r.pension.J过渡
      };
    }
    dump.gui = guiP;
    ck('4010-3','GUI P月(total) 有限正值', !!guiP && isFinite(guiP.total) && guiP.total > 0, guiP && guiP.total, 'finite >0');
    ck('4010-4','GUI 三分项均为有限非负值', !!guiP && [guiP.J基础,guiP.J账户,guiP.J过渡].every(v => isFinite(v) && v >= 0),
       guiP && [round2(guiP.J基础),round2(guiP.J账户),round2(guiP.J过渡)].join('/'), 'finite >=0');
    ck('4010-5','GUI 三分项之和=P月（勾稽）', !!guiP && close2(Number(guiP.J基础)+Number(guiP.J账户)+Number(guiP.J过渡), guiP.total),
       guiP && round2(Number(guiP.J基础)+Number(guiP.J账户)+Number(guiP.J过渡)), guiP && round2(guiP.total));

    // node 侧独立重算（parseFixture→buildInputLike 与页面同构输入；Engine.calculate）
    const fx = stlib.parseFixture(FIXTURE);
    const input = stlib.engineInputFromParsed(fx.parsed);
    input.retireYM = '2035-09'; // 与 GUI 显式选定一致
    const nr = Engine.calculate(input);
    const nodeP = { total: nr.pension.total, J基础: nr.pension.J基础, J账户: nr.pension.J账户, J过渡: nr.pension.J过渡 };
    dump.node = nodeP;
    ck('4010-6','node 独立重算 P月 有限正值', isFinite(nodeP.total) && nodeP.total>0, nodeP.total, 'finite >0');

    ck('4010-7','GUI 与 node P月一致', !!guiP && close2(guiP.total, nodeP.total), guiP && round2(guiP.total), round2(nodeP.total));
    ck('4010-8','GUI 与 node 三分项一致',
       !!guiP && close2(guiP.J基础,nodeP.J基础) && close2(guiP.J账户,nodeP.J账户) && close2(guiP.J过渡,nodeP.J过渡),
       guiP && [round2(guiP.J基础),round2(guiP.J账户),round2(guiP.J过渡)].join('/'),
       [round2(nodeP.J基础),round2(nodeP.J账户),round2(nodeP.J过渡)].join('/'));

    await mp.screenshot({ path: path.join(LOGDIR,'GT4010.png') }).catch(()=>{});
    dump.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR,'result-GT4010.json'), JSON.stringify(Object.assign({},dump,{checks:rec.list}),null,2));
  } catch (e) {
    fatal = true;
    tr('ABORT '+(e&&e.message));
    try { dump.finishedAt=new Date().toISOString(); fs.writeFileSync(path.join(LOGDIR,'result-GT4010.json'), JSON.stringify(Object.assign({},dump,{aborted:String(e&&e.message),checks:rec.list}),null,2)); } catch(x){}
  } finally {
    await L.disconnectQuiet(mp);
  }
  const t = rec.totals();
  tr('=== GT-4010(my1) pass='+t.pass+' fail='+t.fail+' ===');
  process.exit(t.fail ? 1 : (fatal ? 2 : 0));
})();
