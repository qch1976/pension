/* TST-02-GT-4035 独立入口 GUI testcase — REQ-02-IN-008（task-101）
 * 覆盖：基本计算页【年度模式】与【分段月度模式】缴费基数↔Z值双向即时联动；
 *       同输入（e7-my1 + Z=1.3 + 利率0 + doc31转企业2000-11 + 退休2033-07）两页 P月 一致=14715.77。
 * 当前预期 FAIL：年度模式无 Z 字段/无 onYearRowZ（0017 只把联动做到月度模式）。
 * 纪律：40215 只 connect/disconnect；正式产物落本目录 logs/；截图 ≤3。
 */
'use strict';
const fs = require('fs'), path = require('path');
const L = require('../common/gui-conn-lib.js');

const PORT = parseInt(process.argv[2] || '40215', 10);
const BASELINE = process.argv[4] || 'unknown';
const FIXTURE = 'e7-my1.txt';
const RETIRE = '2033-07', Z = '1.3';
const LOGDIR = path.join(__dirname, 'logs');
fs.mkdirSync(LOGDIR, { recursive: true });
const rec = L.makeRecorder();
const sleep = L.sleep;
const appLogs = [];
const tr = m => { try { fs.appendFileSync(path.join(LOGDIR, 'run-trace.log'), new Date().toISOString() + ' ' + m + '\n'); } catch (e) {} console.log(m); };
const ck = (id, t, pass, a, e) => { rec.ck(id, t, pass, a, e); tr((pass ? 'PASS ' : 'FAIL ') + id + ' ' + t + ' :: actual=' + a + ' expected=' + e); };
const r2 = n => Math.round(Number(n) * 100) / 100;
const near = (a, b, t) => isFinite(+a) && isFinite(+b) && Math.abs(+a - +b) <= (t || 0.01);
// 不吞错的 evaluate（直接调 mp.evaluate，失败上抛）；读操作用短重试
const rawEv = async (fn, ...a) => mpLocal.evaluate(fn, ...a);
let mpLocal = null;
const readWithRetry = async (fn, ...a) => {
  let last;
  for (let k = 0; k < 4; k++) {
    try { return await mpLocal.evaluate(fn, ...a); } catch (e) {
      last = e;
      try { const cp = await mpLocal.currentPage(); last = new Error(String(e.message) + ' @route=' + (cp && cp.path)); } catch (e2) {}
      await sleep(500);
    }
  }
  throw last;
};
// 关键交互前确认仍在 index；漂移则上抛带路由（不静默 reLaunch 掩盖现场）
const assertOnIndex = async tag => {
  const cp = await mpLocal.currentPage();
  if (!cp || cp.path !== 'pages/index/index') throw new Error('NAV_DRIFT at ' + tag + ' route=' + (cp && cp.path));
  return true;
};
process.on('unhandledRejection', e => tr('REJ ' + (e && e.message)));
process.on('uncaughtException', e => tr('EXC ' + (e && e.message)));
const segKey = s => [s.type || '', s.startYM, s.endYM, String(Number(s.baseMonthly).toFixed(6))].join('|');

// 年度行受控夹具：2026 年 / 1 月起 / 12 个月
const YR = () => ({ year: '2026', startMonth: '1', months: '12', type: 'flexible', annualBase: '' });

