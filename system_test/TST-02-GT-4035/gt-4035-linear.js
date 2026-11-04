/* TST-02-GT-4035 独立入口 GUI testcase（线性重排版，task-103 终验；REQ-02-IN-008 / BUG-02-0022）
 * 顺序（Manager 复核修正）：① 年模式 Y0~Y5；② 导入+expandYearRows 切月录入 P0（确保真正进入月态）
 *   → 月度 M1~M4（同 evaluate 每步带 route/entryMode 断言）；③ 重新导入干净夹具走两页一致 P0b~P6。
 * 单飞串行；触发真实 handler + 同 tick 读真实 page.data（独立 GUI 取值，不引用任何上游数字）。
 * 产物落 logs/；截图 ≤3。
 */
'use strict';
const fs = require('fs'), path = require('path');
const L = require('../common/gui-conn-lib.js');

const PORT = parseInt(process.argv[2] || '40215', 10);
const BASELINE = process.argv[4] || 'unknown';
const FIXTURE = 'e7-my1.txt';
const LOGDIR = path.join(__dirname, 'logs');
fs.mkdirSync(LOGDIR, { recursive: true });
const rec = L.makeRecorder();
const sleep = L.sleep;
const tr = m => { try { fs.appendFileSync(path.join(LOGDIR, 'run-trace.log'), new Date().toISOString() + ' ' + m + '\n'); } catch (e) {} console.log(m); };
const ck = (id, t, pass, a, e) => { rec.ck(id, t, pass, a, e); tr((pass ? 'PASS ' : 'FAIL ') + id + ' ' + t + ' :: actual=' + a + ' expected=' + e); };
const r2 = n => Math.round(Number(n) * 100) / 100;
const near = (a, b, t) => isFinite(+a) && isFinite(+b) && Math.abs(+a - +b) <= (t || 0.01);
let mpCtx = null;
// 通道 null 兜底：L.ev 5 次重试全抛返回 null 时外层再轮（读真实 page.data；handler 同值触发幂等）
const evSure = async (fn, ...a) => {
  let r;
  for (let k = 0; k < 6; k++) { r = await L.ev(mpCtx, fn, ...a); if (r !== null && r !== undefined) return r; await sleep(800); }
  throw new Error('EVAL_NULL_PERSIST');
};
// 确保停在基本计算页 index（reLaunch 偶尔 settle 到 entry）：若在 entry 走真实 goBasic()，再轮询到 index keys>5。
const ensureIndex = async (tag) => {
  const t0 = Date.now();
  while (Date.now() - t0 < 45000) {
    let cp = null;
    try { cp = await mpCtx.currentPage(); } catch (e) {}
    if (cp && cp.path === 'pages/index/index') {
      let dd = null; try { dd = await cp.data(); } catch (e) {}
      if (dd && Object.keys(dd).length > 5) return { ok: true, route: 'pages/index/index', tag };
    } else if (cp && cp.path === 'pages/entry/entry') {
      // 走产品真实入口 handler redirectTo 到 index
      await L.ev(mpCtx, () => { const p = getCurrentPages().slice(-1)[0]; if (typeof p.goBasic === 'function') p.goBasic(); return true; });
    } else {
      await mpCtx.reLaunch('/pages/index/index').catch(() => {});
    }
    await sleep(1200);
  }
  throw new Error('ENSURE_INDEX_TIMEOUT@' + tag);
};
process.on('unhandledRejection', e => tr('REJ ' + (e && e.message)));
process.on('uncaughtException', e => tr('EXC ' + (e && e.message)));

