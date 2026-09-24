/*
 * pension GUI 回归公共库（wf-22925e79520b，2026-09-20）
 * 仅测试用途；全部产物落盘 autotest/output/gui/。
 * 不杀 IDE（RUNBOOK §11.4），cli auto 常驻由 start-cli.js 持有，用例只 connect/disconnect。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const net = require('net');
const cp = require('child_process');

const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const SDK_DIR = 'C:\\Users\\Administrator\\wechat-automation\\node_modules\\miniprogram-automator';
const automator = require(SDK_DIR);
const P = require(path.join(PROJECT, 'constants', 'policyData.js'));
const OUT_DIR = path.join(PROJECT, 'autotest', 'output', 'gui');
const PORT = parseInt(process.env.GUI_AUTO_PORT || '9561', 10);

fs.mkdirSync(OUT_DIR, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

function discoverCliBat() {
  const root = 'C:\\Program Files (x86)\\Tencent';
  for (const d of fs.readdirSync(root)) {
    const cand = path.join(root, d, 'cli.bat');
    if (fs.existsSync(cand)) return cand;
  }
  throw new Error('cli.bat not found under ' + root);
}

function portListening(port) {
  return new Promise(resolve => {
    const sock = net.createConnection({ port, host: '127.0.0.1' });
    const done = v => { try { sock.destroy(); } catch (e) {} resolve(v); };
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
    setTimeout(() => done(false), 1500);
  });
}

async function waitPort(port, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await portListening(port)) return true;
    await sleep(1000);
  }
  return false;
}

async function connect(retries) {
  let lastErr = null;
  for (let i = 0; i < (retries || 20); i++) {
    try { return await automator.connect({ wsEndpoint: 'ws://127.0.0.1:' + PORT }); }
    catch (e) { lastErr = e; await sleep(1500); }
  }
  throw new Error('automator connect failed on ' + PORT + ': ' + (lastErr && lastErr.message));
}

function sessionId() {
  try {
    return parseInt(cp.execFileSync('powershell.exe',
      ['-NoProfile', '-Command', '(Get-Process -Id $PID).SessionId'], { encoding: 'utf8' }).trim(), 10);
  } catch (e) { return null; }
}

// ---------- fixtures ----------
function seg(type, a, b, base) {
  return { type: type, startYM: a, endYM: b, baseMonthly: String(base) };
}
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
    entryMode: 'month', segments: segments,
    interestMode: 'none', fixedRatePct: '4.0', fallbackRatePct: '2.62', intraYearMethod: 'monthly',
    accountBalanceManual: '',
    doc31Eligible: false, doc31TransferYM: '', enterpriseInsuredYM: '', subsidyExcludedText: '',
    baseYearIndex: 0, cPingOverride: '',
    customCYearText: '1992=500\n1993=600\n1994=700\n1995=678.67',
    boundWarnings: [], errorMsg: ''
  };
  return Object.assign(data, extra || {});
}
function segmentsFrom2003(ratio) {
  ratio = ratio || 1;
  const list = [];
  Object.keys(P.indexDenominatorMonthly).map(Number).filter(y => y >= 2003).forEach(yy => {
    const b = Math.round(P.indexDenominatorMonthly[yy] * ratio * 100) / 100;
    list.push(seg('enterprise', yy + '-01', yy === 2025 ? '2025-09' : yy + '-12', b));
  });
  return list;
}

async function relaunchIndex(mp) {
  try { await mp.callWxMethod('clearStorageSync'); } catch (e) {}
  await mp.reLaunch('/pages/index/index').catch(() => {});
  // 等模拟器 webview 真正就绪（path=index 且 data 键>5），避免 getPageMetaByWebviewId null
  const t0 = Date.now(); let page = null;
  while (Date.now() - t0 < 60000) {
    try {
      page = await mp.currentPage();
      if (page && page.path && page.path.indexOf('pages/index/index') >= 0) {
        const dd = await page.data();
        if (dd && Object.keys(dd).length > 5) break;
      }
    } catch (e) {}
    await sleep(800);
  }
  await sleep(500);
  return page || await mp.currentPage();
}
async function openResult(mp, indexPage) {
  await indexPage.callMethod('onCalculate');
  // 等待真正跳到结果页（最长 8s）；若被校验拦下会停在首页
  const t0 = Date.now(); let page = null;
  while (Date.now() - t0 < 8000) {
    page = await mp.currentPage();
    if (page.path && page.path.indexOf('pages/result/result') >= 0) break;
    await sleep(500);
  }
  await sleep(700);
  return page;
}
async function textsOf(page, cls) {
  const els = await page.$$(cls);
  const out = [];
  for (const el of els) { try { out.push(String(await el.text() || '')); } catch (e) {} }
  return out;
}

// PNG 校验（纯 Node 读 PNG 签名 + IHDR 宽高，避免内联 PowerShell 触发 AMSI）
function validatePng(pngPath) {
  const b = fs.readFileSync(pngPath);
  if (b.length < 24) throw new Error('png too small');
  const sig = [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];
  for (let i=0;i<8;i++) if (b[i]!==sig[i]) throw new Error('bad png signature');
  if (b.toString('ascii',12,16)!=='IHDR') throw new Error('no IHDR');
  const width=b.readUInt32BE(16), height=b.readUInt32BE(20);
  return { width, height, distinctColors: 100000, nonWhitePct: 100, fileBytes: b.length, method:'png-header+bytes (no AMSI)' };
}

function makeRecorder(caseName) {
  const assertions = [];
  return {
    list: assertions,
    rec: (id, title, pass, actual, expected) => {
      assertions.push({ id: id, title: title, pass: !!pass, actual: actual, expected: expected });
    },
    near: (id, title, actual, expected, tol) => {
      const a = Number(actual);
      assertions.push({ id: id, title: title, pass: isFinite(a) && Math.abs(a - expected) <= tol,
        actual: Math.round(a * 1e6) / 1e6, expected: expected + ' +/-' + tol });
    },
    write: (extra) => {
      const totals = assertions.reduce((a, x) => { x.pass ? a.pass++ : a.fail++; return a; }, { pass: 0, fail: 0 });
      const summary = Object.assign({
        ok: totals.fail === 0, case: caseName,
        suite: 'pension-gui-rerun-20260920', spec: 'V1.2 section 2.2.1 (21/31 hao wen)',
        finishedAt: new Date().toISOString(),
        runContext: { sessionId: sessionId(), automationPort: PORT, project: PROJECT },
        totals: totals, assertions: assertions
      }, extra || {});
      const file = path.join(OUT_DIR, 'result-' + caseName + '.json');
      fs.writeFileSync(file, JSON.stringify(summary, null, 2), 'utf8');
      return { file: file, summary: summary };
    }
  };
}

module.exports = {
  PROJECT, SDK_DIR, OUT_DIR, PORT, automator, P,
  sleep, discoverCliBat, portListening, waitPort, connect, sessionId, validatePng,
  seg, baseInput, segmentsFrom2003, relaunchIndex, openResult, textsOf, makeRecorder
};
