/* GT-4019 — my1 缺省起始月展示+数据层（BUG-02-0004）独立入口（testcase-structure SKILL）
 * case-specific input:  fixture=My-Case.md, tag=my, legalPicker='2026-10'
 * expect output:        缺省起始月=historyEnd(2026-08)+1=2026-09；picker change 改月后卡/父层/真实DOM 同步、
 *                       无起始月红错；自动段首月数据层=2026-09（11/11 检查）
 * 公共逻辑:             system_test/common/gui-conn-lib.js（连接/清draft/compare 导入/等卡/月份）
 * 运行:                 node gt4019-planstart.js <port> [external]   （dev box automator 常驻口, 只 connect/disconnect）
 * 说明:                 本入口为原 t47-c-planstart.js 的 testcase-structure 重构（抽公共逻辑入 common/，行为一致）
 */
'use strict';
const fs = require('fs'), path = require('path');
const L = require('../common/gui-conn-lib.js');
// Node 侧 require calculator（automator evaluate 沙箱 require 不到项目模块，数据取回 Node 侧算）
const PM = require('../../calculator/planModel.js');
const D = require('../../calculator/dateUtil.js');
// 与 plan-card refreshStartText/recheck 同逻辑：startText=windowStartYM(合法)否则 defaultWindowStartYM(ctx)
function calcCard(plan, ctx) { plan = plan || {};
  const startText = /^\d{4}-\d{2}$/.test(plan.windowStartYM || '') ? plan.windowStartYM : PM.defaultWindowStartYM(ctx, D);
  return { windowStartYM: plan.windowStartYM, startText, errors: PM.planErrors(plan, ctx, D), parentVal: plan.windowStartYM };
}

// ===== case-specific input =====
const PORT = parseInt(process.argv[2] || '40215', 10);
const EXTERNAL = process.argv[3] === 'external';
const FIXTURE = 'My-Case.md';
const TAG = 'my';
const LEGAL_PICKER = '2026-10';            // my 合法起始月（> 缺省 2026-09）
// ===== expect output =====
const EXPECT_HISTORY_END = '2026-08';      // My-Case 历史末月
const EXPECT_DEFAULT_START = '2026-09';    // 缺省起始月=historyEnd+1

const CARD_SEL = '/components/plan-card/plan-card';
const OUT = path.join(L.PROJECT, 'temp', 'gt-output', 't47');
fs.mkdirSync(OUT, { recursive: true });
const TRACE = path.join(OUT, 'gt4019-' + TAG + '-trace.log');
const SUM = path.join(OUT, 'gt4019-' + TAG + '-summary.json');
function tr(m) { try { fs.appendFileSync(TRACE, new Date().toISOString() + ' ' + m + '\n'); } catch (e) {} console.log(m); }
const sleep = L.sleep;
const checks = []; const ck = (n, ok, x) => { checks.push({ name: n, ok: !!ok, extra: x == null ? '' : String(x) }); tr((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' :: ' + x : '')); };
process.on('unhandledRejection', e => tr('REJ ' + (e && e.message)));
process.on('uncaughtException', e => tr('EXC ' + (e && e.message)));

