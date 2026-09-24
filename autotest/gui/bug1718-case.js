// bug1718-case.js — pension Bug17/18 真机端到端验证（活着的模拟器，session 2）
// Run: GUI_AUTO_PORT=<fresh cli auto port> node bug1718-case.js MY1|MY2
// 每案独立一次性 cli auto 端口（见 run-bug1718.js）。
// 断言权威：页面 page.data()(data) + 真实 DOM 文本；截图仅证据。
'use strict';
const G = require('./lib-gui.js');
const fs = require('fs');
const path = require('path');
const CASE = process.argv[2]; // MY1 灵活 Z=.6 | MY2 企业 Z=3
const sleep = G.sleep;

// 锁定基线（定稿 §1.3 C 版 + Bug18 月层封顶）：2026 历史年基 287562（8月）
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
  const fb = Math.round(z * 11937 * 100) / 100; // MY1 7162.20 | MY2 35811.00
  segs.push({ type, startYM: '2026-09', endYM: '2033-06', baseMonthly: String(fb) });
  return segs;
}

const EXPECT = {
  MY1: { z: 0.6, type: 'flexible', Z实: 2.4014, preZ: 2.4050, sumZYear: 80.9690,
         N应缴: 32.6667, K: 392,
         J基础: 7786.80, J账户: 5797.59, J过渡: 868.02, total: 14452.41,
         R补: 10915.46, R储: 794949.33,
         shots: [
           { name: 'cap', file: 'bug1718-MY1-cap.png' },        // 年表内 2019 封顶行
           { name: 'ledger', file: 'bug1718-MY1-ledger.png' }  // N应缴/勾稽/封顶说明区
         ] },
  MY2: { z: 3.0, type: 'enterprise', Z实: 2.8960, preZ: 2.8996, sumZYear: 98.3094,
         N应缴: 32.6667, K: 392,
         J基础: 8919.15, J账户: 7236.61, J过渡: 1046.82, total: 17202.58,
         R补: 13163.77, R储: 992724.85,
         shots: [
           { name: 'cap', file: 'bug1718-MY2-cap.png' },          // 年表内 2019 封顶行
           { name: 'nshould', file: 'bug1718-MY2-nshould.png' }  // Z实/N应缴 中间变量区
         ] }
};

const STAGE_FILE = path.join(G.OUT_DIR, 'stage-bug1718-' + CASE + '.log');
const ST = m => { try { fs.appendFileSync(STAGE_FILE, new Date().toISOString() + ' ' + m + '\n'); } catch (e) {} };
try { fs.unlinkSync(STAGE_FILE); } catch (e) {}

