/* GT-4023 独立入口（testcase-structure 铁律）— Z3.0 × 个人账户利率 0% compare 结果页只读验收（BUG-02-0007）
 * case input : fixture My-Case.md；男1973-07→2033-07退休；2026-09起 Z=3.0 灵活就业；futureMonthlyRate=0
 * expect     : compare 结果页 R续=596107.20 / J账=6556.57 / P月=15292.32（期望由产品引擎独立自取，非引用旧线索）
 * common     : system_test/common/gui-conn-lib.js
 * run        : node gt-4023.js [port]   （dev box 40215 常驻口, 只 connect/disconnect）
 */
'use strict';
const fs = require('fs'), path = require('path');
const L = require('../common/gui-conn-lib.js');
const PORT = parseInt(process.argv[2] || '40215', 10);
const LOG = path.join(__dirname, 'logs'); fs.mkdirSync(LOG, { recursive: true });

// ===== case-specific input =====
const FIXTURE = 'My-Case.md';
const RATE = 0;
const PLAN = { retireYM: '2033-07', z: '3.0', segType: 'flexible' };
// ===== expect output =====
const EXPECT = { R: 596107.20, JA: 6556.57, P: 15292.32 };
const TOL = 0.001;

(async () => {
  const startedAt = new Date().toISOString();
  const rec = L.makeRecorder(); let mp = null; let shot = null; let got = null;
  try {
    mp = await L.connectExisting(PORT);
    const ref = L.buildFixtureInput(FIXTURE, RATE);
    got = await L.openCompareResult(mp, ref.sharedInput, PLAN);
    rec.ck('R续', 'compare R续', Math.abs(got.R - EXPECT.R) <= TOL, got.R, EXPECT.R);
    rec.ck('J账', 'compare J账', Math.abs(got.JA - EXPECT.JA) <= TOL, got.JA, EXPECT.JA);
    rec.ck('P月', 'compare P月', Math.abs(got.P - EXPECT.P) <= TOL, got.P, EXPECT.P);
    shot = path.join(LOG, 'GT4023-compare-result.png');
    for (let i = 0; i < 3; i++) { const s = await L.safeAttempt(() => mp.screenshot({ path: shot })); if (s.ok && fs.existsSync(shot) && fs.statSync(shot).length > 5000) break; await L.sleep(1200); }
  } catch (e) { rec.ck('FATAL', String((e && e.message) || e), false); }
  finally { await L.disconnectQuiet(mp); }

  const t = rec.totals(); const ok = t.fail === 0;
  fs.writeFileSync(path.join(LOG, 'result-GT4023.json'), JSON.stringify({
    case: 'GT-4023', type: 'GUI compare result readonly', ok, startedAt, finishedAt: new Date().toISOString(),
    input: { fixture: FIXTURE, futureMonthlyRate: RATE, plan: PLAN }, expected: EXPECT, tolerance: TOL, actual: got,
    screenshot: fs.existsSync(shot || '') ? shot : null, totals: t, assertions: rec.list }, null, 2));
  console.log('GT4023 ' + (ok ? 'PASS' : 'FAIL') + ' ' + t.pass + '/' + (t.pass + t.fail) + ' actual=' + JSON.stringify(got));
  process.exit(ok ? 0 : 1);
})();
