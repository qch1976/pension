/* GT-4021 独立 GUI 回归（task-75 / BUG-02-0009 修复验收）
 * 独立入口；公共逻辑 system_test/common/gui-conn-lib.js。external 模式：常驻口 40215 只 connect/disconnect。
 *
 * case-specific input:
 *   夹具 docs/customer_usecases/My-Case.md（真实文件链路导入）
 *   历史末月 historyEndYM=2026-08（由导入后真实 ctx 独立核对）
 *   法定退休 retireYM=2035-09；上界组用弹性退休 retireYM=2033-08（合法区间 2033-07~2038-09）
 * expect（tester 经产品模块独立 derive，见 temp/derive-t75.js）：
 *   2026-08(=历史末月) 拦、2026-07(严格早) 拦、2033-08(晚退休前月2033-07) 拦；
 *   2026-09(末月+1) 合法、2033-07(退休前月) 合法、留空(缺省) 合法；
 *   assemblePlanInput 合法起点自动段首月=2026-09，历史/自动段月份零交集；当月起点 assemble 抛错。
 * 产物：本目录 logs/result-GT4021-task75.json + GT4021-task75.png
 * 运行：node gt-4021-task75.js 40215 external
 */
'use strict';
const fs = require('fs'), path = require('path');
const L = require('../common/gui-conn-lib.js');
const D = require('../../calculator/dateUtil.js');
const PM = require('../../calculator/planModel.js');
const Asm = require('../../calculator/planAssembler.js');

const PORT = parseInt(process.argv[2] || '40215', 10);
const EXTERNAL = process.argv[3] === 'external';
const FIXTURE = 'My-Case.md', TAG = 'task75';
const EXP_HIST_END = '2026-08', EXP_STATUTORY = '2035-09', RET_UPPER = '2033-08';

const LOGDIR = path.join(__dirname, 'logs');
fs.mkdirSync(LOGDIR, { recursive: true });
const checks = [];
const ck = (title, ok, extra) => { checks.push({ title, pass: !!ok, extra: extra == null ? '' : String(extra) }); tr((ok ? 'PASS ' : 'FAIL ') + title + (extra ? ' :: ' + extra : '')); };
function tr(m) { try { fs.appendFileSync(path.join(LOGDIR, 'run-trace.log'), new Date().toISOString() + ' ' + m + '\n'); } catch (e) {} console.log(m); }
const sleep = L.sleep;
process.on('unhandledRejection', e => tr('REJ ' + (e && e.message)));
process.on('uncaughtException', e => tr('EXC ' + (e && e.message)));

// [起始月, 退休月, 期望合法, 说明]
const CASES = [
  ['2026-08', EXP_STATUTORY, false, '=历史末月应拦(等值)'],
  ['2026-07', EXP_STATUTORY, false, '严格早于历史末月应拦'],
  ['2033-08', RET_UPPER,     false, '晚于退休前月(2033-07)应拦'],
  ['2026-09', EXP_STATUTORY, true,  '历史末月+1合法'],
  ['2033-07', RET_UPPER,     true,  '退休前月合法'],
  ['',       EXP_STATUTORY, true,  '留空缺省合法']
];

