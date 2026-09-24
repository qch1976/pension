// bug2526-struct.js - Bug25/26 input-page structure verification on real simulator.
// Run: GUI_AUTO_PORT=<fresh one-shot cli auto port> node bug2526-struct.js
'use strict';
const fs = require('fs');
const path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const OUT = PROJECT + '\\autotest\\output\\gui';
const SDK_DIR = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const automator = require(SDK_DIR);
const PORT = parseInt(process.env.GUI_AUTO_PORT || '9651', 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

async function rr(fn, n) {
  let e = null;
  for (let i = 0; i < (n || 3); i++) {
    try { return await fn(); } catch (x) { e = x; await sleep(600 * (i + 1)); }
  }
  throw e;
}
async function connect() {
  let last = null;
  for (let i = 0; i < 25; i++) {
    try { return await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT }); }
    catch (e) { last = e; await sleep(1500); }
  }
  throw new Error('connect failed: ' + (last && last.message));
}
async function relaunchIndex(mp) {
  try { await mp.callWxMethod('clearStorageSync'); } catch (e) {}
  await mp.reLaunch('/pages/index/index').catch(() => {});
  const t0 = Date.now(); let page = null;
  while (Date.now() - t0 < 90000) {
    try {
      page = await rr(() => mp.currentPage());
      if (page && page.path && page.path.indexOf('pages/index/index') >= 0) {
        const dd = await rr(() => page.data());
        if (dd && Object.keys(dd).length > 5) break;
      }
    } catch (e) {}
    await sleep(800);
  }
  if (!page) throw new Error('index page not ready (active interactive session required)');
  return page;
}
function makeRec() {
  const list = [];
  return {
    list,
    rec: (id, t, pass, actual, expected) => list.push({ id, title: t, pass: !!pass, actual, expected }),
  };
}
async function screenshot(mp, name) {
  const p = path.join(OUT, name);
  try { fs.unlinkSync(p); } catch (e) {}
  for (let i = 1; i <= 3; i++) {
    try {
      await mp.screenshot({ path: p });
      await sleep(400);
      const bytes = fs.statSync(p).size;
      if (bytes > 40000) return { path: p, bytes };
    } catch (e) { await sleep(1200 * i); }
  }
  return null;
}