(async () => {
  let mp = null, fatal = false;
  const dump = { at: new Date().toISOString(), testcase: 'TST-02-GT-4035', requirement: 'REQ-02-IN-008',
    caseId: 'BUG-02-0022', mode: 'linear-ordered', baseline: BASELINE, port: PORT,
    params: { fixture: FIXTURE, Z: '1.3', rate: 0, doc31: true, transferYM: '2000-11', retire: '2033-07' } };
  try {
    mp = await L.connectExisting(PORT); mpCtx = mp;
    if (!await L.waitLanded(mp)) { tr('NO_PAGE_LANDED'); process.exit(4); }
    await mp.reLaunch('/pages/index/index').catch(() => {});
    let page = null; const tW = Date.now();
    while (Date.now() - tW < 60000) {
      let pg = null, dd = null;
      try { pg = await mp.currentPage(); } catch (e) {}
      if (pg && pg.path && pg.path.indexOf('pages/index/index') >= 0) { try { dd = await pg.data(); } catch (e) {} if (dd && Object.keys(dd).length > 5) { page = pg; break; } }
      await sleep(1000);
    }
    if (!page) { tr('NO_PAGE_AFTER_RELAUNCH'); dump.aborted = 'NO_PAGE_AFTER_RELAUNCH'; dump.finishedAt = new Date().toISOString(); dump.checks = rec.list;
      fs.writeFileSync(path.join(LOGDIR, 'result-GT4035-IN008.json'), JSON.stringify(dump, null, 2)); process.exit(4); }
    tr('INDEX_READY in ' + (Date.now() - tW) + 'ms');

    /* ============ ① 年度模式 年缴费基数 ↔ Z ============ */
    await L.clearBasicDraft(mp);
    await L.importFixture(mp, FIXTURE, 'gt4035-year');
    await evSure(() => { getCurrentPages().slice(-1)[0].setData({ entryMode: 'year',
      yearRows: [{ year: '2026', startMonth: '1', months: '12', type: 'flexible', annualBase: '', zValue: '' }] }); return true; });
    await sleep(500);
    const yearInputRead = (k, v) => evSure((i, kk, vv) => { const p = getCurrentPages().slice(-1)[0];
      p.onYearRow({ currentTarget: { dataset: { i: i, k: kk } }, detail: { value: String(vv) } });
      const r = (p.data.yearRows || [])[i] || {}; return { route: p.route, months: r.months, annualBase: r.annualBase, zValue: r.zValue }; }, 0, k, v);
    const yearZRead = z => evSure((i, zz) => { const p = getCurrentPages().slice(-1)[0];
      if (typeof p.onYearRowZ !== 'function') return { hasHandler: false, route: p.route };
      p.onYearRowZ({ currentTarget: { dataset: { i: i } }, detail: { value: String(zz) } });
      const r = (p.data.yearRows || [])[i] || {}; return { hasHandler: true, route: p.route, months: r.months, annualBase: r.annualBase, zValue: r.zValue }; }, 0, z);

    let yr = await yearInputRead('annualBase', r2(15750.8 * 12)); dump.yBaseToZ = yr;
    ck('IN008-Y1', '年度 189009.6 → Z 1.3000', yr.route === 'pages/index/index' && String(yr.zValue) === '1.3000', 'route=' + yr.route + ' z=' + yr.zValue, 'index/1.3000');
    ck('IN008-Y0', '年度行存在 zValue 绑定', yr.zValue !== undefined && yr.zValue !== null, 'zValue=' + String(yr.zValue), 'present');
    let h = await yearZRead('0.6'); dump.yZ06 = h;
    ck('IN008-Y2', '年度 Z=0.6 → 月基数 7270', h.hasHandler && near(Number(h.annualBase) / Number(h.months), 7270, 1), 'monthly=' + r2(Number(h.annualBase) / Number(h.months)), '7270');
    h = await yearZRead('1.3'); dump.yZ13 = h;
    ck('IN008-Y3', '年度 Z=1.3 → 月基数 15750.8', h.hasHandler && near(Number(h.annualBase) / Number(h.months), 15750.8, 1), 'monthly=' + r2(Number(h.annualBase) / Number(h.months)), '15750.8');
    h = await yearZRead('3.0'); dump.yZ30 = h;
    ck('IN008-Y4', '年度 Z=3.0 → 月基数 36348', h.hasHandler && near(Number(h.annualBase) / Number(h.months), 36348, 1), 'monthly=' + r2(Number(h.annualBase) / Number(h.months)), '36348');
    yr = await yearInputRead('annualBase', 7270 * 12); dump.yReverse = yr;
    ck('IN008-Y5', '年度 87240 → Z 0.6000', String(yr.zValue) === '0.6000', 'zValue=' + yr.zValue, '0.6000');
    await mp.screenshot({ path: path.join(LOGDIR, 'GT4035-yearmode.png') }).catch(() => {});

    /* ============ ② 先真正切到月录入态（导入 + expandYearRows 重建）P0 ============ */
    await L.clearBasicDraft(mp);
    await ensureIndex('before-month-import');
    await L.importFixture(mp, FIXTURE, 'gt4035-month');
    const sw = await evSure(() => { const p = getCurrentPages().slice(-1)[0];
      const rows = p.data.yearRows || []; let rebuilt = null;
      try { rebuilt = (typeof p.expandYearRows === 'function') ? p.expandYearRows(rows) : null; } catch (e) {}
      if (!rebuilt || !rebuilt.length) return { ok: false, route: p.route, mode: p.data.entryMode, rows: rows.length };
      p.setData({ entryMode: 'month', segments: rebuilt });
      return { ok: true, route: p.route, mode: 'month', n: rebuilt.length }; });
    dump.switchToMonth = sw; await sleep(800);
    ck('IN008-P0', '切月录入 segments 由 yearRows 重建（进入月态）', sw.ok === true, JSON.stringify(sw), 'ok=true');
    // 月态就绪断言：route=index、entryMode=month、segments 非空、onSegZ/onSegBase 均为函数
    const monthReady = await evSure(() => { const p = getCurrentPages().slice(-1)[0];
      return { route: p.route, entryMode: p.data.entryMode, n: (p.data.segments || []).length,
        onSegZ: typeof p.onSegZ, onSegBase: typeof p.onSegBase }; });
    dump.monthReady = monthReady;
    const monthOk = monthReady.route === 'pages/index/index' && monthReady.entryMode === 'month' && monthReady.n > 0
      && monthReady.onSegZ === 'function' && monthReady.onSegBase === 'function';
    ck('IN008-M0', '月录入态就绪（route=index / entryMode=month / handler 齐）', monthOk, JSON.stringify(monthReady), 'index/month/fns');

    /* ============ ②b 月度 M1~M4：已在月态；受控单段，同 evaluate 每步带 route/mode 断言 ============ */
    const mz = await evSure(() => { const p = getCurrentPages().slice(-1)[0];
      p.setData({ entryMode: 'month', segments: [{ type: 'flexible', startYM: '2026-01', endYM: '2026-12', baseMonthly: '', zValue: '' }] });
      const guard = () => ({ route: p.route, mode: p.data.entryMode });
      const rd = () => { const s = p.data.segments[0]; return Object.assign(guard(), { baseMonthly: s.baseMonthly, zValue: s.zValue }); };
      const z06 = (() => { p.onSegZ({ currentTarget: { dataset: { i: 0 } }, detail: { value: '0.6' } }); return rd(); })();
      const z13 = (() => { p.onSegZ({ currentTarget: { dataset: { i: 0 } }, detail: { value: '1.3' } }); return rd(); })();
      const z30 = (() => { p.onSegZ({ currentTarget: { dataset: { i: 0 } }, detail: { value: '3.0' } }); return rd(); })();
      return { z06, z13, z30 }; });
    dump.monthZ = mz;
    const mzOk = r => r.route === 'pages/index/index' && r.mode === 'month';
    ck('IN008-M1', '月度 Z=0.6 → 月基数 7270', mzOk(mz.z06) && near(mz.z06.baseMonthly, 7270, 1e-6), JSON.stringify(mz.z06), 'index/month/7270');
    ck('IN008-M2', '月度 Z=1.3 → 月基数 15750.8', mzOk(mz.z13) && near(mz.z13.baseMonthly, 15750.800000000001, 1e-6), JSON.stringify(mz.z13), '15750.8');
    ck('IN008-M3', '月度 Z=3.0 → 月基数 36348', mzOk(mz.z30) && near(mz.z30.baseMonthly, 36348, 1e-6), JSON.stringify(mz.z30), '36348');
    await sleep(800); // 等 onSegZ 的 _zGuard 回调复位
    const mrev = await evSure(() => { const p = getCurrentPages().slice(-1)[0];
      p.onSegBase({ currentTarget: { dataset: { i: 0 } }, detail: { value: '15750.800000000001' } });
      const s = p.data.segments[0]; return { route: p.route, mode: p.data.entryMode, baseMonthly: s.baseMonthly, zValue: s.zValue }; });
    dump.monthReverse = mrev;
    ck('IN008-M4', '月度改基数 15750.8 → Z 1.3000', mzOk(mrev) && String(mrev.zValue) === '1.3000', JSON.stringify(mrev), 'index/month/1.3000');

    /* ============ ③ 重新导入干净夹具，走真实两页一致（A 口径） ============ */
    await L.clearBasicDraft(mp);
    await ensureIndex('before-p-import');
    await L.importFixture(mp, FIXTURE, 'gt4035p-basic');
    const sw2 = await evSure(() => { const p = getCurrentPages().slice(-1)[0];
      const rows = p.data.yearRows || []; let rebuilt = null;
      try { rebuilt = (typeof p.expandYearRows === 'function') ? p.expandYearRows(rows) : null; } catch (e) {}
      if (!rebuilt || !rebuilt.length) return { ok: false };
      p.setData({ entryMode: 'month', segments: rebuilt }); return { ok: true, n: rebuilt.length }; });
    await sleep(700);
    await evSure(() => { const p = getCurrentPages().slice(-1)[0];
      p.setData({ futureMonthlyRatePct: '0', retireYM: '2033-07', doc31Eligible: true, doc31TransferYM: '2000-11',
        hasDeemed: true, deemedStartYM: '1995-07', deemedEndYM: '2000-10' }); return true; });
    await sleep(500);
    const added = await evSure(() => { const p = getCurrentPages().slice(-1)[0];
      const list = (p.data.segments || []).slice();
      list.push({ type: 'flexible', startYM: '2026-09', endYM: '2033-06', baseMonthly: '', zValue: '' });
      p.setData({ segments: list }); return list.length; });
    await sleep(400);
    const segLast = await evSure(i => { const p = getCurrentPages().slice(-1)[0];
      p.onSegZ({ currentTarget: { dataset: { i: i } }, detail: { value: '1.3' } });
      const s = (p.data.segments || [])[i] || {}; return { route: p.route, baseMonthly: s.baseMonthly, zValue: s.zValue }; }, added - 1);
    dump.autoSeg = segLast;
    ck('IN008-P0b', '未来段 Z=1.3 → 基数 15750.8', segLast.route === 'pages/index/index' && near(segLast.baseMonthly, 15750.800000000001, 1e-6), JSON.stringify(segLast), '15750.8');

    await evSure(() => { getCurrentPages().slice(-1)[0].onCalculate(); return true; });
    const rs = await L.waitCurrentReady(mp, 'pages/result/result', d => d.ready === true && !!d.r, 45000);
    const basicP = rs.ok ? rs.data.r.pension.total : null;
    const basicJ = rs.ok ? [rs.data.r.pension.J基础, rs.data.r.pension.J账户, rs.data.r.pension.J过渡] : null;
    dump.basic = { ok: rs.ok, P: basicP, J: basicJ };
    ck('IN008-P1', '基本计算结果页 ready', rs.ok, 'path=' + rs.path, 'pages/result/result');
    ck('IN008-P2', '基本计算 P月=14715.77', near(basicP, 14715.77, 0.01), 'P=' + r2(basicP), '14715.77');
    await mp.screenshot({ path: path.join(LOGDIR, 'GT4035-basic.png') }).catch(() => {});

    await L.clearCompareDrafts(mp);
    await L.gotoCompare(mp);
    await L.importFixture(mp, FIXTURE, 'gt4035p-cmp');
    await evSure(() => { const p = getCurrentPages().slice(-1)[0]; const s = p.selectComponent('#sharedData');
      if (s && s.onFutureRate) s.onFutureRate({ detail: { value: '0' } });
      if (s && s.setDoc31) s.setDoc31({ currentTarget: { dataset: { v: 'yes' } } });
      if (s && s.onDoc31Transfer) s.onDoc31Transfer({ detail: { value: '2000-11' } }); return true; });
    await sleep(400);
    await evSure(() => { getCurrentPages().slice(-1)[0].syncCtx(); return true; });
    await sleep(900);
    await L.patchPlanCard(mp, 0, { retireYM: '2033-07', z: '1.3', segType: 'flexible', windowStartYM: '' });
    await L.patchPlanCard(mp, 1, { retireYM: '2033-07', z: '0.6', segType: 'flexible', windowStartYM: '' });
    const res = await L.compareStartAndWait(mp);
    const cmpCols = await evSure(() => { const v = ((getCurrentPages().slice(-1)[0].data || {}).view || {});
      return (v.columns || []).map(c => ({ P: c.pMonthly, jBasic: c.jBasic, jAccount: c.jAccount, jTransit: c.jTransit })); });
    const c0 = cmpCols[0] || {};
    const cmpP = res.columns[0] ? res.columns[0].P : null;
    const cmpJ = [c0.jBasic, c0.jAccount, c0.jTransit];
    dump.compare = { landed: res.landed, P: cmpP, J: cmpJ };
    ck('IN008-P3', '方案比较结果页 ready 且2列', res.landed && res.columns.length === 2, 'landed=' + res.landed + ' n=' + res.columns.length, '2');
    ck('IN008-P4', '方案比较 P月=14715.77', near(cmpP, 14715.77, 0.01), 'P=' + r2(cmpP), '14715.77');
    ck('IN008-P5', '两页 P月一致 Δ=0', isFinite(basicP) && isFinite(cmpP) && Math.abs(basicP - cmpP) < 0.01,
      'basic=' + r2(basicP) + ' compare=' + r2(cmpP) + ' Δ=' + r2(basicP - cmpP), 'Δ<0.01');
    ck('IN008-P6', '两页三分项 8126.27/5667.88/921.62 一致',
      !!basicJ && !!cmpJ && basicJ.every((v, i) => isFinite(v) && isFinite(cmpJ[i]) && Math.abs(v - cmpJ[i]) < 0.01),
      JSON.stringify(basicJ) + ' vs ' + JSON.stringify(cmpJ), '8126.27/5667.88/921.62');
    await mp.screenshot({ path: path.join(LOGDIR, 'GT4035-compare.png') }).catch(() => {});

    dump.finishedAt = new Date().toISOString(); dump.checks = rec.list;
    fs.writeFileSync(path.join(LOGDIR, 'result-GT4035-IN008.json'), JSON.stringify(dump, null, 2));
  } catch (e) {
    fatal = true; tr('ABORT ' + (e && e.message));
    try { dump.aborted = String(e && e.message); dump.finishedAt = new Date().toISOString(); dump.checks = rec.list;
      fs.writeFileSync(path.join(LOGDIR, 'result-GT4035-IN008.json'), JSON.stringify(dump, null, 2)); } catch (x) {}
  } finally { await L.disconnectQuiet(mp); }
  const t = rec.totals();
  tr('=== TST-02-GT-4035(ordered) pass=' + t.pass + ' fail=' + t.fail + (fatal ? ' fatal' : '') + ' ===');
  process.exit(t.fail ? 1 : (fatal ? 2 : 0));
})();