(async () => {
  let mp = null;
  const dump = { at: new Date().toISOString(), testcase: 'TST-02-GT-4021', task: 'task-75', fixture: FIXTURE, port: PORT, baseline: 'e530e95', cases: [], assemble: null };
  try {
    mp = await L.connectExisting(PORT);
    const landed = await L.waitLanded(mp); tr('landed=' + landed);
    if (!landed) { tr('NO_PAGE'); process.exit(4); }
    await L.resetToEntry(mp);
    const cmp = await L.gotoCompare(mp); tr('compare=' + cmp);
    if (!cmp) { tr('COMPARE_NOT_READY'); process.exit(3); }

    const fileName = await L.importFixture(mp, FIXTURE, TAG);
    tr('imported=' + fileName);
    ck('真实文件导入成功', !!(fileName && String(fileName).indexOf(FIXTURE) >= 0), fileName);

    const info = await L.compareCtx(mp);
    dump.ctx = info.ctx;
    ck('historyEndYM=2026-08（真实导入后 ctx）', (info.ctx || {}).historyEndYM === EXP_HIST_END, info.ctx && info.ctx.historyEndYM);
    const N = info.planCount;
    const ready = await L.ev(mp, (nn) => { const p = getCurrentPages().slice(-1)[0]; const pl = p.selectComponent('#planList'); return !!pl && (pl.data.plans || []).length === nn && nn > 0; }, N);
    ck('plan-card 数据层就绪 count=' + N, ready, 'ready=' + ready);

    // 运行时只读导出产品真实构建的 sharedInput（#sharedData.buildValidatedInput），供 node 侧 assemble 复核（非引擎另算）
    const realBuilt = await L.ev(mp, () => { const p = getCurrentPages().slice(-1)[0]; const s = p.selectComponent('#sharedData'); const b = s.buildValidatedInput(); return { ok: b.ok, error: b.error || '', input: b.input }; });
    ck('产品真实 buildValidatedInput ok', !!(realBuilt && realBuilt.ok), realBuilt && realBuilt.error);
    const realShared = realBuilt.input;
    dump.realSharedSummary = { segCount: (realShared.segments || []).length, futureMonthlyRate: realShared.futureMonthlyRate, retireYM: realShared.retireYM };

    // 取首卡真实 plan（含 z/segType/retireYM），逐场景 clone 后判定（不触发 picker change）
    async function judge(startYM, retireYM) {
      const raw = await L.ev(mp, () => { const p = getCurrentPages().slice(-1)[0]; const pl = p.selectComponent('#planList'); return { plan: (pl.data.plans || [])[0] || null }; });
      const plan = JSON.parse(JSON.stringify(raw.plan));
      plan.windowStartYM = startYM;
      plan.retireYM = retireYM;
      const errs = (PM.planErrors(plan, info.ctx, D) || []).filter(s => /缴费起始时间/.test(s));
      return { startErrs: errs, isValidPlan: PM.isValidPlan(plan, info.ctx, D) };
    }

    for (const [ym, ret, expectLegal, desc] of CASES) {
      const r = await judge(ym, ret);
      const legal = r.startErrs.length === 0;
      dump.cases.push({ startYM: ym, retireYM: ret, desc, expectLegal, actual: r });
      ck('起始月[' + (ym || '空') + '] ' + desc + ' 期望' + (expectLegal ? '合法' : '拦'), legal === expectLegal,
         'isValidPlan=' + r.isValidPlan + ' errs=' + JSON.stringify(r.startErrs));
    }

    // assemblePlanInput：用运行时导出的真实 sharedInput，合法起点(2026-09, retire 2033-08) 自动段首月/零交集
    function monthMap(segs) { const m = {}; segs.forEach(s => { for (let i = D.toIndex(s.startYM); i <= D.toIndex(s.endYM); i++) m[i] = (m[i] || 0) + 1; }); return m; }
    const legalPlan = { retireYM: RET_UPPER, z: 1.0, segType: 'flexible', windowStartYM: '2026-09' };
    const assembled = Asm.assemblePlanInput(realShared, legalPlan);
    const autoSegs = assembled.segments.filter(s => D.toIndex(s.startYM) >= D.toIndex('2026-09'));
    const mm = monthMap(assembled.segments);
    const overlap = Object.keys(mm).filter(k => mm[k] > 1).map(k => D.toYM(+k));
    const autoFirst = autoSegs.length ? autoSegs[0].startYM : '';
    dump.assemble = { autoFirstMonth: autoFirst, overlapMonths: overlap, totalSegs: assembled.segments.length, autoSegs: autoSegs.length };
    ck('assemble 自动段首月=历史末月+1=2026-09（真实 sharedInput）', autoFirst === '2026-09', autoFirst);
    ck('assemble 历史段与自动段月份零交集', overlap.length === 0, 'overlap=' + JSON.stringify(overlap));

    let augThrow = '';
    try { Asm.assemblePlanInput(realShared, { retireYM: EXP_STATUTORY, z: 1.0, segType: 'flexible', windowStartYM: EXP_HIST_END }); augThrow = 'NO_THROW'; }
    catch (e) { augThrow = e.message; }
    dump.assemble.assembleAtHistEnd = augThrow;
    ck('assemble 起始月=历史末月当月抛错', /不得早于最后缴费月/.test(augThrow), augThrow);

    await mp.screenshot({ path: path.join(LOGDIR, 'GT4021-task75.png') }).catch(() => {});
    fs.writeFileSync(path.join(LOGDIR, 'result-GT4021-task75.json'), JSON.stringify(Object.assign({}, dump, { checks, finishedAt: new Date().toISOString() }), null, 2));
  } finally {
    await L.disconnectQuiet(mp);
  }
  const fail = checks.filter(c => !c.pass).length;
  tr('=== GT-4021(task-75) pass=' + (checks.length - fail) + '/' + checks.length + ' fail=' + fail + ' ===');
  process.exit(fail ? 1 : 0);
})();