(async () => {
  const mp = await connect();
  const rec = makeRec();
  let fatal = null;
  const shots = { sec1: null, sec4: null };
  try {
    const page = await relaunchIndex(mp);
    await sleep(600);
    // ensure doc31 OFF: Bug26 field must be visible regardless
    await rr(() => page.setData({ doc31Eligible: false }));
    await sleep(400);

    // ---- Bug25: 5 cards, continuous numbering, title order ----
    const titleEls = await rr(() => page.$$('.card-title'));
    const titles = [];
    for (const el of titleEls) titles.push(String(await rr(() => el.text()) || '').replace(/\s+/g, ' ').trim());
    const wantTitles = [
      '① 基本信息',
      '② 视同缴费年限（按档案认定起止年月）',
      '③ 实际缴费记录（单位 / 灵活就业）',
      '④ 个人账户养老金',
      '⑤ 计发基数 C平 与缺口年度数据'
    ];
    rec.rec('B25-cards', '输入页共5个card且编号①~⑤连续、标题正确',
      titles.length === 5 && wantTitles.every((t, i) => titles[i] === t),
      JSON.stringify(titles), JSON.stringify(wantTitles));

    // no standalone ④-2 anywhere
    const bodyText = String(await rr(async () => {
      const el = await page.$('page');
      return el ? el.text() : '';
    }) || '');
    rec.rec('B25-no4-2', '页面不存在独立 section「④-2」',
      bodyText.indexOf('④-2') < 0 && bodyText.indexOf('4-2') < 0,
      bodyText.indexOf('④-2') >= 0 ? 'found ④-2' : 'clean', 'clean');

    // section 4 subheads
    const subEls = await rr(() => page.$$('.subhead'));
    const subs = [];
    for (const el of subEls) subs.push(String(await rr(() => el.text()) || '').replace(/\s+/g, ' ').trim());
    rec.rec('B25-subheads', 'section④ 下两个分项：① 个人账户储蓄额 / ② 人员身份与 R补',
      subs.length === 2 && subs[0].indexOf('个人账户储蓄额') >= 0 && subs[1].indexOf('人员身份与 R补') >= 0,
      JSON.stringify(subs), '["① 个人账户储蓄额","② 人员身份与 R补…"]');

    // controls retained in section4
    const labels = [];
    const labelEls = await rr(() => page.$$('.label'));
    for (const el of labelEls) labels.push(String(await rr(() => el.text()) || '').trim());
    rec.rec('B25-ctrl-balance', '④项①含「个人账户累计储存额」控件', labels.some(t => t.indexOf('个人账户累计储存额') >= 0),
      labels.find(t => t.indexOf('累计储存额') >= 0) || 'missing', '个人账户累计储存额(元)');
    rec.rec('B25-ctrl-doc31', '④项②含「是否属于31号文人员」控件', labels.some(t => t.indexOf('31号文') >= 0),
      labels.find(t => t.indexOf('31号文') >= 0) || 'missing', '是否属于31号文人员');

    // ---- Bug26: field in section 1, visible for non-doc31 ----
    // locate cards and check the enterprise row lives in the FIRST card
    const cards = await rr(() => page.$$('.card'));
    async function cardHasRow(card, key) {
      const rows = await card.$$('.row');
      for (const row of rows) {
        const labs = await row.$$('.label');
        for (const lx of labs) {
          const t = String(await lx.text() || '');
          if (t.indexOf(key) >= 0) return true;
        }
      }
      return false;
    }
    const inCard1 = cards.length >= 5 && await cardHasRow(cards[0], '企业实际参保缴费起始');
    const inCard4 = cards.length >= 5 && await cardHasRow(cards[3], '企业实际参保缴费起始');
    rec.rec('B26-inSec1', '「企业实际参保缴费起始」位于 section① 基本信息（doc31关闭仍可见）',
      inCard1, inCard1 ? 'found in card1' : 'not in card1', 'present in card ①');
    rec.rec('B26-notInSec4', 'section④ 内不再出现该字段控件', !inCard4,
      inCard4 ? 'found in card4' : 'absent', 'absent from card ④');

    // ordering: workStart row before enterprise row, enterprise row before retire row within card1
    const c1rows = await cards[0].$$('.row');
    const rowFlags = [];
    for (const row of c1rows) {
      const t = String(await row.text() || '');
      rowFlags.push(t.indexOf('参加工作年月') >= 0 ? 'work' :
        t.indexOf('企业实际参保缴费起始') >= 0 ? 'ent' :
        t.indexOf('拟退休年月') >= 0 ? 'retire' : '');
    }
    const iw = rowFlags.indexOf('work'), ie = rowFlags.indexOf('ent'), ir = rowFlags.indexOf('retire');
    rec.rec('B26-order', '字段次序：参加工作年月 → 企业实际参保缴费起始 → 拟退休年月',
      iw >= 0 && ie > iw && ir > ie, JSON.stringify(rowFlags), 'work < ent < retire');

    // data key present and settable
    const d0 = await rr(() => page.data());
    rec.rec('B26-datakey', 'page.data 含 enterpriseInsuredYM 键', Object.prototype.hasOwnProperty.call(d0, 'enterpriseInsuredYM'),
      Object.prototype.hasOwnProperty.call(d0, 'enterpriseInsuredYM'), 'key exists');
    await rr(() => page.setData({ enterpriseInsuredYM: '2004-09' }));
    await sleep(300);
    const d1 = await rr(() => page.data());
    rec.rec('B26-settable', '普通人员（非31号文）可录入该值', d1.enterpriseInsuredYM === '2004-09',
      d1.enterpriseInsuredYM, '2004-09');
    // reset to empty for cleanliness
    await rr(() => page.setData({ enterpriseInsuredYM: '' }));

    // ---- screenshots LAST (input page: sec① top, sec④ scrolled) ----
    shots.sec1 = await screenshot(mp, 'bug2526-input-sec1.png');
    rec.rec('ShotSec1', '输入页 section① 结构真实截图', !!shots.sec1,
      shots.sec1 && shots.sec1.bytes, 'PNG >40KB');
    for (let i = 0; i < 3; i++) {
      try { await mp.callWxMethod('pageScrollTo', { scrollTop: 900, duration: 0 }); break; }
      catch (e) { await sleep(800); }
    }
    await sleep(900);
    shots.sec4 = await screenshot(mp, 'bug2526-input-sec4.png');
    rec.rec('ShotSec4', '输入页 section④ 合并结构真实截图', !!shots.sec4,
      shots.sec4 && shots.sec4.bytes, 'PNG >40KB');
  } catch (e) {
    fatal = String(e && e.message || e);
  } finally {
    try { await mp.disconnect(); } catch (e) {}
  }
  const totals = rec.list.reduce((a, x) => { x.pass ? a.pass++ : a.fail++; return a; },
    { pass: 0, fail: 0 });
  const summary = {
    case: 'STRUCT', ok: !fatal && totals.fail === 0, fatal,
    totals, assertions: rec.list, screenshots: shots,
    finishedAt: new Date().toISOString(),
    runContext: { automationPort: PORT, project: PROJECT }
  };
  fs.writeFileSync(path.join(OUT, 'bug2526-struct.json'),
    JSON.stringify(summary, null, 2), 'utf8');
  console.log('DONE STRUCT pass=' + totals.pass + ' fail=' + totals.fail +
    (fatal ? ' fatal=' + fatal : ''));
  process.exit(summary.ok ? 0 : 2);
})();
