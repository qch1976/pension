/*
 * cases.js <C1|C2|C3|C4|C5> —— pension R储/R补 GUI 业务断言集（每 case 独立 result-<case>.json）
 * 连接 start-cli.js 常驻的 automation 端口（9561），必须在 RDP session 2 内运行。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const G = require('./lib-gui.js');

const CASE = process.argv[2];
const sleep = G.sleep;

async function shoot(mp, name) {
  const file = path.join(G.OUT_DIR, name + '.png');
  let lastErr = null;
  // automator screenshot is an evidence-only final step; retry transient WS timeouts
  // and never let a screenshot exception mark the whole business case fatal.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      try { fs.unlinkSync(file); } catch (e) {}
      await mp.screenshot({ path: file });
      await sleep(500);
      const bytes = fs.existsSync(file) ? fs.statSync(file).size : 0;
      let png = null;
      try { png = G.validatePng(file); } catch (e) { png = { error: e.message }; }
      const ok = bytes > 10240 && png && png.distinctColors > 300 && png.nonWhitePct > 1;
      if (ok) return { name, path: file, bytes, png, ok: true, attempts: attempt };
      lastErr = 'invalid screenshot: bytes=' + bytes + ' png=' + JSON.stringify(png);
    } catch (e) {
      lastErr = e && e.message || String(e);
    }
    if (attempt < 3) await sleep(1500 * attempt);
  }
  const bytes = fs.existsSync(file) ? fs.statSync(file).size : 0;
  let png = null;
  try { png = G.validatePng(file); } catch (e) { png = { error: e.message }; }
  return { name, path: file, bytes, png, ok: false, attempts: 3, error: lastErr };
}

(async () => {
  const R = G.makeRecorder(CASE);
  let shotInfo = null;
  let mp = null;
  try {
    mp = await G.connect(25);
    await mp.checkVersion().catch(() => {});

    if (CASE === 'C1') {
      // 默认普通职工：R补=0 / applicable=false / 总额7457.38 / 计算步骤无 R补-P13 行
      let indexPage = await G.relaunchIndex(mp);
      await indexPage.setData(G.baseInput());
      await sleep(300);
      let resultPage = await G.openResult(mp, indexPage);
      R.rec('C1-01', '跳转结果页 pages/result/result', resultPage.path === 'pages/result/result', resultPage.path, 'pages/result/result');
      const d = await resultPage.data();
      R.rec('C1-02', 'ready=true（真实页面数据）', d.ready === true, d.ready, true);
      R.rec('C1-03', '普通职工 R补=0', d.r.intermediates['R补'] === 0, d.r.intermediates['R补'], 0);
      R.rec('C1-04', 'accountSubsidy.applicable=false', d.r.accountSubsidy.applicable === false, d.r.accountSubsidy.applicable, false);
      R.rec('C1-05', 'R储=144739.20（S1 不计息基准）', Math.abs(d.r.intermediates['R储'] - 144739.2) < 0.01, d.r.intermediates['R储'], 144739.2);
      R.near('C1-06', 'J账户=R储÷139=1041.29', d.r.pension['J账户'], 1041.29, 0.01);
      R.near('C1-07', '养老金总额=7457.38（V1.1 零差异回归）', d.r.pension.total, 7457.38, 0.01);
      const keys = d.r.formulaLines.map(f => f.key + '/' + f.ref);
      R.rec('C1-08', '计算步骤公式 4 条', d.r.formulaLines.length === 4, d.r.formulaLines.length, 4);
      R.rec('C1-09', '计算步骤区无 R补/P13 行', keys.join(',').indexOf('R补') < 0, keys.join(','), 'no R补/P13');
      R.rec('C1-10', 'vm.subsidy.amount=0', d.vm.subsidy.amount === 0, d.vm.subsidy.amount, 0);
      R.rec('C1-11', 'vm.subsidy 状态文案=不适用（非31号第一条人员）',
        d.vm.subsidy.statusText.indexOf('不适用') >= 0 && d.vm.subsidy.statusText.indexOf('31') >= 0,
        d.vm.subsidy.statusText, '含 不适用/31号');
      R.rec('C1-12', 'vm.subsidy.showFormula=false（无分档明细）', d.vm.subsidy.showFormula === false, d.vm.subsidy.showFormula, false);
      const totalText = await (await resultPage.$('.total')).text();
      R.rec('C1-13', 'DOM 真实渲染总额含 7457.38', /7457\.38/.test(String(totalText)), String(totalText), '含 7457.38');
      const vals = await G.textsOf(resultPage, '.value');
      const labels = await G.textsOf(resultPage, '.label');
      R.rec('C1-14', 'DOM 渲染 R补 行标签且值区不出现 8990.16',
        labels.some(t => t.indexOf('R补') >= 0) && !vals.some(t => t.indexOf('8990.16') >= 0),
        'labels=' + labels.filter(t => t.indexOf('R补') >= 0).join('|') + ';has8990=' + vals.some(t => t.indexOf('8990.16') >= 0),
        '有 R补 标签；无 8990.16');

    } else if (CASE === 'C2') {
      // 31号人员 2003-01 调入：R补=8990.16 / J账户=(R储+8990.16)/139 / 分档 / 不入余额 / P13 弹窗
      let indexPage = await G.relaunchIndex(mp);
      await indexPage.setData(G.baseInput({
        doc31Eligible: true, doc31TransferYM: '2003-01', enterpriseInsuredYM: '2003-01',
        segments: G.segmentsFrom2003(1)
      }));
      await sleep(300);
      let resultPage = await G.openResult(mp, indexPage);
      const d = await resultPage.data();
      R.rec('C2-01', '跳转结果页', resultPage.path === 'pages/result/result', resultPage.path, 'pages/result/result');
      R.rec('C2-02', 'ready=true', d.ready === true, d.ready, true);
      R.rec('C2-03', 'applicable=true', d.r.accountSubsidy.applicable === true, d.r.accountSubsidy.applicable, true);
      R.near('C2-04', 'R补=8990.16（官方分档复算）', d.r.intermediates['R补'], 8990.16, 0.01);
      const rStore = d.r.intermediates['R储'];
      const expectJ = Math.round((rStore + 8990.16) / 139 * 100) / 100;
      R.near('C2-05', 'J账户=(R储+8990.16)÷139=1040.43', d.r.pension['J账户'], expectJ, 0.01);
      R.near('C2-06', 'J账户精确期望 1040.43', d.r.pension['J账户'], 1040.43, 0.01);
      R.rec('C2-07', 'R储数值不含 8990.16（=135629.83，Z补贴不入余额）',
        Math.abs(rStore - 135629.83) < 0.02 && Math.abs(rStore - 8990.16) > 1, rStore, 135629.83);
      R.rec('C2-08', '未建账模拟 123 个月（1992-10~2002-12）', d.r.accountSubsidy.monthCount === 123, d.r.accountSubsidy.monthCount, 123);
      R.rec('C2-09', '期间文本 1992-10~2002-12',
        d.vm.subsidy.periodText === '1992-10~2002-12', d.vm.subsidy.periodText, '1992-10~2002-12');
      const tiers = {};
      d.r.accountSubsidy.tiers.forEach(t => { tiers[t.rate] = t; });
      R.near('C2-10', '2%档=82.425', tiers[0.02] && tiers[0.02].bracket, 82.425, 1e-6);
      R.near('C2-11', '5%档=1714.775', tiers[0.05] && tiers[0.05].bracket, 1714.775, 1e-6);
      R.near('C2-12', '11%档=7192.955', tiers[0.11] && tiers[0.11].bracket, 7192.955, 1e-6);
      R.rec('C2-13', '无 8% 档（2003-01 调入），共 3 档', d.r.accountSubsidy.tiers.length === 3, d.r.accountSubsidy.tiers.length, 3);
      R.rec('C2-14', '「不计入账户实际储存额」说明存在',
        d.vm.subsidy.notIncludedNote.indexOf('不计入') >= 0 && d.vm.subsidy.notIncludedNote.indexOf('实际储存额') >= 0,
        d.vm.subsidy.notIncludedNote.slice(0, 60), '含 不计入/实际储存额');
      R.rec('C2-15', '状态文案为适用并入 J账户', d.vm.subsidy.statusText.indexOf('适用') >= 0, d.vm.subsidy.statusText.slice(0, 60), '含 适用');
      const keys = d.r.formulaLines.map(f => f.key + '/' + f.ref);
      R.rec('C2-16', '计算步骤 5 条，末条 R补/P13',
        d.r.formulaLines.length === 5 && d.r.formulaLines[4].key === 'R补' && d.r.formulaLines[4].ref === 'P13',
        keys.join(','), '…R补/P13');
      const vals = await G.textsOf(resultPage, '.value');
      R.rec('C2-17', 'DOM 真实渲染 8990.16', vals.some(t => t.indexOf('8990.16') >= 0), vals.join('|').slice(0, 260), '含 8990.16');
      // P13 角标弹窗
      const badge = await resultPage.$('text[data-id="P13"]');
      R.rec('C2-18', 'P13 角标元素存在', !!badge, !!badge, true);
      if (badge) {
        await badge.tap();
        await sleep(700);
        const d2 = await resultPage.data();
        R.rec('C2-19', 'P13 弹窗打开 refDetail', !!d2.refDetail, d2.refDetail && d2.refDetail.name, '弹窗对象非空');
        R.rec('C2-20', '弹窗文号=京劳社养发〔2007〕31号',
          d2.refDetail && d2.refDetail.docNo === '京劳社养发〔2007〕31号', d2.refDetail && d2.refDetail.docNo, '京劳社养发〔2007〕31号');
        R.rec('C2-21', '弹窗 URL=首都之窗 31 号文原文',
          d2.refDetail && /beijing\.gov\.cn/.test(d2.refDetail.url) && /t20250929_4213600/.test(d2.refDetail.url),
          d2.refDetail && d2.refDetail.url, 'beijing.gov.cn t20250929_4213600');
      }
      shotInfo = await shoot(mp, 'C2-result-doc31');
      R.rec('C2-22', '最终模拟器截图非空白/报错页', !!shotInfo.ok, shotInfo && { bytes: shotInfo.bytes, png: shotInfo.png }, 'bytes>10KB,colors>300,nonWhite>1%');

    } else if (CASE === 'C3') {
      // 身份门槛：调动年月早于1998阻断 / 必填项空阻断（留在首页，不跳转）
      let indexPage = await G.relaunchIndex(mp);
      await indexPage.setData(G.baseInput({
        doc31Eligible: true, doc31TransferYM: '1996-05', enterpriseInsuredYM: '2000-01',
        segments: G.segmentsFrom2003(1)
      }));
      await indexPage.callMethod('onCalculate');
      await sleep(600);
      let cur = await mp.currentPage();
      let ed = await indexPage.data();
      R.rec('C3-01', '调动1996-05：非跳转（留在首页）', cur.path === 'pages/index/index', cur.path, 'pages/index/index');
      R.rec('C3-02', '阻断提示含 1998 与31号文',
        /1998/.test(ed.errorMsg || '') && /31/.test(ed.errorMsg || ''), ed.errorMsg, '含 1998/31号');

      indexPage = await G.relaunchIndex(mp);
      await indexPage.setData(G.baseInput({
        doc31Eligible: true, doc31TransferYM: '', enterpriseInsuredYM: '',
        segments: G.segmentsFrom2003(1)
      }));
      await indexPage.callMethod('onCalculate');
      await sleep(600);
      cur = await mp.currentPage();
      ed = await indexPage.data();
      R.rec('C3-03', '必填项留空：非跳转（留在首页）', cur.path === 'pages/index/index', cur.path, 'pages/index/index');
      R.rec('C3-04', '阻断提示要求填写调动/入伍/转制年月',
        /调动|入伍|转制/.test(ed.errorMsg || ''), ed.errorMsg, '含 调动/入伍/转制');

      indexPage = await G.relaunchIndex(mp);
      await indexPage.setData(G.baseInput({
        doc31Eligible: true, doc31TransferYM: '2003-01', enterpriseInsuredYM: '',
        segments: G.segmentsFrom2003(1)
      }));
      await indexPage.callMethod('onCalculate');
      await sleep(600);
      cur = await mp.currentPage();
      ed = await indexPage.data();
      R.rec('C3-05', '缺企业参保起始：非跳转', cur.path === 'pages/index/index', cur.path, 'pages/index/index');
      R.rec('C3-06', '阻断提示要求填写企业实际参保缴费起始年月',
        /参保.*起始/.test(ed.errorMsg || ''), ed.errorMsg, '含 参保…起始');

    } else if (CASE === 'C4') {
      // 缺 C 年阻断：2030 调入/参保 → 2026 等年度缺 C 年，结果页可出但 R补=0 + 黄字补录提示
      let indexPage = await G.relaunchIndex(mp);
      await indexPage.setData(G.baseInput({
        doc31Eligible: true, doc31TransferYM: '2030-01', enterpriseInsuredYM: '2030-01',
        segments: [], accountBalanceManual: '100000', birthYM: '1970-10', retireYM: '2030-10'
      }));
      let resultPage = await G.openResult(mp, indexPage);
      const d = await resultPage.data();
      R.rec('C4-01', '跳转结果页（主险仍可测算）', resultPage.path === 'pages/result/result', resultPage.path, 'pages/result/result');
      R.rec('C4-02', 'R补=0', d.r.intermediates['R补'] === 0, d.r.intermediates['R补'], 0);
      R.rec('C4-03', 'applicable=false（缺C年不猜测）', d.r.accountSubsidy.applicable === false, d.r.accountSubsidy.applicable, false);
      R.rec('C4-04', 'reason=missing-annual-wage', d.r.accountSubsidy.reason === 'missing-annual-wage', d.r.accountSubsidy.reason, 'missing-annual-wage');
      R.rec('C4-05', 'missingYears 含 2026',
        Array.isArray(d.r.accountSubsidy.missingYears) && d.r.accountSubsidy.missingYears.indexOf(2026) >= 0,
        d.r.accountSubsidy.missingYears, '包含 2026');
      R.rec('C4-06', '引擎 warning 含缺年度与补录引导',
        /2026/.test(d.r.accountSubsidy.warning || '') && /补录/.test(d.r.accountSubsidy.warning || ''),
        d.r.accountSubsidy.warning, '含 2026/补录');
      R.rec('C4-07', '结果页 vm 状态文案为警告并含补录',
        d.vm.subsidy.statusText.indexOf('R补=0') >= 0 && /补录/.test(d.vm.subsidy.statusText),
        d.vm.subsidy.statusText.slice(0, 120), '含 R补=0/补录');

    } else if (CASE === 'C5') {
      // 文案/符号映射 AC-RC-01：R储=21号文累计储存额、R补=31号文 Z补贴、用户口径符号
      let indexPage = await G.relaunchIndex(mp);
      await indexPage.setData({ doc31Eligible: true });
      await sleep(400);
      let muted = await G.textsOf(indexPage, '.muted');
      let titles = await G.textsOf(indexPage, '.card-title');
      const idxAll = muted.concat(titles).join('\n');
      R.rec('C5-01', '输入页：R储=官方「个人账户累计储存额」21号第二条(二)',
        idxAll.indexOf('个人账户累计储存额') >= 0 && /21号第二条\(二\)/.test(idxAll), true, true);
      R.rec('C5-02', '输入页：明示「用户口径符号/用户符号」，不宣称官方字母符号',
        /用户口径符号|用户符号/.test(idxAll), true, true);
      R.rec('C5-03', '输入页：R补=个人账户补贴额 Z补贴 + 31号',
        idxAll.indexOf('Z补贴') >= 0 && idxAll.indexOf('31号') >= 0, true, true);

      let indexPage2 = await G.relaunchIndex(mp);
      await indexPage2.setData(G.baseInput({
        doc31Eligible: true, doc31TransferYM: '2003-01', enterpriseInsuredYM: '2003-01',
        segments: G.segmentsFrom2003(1)
      }));
      let resultPage = await G.openResult(mp, indexPage2);
      const d = await resultPage.data();
      const rm = await G.textsOf(resultPage, '.muted');
      const resAll = rm.join('\n');
      R.rec('C5-04', '结果页：R储对应「个人账户累计储存额」（21号文第二条(二)）',
        resAll.indexOf('个人账户累计储存额') >= 0 && /21号文第二条\(二\)/.test(resAll), true, true);
      R.rec('C5-05', '结果页：R储标注「用户口径符号」',
        /用户口径符号|用户符号/.test(resAll), true, true);
      R.rec('C5-06', '结果页：R补=Z补贴、31号文第二条(三)，且明示用户符号',
        /Z补贴/.test(resAll) && /31号文第二条\(三\)/.test(resAll) && /用户符号|用户口径符号/.test(resAll),
        true, true);
      R.rec('C5-07', '结果页：「不计入个人账户实际储存额」口径说明',
        /不计入.*实际储存额/.test(resAll), true, true);
      R.rec('C5-08', '计算步骤含 R补/P13 引用',
        d.r.formulaLines.some(f => f.ref === 'P13'), d.r.formulaLines.map(f => f.ref).join(','), '含 P13');
    }

    await mp.close();
    const out = R.write(shotInfo ? { screenshot: { name: shotInfo.name, path: shotInfo.path, bytes: shotInfo.bytes, png: shotInfo.png, ok: shotInfo.ok } } : null);
    console.log(CASE + '_RESULT=' + out.file + ' ok=' + out.summary.ok + ' pass=' + out.summary.totals.pass + ' fail=' + out.summary.totals.fail);
    process.exit(out.summary.ok ? 0 : 1);
  } catch (e) {
    try { if (mp) await mp.close(); } catch (x) {}
    const out = R.write({ fatal: String(e && e.message || e), stack: String(e && e.stack || '').slice(0, 800), screenshot: shotInfo || null });
    console.log(CASE + '_FATAL ' + out.file + ' ' + (e && e.message));
    process.exit(1);
  }
})();
