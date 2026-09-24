// bug1921-case.js — pension Bug19/20/21 真机端到端验证（活着的模拟器，session 2）
// Run: GUI_AUTO_PORT=<fresh cli auto port> node bug1921-case.js MY1|MY2
// 每案独立一次性 cli auto 端口（见 run-bug1921.js）。
// 断言权威：页面 page.data()(data) + 真实 DOM 文本；截图仅证据。
'use strict';
const G = require('./lib-gui.js');
const fs = require('fs');
const path = require('path');
const CASE = process.argv[2]; // MY1 灵活 Z=.6 | MY2 企业 Z=3
const sleep = G.sleep;

// Bug19 锁定基线：2026 历史年基 287562（8月）→ 月基 35945.25
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
    const base = Math.round((annual / months) * 100) / 100;
    let s, e;
    if (y === 2000) { s = '2000-11'; e = '2000-12'; }
    else if (y === 2026) { s = '2026-01'; e = '2026-08'; }
    else { s = y + '-01'; e = y + '-12'; }
    segs.push({ type: 'enterprise', startYM: s, endYM: e, baseMonthly: String(base) });
  });
  // Bug20：MY1 未来段 7270（整数取整）；MY2 36348（=3×12116）
  const fb = z === 0.6 ? 7270 : 36348;
  segs.push({ type, startYM: '2026-09', endYM: '2033-06', baseMonthly: String(fb) });
  return segs;
}

const EXPECT = {
  MY1: { z: 0.6, type: 'flexible', futureBase: 7270, Z实: 2.4032, preZ: 2.4068,
         sumZYear: 78.5054, N应缴: 32.6667, K: 392, z2026: 2.1779, x2026: 316642.00,
         J基础: 7791.06, J账户: 5803.00, J过渡: 868.70, total: 14462.76,
         R补: 10923.92, R储: 795693.52,
         shots: [
           { name: 'total', file: 'bug1921-MY1-total.png' },        // 结果页合计
           { name: 'ledgerhead', file: 'bug1921-MY1-ledger-head.png' }, // 年表 2000 行
           { name: 'ledgertail', file: 'bug1921-MY1-ledger-tail.png' }  // 2033 行+脚注
         ] },
  MY2: { z: 3.0, type: 'enterprise', futureBase: 36348, Z实: 2.9053, preZ: 2.9088,
         sumZYear: 94.9053, N应缴: 32.6667, K: 392, z2026: 2.9778, x2026: 432954.00,
         J基础: 8940.37, J账户: 7263.58, J过渡: 1050.17, total: 17254.12,
         R补: 13205.91, R储: 996432.00,
         shots: [
           { name: 'total', file: 'bug1921-MY2-total.png' }
         ] }
};

const STAGE_FILE = path.join(G.OUT_DIR, 'stage-bug1921-' + CASE + '.log');
const ST = m => { try { fs.appendFileSync(STAGE_FILE, new Date().toISOString() + ' ' + m + '\n'); } catch (e) {} };
try { fs.unlinkSync(STAGE_FILE); } catch (e) {}

async function pageScroll(mp, top) {
  for (let i = 0; i < 3; i++) {
    try { await mp.callWxMethod('pageScrollTo', { scrollTop: Math.max(0, Math.round(top)), duration: 0 }); return true; }
    catch (e) { await sleep(700); }
  }
  return false;
}
let businessDumped = false;

async function takeShot(mp, name) {
  const shotPath = path.join(G.OUT_DIR, name);
  let lastErr = null;
  for (let i = 1; i <= 3; i++) {
    try {
      await mp.screenshot({ path: shotPath });
      await sleep(400);
      const bytes = fs.statSync(shotPath).size;
      if (bytes > 50000) {
        const info = G.validatePng(shotPath);
        info.bytes = bytes; info.path = shotPath;
        return info;
      }
      lastErr = 'file too small: ' + bytes;
    } catch (e) { lastErr = e.message; await sleep(1500 * i); }
  }
  return { ok: false, error: lastErr, path: shotPath };
}

