// mycases.js — user's two real cases (post Bug2/3/4 fix), GUI E2E via live simulator.
// Run: GUI_AUTO_PORT=<fresh cli auto port> node mycases.js MY1|MY2
// Each case gets its OWN one-shot cli auto port (see run-mycases.js).
'use strict';
const G = require('./lib-gui.js');
const fs = require('fs');
const path = require('path');
// T6: read the official current-year denominator table — never hardcode a frozen denominator.
const Policy = require('../../constants/policyData.js');
const CASE = process.argv[2];                 // MY1 flexible Z=.6 | MY2 enterprise Z=3
const sleep = G.sleep;
const FUTURE_START_YEAR = 2026;               // future segment begins 2026-09

// My-Case.md annual table: year base is ANNUAL contribution total; monthly = annual / months paid.
const hist = [
  [2000, 6142, 2], [2001, 41328], [2002, 47184], [2003, 58434], [2004, 69645],
  [2005, 81816], [2006, 95079], [2007, 105822], [2008, 116766], [2009, 130500],
  [2010, 142533], [2011, 149760], [2012, 163953], [2013, 183069], [2014, 198288],
  [2015, 220608], [2016, 243882], [2017, 266256], [2018, 291114], [2019, 293796],
  [2020, 300636], [2021, 328572], [2022, 360630], [2023, 394650], [2024, 415044],
  [2025, 426564], [2026, 287562, 8]
];

function buildSegments(z, type) {
  const segs = [];
  hist.forEach(([y, annual, mo]) => {
    const months = mo || 12;
    const base = Math.round((annual / months) * 100) / 100; // 2000:3071.00, 2026:35811.00
    let s, e;
    if (y === 2000) { s = '2000-11'; e = '2000-12'; }
    else if (y === 2026) { s = '2026-01'; e = '2026-08'; }
    else { s = y + '-01'; e = y + '-12'; }
    segs.push({ type: 'enterprise', startYM: s, endYM: e, baseMonthly: String(base) });
  });
  // Future 2026-09 -> 2033-06 (82 months).
  // T6 (owner-approved D1): derive from the OFFICIAL 2026 denominator (12116), rounded to whole yuan.
  //   MY1: round(0.6 x 12116)=round(7269.6)=7270 ; MY2: round(3 x 12116)=36348.
  // No frozen 11937 anywhere; follows the official table so it cannot drift.
  const officialDenom = Policy.indexDenominatorMonthly[FUTURE_START_YEAR];
  const fb = Math.round(z * officialDenom); // MY1 7270 | MY2 36348
  segs.push({ type, startYM: '2026-09', endYM: '2033-06', baseMonthly: String(fb) });
  return segs;
}

// T6 expected values = independent oracle (real engine, 7270/36348) cross-checked by first-principles Python.
const EXPECT = {
  MY1: { z: 0.6, type: 'flexible', Z实: 2.4032, N应缴: 32.6667, R补: 10923.92, G实: 868.70,
         R储: 795693.52, J基础: 7791.06, J账户: 5803.00, J过渡: 868.70, total: 14462.76 },
  MY2: { z: 3.0, type: 'enterprise', Z实: 2.9053, N应缴: 32.6667, R补: 13205.91, G实: 1050.17,
         R储: 996432.00, J基础: 8940.37, J账户: 7263.58, J过渡: 1050.17, total: 17254.12 }
};

