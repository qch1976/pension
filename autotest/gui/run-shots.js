'use strict';
// run-shots.js — 每张截图一轮 fresh cli auto（独立端口），只做一次导航+截图。
// 脚本内轮询；失败自动换端口重试1次。产出 bug17-18-shots-summary.json。
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const GUI = PROJECT + '\\autotest\\gui';
const OUT = PROJECT + '\\autotest\\output\\gui';
const CLI_DIR = 'C:\\Program Files (x86)\\Tencent';
let portCursor = parseInt(process.argv[2] || '9701', 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
function discoverCli(){ for(const d of fs.readdirSync(CLI_DIR)){ const c=path.join(CLI_DIR,d,'cli.bat'); if(fs.existsSync(c)) return c; } throw new Error('no cli'); }
function listening(p){ return new Promise(res=>{ const s=net.createConnection({port:p,host:'127.0.0.1'}); const d=v=>{try{s.destroy();}catch(e){}res(v);}; s.once('connect',()=>d(true));s.once('error',()=>d(false));setTimeout(()=>d(false),1000); }); }
function killTree(pid){ try{cp.execSync('taskkill /PID '+pid+' /T /F',{stdio:'ignore'});}catch(e){} }

// 目标截图：tag / scrollTop
const SHOTS = [
  { case: 'MY1', tag: 'total', scroll: 0 },
  { case: 'MY1', tag: 'nshould', scroll: 700 },
  { case: 'MY1', tag: 'cap', scroll: 1250 },
  { case: 'MY2', tag: 'total', scroll: 0 },
  { case: 'MY2', tag: 'nshould', scroll: 700 },
  { case: 'MY2', tag: 'cap', scroll: 1250 }
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const CLI = discoverCli();
  const results = [];
  for (const sh of SHOTS) {
    let ok = false, lastOut = '', port = 0;
    for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
      port = portCursor++;
      const logFile = path.join(OUT, 'cli-auto-shot-' + sh.case + '-' + sh.tag + '-' + port + '.log');
      const lf = fs.openSync(logFile, 'w');
      let child;
      try { child = cp.spawn('"' + CLI + '" auto --project "' + PROJECT + '" --auto-port ' + port,
        { shell: true, stdio: ['ignore', lf, lf], windowsHide: true }); }
      finally { try { lf.close(); } catch (e) {} }
      const t0 = Date.now(); let up = false;
      while (Date.now() - t0 < 120000) { up = await listening(port); if (up) break; await sleep(2000); }
      if (!up) { killTree(child.pid); await sleep(5000); lastOut = 'cli auto port not listening'; continue; }
      await sleep(2500);
      let r;
      try {
        r = cp.spawnSync(process.execPath, ['one-shot.js', sh.case, sh.tag, String(sh.scroll)],
          { cwd: GUI, env: Object.assign({}, process.env, { GUI_AUTO_PORT: String(port) }),
            encoding: 'utf8', timeout: 180000 });
      } catch (e) { killTree(child.pid); lastOut = 'spawn threw ' + e.message; continue; }
      lastOut = String((r.stdout || '') + (r.stderr || '')).trim().split(/\r?\n/).slice(-2).join(' | ');
      if (r.status === 0 && /ONESHOT/.test(r.stdout || '')) ok = true;
      killTree(child.pid);
      await sleep(5000);
    }
    results.push({ case: sh.case, tag: sh.tag, scroll: sh.scroll, ok, port, output: lastOut });
    console.log('SHOT ' + sh.case + '/' + sh.tag + ' ok=' + ok + ' :: ' + lastOut);
  }
  const summary = { finishedAt: new Date().toISOString(), results };
  fs.writeFileSync(OUT + '\\bug17-18-shots-summary.json', JSON.stringify(summary, null, 2), 'utf8');
  console.log('ALL SHOTS ok=' + results.every(r => r.ok));
  process.exit(0);
})().catch(e => { console.log('FATAL ' + (e && e.message)); process.exit(1); });