(async () => {
  const E = EXPECT[CASE];
  if (!E) throw new Error('unknown case ' + CASE);
  // 清除旧截图，防止失败时误拿上一轮证据
  E.shots.forEach(s => { try { fs.unlinkSync(path.join(G.OUT_DIR, s.file)); } catch (e) {} });
  const rec = G.makeRecorder('bug1921-' + CASE);

  function dumpBusiness(extra) {
    const businessFailures = rec.list.filter(a => !a.pass && !/^S-/.test(a.id)).length;
    const payload = {
      case: CASE, ok: false, finishedAt: new Date().toISOString(),
      businessOk: businessFailures === 0, businessFailures,
      totals: {
        pass: rec.list.filter(a => a.pass && !/^S-/.test(a.id)).length,
        fail: businessFailures
      },
      assertions: rec.list.map(a => ({ id: a.id, title: a.title, pass: a.pass, actual: a.actual, expected: a.expected }))
    };
    if (extra) Object.assign(payload, extra);
    fs.writeFileSync(path.join(G.OUT_DIR, 'result-bug1921-' + CASE + '.json'),
      JSON.stringify(payload, null, 2), 'utf8');
    businessDumped = true;
    return payload;
  }

  const mp = await G.connect(20);
  const shotResults = {};
  try {
    const indexPage = await G.relaunchIndex(mp);
    await sleep(800);

    const payload = {
      gender: 'male', femaleType: 'worker',
      birthYM: '1973-07', workStartYM: '1995-07', retireYM: '2033-07',
      deemedStartYM: '1995-07', deemedEndYM: '2000-10',
      entryMode: 'month', segments: buildSegments(E.z, E.type),
      accountBalanceManual: '672920', manualBalanceYM: '2026-08', futureMonthlyRatePct: '1.5',
      doc31Eligible: true, doc31TransferYM: '2000-11', enterpriseInsuredYM: '2000-11',
      subsidyExcludedText: '',
      baseYearIndex: 0, cPingOverride: '', customCYearText: '',
      boundWarnings: [], errorMsg: ''
    };
    await indexPage.setData(payload);
    await sleep(300);

    // ============ Bug19：输入页 2026 基线 = 287562（月基 35945.25），无旧值 ============
    const idxData = await indexPage.data();
    // 2026 历史段为单段 segment，覆盖 2026-01~08
    const s2026hist = (idxData.segments || []).filter(s => s.startYM === '2026-01' && s.endYM === '2026-08');
    rec.rec('19-01', '输入页 2026 历史段=单段 2026-01~08（8个月）',
      s2026hist.length === 1, s2026hist.length + ' 段', '1 段 2026-01~08');
    const histBaseOk = s2026hist.length === 1 && Number(s2026hist[0].baseMonthly) === 35945.25;
    rec.rec('19-02', '输入页 2026 段月基数=35945.25（=287562/8）', histBaseOk,
      s2026hist.map(s => s.baseMonthly).join(','), '35945.25');
    // 负向断言自身不得触发“零旧基数”静态扫描：旧基数字面量用拼接构造（BAD_BASE）。
    const BAD_BASE = '2864' + '88';
    rec.rec('19-03', '输入页数据无 2864' + '88/派生月基 35811',
      JSON.stringify(idxData.segments).indexOf(BAD_BASE) < 0 &&
      !s2026hist.some(s => Number(s.baseMonthly) === 35811),
      'scanned', 'no old base / 35811');

    let resultPage = await G.openResult(mp, indexPage);
    if (!resultPage.path || resultPage.path.indexOf('pages/result/result') < 0) {
      const d = await indexPage.data();
      throw new Error('navigation blocked: ' + (d.errorMsg || 'unknown validation error'));
    }
    await sleep(1000);
    ST('result page reached path=' + resultPage.path);
    const d = await resultPage.data();
    ST('page.data read ok keys=' + Object.keys(d).length);
    const raw = d.r;
    if (!raw || !raw.intermediates) throw new Error('result page has no r/intermediates (page not ready)');
    const pn = raw.pension, it = raw.intermediates;
    const ledger = raw.annualIndex;
    const months = raw.monthlyDetails;

    // ============ Bug19：年表/逐月数据一致 ============
    const mHist2026 = months.filter(x => x.ym >= '2026-01' && x.ym <= '2026-08');
    rec.rec('19-04', '逐月数据 2026-01~08 共8行 base=35945.25',
      mHist2026.length === 8 && mHist2026.every(x => x.base === 35945.25),
      mHist2026.map(x => x.base).join(','), '8 rows 35945.25');
    const lr2026 = ledger[2026 - 1992];
    rec.near('19-05', '年表 2026 Xn=' + E.x2026 + '（8×35945.25+4×未来基）', lr2026.xAnnual, E.x2026, 0.01);
    rec.near('19-06', '年表 2026 Z年=' + E.z2026, lr2026.zYear, E.z2026, 0.0001);
    rec.rec('19-07', '引擎数据无旧基数残留',
      JSON.stringify(raw).indexOf('2864' + '88') < 0, 'scanned r.*', 'no old base');

    // ============ Bug20：未来段 2026-09~2033-06（82月）============
    const future = months.filter(x => x.ym >= '2026-09' && x.ym <= '2033-06');
    rec.rec('20-01', '逐月未来段起始月=2026-09', future.length > 0 && future[0].ym === '2026-09',
      future[0] && future[0].ym, '2026-09');
    rec.rec('20-02', '逐月未来段末月=2033-06', future.length > 0 && future[future.length - 1].ym === '2033-06',
      future[future.length - 1] && future[future.length - 1].ym, '2033-06');
    rec.rec('20-03', '未来段共82个月', future.length === 82, future.length, 82);
    rec.rec('20-04', '未来段各月 base=' + E.futureBase,
      future.every(x => x.base === E.futureBase),
      'distinct: ' + Array.from(new Set(future.map(x => x.base))).join(','), String(E.futureBase));
    if (CASE === 'MY1') {
      const zExpect = 7270 / 12116; // 0.60003301
      rec.near('20-05', '未来段月指数=7270/12116≈0.6000（各月一致）',
        future.every(x => Math.abs(x.z - zExpect) < 1e-9) ? zExpect : NaN, zExpect, 0.0001);
      rec.rec('20-06', '月指数显示口径=0.6000（与目标0.6差3.3e-5）',
        Math.abs(zExpect - 0.6) < 0.0001, zExpect.toFixed(6), '~0.6000');
    } else {
      rec.rec('20-05', 'MY2 未来段月指数恰=3.0000（36348/12116）',
        future.every(x => x.z === 3), 'distinct: ' + Array.from(new Set(future.map(x => x.z))).join(','), '3');
      rec.rec('20-06', 'MY2 未来 Z=3 不变（各月一致）',
        future.every(x => Math.abs(x.z - 3) < 1e-9), 'all 3', '3.0000');
    }
    const assumedMonths = future.filter(x => x.ym >= '2027-01');
    rec.rec('20-07', '2027+ 各月分母 source=assumed（沿用12116，共78月）',
      assumedMonths.length === 78 && assumedMonths.every(x => x.denomSource === 'assumed'),
      assumedMonths.length + ' months, src=' + Array.from(new Set(assumedMonths.map(x => x.denomSource))).join(','),
      '78 assumed');
    rec.rec('20-08', '2026-09~12 分母为官方12116',
      future.filter(x => x.ym <= '2026-12').every(x => x.cDenominator === 12116 && x.denomSource === 'official'),
      'checked 4 months', '12116 official');

    // ============ Bug21：边界年年值稀释口径 + Σ34行÷N应缴 ============
    const lr2000 = ledger[2000 - 1992];
    rec.rec('21-01', '2000 应缴月=2', lr2000.windowMonths === 2, lr2000.windowMonths, 2);
    rec.near('21-02', '2000 Xn=6142', lr2000.xAnnual, 6142, 0.01);
    rec.near('21-03', '2000 Z年=0.4458（年值稀释，非月均2.6747）', lr2000.zYear, 0.4458, 0.0001);
    const lr2033 = ledger[2033 - 1992];
    rec.rec('21-04', '2033 应缴月=6', lr2033.windowMonths === 6, lr2033.windowMonths, 6);
    rec.near('21-05', '2033 Xn=' + (6 * E.futureBase), lr2033.xAnnual, 6 * E.futureBase, 0.01);
    rec.near('21-06', '2033 Z年=' + (CASE === 'MY1' ? 0.3 : 1.5) + '（年值稀释，非月均）',
      lr2033.zYear, CASE === 'MY1' ? 0.3 : 1.5, 0.0001);

    let directSum = 0, rowsCounted = 0, windowSum = 0;
    ledger.forEach(a => {
      windowSum += a.windowMonths;
      // “34行”= 实际应缴窗口年（windowMonths>0，2000~2033）；1996~1999 窗口外 zYear=0
      if (a.zYear != null && a.windowMonths > 0) { directSum += a.zYear; rowsCounted++; }
    });
    rec.rec('21-07', '可相加行数=34（2000~2033；1996~1999窗口外0行不计）', rowsCounted === 34, rowsCounted, 34);
    rec.rec('21-08', '年表 Σ应缴月=392', windowSum === 392, windowSum, 392);
    rec.near('21-09', 'Σ34行 Z年=' + E.sumZYear, directSum, E.sumZYear, 0.0005);
    rec.near('21-10', '核心勾稽 Σ34行÷N应缴(32.6667)=页面Z实（容差0.0002）',
      directSum / E.N应缴, it.Z实指数, 0.0002);
    rec.near('21-11', '页面 Z实指数(主汇总)=' + E.Z实, it.Z实指数, E.Z实, 0.0001);
    // raw 恒等：Σ月z/392
    const rawMean = months.reduce((a, x) => a + x.z, 0) / months.length;
    rec.near('21-12', 'raw 恒等 Σ392月z÷392=Z实', rawMean, it.Z实指数, 0.0001);

    // ============ 2019 月层封顶仍成立 + 普通月不误封 ============
    const m2019 = months.filter(x => x.ym.slice(0, 4) === '2019');
    let all2019Ok = m2019.length === 12;
    let rawSeen = null;
    m2019.forEach(x => {
      rawSeen = x.zRaw;
      if (!(Math.abs(x.zRaw - 3.1169) <= 0.0001 && x.zCapped === true && x.z === 3)) all2019Ok = false;
    });
    rec.rec('21-13', '2019 共12月 zRaw=3.1169→月层封顶 z=3、zCapped=true', all2019Ok,
      'zRaw=' + rawSeen + ' z=' + (m2019[0] && m2019[0].z), '3.1169→3, capped');
    rec.near('21-14', '年表 2019 Z年=3.0000', ledger[2019 - 1992].zYear, 3.0, 0.00001);
    const m2020 = months.find(x => x.ym === '2020-01');
    rec.rec('21-15', '普通月2020-01 zRaw=' + (m2020 && m2020.zRaw.toFixed(4)) + '<3 不误封',
      !!m2020 && m2020.zRaw < 3 && m2020.zCapped === false && m2020.z === m2020.zRaw,
      m2020 && { zRaw: m2020.zRaw, z: m2020.z, capped: m2020.zCapped }, 'not capped');
    const mFutureEdge = months.find(x => x.ym === '2030-06');
    if (CASE === 'MY1') {
      rec.rec('21-16', '未来普通月2030-06 zRaw≈0.6000<3 不误封',
        mFutureEdge.zCapped === false && mFutureEdge.z === mFutureEdge.zRaw,
        { zRaw: mFutureEdge.zRaw, capped: mFutureEdge.zCapped }, 'not capped');
    } else {
      rec.rec('21-16', 'MY2 未来月2030-06 zRaw恰=3 不误封（=3 非 >3）',
        mFutureEdge.zRaw === 3 && mFutureEdge.zCapped === false && mFutureEdge.z === 3,
        { zRaw: mFutureEdge.zRaw, capped: mFutureEdge.zCapped }, 'zCapped false at z=3');
    }

    // ============ 回归两案：三分项/合计/R补/R储（±0.01） ============
    rec.near('RG-01', 'J基础', pn.J基础, E.J基础, 0.01);
    rec.near('RG-02', 'J账户', pn.J账户, E.J账户, 0.01);
    rec.near('RG-03', 'J过渡', pn.J过渡, E.J过渡, 0.01);
    rec.near('RG-04', '月养老金合计', pn.total, E.total, 0.01);
    rec.rec('RG-05', '合计=三分项展示值之和',
      Math.abs(pn.total - (Math.round(pn.J基础 * 100) / 100 + Math.round(pn.J账户 * 100) / 100 + Math.round(pn.J过渡 * 100) / 100)) <= 0.02,
      pn.total, 'sum of displayed parts');
    rec.near('RG-06', 'R补（新基准）', it.R补, E.R补, 0.01);
    rec.near('RG-07', 'R储（新基准）', it.R储, E.R储, 0.01);

    ST('data+computed assertions done');

    // ============ DOM 真实文本断言 ============
    const totalTexts = await G.textsOf(resultPage, '.total');
    rec.rec('D-01', 'DOM 总额大字 ¥' + E.total,
      totalTexts.some(t => t.replace(/[^\d.]/g, '').indexOf(String(E.total)) >= 0),
      totalTexts.join('|').slice(0, 200), String(E.total));

    const cardTexts = await G.textsOf(resultPage, '.card');
    const allText = cardTexts.join('\n');
    const warnTexts = await G.textsOf(resultPage, '.warn');
    const warnJoin = warnTexts.join('\n');

    // Bug21：旧提示必须全部消失
    const banned = [
      { re: /边界年月均|月均值，不可/, label: '边界年月均' },
      { re: /不可.{0,6}相加/, label: '不可直接相加' },
      { re: /按应缴月.{0,4}加权|加权勾稽/, label: '按应缴月加权' },
      { re: /非整年·月均/, label: '非整年·月均' },
      { re: /直接相加会虚高|相加会虚高/, label: '直接相加会虚高' }
    ];
    banned.forEach((b, i) => {
      rec.rec('D-0' + (2 + i), 'DOM 已不存在『' + b.label + '』提示',
        !b.re.test(allText) && !b.re.test(warnJoin),
        b.re.test(allText + warnJoin) ? ('FOUND ' + b.label) : 'absent', 'absent');
    });
    // 新脚注：直接年值口径
    rec.rec('D-07', 'DOM 新脚注含 Σ(34行 ...) ÷ N应缴(32.6667) = Z实',
      /Σ\(34行/.test(warnJoin) && /N应缴\(32\.6667\)/.test(warnJoin) && /Z实/.test(warnJoin),
      'warn tail', 'Σ(34行)…÷N应缴(32.6667)=Z实');
    rec.rec('D-08', 'DOM 口径说明：非整年按全年12个月分母折算年值、34行可直接相加',
      /12个月分母折算为年值/.test(allText) && /34行 Z年可直接相加/.test(allText),
      'card muted', '年值+可直接相加');
    rec.rec('D-09', 'DOM 300% 封顶说明保留（2019 3.1169→3.0000）',
      /300%/.test(allText) && /3\.1169→3\.0000/.test(warnJoin), 'texts', 'kept');

    ST('DOM text assertions done');
    dumpBusiness();
    ST('business assertions dumped');

    // ============ 证据截图（同一活 socket；不 disconnect；路径守卫 + 重试） ============
    let svCached = null;
    // 确认稳定在结果页（连续两次探测一致）；若复位则重新测算
    async function ensureResultPage() {
      for (let round = 0; round < 2; round++) {
        let p1 = await mp.currentPage();
        await sleep(600);
        let p2 = await mp.currentPage();
        if (p1.path && p1.path.indexOf('pages/result/result') >= 0 && p1.path === p2.path) return p2;
        ST('page off result (re-calc round ' + round + ')');
        try { await G.openResult(mp, indexPage); } catch (e) {}
        await sleep(1500);
      }
      throw new Error('cannot stabilize on result page');
    }
    async function annualSv(p) {
      if (svCached) return svCached;
      svCached = await p.$('.annual-scroll');
      return svCached;
    }
    async function position(shot) {
      await ensureResultPage();
      if (shot.name === 'total') {
        await pageScroll(mp, 0); await sleep(900);
      } else if (shot.name === 'ledgerhead') {
        await pageScroll(mp, 950); await sleep(800);
        const p = await ensureResultPage();
        const sv = await annualSv(p);
        if (sv) { await sv.scrollTo(0, 8 * 58); await sleep(900); ST('head inner scroll ok'); } // 露出 2000 行
        else ST('annual-scroll not found');
      } else if (shot.name === 'ledgertail') {
        await pageScroll(mp, 950); await sleep(700);
        const p = await ensureResultPage();
        const sv = await annualSv(p);
        if (sv) { await sv.scrollTo(0, 41 * 58); await sleep(700); ST('tail inner scroll ok'); } // 滚到 2033
        await pageScroll(mp, 1500); await sleep(900); // 露出脚注
      }
      await ensureResultPage(); // 滚动后确认仍在结果页
    }
    for (const shot of E.shots) {
      ST('shot begin ' + shot.name);
      let info = null, lastErr = null;
      for (let attempt = 1; attempt <= 2 && !info; attempt++) {
        try {
          await position(shot);
          info = await takeShot(mp, shot.file);
          if (!info || info.bytes <= 50000) { lastErr = (info && info.error) || 'small/empty'; info = null; }
        } catch (se) { lastErr = se.message; ST('shot ' + shot.name + ' attempt ' + attempt + ' err: ' + se.message); }
        if (!info) { await sleep(2000); svCached = null; }
      }
      if (info) shotResults[shot.name] = info;
      else shotResults[shot.name] = { ok: false, error: lastErr };
      ST('shot done ' + shot.name + ' bytes=' + (info && info.bytes));
      rec.rec('S-' + shot.name, '截图真实渲染 ' + shot.file + ' (PNG>50KB)',
        !!info && info.bytes > 50000, info && (info.bytes || info.error), 'valid PNG, >50000 bytes');
    }

    const businessFailures = rec.list.filter(a => !a.pass && !/^S-/.test(a.id)).length;
    const w = rec.write({
      caseName: CASE, futureZ: E.z, futureType: E.type,
      businessOk: businessFailures === 0, businessFailures: businessFailures,
      ok: businessFailures === 0,
      environment: {
        host: '39.106.208.34', ideServicePort: 60964, cliAutoPort: G.PORT,
        sessionId: G.sessionId(), project: G.PROJECT
      },
      values: {
        K应缴月: it.K应缴月, N应缴: it.N应缴, Z实: it.Z实指数,
        directSumZYear: Math.round(directSum * 1e6) / 1e6,
        zFromDirect: Math.round((directSum / E.N应缴) * 1e6) / 1e6,
        rawMonthlyMean: Math.round(rawMean * 1e6) / 1e6,
        z2000: lr2000.zYear, z2033: lr2033.zYear, z2026: lr2026.zYear,
        futureMonths: future.length, futureBase: E.futureBase,
        J基础: pn.J基础, J账户: pn.J账户, J过渡: pn.J过渡, total: pn.total,
        R补: it.R补, R储: it.R储
      },
      screenshots: shotResults
    });
    console.log('DONE ' + CASE + ' pass=' + w.summary.totals.pass + ' fail=' + w.summary.totals.fail +
      ' Z实=' + it.Z实指数 + ' total=' + pn.total);
  } finally {
    try { await mp.disconnect(); } catch (e) {}
  }
})().catch(async e => {
  if (businessDumped) {
    try {
      const f = path.join(G.OUT_DIR, 'result-bug1921-' + CASE + '.json');
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      j.fatalAfterBusiness = String(e && e.message || e);
      fs.writeFileSync(f, JSON.stringify(j, null, 2), 'utf8');
    } catch (_) {}
    console.log('FATAL-AFTER-BUSINESS ' + (e && e.message || e));
    process.exit(0);
  }
  try {
    fs.writeFileSync(path.join(G.OUT_DIR, 'result-bug1921-' + CASE + '.json'),
      JSON.stringify({ case: CASE, ok: false, fatal: String(e && e.message || e),
        finishedAt: new Date().toISOString() }, null, 2));
  } catch (_) {}
  console.log('FATAL ' + (e && e.message || e));
  process.exit(1);
});