(async () => {
  if (!EXPECT[CASE]) throw new Error('unknown case ' + CASE);
  const E = EXPECT[CASE];
  const rec = G.makeRecorder(CASE);
  const mp = await G.connect(20);
  let shotInfo = null, shotErr = null;
  try {
    const indexPage = await G.relaunchIndex(mp);
    await sleep(800);

    // Fixed post-fix input (page data keys — buildInput() maps these to engine inputs)
    const payload = {
      gender: 'male', femaleType: 'worker',
      birthYM: '1973-07', workStartYM: '1995-07', retireYM: '2033-07',
      hasDeemed: true, deemedStartYM: '1995-07', deemedEndYM: '2000-10', // T4: Bug22 校验要求 hasDeemed 开关置有
      entryMode: 'month', segments: buildSegments(E.z, E.type),
      accountBalanceManual: '672920', manualBalanceYM: '2026-08', futureMonthlyRatePct: '1.5',
      doc31Eligible: true, doc31TransferYM: '2000-11', enterpriseInsuredYM: '2000-11',
      subsidyExcludedText: '',
      baseYearIndex: 0, cPingOverride: '', customCYearText: '',
      boundWarnings: [], errorMsg: ''
    };
    await indexPage.setData(payload);
    await sleep(300);

    const resultPage = await G.openResult(mp, indexPage);
    if (!resultPage.path || resultPage.path.indexOf('pages/result/result') < 0) {
      const d = await indexPage.data();
      throw new Error('navigation blocked: ' + (d.errorMsg || 'unknown validation error'));
    }
    await sleep(1000);
    const d = await resultPage.data();
    const raw = d.r;
    if (!raw || !raw.intermediates) throw new Error('result page has no r/intermediates (page not ready)');
    const pn = raw.pension, it = raw.intermediates, mt = raw.meta, sub = raw.accountSubsidy;

    // ---- data assertions (read from page data, ±0.01) ----
    rec.near('A1', 'J基础', pn.J基础, E.J基础, 0.01);
    rec.near('A2', 'J账户', pn.J账户, E.J账户, 0.01);
    rec.near('A3', 'J过渡', pn.J过渡, E.J过渡, 0.01);
    rec.near('A4', '月养老金合计', pn.total, E.total, 0.01);
    rec.near('A5', 'Z实指数', it.Z实指数, E.Z实, 0.0001);
    rec.near('A6', 'N应缴(年)', it.N应缴, E.N应缴, 0.0001);
    rec.near('A7', 'R补', it.R补, E.R补, 0.01);
    rec.near('A8', 'G同', it.G同, 0, 0.01);
    rec.near('A9', 'G实', it.G实, E.G实, 0.01);
    rec.near('A10', 'N实同', it.N实同, 38.0, 0.0001);
    rec.near('A11', 'R储', it.R储, E.R储, 0.01);
    rec.rec('A12', 'K应缴月=392', it.K应缴月 === 392, it.K应缴月, 392);
    rec.rec('A13', '实缴月=392', it.actualPaidMonths === 392, it.actualPaidMonths, 392);
    rec.rec('A14', '认定视同月=64', it.deemedMonths === 64, it.deemedMonths, 64);
    rec.near('A15', 'N同=0', it.N同, 0, 0.0001);
    rec.near('A16', 'N实98=3', it.N实98, 3.0, 0.0001);
    rec.rec('A17', 'M=139', it.M === 139, it.M, 139);
    rec.rec('A18', 'R补补贴适用', sub && sub.applicable === true, sub && sub.applicable, true);
    rec.rec('A19', '资格eligible', mt.eligible === true, mt.eligible, true);

    // ---- real DOM text: the rows must visibly carry R补 / G同=0 / G实 / total ----
    const rows = await G.textsOf(resultPage, '.row');
    const joined = rows.join('\n');
    function rowHas(label, valueStr) {
      const re = new RegExp(label + '[\\s\\S]*?' + valueStr.replace('.', '\\.'));
      return re.test(joined);
    }
    rec.rec('D1', 'DOM 合计大字=' + E.total, (await G.textsOf(resultPage, '.total')).some(t => t.indexOf(String(E.total)) >= 0),
      'see .total', String(E.total));
    rec.rec('D2', 'DOM R补行含 ' + E.R补, rowHas('R补', String(E.R补)), 'row text', 'R补 ... ' + E.R补);
    rec.rec('D3', 'DOM G同行=0', rowHas('G同', '0'), 'row text', 'G同 ... 0');
    rec.rec('D4', 'DOM G实行含 ' + E.G实, rowHas('G实', String(E.G实)), 'row text', 'G实 ... ' + E.G实);

    // ---- evidence screenshots (automator native; retries; never fatal for business asserts) ----
    // Two shots per case: top (total card) and scrolled middle card (R补 / G同=0 / G实).
    async function takeShot(name) {
      const shotPath = path.join(G.OUT_DIR, CASE + '-' + name + '.png');
      for (let i = 1; i <= 3; i++) {
        try {
          await mp.screenshot({ path: shotPath });
          await sleep(500);
          const bytes = fs.statSync(shotPath).size;
          if (bytes > 50000) { const info = G.validatePng(shotPath); info.bytes = bytes; return info; }
          lastShotErr = 'file too small: ' + bytes;
        } catch (e) { lastShotErr = e.message; await sleep(1500 * i); }
      }
      return null;
    }
    let lastShotErr = null;
    const shotTop = await takeShot('result');
    // scroll to middle-variable area so R补 / G同 / G实 rows are visible
    let scrolled = false;
    for (let i = 0; i < 3; i++) {
      try { await mp.callWxMethod('pageScrollTo', { scrollTop: 760, duration: 0 }); scrolled = true; break; }
      catch (e) { await sleep(800); }
    }
    await sleep(900);
    const shotMid = scrolled ? await takeShot('result-mid') : null;
    shotInfo = shotTop;
    shotErr = shotTop ? (shotMid ? null : 'mid shot failed: ' + lastShotErr) : lastShotErr;
    rec.rec('S1', '结果页顶部截图真实(PNG>50KB)', !!shotTop, lastShotErr || (shotTop && shotTop.bytes),
      'valid PNG, >50000 bytes');
    rec.rec('S2', '结果页中部截图(含R补/G同/G实)', !!shotMid,
      shotMid ? shotMid.bytes : (scrolled ? lastShotErr : 'scroll failed'),
      'valid PNG, >50000 bytes');

    const w = rec.write({
      futureZ: E.z, futureType: E.type,
      pension: { J基础: pn.J基础, J账户: pn.J账户, J过渡: pn.J过渡, total: pn.total },
      intermediates: {
        Z实指数: it.Z实指数, N应缴: it.N应缴, K应缴月: it.K应缴月, R补: it.R补,
        G同: it.G同, G实: it.G实, N实同: it.N实同, N同: it.N同, N实98: it.N实98,
        R储: it.R储, M: it.M, actualPaidMonths: it.actualPaidMonths, deemedMonths: it.deemedMonths
      },
      screenshot: shotTop, screenshotMid: shotMid,
      screenshotError: shotInfo && shotMid ? null : shotErr
    });
    console.log('DONE ' + CASE + ' pass=' + w.summary.totals.pass + ' fail=' + w.summary.totals.fail +
      ' total=' + pn.total + ' shot=' + (shotTop ? shotTop.bytes : 'FAIL') +
      ' shotMid=' + (shotMid ? shotMid.bytes : 'FAIL'));
  } finally {
    try { await mp.disconnect(); } catch (e) {}
  }
})().catch(async (e) => {
  try {
    fs.writeFileSync(path.join(G.OUT_DIR, 'result-' + CASE + '.json'),
      JSON.stringify({ case: CASE, ok: false, fatal: String(e && e.message || e),
        finishedAt: new Date().toISOString() }, null, 2));
  } catch (_) {}
  console.log('FATAL ' + (e && e.message || e));
  process.exit(1);
});