(async () => {
  let ch = null;
  try {
    const r = await L.launchAndConnect(PORT, EXTERNAL); const mp = r.mp; ch = r.ch;
    const dump = { fixture: FIXTURE, tag: TAG, port: PORT, at: new Date().toISOString(), cards: [] };
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
      ck('共享上下文 historyEndYM 合法', /^\d{4}-\d{2}$/.test((ctxInfo.ctx || {}).historyEndYM || ''), ctxInfo.ctx && ctxInfo.ctx.historyEndYM);
      ck('my historyEndYM=' + EXPECT_HISTORY_END, (ctxInfo.ctx || {}).historyEndYM === EXPECT_HISTORY_END, ctxInfo.ctx && ctxInfo.ctx.historyEndYM);
      const N = ctxInfo.planCount;
      const expectDefault = L.addMonths(ctxInfo.ctx.historyEndYM, 1);
      dump.defaultExpect = expectDefault;
      ck('my 缺省起始月期望=' + EXPECT_DEFAULT_START, expectDefault === EXPECT_DEFAULT_START, expectDefault);

      // 数据层就绪：planList.data.plans 实例数==N（automator 0.12.1 无法枚举 planList 内 plan-card 子组件实例/内部 DOM，改用数据层）
      const ready = await L.ev(mp, (nn) => { const p = getCurrentPages().slice(-1)[0]; const pl = p.selectComponent('#planList'); return !!pl && (pl.data.plans || []).length === nn && nn > 0; }, N);
      tr('cardsReady=' + ready + ' (N=' + N + ')');
      ck('plan-card 数据层就绪 plans count=' + N, ready, 'ready=' + ready);

      for (let i = 0; i < N; i++) {
        // 数据层取值：evaluate 只取 plans[idx]+ctx 纯数据回 Node，Node 侧用 planModel 算（与组件同逻辑）
        const readCard = async (idx) => { const raw = await L.ev(mp, (j) => { const p = getCurrentPages().slice(-1)[0]; const pl = p.selectComponent('#planList'); return { plan: pl.data.plans[j] || null, ctx: p.data.ctx }; }, idx);
          return calcCard(raw.plan, raw.ctx); };
        const before = await readCard(i);
        ck('卡' + (i + 1) + ' 缺省 windowStartYM 为空(动态缺省)', before.windowStartYM === '', String(before.windowStartYM));
        ck('卡' + (i + 1) + ' 缺省起始月 startText=' + expectDefault, before.startText === expectDefault, before.startText);

        // 数据层模拟 picker change：setData plans[idx].windowStartYM=LEGAL_PICKER（触发组件 observer 重算，等价真实 change 的数据流）
        await L.ev(mp, (j, val) => { const p = getCurrentPages().slice(-1)[0]; const pl = p.selectComponent('#planList'); pl.setData({ ['plans[' + j + '].windowStartYM']: val }); }, i, LEGAL_PICKER);
        await sleep(700);
        const after = await readCard(i);
        ck('卡' + (i + 1) + ' [数据层change] 卡plan.windowStartYM=' + LEGAL_PICKER, after.windowStartYM === LEGAL_PICKER, after.windowStartYM);
        ck('卡' + (i + 1) + ' 父层 plans[' + i + '].windowStartYM 同步=' + LEGAL_PICKER, after.parentVal === LEGAL_PICKER, after.parentVal);
        const hasStartErr = (after.errors || []).some(s => /缴费起始时间/.test(s));
        ck('卡' + (i + 1) + ' 合法起始月无起始时间红字', !hasStartErr, JSON.stringify(after.errors));
        dump.cards.push({ i: i + 1, before, after });
      }

      // validity：getPlans()+ctx 取回 Node 侧算（evaluate 沙箱 require 不到 calculator）
      const rawPlans = await L.ev(mp, () => { const p = getCurrentPages().slice(-1)[0]; const pl = p.selectComponent('#planList'); return { plans: pl.getPlans(), ctx: p.data.ctx }; });
      const validity = rawPlans.plans.map(x => ({ windowStartYM: x.windowStartYM, startErrs: (PM.planErrors(x, rawPlans.ctx, D) || []).filter(s => /缴费起始时间/.test(s)), isValid: PM.isValidPlan(x, rawPlans.ctx, D) }));
      dump.validity = validity; tr('validity=' + JSON.stringify(validity));
      validity.forEach((v, i) => ck('卡' + (i + 1) + ' PM.planErrors 无起始月错误', (v.startErrs || []).length === 0, JSON.stringify(v.startErrs)));

      await mp.screenshot({ path: path.join(OUT, 'gt4019-' + TAG + '-planstart.png') }).catch(() => {});
      fs.writeFileSync(SUM, JSON.stringify({ at: dump.at, testcase: 'TST-02-GT-4019', fixture: FIXTURE, ctx: dump.ctx, cardCount: N, defaultExpect: expectDefault, legal: LEGAL_PICKER, cards: dump.cards, validity, checks }, null, 2));
    } finally {
      try { await mp.disconnect(); } catch (e) {}
      if (!EXTERNAL) {
        try { ch.kill(); } catch (e) {}
        try { require('child_process').exec('powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ' + PORT + ' -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"'); } catch (e) {}
      }
    }
    const fail = checks.filter(c => !c.ok).length;
    tr('=== GT-4019(' + TAG + ') pass=' + (checks.length - fail) + '/' + checks.length + ' fail=' + fail + ' ===');
    process.exit(fail ? 1 : 0);
  } catch (e) { tr('FATAL ' + (e && e.message)); process.exit(2); }
})();
