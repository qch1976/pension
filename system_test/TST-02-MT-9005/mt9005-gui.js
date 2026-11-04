/* TST-02-MT-9005 独立 GUI 取证（task-105 · BUG-02-0019 fixed 非终态 · 夹具 e7-wife4.txt / 1981-07 女）
 * tester worker4 独立取证，不引用 developer 回显；项目主本人再次手测通过后才转 PASS/closed。
 * 走真实用户路径：文件导入 → 界面性别/身份切换(setGender/setFemaleType/setSharedCtx) → 方案卡 onCardChange → startCompare。
 * 放行/拦截 GUI 判定 = startCompare 是否真跳 pages/compare-result；卡红错文案用卡 recheck 同一纯函数
 *   PM.planErrors 独立 node 取证（当前基础库 selectAllComponents 子卡选择器返回 0，沿用 GT-4032 既定法）。
 * 截图 ≤3。产物 logs/。
 */
'use strict';
const fs = require('fs'), path = require('path');
const L = require('../common/gui-conn-lib.js');
const PM = require('../../calculator/planModel.js');
const D = require('../../calculator/dateUtil.js');

const PORT = parseInt(process.argv[2] || '40215', 10);
const BASELINE = process.argv[4] || 'unknown';
const FIXTURE = 'e7-wife4.txt';
const BIRTH = '1981-07';
const LOGDIR = path.join(__dirname, 'logs');
fs.mkdirSync(LOGDIR, { recursive: true });
const rec = L.makeRecorder();
const sleep = L.sleep;
const tr = m => { try { fs.appendFileSync(path.join(LOGDIR, 'run-trace.log'), new Date().toISOString() + ' ' + m + '\n'); } catch (e) {} console.log(m); };
const ck = (id, t, pass, a, e) => { rec.ck(id, t, pass, a, e); tr((pass ? 'PASS ' : 'FAIL ') + id + ' ' + t + ' :: actual=' + a + ' expected=' + e); };
let mpCtx = null;
const evSure = async (fn, ...a) => {
  let r;
  for (let k = 0; k < 6; k++) { r = await L.ev(mpCtx, fn, ...a); if (r !== null && r !== undefined) return r; await sleep(800); }
  throw new Error('EVAL_NULL_PERSIST');
};
// reLaunch 偶尔 settle 到 entry：在 entry 走真实 goBasic 回 index 再轮询 keys>5。
const ensureIndex = async (tag) => {
  const t0 = Date.now();
  while (Date.now() - t0 < 45000) {
    let cp = null; try { cp = await mpCtx.currentPage(); } catch (e) {}
    if (cp && cp.path === 'pages/index/index') {
      let dd = null; try { dd = await cp.data(); } catch (e) {}
      if (dd && Object.keys(dd).length > 5) return { ok: true, route: 'pages/index/index', tag };
    } else if (cp && cp.path === 'pages/entry/entry') {
      await L.ev(mpCtx, () => { const p = getCurrentPages().slice(-1)[0]; if (typeof p.goBasic === 'function') p.goBasic(); return true; });
    } else { await mpCtx.reLaunch('/pages/index/index').catch(() => {}); }
    await sleep(1200);
  }
  throw new Error('ENSURE_INDEX_TIMEOUT@' + tag);
};
// 卡退休红错（卡 recheck 同一纯函数，node 侧独立取值）
const retireErrs = (plan, ctx) => (PM.planErrors(plan, ctx, D) || []).filter(s => /退休/.test(String(s)));
// 等停回 compare 页且 #planList 就绪（startCompare 跳结果后 navigateBack 用）
const waitCompareReady = async (tag) => {
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const r = await L.ev(mpCtx, () => { const p = getCurrentPages().slice(-1)[0];
      return { route: p.route, ok: !!(p.route === 'pages/compare/compare' && p.selectComponent('#planList')) }; });
    if (r && r.route === 'pages/compare/compare' && r.ok) { await sleep(600); return true; }
    await sleep(800);
  }
  throw new Error('COMPARE_NOT_READY@' + tag);
};
process.on('unhandledRejection', e => tr('REJ ' + (e && e.message)));
process.on('uncaughtException', e => tr('EXC ' + (e && e.message)));

