'use strict';
// build-verify.js — 汇总两案 result-bug1718-MY*.json 为 bug17-18-verify.json（data/DOM 权威）。
const fs = require('fs');
const path = require('path');
const OUT = 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension\\autotest\\output\\gui';
function read(c){ try { return JSON.parse(fs.readFileSync(path.join(OUT,'result-bug1718-'+c+'.json'),'utf8')); } catch(e){ return null; } }
const MY1 = read('MY1'), MY2 = read('MY2');
function pick(r){
  if(!r) return null;
  return {
    ok: r.businessOk === true,
    businessOk: r.businessOk, businessFailures: r.businessFailures,
    totals: r.totals,
    environment: r.environment,
    values: r.values,
    screenshotStatus: r.screenshots ?
      Object.keys(r.screenshots).reduce((o,k)=>{ o[k] = { ok: !!(r.screenshots[k] && (r.screenshots[k].bytes>50000 || r.screenshots[k].fileBytes>50000)),
        bytes: r.screenshots[k].bytes || r.screenshots[k].fileBytes || null,
        error: r.screenshots[k].error || null }; return o; }, {}) : {}
  };
}
const a = pick(MY1), b = pick(MY2);
// 关键业务断言逐项（从原文件取，便于核对）
function keyChecks(r){
  if(!r) return {};
  const want = ['17-01','17-02','17-05','17-06','17-08','17-09','17-11','17-12','18-02','18-03','18-07','18-08','18-09','18-10','18-11','RG-01','RG-02','RG-03','RG-04','D-01','D-02','D-03','D-04','D-05','D-06'];
  const o = {};
  (r.assertions||[]).forEach(x=>{ if(want.indexOf(x.id)>=0) o[x.id]={pass:x.pass, actual:x.actual}; });
  return o;
}
const summary = {
  title: 'pension Bug17/18 活着的模拟器端到端真机验证',
  finishedAt: new Date().toISOString(),
  environment: {
    host: '39.106.208.34', os: 'Windows 11', ideServicePort: 60964,
    sessionId: 2, project: 'C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension',
    note: '每用例 fresh cli auto 一次性端口；MY1/MY2 业务端口见各 case.environment.cliAutoPort'
  },
  MY1: Object.assign({}, a, { checks: keyChecks(MY1) }),
  MY2: Object.assign({}, b, { checks: keyChecks(MY2) }),
  verdict: {
    bug17: !!(a&&b&&a.ok&&b.ok && MY1.assertions.find(x=>x.id==='17-08').pass && MY2.assertions.find(x=>x.id==='17-08').pass),
    bug18: !!(a&&b&&a.ok&&b.ok && MY1.assertions.find(x=>x.id==='18-07').pass && MY2.assertions.find(x=>x.id==='18-07').pass),
    regression: !!(a&&b&&a.ok&&b.ok)
  }
};
fs.writeFileSync(path.join(OUT,'bug17-18-verify.json'), JSON.stringify(summary,null,2),'utf8');
console.log('BUILT verdict='+JSON.stringify(summary.verdict));
