/* GT-4021 — 起始月边界/越界数据层（BUG-02-0004/0009）独立入口（testcase-structure SKILL）
 * case-specific input:  fixture=My-Case.md, tag=my-boundary, 边界起始月集合
 *                       historyEndYM=2026-08（历史末月）、retireYM=2035-09（退休）→退休前月 2035-08
 * expect output:        只读回读 isValidPlan/planErrors（不触发 picker change，数据层判定）：
 *                         2026-09 合法、2035-08 合法、2035-09 拒、留空(动态缺省 2026-09) 合法；
 *                         2026-08(=历史末月) 应拒（=边界等值，BUG-02-0009 off-by-one：用 < 应 <=）
 *                         —— 该用例对当前引擎为 FAIL（BUG-02-0009 待修），fail 时 exit 1
 * 公共逻辑:             system_test/common/gui-conn-lib.js
 * 运行:                 node gt4021-planstart-boundary.js <port> [external]
 */
'use strict';
const fs = require('fs'), path = require('path');
const L = require('../common/gui-conn-lib.js');
// Node 侧 require calculator（automator evaluate 沙箱 require 不到项目模块）
const PM = require('../../calculator/planModel.js');
const D = require('../../calculator/dateUtil.js');

// ===== case-specific input =====
const PORT = parseInt(process.argv[2] || '40215', 10);
const EXTERNAL = process.argv[3] === 'external';
const FIXTURE = 'My-Case.md';
const TAG = 'my-boundary';
const EXPECT_HISTORY_END = '2026-08';      // My-Case 历史末月
const EXPECT_RETIRE = '2035-09';           // My-Case 退休（fixture 实测 plans[0].retireYM=2035-09）
// 边界用例: [起始月, 期望 isValidPlan(无起始月错误视为合法), 说明]
const BOUNDARY_CASES = [
  ['2026-09', true,  '历史末月+1=缺省合法下界'],
  ['2035-08', true,  '退休前月合法上界（retireYM=2035-09）'],
  ['2035-09', false, '退休当月越界应拒（retireYM=2035-09）'],
  ['2026-08', false, '=历史末月应拒（等值边界，BUG-02-0009 当前引擎 off-by-one 实放）']
];

const CARD_SEL = '/components/plan-card/plan-card';
const OUT = path.join(L.PROJECT, 'temp', 'gt-output', 't47');
fs.mkdirSync(OUT, { recursive: true });
const TRACE = path.join(OUT, 'gt4021-' + TAG + '-trace.log');
const SUM = path.join(OUT, 'gt4021-' + TAG + '-summary.json');
function tr(m) { try { fs.appendFileSync(TRACE, new Date().toISOString() + ' ' + m + '\n'); } catch (e) {} console.log(m); }
const sleep = L.sleep;
const checks = []; const ck = (n, ok, x) => { checks.push({ name: n, ok: !!ok, extra: x == null ? '' : String(x) }); tr((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' :: ' + x : '')); };
process.on('unhandledRejection', e => tr('REJ ' + (e && e.message)));
process.on('uncaughtException', e => tr('EXC ' + (e && e.message)));

