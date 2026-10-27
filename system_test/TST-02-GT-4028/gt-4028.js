/* GT-4028 独立入口（testcase-structure 铁律）— compare 建 Z=0.6/1.0/3.0 三方案，结果页只读 J账，两两拉开>100（BUG-02-0007）
 * case input : fixture My-Case.md 共享区；plans=[Z0.6, Z1.0, Z3.0]（均灵活就业，同退休2033-07）；利率 0% 与 1.5% 两档
 * expect     : 每档三方案 J账两两之差均 >100（期望差由产品引擎独立自取，非引用旧线索）
 *                0%   : 1.0-0.6=228.73, 3.0-1.0=1143.61, 3.0-0.6=1372.34
 *                1.5% : 1.0-0.6=240.70, 3.0-1.0=1203.49, 3.0-0.6=1444.19
 * common     : system_test/common/gui-conn-lib.js
 * run        : node gt-4028.js [port]   （dev box 40215 常驻口, 只 connect/disconnect）
 */
'use strict';
const fs = require('fs'), path = require('path');
const L = require('../common/gui-conn-lib.js');
const PORT = parseInt(process.argv[2] || '40215', 10);
const LOG = path.join(__dirname, 'logs'); fs.mkdirSync(LOG, { recursive: true });

// ===== case-specific input =====
const FIXTURE = 'My-Case.md';
const PLANS = [
  { tag: 'Z0.6', plan: { retireYM: '2033-07', z: '0.6', segType: 'flexible' } },
  { tag: 'Z1.0', plan: { retireYM: '2033-07', z: '1.0', segType: 'flexible' } },
  { tag: 'Z3.0', plan: { retireYM: '2033-07', z: '3.0', segType: 'flexible' } }
];
const RATES = [ { label: '0%', rate: 0 }, { label: '1.5%', rate: 0.015 } ];
const PAIRS = [ [1, 0], [2, 1], [2, 0] ];
const EXPECT_GAP = { // 独立自取
  '0%':   { '1-0': 228.73, '2-1': 1143.61, '2-0': 1372.34 },
  '1.5%': { '1-0': 240.70, '2-1': 1203.49, '2-0': 1444.19 }
};
// ===== expect output =====
const SPREAD = 100; // 两两拉开 >100
const GAP_TOL = 0.01;

(async () => {
  const startedAt = new Date().toISOString();
  const rec = L.makeRecorder(); let mp = null; let shot = null; const table = [];
  try {
    mp = await L.connectExisting(PORT);
    for (const rc of RATES) {
      const shared = L.buildFixtureInput(FIXTURE, rc.rate).sharedInput;
      const cols = await L.openCompareResultN(mp, shared, PLANS.map(p => p.plan));
      const JA = cols.map(c => c.JA);
      const gaps = {};
      for (const [hi, lo] of PAIRS) {
        const key = hi + '-' + lo;
        gaps[key] = +(JA[hi] - JA[lo]).toFixed(2);
        const expGap = EXPECT_GAP[rc.label][key];
        rec.ck('J账拉开 ' + rc.label + ' ' + PLANS[hi].tag + '-' + PLANS[lo].tag,
          gaps[key] > SPREAD && Math.abs(gaps[key] - expGap) <= GAP_TOL,
          gaps[key], '>100 且期望 ' + expGap);
      }
      table.push({ rate: rc.label, J账: JA, gaps });
      if (rc.label === '0%') {
        shot = path.join(LOG, 'GT4028-triple-compare-0pct.png');
        for (let i = 0; i < 3; i++) { const s = await L.safeAttempt(() => mp.screenshot({ path: shot })); if (s.ok && fs.existsSync(shot) && fs.statSync(shot).length > 5000) break; await L.sleep(1200); }
      }
    }
  } catch (e) { rec.ck('FATAL', String((e && e.message) || e), false); }
  finally { await L.disconnectQuiet(mp); }

  const t = rec.totals(); const ok = t.fail === 0;
  fs.writeFileSync(path.join(LOG, 'result-GT4028.json'), JSON.stringify({
    case: 'GT-4028', type: 'GUI compare three-plan J-spread', ok, startedAt, finishedAt: new Date().toISOString(),
    input: { fixture: FIXTURE, plans: PLANS.map(p => p.tag), rates: RATES.map(r => r.label) },
    spreadOver: SPREAD, expectedGap: EXPECT_GAP, table,
    screenshot: fs.existsSync(shot || '') ? shot : null, totals: t, assertions: rec.list }, null, 2));
  console.log('GT4028 ' + (ok ? 'PASS' : 'FAIL') + ' ' + t.pass + '/' + (t.pass + t.fail));
  process.exit(ok ? 0 : 1);
})();
