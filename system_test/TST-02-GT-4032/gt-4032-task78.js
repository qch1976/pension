/* GT-4032 独立 GUI 验收（task-78 / BUG-02-0008 修复验收）
 * 独立单一入口（一 testcase 一入口）；公共逻辑 system_test/common/gui-conn-lib.js（零本 case 期望值）。
 * external 模式：常驻 automator 口 40215 只 connect/disconnect，零 RDP、不杀进程。
 *
 * 交互方式（不依赖 selectAllComponents 子卡选择器——当前基础库该选择器返回 0）：
 *   用户对卡的录入最终都冒泡为 plan-list.onCardChange({detail:{index,patch}})；
 *   卡内 onRetire/onZ/setSegType 仅构造 patch 后 triggerEvent('change')，故直接调父层真实
 *   onCardChange 与真实点选等价（同一 applyPlans/persist 产品路径）。
 *   卡红错 = PM.planErrors(plan,ctx,D)（卡 recheck 调用的同一纯函数），node 侧独立计算取证。
 *
 * case-specific input / 期望（tester 用产品模块独立 derive，非引用上游回显）：
 *   A My-Case(male 1973-07,historyEnd 2026-08)：两卡 retireYM=2035-09（非2026-01）、touched=false、
 *     storage 同、无退休红错、补差异后可开始比较进结果页；
 *   B MyWife(1981-07,paidTo 2025-12，夹具无性别字段默认male)：male=2044-07 不残留2026-01；
 *     共享区正规交互切 female worker=2034-11、cadre=2039-06；
 *   C 脏 draft(2026-01/touched=false) 导入后自愈=2035-09 落 storage；
 *   D retireTouched=true 手选保护：改出生年/再导入均不覆盖手选值，未触碰卡随 ctx；
 *   E 零回归：手工既有路径、三卡增删、开始比较→结果页 P月 有限正值。
 * 产物：logs/result-GT4032-task78.json + 截图（≤3）+ run-trace.log
 * 运行：node gt-4032-task78.js 40215 external 6e8ea72
 */
'use strict';
const fs = require('fs'), path = require('path');
const L = require('../common/gui-conn-lib.js');
const PM = require('../../calculator/planModel.js');
const D = require('../../calculator/dateUtil.js');
const RS = require('../../calculator/retireSchedule.js');

const PORT = parseInt(process.argv[2] || '40215', 10);
const EXTERNAL = process.argv[3] === 'external';
const BASELINE = process.argv[4] || 'unknown';

// storage keys 以 char code 构造（避免字面量在转码/传输中被改写）
const PLANS_KEY = String.fromCharCode(112,101,110,115,105,111,110,95,112,108,97,110,115,95,118,49);
const SHARED_KEY = String.fromCharCode(112,101,110,115,105,111,110,95,99,111,109,112,97,114,101,95,105,110,112,117,116,95,118,49);
const PAYLOAD_KEY = String.fromCharCode(112,101,110,115,105,111,110,95,99,111,109,112,97,114,101,95,112,97,121,108,111,97,100,95,118,49);

const LOGDIR = path.join(__dirname, 'logs');
fs.mkdirSync(LOGDIR, { recursive: true });
const rec = L.makeRecorder();
const checks = [];
function tr(m) { try { fs.appendFileSync(path.join(LOGDIR, 'run-trace.log'), new Date().toISOString() + ' ' + m + '\n'); } catch (e) {} console.log(m); }
function ck(id, title, pass, actual, expected) {
  rec.ck(id, title, pass, actual, expected);
  checks.push({ id, title, pass: !!pass, actual: actual == null ? '' : actual, expected: expected == null ? '' : expected });
  tr((pass ? 'PASS ' : 'FAIL ') + id + ' ' + title + ' :: actual=' + actual + ' expected=' + expected);
}
const sleep = L.sleep;
process.on('unhandledRejection', e => tr('REJ ' + (e && e.message)));
process.on('uncaughtException', e => tr('EXC ' + (e && e.message)));

// tester 独立用产品模块 derive 法定退休月
function statutoryOf(gender, femaleType, birthYM) { return RS.statutoryRetireYM(RS.keyOf(gender, femaleType), birthYM); }
// 卡 recheck 用的同一纯函数 → 红错取证（node 侧，独立采样）
const errsOf = (plan, ctx) => PM.planErrors(plan, ctx, D) || [];
const retireErrs = (plan, ctx) => errsOf(plan, ctx).filter(s => /退休/.test(String(s)));