(async () => {
  let mp = null, fatal = false;
  const dump = {
    at: new Date().toISOString(), testcase: 'TST-02-GT-4035', requirement: 'REQ-02-IN-008',
    caseId: 'BUG-02-0022', baseline: BASELINE, port: PORT,
    params: { fixture: FIXTURE, Z: Z, rate: 0, doc31: true, transferYM: '2000-11', retire: RETIRE }
  };
  try {
    mp = await L.connectExisting(PORT);
    mpLocal = mp;
    // 采集 WeappLog（供 NO_PAGE 时核查 utility process exit 字面量）
    try { mp.on('appLog', m => { try { appLogs.push(String((m && (m.message || m.content)) || m)); } catch (e) {} }); } catch (e) {}
    // 项目已 cli open 但模拟器未必自启首页：主动 reLaunch index 并轮询到 page.data() 键数>5
    // （同 system_test/TST-02-GT-4000/gui/lib-gui.js relaunchIndex 已证模式，单次 reLaunch + 60s）
    await mp.reLaunch('/pages/index/index').catch(() => {});
    let warmed = false; const tW = Date.now();
    while (Date.now() - tW < 60000) {
      try {
        const pg = await mp.currentPage();
        if (pg && pg.path && pg.path.indexOf('pages/index/index') >= 0) {
          const dd = await pg.data();
          if (dd && Object.keys(dd).length > 5) { warmed = true; break; }
        }
      } catch (e) {}
      await sleep(800);
    }
    if (!warmed) {
      tr('NO_PAGE_AFTER_RELAUNCH (60s full readiness poll)');
      dump.finishedAt = new Date().toISOString();
      dump.appLogs = appLogs.slice(0, 100);
      try { fs.writeFileSync(path.join(LOGDIR, 'result-GT4035-IN008.json'),
        JSON.stringify(Object.assign({}, dump, { aborted: 'NO_PAGE_AFTER_RELAUNCH', checks: rec.list }), null, 2)); } catch (x) {}
      await L.disconnectQuiet(mp); process.exit(4);
    }
    tr('WARMED pages/index/index data keys>5 in ' + (Date.now() - tW) + 'ms');

    await L.clearBasicDraft(mp);
    await L.importFixture(mp, FIXTURE, 'gt4035in008');

    /* ============ ① 年度模式：年缴费基数 → Z，Z → 月基数 ============ */
    await L.ev(mp, () => { const p = getCurrentPages().slice(-1)[0]; p.setData({ entryMode: 'year' }); return true; });
    await sleep(300);
    // 落受控年度行（2026 年 / 1 月起 / 12 个月 / 灵活就业）
    await L.ev(mp, row => { const p = getCurrentPages().slice(-1)[0]; p.setData({ yearRows: [row] }); return true; }, YR());
    await sleep(400);

    const readRow = async () => readWithRetry(() => { const r = (getCurrentPages().slice(-1)[0].data.yearRows || [])[0] || {};
      return { year: r.year, months: r.months, annualBase: r.annualBase, zValue: r.zValue }; });

    // 改「年缴费基数」走真实 onYearRow（k=annualBase）；修复后应同步把 Z 刷成 月基数/12116（4位小数）
    const setAnnual = async v => readWithRetry((i, vv) => { const p = getCurrentPages().slice(-1)[0];
      p.onYearRow({ currentTarget: { dataset: { i: i, k: 'annualBase' } }, detail: { value: String(vv) } }); return true; }, 0, v);
    // 改 Z 走 onYearRowZ（修复契约：yearRows 行新增 zValue + onYearRowZ handler）
    const setYearZ = async z => readWithRetry((i, zz) => { const p = getCurrentPages().slice(-1)[0];
      if (typeof p.onYearRowZ !== 'function') return { hasHandler: false };
      p.onYearRowZ({ currentTarget: { dataset: { i: i } }, detail: { value: String(zz) } }); return { hasHandler: true }; }, 0, z);

    // Y1: 年基数 = 15750.8×12 → Z 即时 1.3000
    await setAnnual(r2(15750.8 * 12)); await sleep(600);
    let row = await readRow(); dump.yBaseToZ = row;
    ck('IN008-Y1', '年度模式改年缴费基数 → Z 即时刷新=1.3000（月基数/12116，4位小数）',
      String(row.zValue) === '1.3000', 'zValue=' + row.zValue, '1.3000');

    // Y0: 年度行带 Z 字段（Z 值输入框可用）
    ck('IN008-Y0', '年度模式年度行存在 zValue 绑定（Z值输入框）', row.zValue !== undefined && row.zValue !== null,
      'zValue=' + String(row.zValue), 'field present');

    // Y2: Z=0.6 → 月基数 7270（年基数=7270×12，最低档个位四舍五入）
    const h06 = await setYearZ('0.6'); await sleep(600);
    row = await readRow(); dump.yZ06 = { hasHandler: h06 ? h06.hasHandler : null, row: row };
    const mb06 = Number(row.annualBase) / Number(row.months);
    ck('IN008-Y2', '年度模式 Z=0.6 → 月基数 7270（最低档取整到元）',
      h06 && h06.hasHandler && near(mb06, 7270, 1), 'handler=' + (h06 && h06.hasHandler) + ' monthly=' + r2(mb06), '7270');

    // Y3: Z=1.3 → 月基数 15750.8（不取整）
    const h13 = await setYearZ('1.3'); await sleep(600);
    row = await readRow(); dump.yZ13 = { hasHandler: h13 ? h13.hasHandler : null, row: row };
    const mb13 = Number(row.annualBase) / Number(row.months);
    ck('IN008-Y3', '年度模式 Z=1.3 → 月基数 15750.8（不取整）',
      h13 && h13.hasHandler && near(mb13, 15750.8, 1), 'handler=' + (h13 && h13.hasHandler) + ' monthly=' + r2(mb13), '15750.8');

    // Y4: Z=3.0 → 月基数 36348
    const h30 = await setYearZ('3.0'); await sleep(600);
    row = await readRow(); dump.yZ30 = { hasHandler: h30 ? h30.hasHandler : null, row: row };
    const mb30 = Number(row.annualBase) / Number(row.months);
    ck('IN008-Y4', '年度模式 Z=3.0 → 月基数 36348',
      h30 && h30.hasHandler && near(mb30, 36348, 1), 'handler=' + (h30 && h30.hasHandler) + ' monthly=' + r2(mb30), '36348');

    // Y5: 反向：年基数=7270×12 → Z=0.6000
    await setAnnual(7270 * 12); await sleep(600);
    row = await readRow(); dump.yReverse = row;
    ck('IN008-Y5', '年度模式年基数 7270×12 → Z=0.6000', String(row.zValue) === '0.6000',
      'zValue=' + row.zValue, '0.6000');

    await mp.screenshot({ path: path.join(LOGDIR, 'GT4035-yearmode.png') }).catch(() => {});

    /* ============ ② 分段月度模式：月缴费基数 ↔ Z 双向 ============ */
    await L.ev(mp, () => { const p = getCurrentPages().slice(-1)[0];
      p.setData({ entryMode: 'month', segments: [{ type: 'flexible', startYM: '2026-01', endYM: '2026-12', baseMonthly: '', zValue: '' }] });
      return true; });
    await sleep(400);

    const setSegZ = async z => readWithRetry((i, zz) => { const p = getCurrentPages().slice(-1)[0];
      p.onSegZ({ currentTarget: { dataset: { i: i } }, detail: { value: String(zz) } }); return true; }, 0, z);
    const setSegBase = async b => readWithRetry((i, bb) => { const p = getCurrentPages().slice(-1)[0];
      p.onSegBase({ currentTarget: { dataset: { i: i } }, detail: { value: String(bb) } }); return true; }, 0, b);
    const readSeg = async () => readWithRetry(() => { const s = (getCurrentPages().slice(-1)[0].data.segments || [])[0] || {};
      return { baseMonthly: s.baseMonthly, zValue: s.zValue }; });

    await setSegZ('0.6'); await sleep(500);
    await assertOnIndex('before-m1-read');
    let s = await readSeg(); dump.mZ06 = s;
    ck('IN008-M1', '月度模式 Z=0.6 → 月基数 7270', near(s.baseMonthly, 7270, 1e-6), 'base=' + s.baseMonthly, '7270');

    await setSegZ('1.3'); await sleep(500);
    await assertOnIndex('before-m2-read');
    s = await readSeg(); dump.mZ13 = s;
    ck('IN008-M2', '月度模式 Z=1.3 → 月基数 15750.8', near(s.baseMonthly, 15750.800000000001, 1e-6), 'base=' + s.baseMonthly, '15750.8');

    await setSegZ('3.0'); await sleep(500);
    await assertOnIndex('before-m3-read');
    s = await readSeg(); dump.mZ30 = s;
    ck('IN008-M3', '月度模式 Z=3.0 → 月基数 36348', near(s.baseMonthly, 36348, 1e-6), 'base=' + s.baseMonthly, '36348');

    await setSegBase('15750.800000000001'); await sleep(500);
    await assertOnIndex('before-m4-read');
    s = await readSeg(); dump.mB13 = s;
    ck('IN008-M4', '月度模式改基数 → Z 回算 1.3000', String(s.zValue) === '1.3000', 'zValue=' + s.zValue, '1.3000');

    /* ============ ③ 同输入两页 P月 一致 = 14715.77，Δ=0（A 口径，同 GT-4040 已证路径） ============ */
    // BASIC：导入 → 切月录入（expandYearRows 重建段）→ 加未来段 2026-09~2033-06 → Z=1.3 → 计算
    await L.clearBasicDraft(mp);
    await L.importFixture(mp, FIXTURE, 'gt4035p-basic');
    const sw = await readWithRetry(() => {
      const p = getCurrentPages().slice(-1)[0];
      const rows = p.data.yearRows || [];
      let rebuilt = null;
      try { rebuilt = (typeof p.expandYearRows === 'function') ? p.expandYearRows(rows) : null; } catch (e) {}
      if (!rebuilt || !rebuilt.length) return { ok: false, rows: rows.length };
      p.setData({ entryMode: 'month', segments: rebuilt });
      return { ok: true, n: rebuilt.length };
    });
    dump.switchToMonth = sw;
    await sleep(700);
    ck('IN008-P0', '切月录入后 segments 由 yearRows 重建', sw.ok === true, JSON.stringify(sw), 'ok=true');

    await readWithRetry(() => { const p = getCurrentPages().slice(-1)[0];
      p.setData({ futureMonthlyRatePct: '0', retireYM: RETIRE, doc31Eligible: true, doc31TransferYM: '2000-11',
        hasDeemed: true, deemedStartYM: '1995-07', deemedEndYM: '2000-10' });
      return true; });
    await sleep(500);
    let added = await readWithRetry(() => {
      const p = getCurrentPages().slice(-1)[0];
      const list = (p.data.segments || []).slice();
      list.push({ type: 'flexible', startYM: '2026-09', endYM: '2033-06', baseMonthly: '', zValue: '' });
      p.setData({ segments: list });
      return list.length;
    });
    let lastIdx = added - 1;
    const applyFutureZ = async () => readWithRetry(i => { const p = getCurrentPages().slice(-1)[0];
      p.onSegZ({ currentTarget: { dataset: { i: i } }, detail: { value: Z } }); return true; }, lastIdx);
    await applyFutureZ();
    await sleep(700);
    let segLast = await readWithRetry(i => { const s = (getCurrentPages().slice(-1)[0].data.segments || [])[i] || {};
      return { baseMonthly: s.baseMonthly, zValue: s.zValue }; }, lastIdx);
    // 未生效则校正段数/重投递一次（防上一拍读空导致段索引错位）
    if (!near(segLast.baseMonthly, 15750.800000000001, 1e-6)) {
      const st = await readWithRetry(() => getCurrentPages().slice(-1)[0].data.segments.map(x => [x.startYM, x.endYM, x.baseMonthly]));
      const haveFuture = st.some(x => x[0] === '2026-09' && x[1] === '2033-06');
      if (!haveFuture) {
        added = await readWithRetry(() => { const p = getCurrentPages().slice(-1)[0];
          const list = (p.data.segments || []).slice();
          list.push({ type: 'flexible', startYM: '2026-09', endYM: '2033-06', baseMonthly: '', zValue: '' });
          p.setData({ segments: list }); return list.length; });
        lastIdx = added - 1;
      } else {
        lastIdx = st.findIndex(x => x[0] === '2026-09' && x[1] === '2033-06');
      }
      await applyFutureZ(); await sleep(700);
      segLast = await readWithRetry(i => { const s = (getCurrentPages().slice(-1)[0].data.segments || [])[i] || {};
        return { baseMonthly: s.baseMonthly, zValue: s.zValue }; }, lastIdx);
    }
    dump.autoSeg = segLast;
    ck('IN008-P0b', '未来段 Z=1.3 → 基数 15750.8', near(segLast.baseMonthly, 15750.800000000001, 1e-6),
      'base=' + segLast.baseMonthly, '15750.8');

    await readWithRetry(() => { getCurrentPages().slice(-1)[0].onCalculate(); return true; });
    const rs = await L.waitCurrentReady(mp, 'pages/result/result', d => d.ready === true && !!d.r, 45000);
    const basicP = rs.ok ? rs.data.r.pension.total : null;
    const basicJ = rs.ok ? [rs.data.r.pension.J基础, rs.data.r.pension.J账户, rs.data.r.pension.J过渡] : null;
    dump.basic = { ok: rs.ok, P: basicP, J: basicJ };
    ck('IN008-P1', '基本计算结果页 ready', rs.ok, 'path=' + rs.path, 'pages/result/result');
    ck('IN008-P2', '基本计算 P月=14715.77', near(basicP, 14715.77, 0.01), 'P=' + r2(basicP), '14715.77');
    await mp.screenshot({ path: path.join(LOGDIR, 'GT4035-basic.png') }).catch(() => {});

    // COMPARE：同夹具同参数
    await L.clearCompareDrafts(mp);
    await L.gotoCompare(mp);
    await L.importFixture(mp, FIXTURE, 'gt4035p-cmp');
    await L.ev(mp, () => { const p = getCurrentPages().slice(-1)[0]; const s = p.selectComponent('#sharedData');
      if (s && s.onFutureRate) s.onFutureRate({ detail: { value: '0' } });
      if (s && s.setDoc31) s.setDoc31({ currentTarget: { dataset: { v: 'yes' } } });
      if (s && s.onDoc31Transfer) s.onDoc31Transfer({ detail: { value: '2000-11' } });
      return true; });
    await sleep(400);
    await L.ev(mp, () => { getCurrentPages().slice(-1)[0].syncCtx(); return true; });
    await sleep(900);
    await L.patchPlanCard(mp, 0, { retireYM: RETIRE, z: Z, segType: 'flexible', windowStartYM: '' });
    await L.patchPlanCard(mp, 1, { retireYM: RETIRE, z: '0.6', segType: 'flexible', windowStartYM: '' });
    const res = await L.compareStartAndWait(mp);
    const cmpP = res.columns[0] ? res.columns[0].P : null;
    const cmpCols = await readWithRetry(() => {
      const v = ((getCurrentPages().slice(-1)[0].data || {}).view || {});
      return (v.columns || []).map(c => ({ P: c.pMonthly, jBasic: c.jBasic, jAccount: c.jAccount, jTransit: c.jTransit }));
    });
    const c0 = cmpCols[0] || {};
    const cmpJ = [c0.jBasic, c0.jAccount, c0.jTransit];
    dump.compare = { landed: res.landed, P: cmpP, J: cmpJ };
    ck('IN008-P3', '方案比较结果页 ready 且2列', res.landed && res.columns.length === 2,
      'landed=' + res.landed + ' n=' + res.columns.length, '2');
    ck('IN008-P4', '方案比较 P月=14715.77', near(cmpP, 14715.77, 0.01), 'P=' + r2(cmpP), '14715.77');
    ck('IN008-P5', '两页 P月一致 Δ=0（<0.01）',
      isFinite(basicP) && isFinite(cmpP) && Math.abs(basicP - cmpP) < 0.01,
      'basic=' + r2(basicP) + ' compare=' + r2(cmpP) + ' Δ=' + r2(basicP - cmpP), 'Δ<0.01');
    ck('IN008-P6', '两页三分项一致（各项 Δ<0.01）',
      !!basicJ && !!cmpJ && basicJ.every((v, i) => isFinite(v) && isFinite(cmpJ[i]) && Math.abs(v - cmpJ[i]) < 0.01),
      JSON.stringify(basicJ) + ' vs ' + JSON.stringify(cmpJ), 'all Δ<0.01');
    await mp.screenshot({ path: path.join(LOGDIR, 'GT4035-compare.png') }).catch(() => {});

    dump.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(LOGDIR, 'result-GT4035-IN008.json'),
      JSON.stringify(Object.assign({}, dump, { checks: rec.list }), null, 2));
  } catch (e) {
    fatal = true; tr('ABORT ' + (e && e.message));
    try {
      dump.finishedAt = new Date().toISOString();
      fs.writeFileSync(path.join(LOGDIR, 'result-GT4035-IN008.json'),
        JSON.stringify(Object.assign({}, dump, { aborted: String(e && e.message), checks: rec.list }), null, 2));
    } catch (x) {}
  } finally {
    await L.disconnectQuiet(mp);
  }
  const t = rec.totals();
  tr('=== TST-02-GT-4035 pass=' + t.pass + ' fail=' + t.fail + (fatal ? ' fatal' : '') + ' ===');
  process.exit(t.fail ? 1 : (fatal ? 2 : 0));
})();
