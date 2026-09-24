'use strict';
// run-one.js <port> <script.js> — 单轮 fresh cli auto + 跑指定脚本；脚本内轮询。
const fs = require('fs');
const net = require('net');
const cp = require('child_process');
const path = require('path');
const PROJECT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const GUI = PROJECT + '\\autotest\\gui';
const OUT = PROJECT + '\\autotest\\output\\gui';
const PORT = parseInt(process.argv[2], 10);
const SCRIPT = process.argv[3];
const EXTRA = process.argv.slice(4);
const CLI_DIR = 'C:\\Program Files (x86)\\Tencent';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function discoverCli(){ for(const d of fs.readdirSync(CLI_DIR)){ const c=path.join(CLI_DIR,d,'cli.bat'); if(fs.existsSync(c)) return c; } throw new Error('no cli'); }
function listening(p){ return new Promise(res=>{ const s=net.createConnection({port:p,host:'127.0.0.1'}); const d=v=>{try{s.destroy();}catch(e){}res(v);}; s.once('connect',()=>d(true));s.once('error',()=>d(false));setTimeout(()=>d(false),1000); }); }
(async () => {
  fs.mkdirSync(OUT,{recursive:true});
  const CLI=discoverCli();
  const logFile=path.join(OUT,'cli-auto-runone-'+PORT+'.log');
  const lf=fs.openSync(logFile,'w');
  let child;
  try { child=cp.spawn('"'+CLI+'" auto --project "'+PROJECT+'" --auto-port '+PORT,{shell:true,stdio:['ignore',lf,lf],windowsHide:true}); }
  finally { try{lf.close();}catch(e){} }
  const t0=Date.now(); let up=false;
  while(Date.now()-t0<150000){ up=await listening(PORT); let tx=''; try{tx=fs.readFileSync(logFile,'utf8');}catch(e){} if(up&&/Using AppID/.test(tx))break; await sleep(2000); }
  console.log('cli auto up='+up+' port='+PORT);
  await sleep(2500);
  const r=cp.spawnSync(process.execPath,[SCRIPT].concat(EXTRA),{cwd:GUI,env:Object.assign({},process.env,{GUI_AUTO_PORT:String(PORT)}),encoding:'utf8',timeout:240000});
  console.log(r.stdout||''); if(r.stderr) console.log('STDERR '+r.stderr);
  try{cp.execSync('taskkill /PID '+child.pid+' /T /F',{stdio:'ignore'});}catch(e){}
  process.exit(0);
})().catch(e=>{console.log('FATAL '+e.message);process.exit(1);});