(async () => {
  let mp = null, fatal = false;
  const dump = { at: new Date().toISOString(), testcase: 'TST-02-MT-9005', requirement: 'REQ-02-CAL-000',
    bug: 'BUG-02-0019', mode: 'gui-evidence-fixed-not-closed', baseline: BASELINE, port: PORT, fixture: FIXTURE };
  try {
    mp = await L.connectExisting(PORT); mpCtx = mp;
    if (!await L.waitLanded(mp)) { tr('NO_PAGE_LANDED'); process.exit(4); }

    /* ================= A. 基本计算页：0018 文件值保留 + 身份切换即时生效 + warning 不阻断 ================= */
    await L.clearBasicDraft(mp);
    await ensureIndex('basic-import');
    await L.importFixture(mp, FIXTURE, 'mt9005-basic');
    const afterImport = await evSure(() => { const p = getCurrentPages().slice(-1)[0]; const d = p.data;
      return { route: p.route, birthYM: d.birthYM, gender: d.gender, femaleType: d.femaleType, retireYM: d.retireYM }; });
    dump.basicAfterImport = afterImport;
    ck('M9005-A0', '导入 e7-wife4 落基本页 出生1981-07', afterImport.route === 'pages/index/index' && afterImport.birthYM === BIRTH,
      JSON.stringify(afterImport), 'index/birth=1981-07');
    ck('M9005-A1', '0018：文件自带 retireYM=2031-07 导入后保留（不被法定值覆盖）', afterImport.retireYM === '2031-07',
      'retireYM=' + afterImport.retireYM, '2031-07');

    // 界面真实切换身份 → 即时生效；每态读 retireHint 中「超出弹性范围(min~max)」或直接由 range 佐证
    const switchBasic = (gender, femaleType) => evSure((g, ft) => { const p = getCurrentPages().slice(-1)[0];
      p.setGender({ currentTarget: { dataset: { v: g } } });
      if (ft) p.setFemaleType({ currentTarget: { dataset: { v: ft } } });
      return true;
    }, gender, femaleType).then(() => sleep(400)).then(() => evSure(() => { const p = getCurrentPages().slice(-1)[0];
      return { route: p.route, gender: p.data.gender, femaleType: p.data.femaleType, retireYM: p.data.retireYM, retireHint: p.data.retireHint }; }));
    const bW = await switchBasic('female', 'worker'); dump.basicWorker = bW;
    ck('M9005-A2w', '切女工人即时生效 且弹性下限提示 2031-07', bW.route === 'pages/index/index' && bW.gender === 'female' && bW.femaleType === 'worker'
      && /2031-07/.test(bW.retireHint) && !/2041-07/.test(bW.retireHint), 'hint=' + bW.retireHint, 'female/worker 含2031-07 无2041-07');
    const bC = await switchBasic('female', 'cadre'); dump.basicCadre = bC;
    ck('M9005-A2c', '切女干部即时生效 且弹性下限提示 2036-07（绝无2041-07）', bC.gender === 'female' && bC.femaleType === 'cadre'
      && /2036-07/.test(bC.retireHint) && !/2041-07/.test(bC.retireHint), 'hint=' + bC.retireHint, 'female/cadre 含2036-07 无2041-07');
    const bW2 = await switchBasic('female', 'worker'); dump.basicWorkerBack = bW2;
    ck('M9005-A3', '身份多次切换后文件 retireYM 仍 2031-07 保留', bW2.retireYM === '2031-07', 'retireYM=' + bW2.retireYM, '2031-07');
    await mp.screenshot({ path: path.join(LOGDIR, 'MT9005-basic-female-worker-hint.png') }).catch(() => {});

    // warning 不阻断计算：干净重导（复刻已证 GT-4039 路径）→ 女工2031-07 → onCalculate 真跳结果页 P有限
    await L.clearBasicDraft(mp);
    await ensureIndex('a4-import');
    await L.importFixture(mp, FIXTURE, 'mt9005-a4');
    // 复位跨轮次残留开关（同 GT-4039）
    await evSure(() => { const p = getCurrentPages().slice(-1)[0];
      p.setData({ doc31Eligible: false, doc31TransferYM: '', enterpriseInsuredYM: '', subsidyExcludedText: '' }); return true; });
    await sleep(200);
    await evSure(() => { const p = getCurrentPages().slice(-1)[0]; p.setGender({ currentTarget: { dataset: { v: 'female' } } }); return true; });
    await sleep(600);
    const a4Pre = await evSure(() => { const p = getCurrentPages().slice(-1)[0]; return { gender: p.data.gender, femaleType: p.data.femaleType, retireYM: p.data.retireYM, errorMsg: p.data.errorMsg || '' }; });
    tr('A4 pre-calc ' + JSON.stringify(a4Pre));
    await evSure(() => { getCurrentPages().slice(-1)[0].onCalculate(); return true; });
    const rs = await L.waitCurrentReady(mp, 'pages/result/result', d => d && d.ready === true && !!d.r, 45000);
    let errorMsg = '';
    if (!rs.ok) errorMsg = await evSure(() => getCurrentPages().slice(-1)[0].data.errorMsg || '').catch(() => '');
    dump.basicCalc = { landed: rs.ok, path: rs.path, P: rs.ok ? rs.data.r.pension.total : null, errorMsg };
    ck('M9005-A4', 'warning 不阻断：女工2031-07 计算真跳结果页 P有限', rs.ok && isFinite(rs.data.r.pension.total) && rs.data.r.pension.total > 0,
      'landed=' + rs.ok + ' P=' + (rs.ok ? rs.data.r.pension.total : null) + (errorMsg ? ' err=' + errorMsg : ''), 'result页/P>0');

    /* ================= B. 方案比较页：放行/拦截边界（startCompare 是否真跳结果页） ================= */
    await L.clearCompareDrafts(mp);
    const goCmp = await L.gotoCompare(mp);
    tr('gotoCompare=' + goCmp);
    await L.importFixture(mp, FIXTURE, 'mt9005-cmp');
    // 共享区补充利率（方法存在才调，真实组件 handler），避免共享校验缺项
    await evSure(() => { const p = getCurrentPages().slice(-1)[0]; const s = p.selectComponent('#sharedData');
      if (s && s.onFutureRate) s.onFutureRate({ detail: { value: '0' } }); return true; });
    await sleep(300);

    // 每个边界场景独立重新进入 compare（放行场景跳结果后不 navigateBack，用 reLaunch 统一重开，避免跨场景返回后通道不稳）。
    const FLEX = { z: '1.3', segType: 'flexible' }, ENT = { z: '0.6', segType: 'enterprise' };
    const runScenario = async (tag, ctxPatch, c0, c1) => {
      await L.clearCompareDrafts(mp);
      const okGo = await L.gotoCompare(mp);
      if (!okGo) throw new Error('GOTO_COMPARE_FAIL@' + tag);
      await L.importFixture(mp, FIXTURE, 'mt9005-' + tag);
      await evSure(() => { const p = getCurrentPages().slice(-1)[0]; const s = p.selectComponent('#sharedData');
        if (s && s.onFutureRate) s.onFutureRate({ detail: { value: '0' } }); return true; });
      await sleep(300);
      await L.setSharedCtx(mp, ctxPatch);
      await L.patchPlanCard(mp, 0, Object.assign({ retireTouched: true }, c0));
      await L.patchPlanCard(mp, 1, Object.assign({ retireTouched: true }, c1));
      await sleep(600);
      const st = await evSure(() => { const p = getCurrentPages().slice(-1)[0]; const pl = p.selectComponent('#planList');
        if (!pl) return null;
        return { ctx: p.data.ctx, plans: pl.getPlans().map(x => ({ windowStartYM: x.windowStartYM, retireYM: x.retireYM, z: x.z, segType: x.segType })) }; });
      const ctx = st.ctx, plans = st.plans;
      const e0 = retireErrs(plans[0] || {}, ctx);
      const e1 = retireErrs(plans[1] || {}, ctx);
      const landed = await L.compareStartAndWait(mp, 15000);
      // 不 navigateBack：放行时停在结果页，下一场景由 clearCompareDrafts reLaunch 重开
      return { tag, ctx: { gender: ctx.gender, femaleType: ctx.femaleType, birthYM: ctx.birthYM }, plans, e0, e1, landed: landed.landed, cols: landed.columns };
    };

    // B1 女工人：2031-07 放行；对照卡 2034-11（法定）
    const wAllow = await runScenario('wAllow', { gender: 'female', femaleType: 'worker', birthYM: BIRTH },
      Object.assign({ retireYM: '2031-07' }, FLEX), Object.assign({ retireYM: '2034-11' }, ENT));
    dump.workerAllow = wAllow;
    ck('M9005-B1a', '女工 2031-07 卡无退休红错', wAllow.e0.length === 0, JSON.stringify(wAllow.e0), '[]（放行）');
    ck('M9005-B1b', '女工 2031-07 startCompare 真跳结果页（放行）', wAllow.landed === true, 'landed=' + wAllow.landed + ' ctx=' + JSON.stringify(wAllow.ctx), 'landed=true');
    await mp.screenshot({ path: path.join(LOGDIR, 'MT9005-worker-2031-07-allow.png') }).catch(() => {});

    // B2 女工人：2031-06 拦截，文案下限 2031-07 且不含 2041-07
    const wBlock = await runScenario('wBlock', { gender: 'female', femaleType: 'worker', birthYM: BIRTH },
      Object.assign({ retireYM: '2031-06' }, FLEX), Object.assign({ retireYM: '2034-11' }, ENT));
    dump.workerBlock = wBlock;
    ck('M9005-B2a', '女工 2031-06 卡退休红错 下限2031-07', wBlock.e0.length === 1 && /2031-07/.test(wBlock.e0[0]), JSON.stringify(wBlock.e0), '含下限2031-07');
    ck('M9005-B2b', '女工拦截文案绝不出现男性值 2041-07', !/2041-07/.test(wBlock.e0.join('|')), JSON.stringify(wBlock.e0), '无2041-07');
    ck('M9005-B2c', '女工 2031-06 startCompare 不跳结果页（拦截）', wBlock.landed === false, 'landed=' + wBlock.landed, 'landed=false');

    // B3 女干部：2036-07 放行；对照 2039-06（法定）
    const cAllow = await runScenario('cAllow', { gender: 'female', femaleType: 'cadre', birthYM: BIRTH },
      Object.assign({ retireYM: '2036-07' }, FLEX), Object.assign({ retireYM: '2039-06' }, ENT));
    dump.cadreAllow = cAllow;
    ck('M9005-B3a', '女干部 2036-07 卡无退休红错', cAllow.e0.length === 0, JSON.stringify(cAllow.e0), '[]（放行）');
    ck('M9005-B3b', '女干部 2036-07 startCompare 真跳结果页（放行）', cAllow.landed === true, 'landed=' + cAllow.landed, 'landed=true');

    // B4 女干部：2036-06 拦截，下限 2036-07 不含 2041-07
    const cBlock = await runScenario('cBlock', { gender: 'female', femaleType: 'cadre', birthYM: BIRTH },
      Object.assign({ retireYM: '2036-06' }, FLEX), Object.assign({ retireYM: '2039-06' }, ENT));
    dump.cadreBlock = cBlock;
    ck('M9005-B4a', '女干部 2036-06 卡退休红错 下限2036-07', cBlock.e0.length === 1 && /2036-07/.test(cBlock.e0[0]), JSON.stringify(cBlock.e0), '含下限2036-07');
    ck('M9005-B4b', '女干部拦截文案绝不出现 2041-07', !/2041-07/.test(cBlock.e0.join('|')), JSON.stringify(cBlock.e0), '无2041-07');
    ck('M9005-B4c', '女干部 2036-06 startCompare 不跳结果页（拦截）', cBlock.landed === false, 'landed=' + cBlock.landed, 'landed=false');
    await mp.screenshot({ path: path.join(LOGDIR, 'MT9005-cadre-2036-06-block.png') }).catch(() => {});

    // B5 身份切换即时生效（同一退休值 2031-07：女工合法/女干部报错2036-07，证明 ctx 即时跟随且非男性口径）
    const sameYM = '2031-07';
    const eWorker = retireErrs({ retireYM: sameYM }, wAllow.ctx);
    const eCadre = retireErrs({ retireYM: sameYM }, cAllow.ctx);
    dump.identityImmediate = { eWorker, eCadre };
    ck('M9005-B5', '身份即时生效：同值2031-07 女工合法、女干部报2036-07（非2041-07）',
      eWorker.length === 0 && eCadre.length === 1 && /2036-07/.test(eCadre[0]) && !/2041-07/.test(eCadre[0]),
      'worker=' + JSON.stringify(eWorker) + ' cadre=' + JSON.stringify(eCadre), '女工[] / 女干部含2036-07');

    // B6 男口径不回退（node 同纯函数，独立取值）：2041-07 合法
    const eMale = retireErrs({ retireYM: '2041-07' }, { gender: 'male', femaleType: '', birthYM: BIRTH });
    dump.male = eMale;
    ck('M9005-B6', '男 2041-07 仍合法（口径不回退）', eMale.length === 0, JSON.stringify(eMale), '[]');

    dump.finishedAt = new Date().toISOString(); dump.checks = rec.list;
    fs.writeFileSync(path.join(LOGDIR, 'result-MT9005-0019.json'), JSON.stringify(dump, null, 2));
  } catch (e) {
    fatal = true; tr('ABORT ' + (e && e.message));
    try { dump.aborted = String(e && e.message); dump.finishedAt = new Date().toISOString(); dump.checks = rec.list;
      fs.writeFileSync(path.join(LOGDIR, 'result-MT9005-0019.json'), JSON.stringify(dump, null, 2)); } catch (x) {}
  } finally { await L.disconnectQuiet(mp); }
  const t = rec.totals();
  tr('=== TST-02-MT-9005(gui evidence) pass=' + t.pass + ' fail=' + t.fail + (fatal ? ' fatal' : '') + ' ===');
  process.exit(t.fail ? 1 : (fatal ? 2 : 0));
})();
