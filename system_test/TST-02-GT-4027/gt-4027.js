/* GT-4027 独立入口（testcase-structure 铁律）— 完全相同输入 basic vs compare 两路径 parity（BUG-02-0006）
 * case input : fixture My-Case.md；PLAN Z0.6 灵活就业→2033-07；个人账户利率两档 0% 与 1.5%
 * expect     : 两路径 J账 / P月 逐值 |Δ|≤0.001（两档共 4 断言）
 *              R：basic 页字段=R储(累计储存额)、compare 页字段=R续(继续缴费)，非同量不直接比，仅留两路径数值表+勾稽
 * common     : system_test/common/gui-conn-lib.js
 * run        : node gt-4027.js [port]   （dev box 40215 常驻口, 只 connect/disconnect）
 */
'use strict';
const fs = require('fs'), path = require('path');
const L = require('../common/gui-conn-lib.js');
const PORT = parseInt(process.argv[2] || '40215', 10);
const DIR = __dirname;
const LOG = path.join(DIR, 'logs'); fs.mkdirSync(LOG, { recursive: true });

// ===== case-specific input =====
const FIXTURE = 'My-Case.md';
const PLAN = { retireYM: '2033-07', z: '0.6', segType: 'flexible' };
const RATES = [ { label: '0%', rate: 0, pct: '0' }, { label: '1.5%', rate: 0.015, pct: '1.5' } ];
// ===== expect output =====
const TOL = 0.001; // J账 / P月 |Δ| ≤ 0.001

(async () => {
  const startedAt = new Date().toISOString();
  const rec = L.makeRecorder(); let mp = null; let shot = null; const table = [];
  try {
    mp = await L.connectExisting(PORT);
    for (const rc of RATES) {
      const ref = L.buildFixtureInput(FIXTURE, rc.rate);
      const cmp = await L.openCompareResult(mp, ref.sharedInput, PLAN);
      const bas = await L.runBasicMonth(mp, ref, PLAN, rc.pct, PLAN.retireYM);
      const dJA = Math.abs(bas.JA - cmp.JA), dP = Math.abs(bas.P - cmp.P);
      rec.ck('J账-' + rc.label, 'basic/compare J账 |Δ|≤0.001', dJA <= TOL, dJA, '<=0.001');
      rec.ck('P月-' + rc.label, 'basic/compare P月 |Δ|≤0.001', dP <= TOL, dP, '<=0.001');
      table.push({ rate: rc.label,
        basic: { R储: bas.R, J账: bas.JA, P月: bas.P },
        compare: { R续: cmp.R, J账: cmp.JA, P月: cmp.P },
        delta: { J账: dJA, P月: dP },
        Rnote: '口径不同：R储(累计储存额) vs R续(继续缴费)，非同一量不直接比；R续×40%(8%/20%)≈入账本金' });
      if (rc.label === '0%') {
        shot = path.join(LOG, 'GT4027-basic-result-0pct.png');
        for (let i = 0; i < 3; i++) { const s = await L.safeAttempt(() => mp.screenshot({ path: shot })); if (s.ok && fs.existsSync(shot) && fs.statSync(shot).length > 5000) break; await L.sleep(1200); }
      }
    }
  } catch (e) { rec.ck('FATAL', String((e && e.message) || e), false); }
  finally { await L.disconnectQuiet(mp); }

  const t = rec.totals(); const ok = t.fail === 0;
  const summary = { case: 'GT-4027', type: 'GUI basic/compare parity', ok, startedAt, finishedAt: new Date().toISOString(),
    input: { fixture: FIXTURE, plan: PLAN, rates: RATES.map(r => r.label) }, tolerance: TOL, table,
    screenshot: fs.existsSync(shot || '') ? shot : null, totals: t, assertions: rec.list };
  fs.writeFileSync(path.join(LOG, 'result-GT4027.json'), JSON.stringify(summary, null, 2));
  console.log('GT4027 ' + (ok ? 'PASS' : 'FAIL') + ' ' + t.pass + '/' + (t.pass + t.fail));
  for (const x of table) console.log(x.rate + ' ΔJ账=' + x.delta.J账 + ' ΔP月=' + x.delta.P月 + ' basic=' + JSON.stringify(x.basic) + ' compare=' + JSON.stringify(x.compare));
  process.exit(ok ? 0 : 1);
})();