(async () => {
  let ch = null;
  try {
    const r = await L.launchAndConnect(PORT, EXTERNAL); const mp = r.mp; ch = r.ch;
    const dump = { fixture: FIXTURE, tag: TAG, port: PORT, at: new Date().toISOString(), boundary: [] };
    try {
      const landed = await L.waitLanded(mp); tr('landed=' + landed);
      if (!landed) { tr('NO_PAGE'); process.exit(4); }
      await L.resetToEntry(mp);
      const cmp = await L.gotoCompare(mp); tr('compare=' + cmp);
      if (!cmp) { tr('COMPARE_NOT_READY'); process.exit(3); }

      dump.fileName = await L.importFixture(mp, FIXTURE, TAG);
      tr('imported fileName=' + dump.fileName);
      ck('真实文件导入成功 fileName 含 ' + FIXTURE, !!(dump.fileName && String(dump.fileName).indexOf(FIXTURE) >= 0), dump.fileName);

      const ctxInfo = await L.compareCtx(mp);
      tr('ctx=' + JSON.stringify(ctxInfo.ctx) + ' count=' + ctxInfo.planCount);
      dump.ctx = ctxInfo.ctx;
      ck('historyEndYM=' + EXPECT_HISTORY_END, (ctxInfo.ctx || {}).historyEndYM === EXPECT_HISTORY_END, ctxInfo.ctx && ctxInfo.ctx.historyEndYM);
      const N = ctxInfo.planCount;

      // 数据层就绪（automator 无法枚举 planList 内 plan-card 子组件实例）
      const ready = await L.ev(mp, (nn) => { const p = getCurrentPages().slice(-1)[0]; const pl = p.selectComponent('#planList'); return !!pl && (pl.data.plans || []).length === nn && nn > 0; }, N);
      ck('plan-card 数据层就绪 plans count=' + N, ready, 'ready=' + ready);

      // 只读回读：对首卡逐一边界月，数据层 set plan.windowStartYM 后用 PM.planErrors/isValidPlan 判定（不触发 picker change 事件）
      // 只读回读：取首卡 plans[0]+ctx 回 Node，clone plan set windowStartYM 后用 PM.planErrors/isValidPlan 判定（不触发 picker change）
      async function judgeAt(startYM) {
        const raw = await L.ev(mp, () => { const p = getCurrentPages().slice(-1)[0]; const pl = p.selectComponent('#planList'); return { plan: (pl.data.plans || [])[0] || null, ctx: p.data.ctx }; });
        if (!raw || !raw.plan) return null;
        const plan = JSON.parse(JSON.stringify(raw.plan)); plan.windowStartYM = startYM;
        const errs = (PM.planErrors(plan, raw.ctx, D) || []).filter(s => /缴费起始时间/.test(s));
        return { ym: startYM, startErrs: errs, isValid: PM.isValidPlan(plan, raw.ctx, D) };
      }

      for (const [ym, expectLegal, desc] of BOUNDARY_CASES) {
        const res = await judgeAt(ym);
        tr('boundary ' + ym + ' -> ' + JSON.stringify(res) + ' expectLegal=' + expectLegal);
        const startErrFree = !!(res && (res.startErrs || []).length === 0);
        // 判定口径（Manager 18:30 批）：无起始时间错误即合法；isValidPlan 含 z/segType 必填校验（留空致恒 false）不作起始月判据
        const actualLegal = startErrFree;
        dump.boundary.push({ ym, expectLegal, desc, result: res });
        ck('起始月 ' + ym + ' ' + desc + '（期望' + (expectLegal ? '合法' : '拒') + '）', actualLegal === expectLegal,
           'isValid=' + (res && res.isValid) + ' startErrs=' + JSON.stringify(res && res.startErrs));
      }
      // 留空合法（动态缺省=historyEnd+1=2026-09）
      const blankRes = await judgeAt('');
      const blankLegal = !!(blankRes && (blankRes.startErrs || []).length === 0);
      ck('起始月留空合法（动态缺省 2026-09）', blankLegal === true, 'isValid=' + (blankRes && blankRes.isValid) + ' startErrs=' + JSON.stringify(blankRes && blankRes.startErrs));
      dump.boundary.push({ ym: '', expectLegal: true, desc: '留空动态缺省', result: blankRes });

      await mp.screenshot({ path: path.join(OUT, 'gt4021-' + TAG + '.png') }).catch(() => {});
      fs.writeFileSync(SUM, JSON.stringify({ at: dump.at, testcase: 'TST-02-GT-4021', fixture: FIXTURE, ctx: dump.ctx, boundary: dump.boundary, checks }, null, 2));
    } finally {
      try { await mp.disconnect(); } catch (e) {}
      if (!EXTERNAL) {
        try { ch.kill(); } catch (e) {}
        try { require('child_process').exec('powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ' + PORT + ' -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"'); } catch (e) {}
      }
    }
    const fail = checks.filter(c => !c.ok).length;
    tr('=== GT-4021(' + TAG + ') pass=' + (checks.length - fail) + '/' + checks.length + ' fail=' + fail + ' (2026-08 等值边界 fail=BUG-02-0009 已知待修) ===');
    process.exit(fail ? 1 : 0);
  } catch (e) { tr('FATAL ' + (e && e.message)); process.exit(2); }
})();