(async () => {
  let mp = null;
  const dump = { at: new Date().toISOString(), testcase: 'TST-02-GT-4032', task: 'task-78', baseline: BASELINE, port: PORT, scenarios: {}, finishedAt: null };

  // 回读 compare 状态（不选子卡）：page.ctx/plans/storage
  async function readState() {
    return await L.ev(mp, function (k) {
      const p = getCurrentPages().slice(-1)[0];
      const pl = p.selectComponent('#planList');
      let st = null; try { st = wx.getStorageSync(k); } catch (e) {}
      return {
        route: p.route,
        ctx: p.data.ctx,
        plans: pl.getPlans().map(x => ({ retireYM: x.retireYM, retireTouched: !!x.retireTouched, z: x.z, segType: x.segType, windowStartYM: x.windowStartYM })),
        storagePlans: (st && st.plans ? st.plans : []).map(x => ({ retireYM: x.retireYM, retireTouched: !!x.retireTouched }))
      };
    }, PLANS_KEY);
  }
  async function fullReset() {
    await mp.reLaunch('/pages/entry/entry').catch(() => {});
    await sleep(2200);
    await L.ev(mp, function (a, b, c) { [a, b, c].forEach(k => { try { wx.removeStorageSync(k); } catch (e) {} }); return true; }, PLANS_KEY, SHARED_KEY, PAYLOAD_KEY);
    await sleep(300);
  }
  // 对第 idx(0基) 卡下发真实 patch（走 plan-list 真实 onCardChange → applyPlans/persist）
  async function patchCard(idx, patch) {
    await L.ev(mp, function (i, pp) {
      const p = getCurrentPages().slice(-1)[0]; const pl = p.selectComponent('#planList');
      pl.onCardChange({ detail: { index: i + 1, patch: pp } });
      return true;
    }, idx, patch);
    await sleep(700);
  }
  // 触发开始比较并等结果页；返回 {landed, columns}
  async function doStartCompare() {
    await L.ev(mp, () => { getCurrentPages().slice(-1)[0].startCompare(); return true; });
    const t0 = Date.now();
    while (Date.now() - t0 < 25000) {
      const r = await L.ev(mp, () => {
        const p = getCurrentPages().slice(-1)[0];
        if (p.route === 'pages/compare-result/compare-result') {
          const cols = (((p.data || {}).view || {}).columns || []).map(c => ({ P: c.pMonthly, R: c.rContinued, JA: c.jAccount }));
          return { landed: true, columns: cols };
        }
        return { landed: false };
      });
      if (r && r.landed) return r;
      await sleep(800);
    }
    return { landed: false, columns: [] };
  }
  const assertOrThrow = (c, m) => { if (!c) throw new Error(m); };

  try {
    mp = await L.connectExisting(PORT);
    const landed0 = await L.waitLanded(mp); tr('landed=' + landed0);
    assertOrThrow(!!landed0, 'NO_PAGE');

    /* ===== A: 主复现路径 My-Case ===== */
    await fullReset();
    let cmp = await L.gotoCompare(mp); assertOrThrow(cmp, 'A COMPARE_NOT_READY');
    const fA = await L.importFixture(mp, 'My-Case.md', 'task78');
    ck('A1', '真实文件导入 My-Case 成功', !!(fA && String(fA).indexOf('My-Case.md') >= 0), fA, 'fileName~My-Case.md');
    const sA = await readState(); dump.scenarios.A = sA;
    ck('A2', 'ctx.birthYM=1973-07', sA.ctx.birthYM === '1973-07', sA.ctx.birthYM, '1973-07');
    ck('A3', 'ctx.historyEndYM=2026-08', sA.ctx.historyEndYM === '2026-08', sA.ctx.historyEndYM, '2026-08');
    const expA = statutoryOf('male', 'worker', '1973-07');
    ck('A4', '独立 derive male/1973-07=2035-09', expA === '2035-09', expA, '2035-09');
    ck('A5', '卡1 retireYM=2035-09（非2026-01）', sA.plans[0].retireYM === '2035-09', sA.plans[0].retireYM, '2035-09');
    ck('A6', '卡2 retireYM=2035-09（非2026-01）', sA.plans[1].retireYM === '2035-09', sA.plans[1].retireYM, '2035-09');
    ck('A7', '两卡 retireTouched=false（系统重算非手选）', sA.plans.every(p => p.retireTouched === false), JSON.stringify(sA.plans.map(p => p.retireTouched)), 'false,false');
    ck('A8', 'storage pension_plans_v1 两卡=2035-09', sA.storagePlans.length === 2 && sA.storagePlans.every(p => p.retireYM === '2035-09'), JSON.stringify(sA.storagePlans.map(p => p.retireYM)), '2035-09,2035-09');
    // node 侧用同一纯函数独立计算卡红错（真实取证，非读空选择器）
    const rErrA = retireErrs(sA.plans[0], sA.ctx).concat(retireErrs(sA.plans[1], sA.ctx));
    ck('A9', '两卡无“退休过早/早于最后缴费月”红错', rErrA.length === 0, JSON.stringify(rErrA), '[]');
    // 补两卡差异（真实父层 change）
    await patchCard(0, { z: '1.0', segType: 'flexible' });
    await patchCard(1, { z: '2.0', segType: 'enterprise' });
    const sA2 = await readState(); dump.scenarios.A_filled = sA2;
    ck('A10', '两卡补全 z/segType（GUI 真实落库）', sA2.plans[0].segType === 'flexible' && sA2.plans[1].segType === 'enterprise' && sA2.plans[0].z === '1.0' && sA2.plans[1].z === '2.0', sA2.plans.map(p => p.z + '/' + p.segType).join(' ; '), '1.0/flexible ; 2.0/enterprise');
    ck('A11', '两卡 isValidPlan 均 true', sA2.plans.every(p => PM.isValidPlan(p, sA2.ctx, D)), sA2.plans.map(p => PM.isValidPlan(p, sA2.ctx, D)).join(','), 'true,true');
    const resA = await doStartCompare();
    ck('A12', '可正常开始比较 → 进入 compare-result 结果页', resA.landed === true && resA.columns.length >= 2, 'landed=' + resA.landed + ' cols=' + resA.columns.length, 'landed, cols>=2');
    await mp.screenshot({ path: path.join(LOGDIR, 'GT4032-A-mycase.png') }).catch(() => {});

    /* ===== B: MyWife 女性档 ===== */
    await fullReset();
    cmp = await L.gotoCompare(mp); assertOrThrow(cmp, 'B COMPARE_NOT_READY');
    const fB = await L.importFixture(mp, 'MyWife-Case.md', 'wife78');
    ck('B1', '真实文件导入 MyWife-Case 成功', !!(fB && String(fB).indexOf('MyWife-Case.md') >= 0), fB, 'fileName~MyWife-Case.md');
    const sBm = await readState(); dump.scenarios.B_male = sBm;
    const expBm = statutoryOf('male', 'worker', '1981-07');
    ck('B2', '导入默认 male/1981-07 retireYM=' + expBm + '（不残留2026-01）', sBm.plans.every(p => p.retireYM === expBm && p.retireYM !== '2026-01'), sBm.plans.map(p => p.retireYM).join(','), expBm);
    await L.ev(mp, () => { const p = getCurrentPages().slice(-1)[0]; p.selectComponent('#sharedData').setGender({ currentTarget: { dataset: { v: 'female' } } }); return true; });
    await sleep(200);
    await L.ev(mp, () => { const p = getCurrentPages().slice(-1)[0]; p.selectComponent('#sharedData').setFemaleType({ currentTarget: { dataset: { v: 'worker' } } }); return true; });
    await sleep(200);
    await L.ev(mp, () => { getCurrentPages().slice(-1)[0].syncCtx(); return true; });
    await sleep(1000);
    const sBf = await readState(); dump.scenarios.B_female_worker = sBf;
    const expBf = statutoryOf('female', 'worker', '1981-07');
    ck('B3', '独立 derive female/worker/1981-07=2034-11', expBf === '2034-11', expBf, '2034-11');
    ck('B4', 'female/worker 两卡 retireYM=2034-11 不残留2026-01', sBf.plans.every(p => p.retireYM === '2034-11'), sBf.plans.map(p => p.retireYM).join(','), '2034-11');
    ck('B5', 'female worker 两卡无退休红错', retireErrs(sBf.plans[0], sBf.ctx).concat(retireErrs(sBf.plans[1], sBf.ctx)).length === 0, 'see node planErrors', '[]');
    await L.ev(mp, () => { const p = getCurrentPages().slice(-1)[0]; p.selectComponent('#sharedData').setFemaleType({ currentTarget: { dataset: { v: 'cadre' } } }); return true; });
    await sleep(200);
    await L.ev(mp, () => { getCurrentPages().slice(-1)[0].syncCtx(); return true; });
    await sleep(1000);
    const sBc = await readState(); dump.scenarios.B_female_cadre = sBc;
    const expBc = statutoryOf('female', 'cadre', '1981-07');
    ck('B6', 'female/cadre 两卡 retireYM=' + expBc, sBc.plans.every(p => p.retireYM === expBc), sBc.plans.map(p => p.retireYM).join(','), expBc);
    await mp.screenshot({ path: path.join(LOGDIR, 'GT4032-B-mywife.png') }).catch(() => {});

    /* ===== C: 脏 draft 自愈 ===== */
    await fullReset();
    const dirty = { plans: [
      { retireYM: '2026-01', retireTouched: false, z: '', segType: '', windowStartYM: '' },
      { retireYM: '2026-01', retireTouched: false, z: '', segType: '', windowStartYM: '' }
    ] };
    await L.injectStorage(mp, PLANS_KEY, dirty);
    cmp = await L.gotoCompare(mp); assertOrThrow(cmp, 'C COMPARE_NOT_READY');
    const sCd = await readState(); dump.scenarios.C_dirty = sCd;
    ck('C1', '脏 draft 进入 compare 两卡=2026-01（缺陷态存在）', sCd.plans.every(p => p.retireYM === '2026-01'), sCd.plans.map(p => p.retireYM).join(','), '2026-01');
    await L.importFixture(mp, 'My-Case.md', 'c78');
    const sCh = await readState(); dump.scenarios.C_healed = sCh;
    ck('C2', '导入后两卡自愈=2035-09', sCh.plans.every(p => p.retireYM === '2035-09' && p.retireTouched === false), sCh.plans.map(p => p.retireYM + '/' + p.retireTouched).join(','), '2035-09/false');
    ck('C3', '自愈结果落 storage 两卡=2035-09', sCh.storagePlans.length === 2 && sCh.storagePlans.every(p => p.retireYM === '2035-09'), JSON.stringify(sCh.storagePlans.map(p => p.retireYM)), '2035-09');

    /* ===== D: 手选保护 ===== */
    await fullReset();
    cmp = await L.gotoCompare(mp); assertOrThrow(cmp, 'D COMPARE_NOT_READY');
    await L.importFixture(mp, 'My-Case.md', 'd78');
    const MANUAL = '2035-03';
    await patchCard(0, { retireYM: MANUAL, retireTouched: true });
    const sD0 = await readState(); dump.scenarios.D_touched = sD0;
    ck('D1', '卡1 手选 retireYM=' + MANUAL + ' 且 retireTouched=true', sD0.plans[0].retireYM === MANUAL && sD0.plans[0].retireTouched === true, sD0.plans[0].retireYM + '/' + sD0.plans[0].retireTouched, MANUAL + '/true');
    ck('D1b', '手选合法值无退休红错', retireErrs(sD0.plans[0], sD0.ctx).length === 0, JSON.stringify(retireErrs(sD0.plans[0], sD0.ctx)), '[]');
    await L.ev(mp, () => { const p = getCurrentPages().slice(-1)[0]; p.selectComponent('#sharedData').onBirth({ detail: { value: '1974-07' } }); return true; });
    await sleep(200);
    await L.ev(mp, () => { getCurrentPages().slice(-1)[0].syncCtx(); return true; });
    await sleep(1000);
    const sD1 = await readState(); dump.scenarios.D_birthChange = sD1;
    const expD1 = statutoryOf('male', 'worker', '1974-07');
    ck('D2', '改出生年后 手选卡仍=' + MANUAL, sD1.plans[0].retireYM === MANUAL && sD1.plans[0].retireTouched === true, sD1.plans[0].retireYM, MANUAL);
    ck('D3', '改出生年后 未触碰卡2=' + expD1, sD1.plans[1].retireYM === expD1 && sD1.plans[1].retireTouched === false, sD1.plans[1].retireYM, expD1);
    await L.importFixture(mp, 'My-Case.md', 'd78b');
    const sD2 = await readState(); dump.scenarios.D_reimport = sD2;
    ck('D4', '再导入后 手选卡仍=' + MANUAL, sD2.plans[0].retireYM === MANUAL && sD2.plans[0].retireTouched === true, sD2.plans[0].retireYM, MANUAL);
    ck('D5', '再导入后 未触碰卡2=2035-09', sD2.plans[1].retireYM === '2035-09' && sD2.plans[1].retireTouched === false, sD2.plans[1].retireYM, '2035-09');

    /* ===== E: 零回归 ===== */
    await fullReset();
    cmp = await L.gotoCompare(mp); assertOrThrow(cmp, 'E COMPARE_NOT_READY');
    await L.ev(mp, () => { const p = getCurrentPages().slice(-1)[0]; p.selectComponent('#sharedData').onBirth({ detail: { value: '1973-07' } }); return true; });
    await sleep(200);
    await L.ev(mp, () => { getCurrentPages().slice(-1)[0].syncCtx(); return true; });
    await sleep(1000);
    const sEm = await readState(); dump.scenarios.E_manual = sEm;
    ck('E1', '手工既有路径 两卡 retireYM=2035-09（演示2026-01被纠正）', sEm.plans.every(p => p.retireYM === '2035-09'), sEm.plans.map(p => p.retireYM).join(','), '2035-09');
    await L.ev(mp, () => { const p = getCurrentPages().slice(-1)[0]; p.selectComponent('#planList').addPlan(); return true; });
    await sleep(800);
    const sE3 = await readState(); dump.scenarios.E_threeCards = sE3;
    ck('E2', '新增第3卡 count=3', sE3.plans.length === 3, sE3.plans.length, '3');
    ck('E3', '第3卡 emptyPlan 带正确法定 retireYM=2035-09', sE3.plans[2].retireYM === '2035-09', sE3.plans[2].retireYM, '2035-09');
    await L.ev(mp, () => { const p = getCurrentPages().slice(-1)[0]; p.selectComponent('#planList').removePlan({ detail: { index: 3 } }); return true; });
    await sleep(800);
    const sE2 = await readState();
    ck('E4', '删除第3卡后 count=2', sE2.plans.length === 2, sE2.plans.length, '2');
    // 手工仅出生年【无历史】时 startCompare 会被 buildValidatedInput 正确拦截
    // （probe3 实测 builtOk=false “请填写年缴费基数”，不跳转，属正确校验非回归）。
    // 此处补全真实历史（导入 common），再验手工建卡→结果计算不回归：
    const fE = await L.importFixture(mp, 'My-Case.md', 'e78');
    ck('E4b', '补全历史：再导入 My-Case common 成功', !!(fE && String(fE).indexOf('My-Case.md') >= 0), fE, 'My-Case.md');
    await patchCard(0, { z: '1.0', segType: 'flexible' });
    await patchCard(1, { z: '2.0', segType: 'enterprise' });
    const resE = await doStartCompare(); dump.scenarios.E_result = resE;
    const finiteP = resE.columns.length >= 2 && resE.columns.every(c => isFinite(Number(c.P)) && Number(c.P) > 0);
    ck('E5', '手工建卡+补全历史 开始比较→结果页 两列 P月 有限正值（计算不回归）', resE.landed && finiteP, 'landed=' + resE.landed + ' P=' + resE.columns.map(c => c.P).join(','), 'finite positive');
    await mp.screenshot({ path: path.join(LOGDIR, 'GT4032-E-result.png') }).catch(() => {});

    dump.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR, 'result-GT4032-task78.json'), JSON.stringify(Object.assign({}, dump, { checks }), null, 2));
  } catch (e) {
    tr('ABORT ' + (e && e.message));
    try { dump.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(LOGDIR, 'result-GT4032-task78.json'), JSON.stringify(Object.assign({}, dump, { aborted: String(e && e.message), checks }), null, 2)); } catch (x) {}
  } finally {
    await L.disconnectQuiet(mp);
  }
  const t = rec.totals();
  tr('=== GT-4032(task-78) pass=' + t.pass + ' fail=' + t.fail + ' ===');
  process.exit(t.fail ? 1 : 0);
})();
