'use strict';
// run-all-shots.js — 顺序驱动 4 张截图，每张独立 fresh cli auto（shot-one.js 内部）。
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const GUI = PROJECT + '\\autotest\\gui';
const OUT = PROJECT + '\\autotest\\output\\gui';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SHOTS = [
  { c: 'MY1', w: 'total', file: 'bug1921-MY1-total.png' },
  { c: 'MY1', w: 'ledgerhead', file: 'bug1921-MY1-ledger-head.png' },
  { c: 'MY1', w: 'ledgertail', file: 'bug1921-MY1-ledger-tail.png' },
  { c: 'MY2', w: 'total', file: 'bug1921-MY2-total.png' }
];

(async () => {
  const results = {};
  let port = 9771;
  for (const s of SHOTS) {
    try { fs.unlinkSync(path.join(OUT, s.file)); } catch (e) {}
    let last = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const p = port++;
      const r = cp.spawnSync(process.execPath, ['shot-one.js', s.c, s.w, s.file, String(p)],
        { cwd: GUI, encoding: 'utf8', timeout: 240000 });
      last = String((r.stdout || '') + (r.stderr || '')).trim().split(/\r?\n/).filter(Boolean).pop();
      console.log(s.file + ' attempt' + attempt + ' port' + p + ' -> ' + last);
      if (last && last.indexOf('OK') === 0) break;
      await sleep(5000);
    }
    results[s.file] = last;
    await sleep(6000); // 张间冷静，让 IDE/模拟器恢复
  }
  const okCount = Object.values(results).filter(v => v && v.indexOf('OK') === 0).length;
  const summary = { ok: okCount === SHOTS.length, okCount: okCount, total: SHOTS.length, results: results, finishedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(OUT, 'bug19-21-shots-summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log('SHOTS ' + okCount + '/' + SHOTS.length);
  process.exit(summary.ok ? 0 : 2);
})().catch(e => { console.log('FATAL ' + (e && e.message || e)); process.exit(1); });
