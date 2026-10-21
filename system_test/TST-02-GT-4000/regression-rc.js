/*
 * pension 项目私有 GUI 真实回归脚本（R储 / R补 矩阵，specification V1.2 §2.2 / §2.2.1）
 * 测试负责人 YDL（wf-22925e79520b-node_tester_automation）
 *
 * 约束（共享 RUNBOOK）：
 *  - 仅使用公共 SDK C:\Users\Administrator\wechat-automation\node_modules\miniprogram-automator（不重复安装）
 *  - 必须由交互式计划任务 OpenClawAutoTest 在 RDP/session 2 内运行（SSH/session 0 不算 GUI 回归）
 *  - 产出 result.json + run.log + 真实模拟器截图（非空白/二维码/报错页）
 *
 * 场景（与 spec 验收标准 AC-RC-01~11 / 开发侧 account-subsidy-check.js 对齐）：
 *  BOOT  首页/录入页可启动，渲染标题与政策版本
 *  S1    普通企业职工：R补=0、R储=144739.20、总额=7457.38、公式行4条、J账户=R储÷M
 *  S2    31号文人员 2003-01 参保（RC-T02 政策样例）：R补=8990.16、R储=135629.83、J账户=1040.43、
 *        分档 2%/5%/11%=82.425/1714.775/7192.955、模拟123月、公式行5条（R补/P13）
 *  S3    扣除区间 1995-01~1996-12：扣24月/剩99月、5%档=980.575、R补=8255.96（AC-RC-08）
 *  S4    手录 R储=100000（RC-T08）：展示 R储=100000、J账户=(100000+8990.16)/139=784.10
 *  S6    参保后按60%缴费：Z实≈0.6、R补=8990.155×0.6=5394.09（AC-RC-06，机关年限不入分母）
 *  E1/E2/E3 错误/边界：31号调动早于1998-01 阻断；固定利率越界阻断；缴费段起止倒置阻断
 */
'use strict';
const path = require('path');
const fs = require('fs');
const cp = require('child_process');

const SDK_DIR = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const automator = require(SDK_DIR);
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const P = require(path.join(PROJECT, 'constants', 'policyData.js'));
const OUT_DIR = path.join(PROJECT, 'autotest', 'output', 'regression-rc');
const RESULT_JSON = path.join(OUT_DIR, 'result.json');
const CLI_BAT = 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
const PORT = parseInt(process.env.AUTO_PORT || '9560', 10); // 与已验证 b-run.js 同端口
const IDE_PORT = 29912;