async function safeBox(el) {
  try { return await el.boundingBox(); } catch (e) { return null; }
}
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
  const rec = G.makeRecorder('bug1718-' + CASE);

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
    fs.writeFileSync(path.join(G.OUT_DIR, 'result-bug1718-' + CASE + '.json'),
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

    // ============ Bug17：N应缴/K、窗口、分子分母、加权勾稽 ============
    rec.rec('17-01', 'K应缴月=392', it.K应缴月 === 392, it.K应缴月, 392);
    rec.near('17-02', 'N应缴=32.6667年', it.N应缴, 32.6667, 0.0001);
    rec.rec('17-03', '逐月首月=2000-11', months[0].ym === '2000-11', months[0].ym, '2000-11');
    rec.rec('17-04', '逐月末月=2033-06', months[391].ym === '2033-06', months[391].ym, '2033-06');
    rec.rec('17-05', '逐月序列长度=392', months.length === 392, months.length, 392);

    let weightedNum = 0, windowSum = 0, directSum = 0, rowsCounted = 0;
    ledger.forEach(a => {
      windowSum += a.windowMonths;
      if (a.zYear != null) { weightedNum += a.zYear * a.windowMonths; directSum += a.zYear; rowsCounted++; }
    });
    rec.rec('17-06', '年表 Σ应缴月=392', windowSum === 392, windowSum, 392);
    rec.near('17-07', '分子 Σ(Z年×应缴月) 可逐步对上(=Z实×392)', weightedNum, E.Z实 * 392, 0.05);
    rec.near('17-08', '年表加权勾稽 Σ(Z年×应缴月)÷K = 页面Z实', weightedNum / 392, E.Z实, 0.0002);
    rec.near('17-09', '页面 Z实指数(主汇总)', it.Z实指数, E.Z实, 0.0001);
    rec.near('17-10', '分母 N应缴=392/12', it.K应缴月 / 12, E.N应缴, 0.0001);

    // 用户旧算法：34 行直接 ΣZ年 ÷ 年数
    rec.near('17-11', '34行 Z年 直接相加值(定稿基准)', directSum, E.sumZYear, 0.0005);
    const userStyle = directSum / E.N应缴;
    rec.rec('17-12', '旧算法(直接ΣZ年÷年数=' + userStyle.toFixed(4) + ')≠页面Z实，页面有说明',
      Math.abs(userStyle - E.Z实) > 0.05, userStyle.toFixed(4), '!= ' + E.Z实);

    // ============ Bug18：月指数层封顶 ============
    let rawSum = 0, cappedCount = 0, over3 = 0, negRaw = 0, reduction = 0;
    months.forEach(mo => {
      rawSum += mo.zRaw;
      if (mo.zCapped) cappedCount++;
      if (mo.z > 3) over3++;
      if (mo.zRaw < 0) negRaw++;
      reduction += mo.zRaw - mo.z;
    });
    rec.near('18-01', '封顶前 Z实(ΣzRaw÷392)=' + E.preZ, rawSum / 392, E.preZ, 0.0002);
    rec.rec('18-02', '封顶月数=12（仅2019年）', cappedCount === 12, cappedCount, 12);
    rec.rec('18-03', '封顶后无任何月 z>3', over3 === 0, over3, 0);
    rec.rec('18-04', 'zRaw 恒≥0', negRaw === 0, negRaw, 0);
    rec.near('18-05', '封顶削减量 Σ(zRaw−z)=1.4024', reduction, 1.4024, 0.001);

    const m2019 = months.filter(x => x.ym.slice(0, 4) === '2019');
    rec.rec('18-06', '2019 共12个月', m2019.length === 12, m2019.length, 12);
    let all2019Ok = m2019.length === 12;
    let rawSeen = null;
    m2019.forEach(x => {
      rawSeen = x.zRaw;
      if (!(Math.abs(x.zRaw - 3.1169) <= 0.0001 && x.zCapped === true && x.z === 3)) all2019Ok = false;
    });
    rec.rec('18-07', '2019 每月 zRaw=3.1169→月层封顶 z=3.0、zCapped=true', all2019Ok,
      'zRaw=' + rawSeen + ' z=' + (m2019[0] && m2019[0].z) + ' capped=' + (m2019[0] && m2019[0].zCapped),
      'zRaw 3.1169, z 3, zCapped true');

    const r2019 = ledger[2019 - 1992];
    rec.near('18-08', '年表 2019 Z年=3.0000（年账同步体现）', r2019.zYear, 3.0, 0.00001);
    // vmAnnual（页面视图层）2019 capped 标记
    const vmA = d.vmAnnual ? d.vmAnnual[27] : null;
    rec.rec('18-09', '页面视图 vmAnnual 2019 行 capped=true', !!(vmA && vmA.capped === true && vmA.zYearText === '3.0000'),
      vmA && { capped: vmA.capped, zYearText: vmA.zYearText }, { capped: true, zYearText: '3.0000' });

    // 普通月 z<3 不被误封（历史月 + 未来月各一）
    const m2020 = months.find(x => x.ym === '2020-01');
    const mFuture = months.find(x => x.ym === '2030-06');
    rec.rec('18-10', '普通月2020-01 zRaw=' + (m2020 && m2020.zRaw.toFixed(4)) + '<3 不被误封',
      !!m2020 && m2020.zRaw < 3 && m2020.zCapped === false && m2020.z === m2020.zRaw,
      m2020 && { zRaw: m2020.zRaw, z: m2020.z, capped: m2020.zCapped },
      'zRaw<3, zCapped false, z=zRaw');
    rec.rec('18-11', '未来月2030-06 zRaw=' + (mFuture && mFuture.zRaw.toFixed(4)) + '<3 不被误封',
      !!mFuture && mFuture.zRaw < 3 && mFuture.zCapped === false && mFuture.z === mFuture.zRaw,
      mFuture && { zRaw: mFuture.zRaw, z: mFuture.z, capped: mFuture.zCapped },
      'zRaw<3, zCapped false, z=zRaw');

    // ============ 回归：三分项 + 合计（±0.01） ============
    rec.near('RG-01', 'J基础', pn.J基础, E.J基础, 0.01);
    rec.near('RG-02', 'J账户', pn.J账户, E.J账户, 0.01);
    rec.near('RG-03', 'J过渡', pn.J过渡, E.J过渡, 0.01);
    rec.near('RG-04', '月养老金合计', pn.total, E.total, 0.01);
    rec.rec('RG-05', '合计=三分项展示值之和',
      Math.abs(pn.total - (Math.round(pn.J基础 * 100) / 100 + Math.round(pn.J账户 * 100) / 100 + Math.round(pn.J过渡 * 100) / 100)) <= 0.02,
      pn.total, 'sum of displayed parts');
    rec.near('RG-06', 'R补(含封顶后Z实)', it.R补, E.R补, 0.02);
    rec.near('RG-07', 'R储(不受封顶影响)', it.R储, E.R储, 0.02);

    ST('data+computed assertions done');
    // ============ DOM 真实文本断言 ============
    const totalTexts = await G.textsOf(resultPage, '.total');
    rec.rec('D-01', 'DOM 总额大字 ¥' + E.total,
      totalTexts.some(t => t.replace(/[^\d.]/g, '').indexOf(String(E.total)) >= 0),
      totalTexts.join('|'), String(E.total));

    const warnTexts = await G.textsOf(resultPage, '.warn');
    const warnJoin = warnTexts.join('\n');
    const cardTexts = await G.textsOf(resultPage, '.card');
    const allText = cardTexts.join('\n');
    rec.rec('D-02', 'DOM 含分母 392 与勾稽公式', /392/.test(warnJoin) && /勾稽/.test(warnJoin),
      'warn texts', '392 + 勾稽');
    rec.rec('D-03', 'DOM 提示直接把34行相加会虚高(旧算法不误导)', /相加会|直接把.{0,6}相加|虚高/.test(warnJoin),
      'warn texts', '直接相加会虚高');
    rec.rec('D-04', 'DOM 含 300% 上限/封顶说明', /300%/.test(allText) && /封顶/.test(allText),
      'card texts', '300% + 封顶');
    rec.rec('D-05', 'DOM 含官方依据(183号/政府令)', /183号/.test(allText),
      'card texts', '183号');
    rec.rec('D-06', 'DOM 标注月指数层/封顶月 2019 原值说明', /月指数层/.test(warnJoin),
      'warn texts', '月指数层');

    ST('DOM text assertions done');
    // 截图前先落盘业务断言（防止后续瞬态超时覆盖业务结果）
    dumpBusiness();
    ST('business assertions dumped');
    // 业务阶段 socket 不再需要：关闭后再开截图 socket，避免同一 cli auto 多连接竞态
    try { await mp.disconnect(); } catch (e) {}

    // ============ 证据截图 ============
    // 每个截图阶段使用【全新 connect socket】：被超时污染的 websocket 会令后续调用卡死
    // （start-cli.js RUNBOOK 教训）。cli auto 端口仍为本案一次性端口。
    // 复用同一 socket：前一张截图后重新查询元素（避免第二 connect 出现 page-not-on-top）。
    let mp2 = null;
    for (const shot of E.shots) {
      ST('shot begin ' + shot.name);
      // 复用同一 socket：前一张截图后重新查询元素（避免第二 connect 出现 page-not-on-top）。
      // 首个 shot 打开连接。
      if (!mp2) mp2 = await G.connect(15);
      let p2 = await mp2.currentPage();
      const wReady = Date.now();
      while (Date.now() - wReady < 20000) {
        const probe = await p2.$('.card');
        if (probe) break;
        await sleep(800);
        p2 = await mp2.currentPage();
      }
      await sleep(600);
      try {
        if (shot.name === 'ledger') {
          // 固定滚动到年表脚注区（不依赖 boundingBox）
          await pageScroll(mp2, 1500); await sleep(900);
        } else if (shot.name === 'nshould') {
          await pageScroll(mp2, 650); await sleep(900);
        } else if (shot.name === 'cap') {
          // 先 pageScroll 到年表卡，再 scroll-view 内部用固定行高滚到 2019
          await pageScroll(mp2, 1050); await sleep(800);
          p2 = await mp2.currentPage();
          const sv = await p2.$('.annual-scroll');
          if (sv) {
            await sv.scrollTo(27 * 58);
            await sleep(900);
            ST('cap fixed scroll, sv found');
          } else { ST('cap annual-scroll not found'); }
        }
        const info = await takeShot(mp2, shot.file);
        shotResults[shot.name] = info;
        ST('shot done ' + shot.name + ' bytes=' + (info && info.bytes));
        rec.rec('S-' + shot.name, '截图真实渲染 ' + shot.file + ' (PNG>50KB)',
          !!info && info.bytes > 50000, info && (info.bytes || info.error), 'valid PNG, >50000 bytes');
      } catch (se) {
        ST('shot ' + shot.name + ' stage error: ' + se.message);
        shotResults[shot.name] = { ok: false, error: se.message };
        rec.rec('S-' + shot.name, '截图真实渲染 ' + shot.file, false, se.message, 'valid PNG');
      } finally {
        // 仅在最后一张后断开
        if (shot === E.shots[E.shots.length - 1]) { try { await mp2.disconnect(); } catch (e) {} mp2 = null; }
      }
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
        weightedNumerator: Math.round(weightedNum * 1e6) / 1e6,
        directSumZYear: Math.round(directSum * 1e6) / 1e6,
        userStyle: Math.round(userStyle * 1e6) / 1e6,
        preCapZ: Math.round((rawSum / 392) * 1e6) / 1e6,
        cappedMonths: cappedCount, capReduction: Math.round(reduction * 1e6) / 1e6,
        J基础: pn.J基础, J账户: pn.J账户, J过渡: pn.J过渡, total: pn.total,
        R补: it.R补, R储: it.R储,
        normalMonth2020: m2020 && { zRaw: m2020.zRaw, z: m2020.z, capped: m2020.zCapped },
        futureMonth2030: mFuture && { zRaw: mFuture.zRaw, z: mFuture.z, capped: mFuture.zCapped }
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
    // 业务断言已落盘：合并标注截图阶段异常，不覆盖业务结果
    try {
      const f = path.join(G.OUT_DIR, 'result-bug1718-' + CASE + '.json');
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      j.fatalAfterBusiness = String(e && e.message || e);
      fs.writeFileSync(f, JSON.stringify(j, null, 2), 'utf8');
    } catch (_) {}
    console.log('FATAL-AFTER-BUSINESS ' + (e && e.message || e));
    process.exit(0); // 业务结果有效
  }
  try {
    fs.writeFileSync(path.join(G.OUT_DIR, 'result-bug1718-' + CASE + '.json'),
      JSON.stringify({ case: CASE, ok: false, fatal: String(e && e.message || e),
        finishedAt: new Date().toISOString() }, null, 2));
  } catch (_) {}
  console.log('FATAL ' + (e && e.message || e));
  process.exit(1);
});