// 断开的 RDP 会话中 SESSIONNAME 可能为空；用进程 SessionId 判定（RUNBOOK §3 必须 session 2）
function currentSessionId() {
  try {
    const out = cp.execFileSync('powershell.exe',
      ['-NoProfile', '-Command', '(Get-Process -Id $PID).SessionId'], { encoding: 'utf8' }).trim();
    return parseInt(out, 10);
  } catch (e) { return null; }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const logLines = [];
function log(msg) { const line = `[${new Date().toISOString()}] ${msg}`; console.log(line); logLines.push(line); }

const assertions = [];
function rec(id, scenario, title, pass, actual, expected) {
  assertions.push({ id, scenario, title, pass: !!pass, actual, expected });
  log(`${pass ? 'PASS' : 'FAIL'} ${id} ${title} | actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
}
function near(id, scenario, title, actual, expected, tol) {
  const a = Number(actual);
  rec(id, scenario, title, isFinite(a) && Math.abs(a - expected) <= tol, Math.round(a * 1e6) / 1e6, expected + ' ±' + tol);
}
function eq(id, scenario, title, actual, expected) {
  rec(id, scenario, title, actual === expected, actual, expected);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function seg(type, a, b, base) {
  return { type, startYM: a, endYM: b, baseMonthly: String(base) };
}
// S1/普通人群输入：1992年前参加工作男性，1985-07参加工作，2025-10退休，不计息
// 1992-1995 缺口年度手录（T-10 口径），1996 起按上年社平100%缴费（Z实指数=1）
function baseInput(extra) {
  const segments = [
    seg('enterprise', '1992-10', '1992-12', 500),
    seg('enterprise', '1993-01', '1993-12', 600),
    seg('enterprise', '1994-01', '1994-12', 700),
    seg('enterprise', '1995-01', '1995-12', 678.67)
  ];
  Object.keys(P.indexDenominatorMonthly).forEach(yy => {
    segments.push(seg('enterprise', yy + '-01', yy === '2025' ? '2025-09' : yy + '-12', P.indexDenominatorMonthly[yy]));
  });
  const data = {
    gender: 'male', femaleType: 'worker',
    birthYM: '1965-10', workStartYM: '1985-07', retireYM: '2025-10',
    deemedMode: 'auto', deemedMonths: '',
    entryMode: 'month', segments,
    interestMode: 'none', fixedRatePct: '4.0', fallbackRatePct: '2.62', intraYearMethod: 'monthly',
    accountBalanceManual: '',
    doc31Eligible: false, doc31TransferYM: '', enterpriseInsuredYM: '', subsidyExcludedText: '',
    baseYearIndex: 0, cPingOverride: '',
    customCYearText: '1992=500\n1993=600\n1994=700\n1995=678.67',
    boundWarnings: [], errorMsg: ''
  };
  return Object.assign(data, extra || {});
}
function doc31Extra(transfer, insured, more) {
  return Object.assign({
    doc31Eligible: true, doc31TransferYM: transfer, enterpriseInsuredYM: insured
  }, more || {});
}
// S2~S4 段：2003-01 起按上年社平100%（与单测 AC-RC-02/07 同一夹具）
function segmentsFrom2003(ratio) {
  ratio = ratio || 1;
  const list = [];
  Object.keys(P.indexDenominatorMonthly).map(Number).filter(y => y >= 2003).forEach(yy => {
    const b = Math.round(P.indexDenominatorMonthly[yy] * ratio * 100) / 100;
    list.push(seg('enterprise', yy + '-01', yy === 2025 ? '2025-09' : yy + '-12', b));
  });
  return list;
}

const screenshots = [];
// PNG 非空白校验：PowerShell + System.Drawing 统计颜色种类与非白占比（RUNBOOK §6 验收）
function validatePng(pngPath) {
  const ps = `Add-Type -AssemblyName System.Drawing; ` +
    `$b=[System.Drawing.Bitmap]::FromFile('${pngPath.replace(/'/g, "''")}'); ` +
    `$w=$b.Width; $h=$b.Height; $set=New-Object 'System.Collections.Generic.HashSet[int]'; ` +
    `$nonWhite=0; $n=0; ` +
    `for($y=0;$y -lt $h;$y+=4){for($x=0;$x -lt $w;$x+=4){$c=$b.GetPixel($x,$y);$n++; ` +
    `[void]$set.Add((($c.R -shr 4) -bor (($c.G -shr 4) -shl 4) -bor (($c.B -shr 4) -shl 8))); ` +
    `if(($c.R -lt 235) -or ($c.G -lt 235) -or ($c.B -lt 235)){$nonWhite++}}}; ` +
    `$b.Dispose(); Write-Output ($w.ToString()+','+$h.ToString()+','+$set.Count+','+[math]::Round(100.0*$nonWhite/$n,2))`;
  const out = cp.execFileSync('powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], { encoding: 'utf8' }).trim();
  const parts = out.split(',');
  return { width: +parts[0], height: +parts[1], distinctColors: +parts[2], nonWhitePct: +parts[3] };
}
async function shoot(miniPro, page, name) {
  const file = path.join(OUT_DIR, name + '.png');
  try { fs.unlinkSync(file); } catch (e) {}
  await miniPro.screenshot({ path: file });
  await sleep(300);
  const st = fs.statSync(file);
  let stat = null, pngOk = false;
  try {
    stat = validatePng(file);
    pngOk = st.size > 10240 && stat.distinctColors > 500 && stat.nonWhitePct > 1;
  } catch (e) { stat = { error: String(e.message || e) }; }
  screenshots.push({ name, path: file, bytes: st.size, png: stat, ok: pngOk });
  log(`SCREENSHOT ${name} bytes=${st.size} png=${JSON.stringify(stat)} ok=${pngOk}`);
  return pngOk;
}

async function relaunchIndex(miniPro) {
  try { await miniPro.callWxMethod('clearStorageSync'); } catch (e) {}
  const page = await miniPro.reLaunch('/pages/index/index');
  await sleep(800);
  return page || await miniPro.currentPage();
}
async function openResult(miniPro, indexPage) {
  await indexPage.callMethod('onCalculate');
  await sleep(900);
  const page = await miniPro.currentPage();
  await page.waitFor(800);
  return page;
}
async function valueTexts(page, cls) {
  const els = await page.$$(cls);
  const out = [];
  for (const el of els) { try { out.push(String(await el.text() || '')); } catch (e) {} }
  return out;
}
async function scrollAndShoot(miniPro, page, y, name) {
  try { await miniPro.callWxMethod('pageScrollTo', { scrollTop: y, duration: 0 }); await sleep(400); } catch (e) {}
  return shoot(miniPro, page, name);
}

async function main() {
  const startedAt = new Date().toISOString();
  log('launch cli auto: ' + CLI_BAT + ' port=' + PORT + ' sessionId=' + currentSessionId() + ' SESSIONNAME=' + (process.env.SESSIONNAME || ''));
  // 清掉残留 IDE（编译门禁 cli preview 可能在别的会话留下 IDE server，cli auto 会错误 attach 导致 initialize timeout）
  // 真实进程名是中文「微信开发者工具.exe」（IDE.exe/wechatdevtools.exe 名称不存在，杀不掉会残留 60964 server）
  for (const img of ['IDE.exe', 'wechatdevtools.exe', '微信开发者工具.exe']) {
    try { cp.execFileSync('taskkill', ['/IM', img, '/F', '/T'], { stdio: 'ignore' }); } catch (e) {}
  }
  await sleep(4000);
  // 删除陈旧的 IDE 服务端口标记（Default\.ide / 顶层 .cli）：异常退出后 .ide 会残留死端口，
  // cli auto 读到后误判「IDE may already started at port 60964」并跳过启动、连死端口超时。
  // 保留 .ide-status=On（服务端口开关）。RUNBOOK 之外的环境修复，仅删标记文件不碰项目代码。
  const localAppData = process.env.LOCALAPPDATA;
  const userDataRoot = path.join(localAppData, '微信开发者工具', 'User Data');
  function tryUnlink(p) { try { fs.unlinkSync(p); log('removed stale marker: ' + p); } catch (e) {} }
  try {
    const profiles = fs.readdirSync(userDataRoot);
    profiles.forEach(h => {
      tryUnlink(path.join(userDataRoot, h, 'Default', '.ide'));
      tryUnlink(path.join(userDataRoot, h, '.cli'));
      tryUnlink(path.join(userDataRoot, h, '.ide'));
    });
  } catch (e) { log('stale-marker cleanup skipped: ' + e.message); }

  // 与已验证 unattended\b-run.js 同一启动模式：cli.bat auto + shell:true（避开中文路径 spawn ENOENT）
  const cmd = `"${CLI_BAT}" auto --project "${PROJECT}" --auto-port ${PORT}`;
  const cliProc = cp.spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let cliTail = '';
  cliProc.stdout.on('data', d => { cliTail += d.toString(); if (cliTail.length > 4000) cliTail = cliTail.slice(-4000); });
  cliProc.stderr.on('data', d => { cliTail += d.toString(); if (cliTail.length > 4000) cliTail = cliTail.slice(-4000); });
  cliProc.on('error', e => log('cli proc error: ' + e.message));
  // 等 cli 输出 √ auto（与已验证 b-run.js startCliAuto 一致），最多 90s
  const t0 = Date.now();
  while (Date.now() - t0 < 90000 && !/√\s*auto/.test(cliTail)) {
    if (cliProc.exitCode != null) break;
    await sleep(1000);
  }
  log('cli auto marker seen=' + /√\s*auto/.test(cliTail) + '; tail=' + cliTail.replace(/\s+/g, ' ').slice(-220));
  let miniPro = null, connectError = null;
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    try { miniPro = await automator.connect({ wsEndpoint: `ws://127.0.0.1:${PORT}` }); break; }
    catch (e) { connectError = e; }
  }
  if (!miniPro) throw new Error('automator connect failed: ' + (connectError && connectError.message) + ' cliTail=' + cliTail.slice(-500));
  log('automator connected');
  let sessionInfo = null;
  try { sessionInfo = await miniPro.systemInfo(); } catch (e) { sessionInfo = String(e); }

  // ---------- BOOT：首页/录入页可启动 ----------
  let indexPage = await relaunchIndex(miniPro);
  eq('BOOT-01', 'BOOT', '启动后当前页=pages/index/index', indexPage.path, 'pages/index/index');
  const idxData = await indexPage.data();
  rec('BOOT-02', 'BOOT', '首页 policyVersion 非空', typeof idxData.policyVersion === 'string' && idxData.policyVersion.length > 0,
    idxData.policyVersion, '非空');
  const hero = await indexPage.$('.hero-title');
  const heroText = hero ? String(await hero.text() || '') : '';
  rec('BOOT-03', 'BOOT', '首页真实渲染标题含「养老金测算器」', heroText.indexOf('养老金测算器') >= 0, heroText, '含 养老金测算器');
  await shoot(miniPro, indexPage, '01-index-loaded');

  // ---------- S1 普通企业职工 ----------
  await indexPage.setData(baseInput());
  await sleep(300);
  let shotIdx = await scrollAndShoot(miniPro, indexPage, 0, '02-index-s1-filled');
  let resultPage = await openResult(miniPro, indexPage);
  eq('S1-PATH', 'S1', '跳转结果页 pages/result/result', resultPage.path, 'pages/result/result');
  let d = await resultPage.data();
  eq('S1-READY', 'S1', '结果页 ready=true（真实页面数据）', d.ready === true, d.ready, true);
  near('S1-RSTORE', 'S1', 'R储=144739.20（按8%入账累加，不计息）', d.r.intermediates.R储, 144739.20, 0.01);
  eq('S1-RBU', 'S1', '普通人群 R补=0', d.r.intermediates.R补, 0);
  eq('S1-NAPP', 'S1', 'accountSubsidy.applicable=false', d.r.accountSubsidy.applicable, false);
  near('S1-JACC', 'S1', 'J账户=R储÷139=1041.29', d.r.pension.J账户, 1041.29, 0.01);
  near('S1-TOTAL', 'S1', '首月养老金总额=7457.38（V1.1零差异回归）', d.r.pension.total, 7457.38, 0.01);
  eq('S1-LINES', 'S1', '公式溯源 4 行', d.r.formulaLines.length, 4);
  rec('S1-EXPR', 'S1', 'J账户公式行为「R储 ÷ M」', /R储\s*÷\s*M/.test(d.r.formulaLines[1].text), d.r.formulaLines[1].text, '含 R储 ÷ M');
  const totalText = await (await resultPage.$('.total')).text();
  rec('S1-RENDER-TOTAL', 'S1', '结果页 DOM 真实渲染总额含 7457', /7457(\.\d+)?/.test(String(totalText)), String(totalText), '含 7457');
  eq('S1-VM-SUB', 'S1', 'vm.subsidy.amount=0（结果页 R补 渲染不适用）', d.vm.subsidy.amount, 0);
  rec('S1-VM-STATUS', 'S1', 'vm.subsidy 状态文案=不适用（非31号第一条人员）',
    /不适用/.test(d.vm.subsidy.statusText), d.vm.subsidy.statusText, '含 不适用');
  await scrollAndShoot(miniPro, resultPage, 500, '03-result-s1-normal');

  // ---------- S2 31号文人员（RC-T02：2003-01 参保，Z实=1） ----------
  indexPage = await relaunchIndex(miniPro);
  await indexPage.setData(baseInput(doc31Extra('2003-01', '2003-01', { segments: segmentsFrom2003(1) })));
  resultPage = await openResult(miniPro, indexPage);
  d = await resultPage.data();
  eq('S2-PATH', 'S2', '结果页', resultPage.path, 'pages/result/result');
  eq('S2-READY', 'S2', 'ready=true', d.ready === true, d.ready, true);
  near('S2-RBU', 'S2', 'R补=8990.16（官方 RC-T02 手算复算）', d.r.intermediates.R补, 8990.16, 0.01);
  near('S2-RSTORE', 'S2', 'R储=135629.83（Z补贴不入余额，AC-RC-07）', d.r.intermediates.R储, 135629.83, 0.02);
  near('S2-JACC', 'S2', 'J账户=(R储+R补)÷M=1040.43', d.r.pension.J账户, 1040.43, 0.01);
  eq('S2-APP', 'S2', 'applicable=true', d.r.accountSubsidy.applicable, true);
  near('S2-Z', 'S2', '参保后 Z实指数=1.0', d.r.accountSubsidy.zRealUsed, 1.0, 0.001);
  eq('S2-MONTHS', 'S2', '未建账模拟期=123月（1992-10~2002-12）', d.r.accountSubsidy.monthCount, 123);
  const tiers = {}; d.r.accountSubsidy.tiers.forEach(t => { tiers[t.rate] = t; });
  near('S2-T2', 'S2', '2%档=82.425（(C1992/12×3)+C1993）', tiers[0.02].bracket, 82.425, 1e-6);
  near('S2-T5', 'S2', '5%档=1714.775', tiers[0.05].bracket, 1714.775, 1e-6);
  near('S2-T11', 'S2', '11%档=7192.955（止于C2002）', tiers[0.11].bracket, 7192.955, 1e-6);
  eq('S2-NO8', 'S2', '2003-01参保无8%档', d.r.accountSubsidy.tiers.length, 3);
  eq('S2-LINES', 'S2', '公式行5条且末行 R补/P13',
    d.r.formulaLines.length === 5 && d.r.formulaLines[4].key === 'R补' && d.r.formulaLines[4].ref === 'P13',
    d.r.formulaLines.map(f => f.key + '/' + f.ref).join(','), '…,R补/P13');
  eq('S2-VM', 'S2', 'vm.subsidy.showFormula=true 且状态文案含「适用」',
    d.vm.subsidy.showFormula === true && d.vm.subsidy.statusText.indexOf('适用') >= 0,
    d.vm.subsidy.statusText, '适用…');
  const s2Vals = await valueTexts(resultPage, '.value');
  rec('S2-RENDER-RBU', 'S2', '结果页 DOM 真实渲染含 8990.16（R补行）',
    s2Vals.some(t => t.indexOf('8990.16') >= 0), s2Vals.join('|').slice(0, 300), '含 8990.16');
  await scrollAndShoot(miniPro, resultPage, 650, '04-result-s2-doc31-rbu');

  // ---------- S3 扣除区间（AC-RC-08） ----------
  indexPage = await relaunchIndex(miniPro);
  await indexPage.setData(baseInput(doc31Extra('2003-01', '2003-01', {
    segments: segmentsFrom2003(1), subsidyExcludedText: '1995-01~1996-12'
  })));
  resultPage = await openResult(miniPro, indexPage);
  d = await resultPage.data();
  eq('S3-EXCL', 'S3', '扣除月数=24', d.r.accountSubsidy.excludedMonths, 24);
  eq('S3-MONTHS', 'S3', '总模拟月数=99（123-24）', d.r.accountSubsidy.monthCount, 99);
  near('S3-T5', 'S3', '5%档扣除后=980.575', d.r.accountSubsidy.tiers.filter(t => t.rate === 0.05)[0].bracket, 980.575, 0.01);
  near('S3-RBU', 'S3', 'R补=8255.96（防重复享受扣除后）', d.r.intermediates.R补, 8255.96, 0.02);

  // ---------- S4 手录 R储（RC-T08） ----------
  indexPage = await relaunchIndex(miniPro);
  await indexPage.setData(baseInput(doc31Extra('2003-01', '2003-01', {
    segments: segmentsFrom2003(1), accountBalanceManual: '100000'
  })));
  resultPage = await openResult(miniPro, indexPage);
  d = await resultPage.data();
  eq('S4-RSTORE', 'S4', 'R储展示仍=100000（Z补贴不入余额）', d.r.intermediates.R储, 100000);
  near('S4-JACC', 'S4', 'J账户=(100000+8990.16)/139=784.10', d.r.pension.J账户, 784.10, 0.02);
  near('S4-RBU', 'S4', 'R补=8990.16 不变', d.r.intermediates.R补, 8990.16, 0.01);
  await scrollAndShoot(miniPro, resultPage, 650, '05-result-s4-manual-rstore');

  // ---------- S6 参保后60%缴费（AC-RC-06：机关年限不入Z实分母） ----------
  indexPage = await relaunchIndex(miniPro);
  await indexPage.setData(baseInput(doc31Extra('2003-01', '2003-01', { segments: segmentsFrom2003(0.6) })));
  resultPage = await openResult(miniPro, indexPage);
  d = await resultPage.data();
  rec('S6-Z', 'S6', '参保后 Z实指数≈0.6（机关年限不入分子分母）',
    Math.abs(d.r.accountSubsidy.zRealUsed - 0.6) < 0.02, d.r.accountSubsidy.zRealUsed, '≈0.6');
  near('S6-RBU', 'S6', 'R补=8990.155×0.6=5394.09', d.r.intermediates.R补, 5394.09, 0.05);

  // ---------- E1 31号调动早于1998-01 → 首页阻断 ----------
  indexPage = await relaunchIndex(miniPro);
  await indexPage.setData(baseInput(doc31Extra('1996-05', '2000-01', { segments: segmentsFrom2003(1) })));
  await indexPage.callMethod('onCalculate');
  await sleep(500);
  let stillIndex = await miniPro.currentPage();
  let ed = await indexPage.data();
  eq('E1-PATH', 'E1', '非法身份输入不跳转', stillIndex.path, 'pages/index/index');
  rec('E1-MSG', 'E1', '错误提示含 1998-01 门槛', /1998-01/.test(ed.errorMsg || ''), ed.errorMsg, '含 1998-01');

  // ---------- E2 固定利率越界 ----------
  indexPage = await relaunchIndex(miniPro);
  await indexPage.setData(baseInput({ interestMode: 'fixed', fixedRatePct: '25' }));
  await indexPage.callMethod('onCalculate');
  await sleep(500);
  stillIndex = await miniPro.currentPage();
  ed = await indexPage.data();
  eq('E2-PATH', 'E2', '利率越界不跳转', stillIndex.path, 'pages/index/index');
  rec('E2-MSG', 'E2', '错误提示含 0~24 利率口径', /0~24|利率/.test(ed.errorMsg || ''), ed.errorMsg, '含 0~24/利率');

  // ---------- E3 缴费段起止倒置 ----------
  indexPage = await relaunchIndex(miniPro);
  await indexPage.setData(baseInput({
    segments: [seg('enterprise', '2025-09', '2020-01', 8000)]
  }));
  await indexPage.callMethod('onCalculate');
  await sleep(500);
  stillIndex = await miniPro.currentPage();
  ed = await indexPage.data();
  eq('E3-PATH', 'E3', '起止倒置不跳转', stillIndex.path, 'pages/index/index');
  rec('E3-MSG', 'E3', '错误提示含 结束早于开始', /结束早于开始/.test(ed.errorMsg || ''), ed.errorMsg, '含 结束早于开始');
  await shoot(miniPro, indexPage, '06-index-error-boundary');

  try { await miniPro.close(); } catch (e) {}
  try { cp.spawnSync('taskkill', ['/PID', String(cliProc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
  for (const img of ['IDE.exe', 'wechatdevtools.exe', '微信开发者工具.exe']) {
    try { cp.execFileSync('taskkill', ['/IM', img, '/F'], { stdio: 'ignore' }); } catch (e) {}
  }

  const totals = assertions.reduce((a, x) => { x.pass ? a.pass++ : a.fail++; return a; }, { pass: 0, fail: 0 });
  const shotsOk = screenshots.filter(s => s.ok).length;
  const sid = currentSessionId();
  const sessionOk = sid === 2;
  const ok = totals.fail === 0 && shotsOk === screenshots.length && screenshots.length >= 4 && sessionOk;
  const summary = {
    ok,
    suite: 'pension-autotest-regression-rc',
    specSection: 'specification.md V1.2 §2.2 / §2.2.1（京劳社养发〔2007〕21号/31号）',
    workflowRunId: 'wf-22925e79520b',
    nodeId: 'wf-22925e79520b-node_tester_automation',
    startedAt, finishedAt: new Date().toISOString(),
    runContext: { session: process.env.SESSIONNAME || '', sessionId: sid, viaRdpSession2: sessionOk, automationPort: PORT, idePort: IDE_PORT, project: PROJECT, sdk: SDK_DIR, systemInfo: sessionInfo },
    totals, assertionsTotal: assertions.length,
    screenshotsTotal: screenshots.length, screenshotsOk: shotsOk,
    assertions, screenshots
  };
  fs.writeFileSync(RESULT_JSON, JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'run.log'), logLines.join('\n'), 'utf8');
  log(`DONE ok=${ok} pass=${totals.pass} fail=${totals.fail} screenshots=${shotsOk}/${screenshots.length}`);
  console.log('PENSION_REG_RESULT=' + RESULT_JSON);
  process.exit(ok ? 0 : 1);
}

main().catch(e => {
  log('FATAL ' + (e && e.stack || e));
  const fail = {
    ok: false, suite: 'pension-autotest-regression-rc', fatal: String(e && e.message || e),
    finishedAt: new Date().toISOString(),
    runContext: { session: process.env.SESSIONNAME || '', sessionId: currentSessionId(), automationPort: PORT, idePort: IDE_PORT, project: PROJECT, sdk: SDK_DIR },
    totals: { pass: assertions.filter(a => a.pass).length, fail: assertions.filter(a => !a.pass).length + 1 },
    assertionsTotal: assertions.length + 1, assertions: assertions, screenshots
  };
  try { fs.writeFileSync(RESULT_JSON, JSON.stringify(fail, null, 2), 'utf8'); } catch (x) {}
  try { fs.writeFileSync(path.join(OUT_DIR, 'run.log'), logLines.join('\n'), 'utf8'); } catch (x) {}
  console.log('PENSION_REG_RESULT=' + RESULT_JSON);
  process.exit(1);
});
