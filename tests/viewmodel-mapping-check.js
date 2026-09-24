// /tmp/mapping-check.js —— 任务点名的映射项逐项核对（字段存在性 + 值正确性）
var path = require('path');
var ROOT = process.argv[2] || require('path').join(__dirname, '..');
var Engine = require(path.join(ROOT, 'calculator', 'pensionEngine.js'));

// 批次1 #8 契约收紧后（accountBalanceManual UI 路径必填），旧套件统一走保留的历史重建逃生口。
var __engineCalculate = Engine.calculate;
Engine.calculate = function (input) {
  if (input && input.accountBalanceManual == null && input.accountReconstruct == null) {
    input.accountReconstruct = true;
  }
  return __engineCalculate(input);
};
var P = require(path.join(ROOT, 'constants', 'policyData.js'));
var pageDef, appHolder = { globalData: {} };
global.Page = function (d) { pageDef = d; };
global.getApp = function () { return appHolder; };
global.wx = { showToast: function () {}, setClipboardData: function () {}, navigateBack: function () {} };
require(path.join(ROOT, 'pages', 'result', 'result.js'));

function seg(t,a,b,x){return {type:t,startYM:a,endYM:b,baseMonthly:x};}
var s1 = { gender:'male',birthYM:'1965-10',workStartYM:'1985-07',retireYM:'2025-10',interestMode:'none',segments:[],customCYear:{1992:500,1993:600,1994:700,1995:678.67} };
[['1992-10','1992-12',500],['1993-01','1993-12',600],['1994-01','1994-12',700],['1995-01','1995-12',678.67]].forEach(function(a){s1.segments.push(seg('enterprise',a[0],a[1],a[2]));});
Object.keys(P.indexDenominatorMonthly).forEach(function(yy){yy=+yy;s1.segments.push(seg('enterprise',yy+'-01',yy===2025?'2025-09':yy+'-12',P.indexDenominatorMonthly[yy]));});
var r = Engine.calculate(s1);
appHolder.globalData.lastResult = r;
var inst = { data: JSON.parse(JSON.stringify(pageDef.data||{})) };
inst.setData = function (d) { Object.keys(d).forEach(function(k){inst.data[k]=d[k];}); };
pageDef.onLoad.call(inst);
var d = inst.data;
var fails = 0;
function chk(name, cond, actual) { console.log((cond?'  ✓ ':'  ✗ ') + name + (cond?'':'  => 实际: ' + JSON.stringify(actual))); if(!cond) fails++; }

console.log('== A. 结果区三分项 ==');
chk('vm.pension.basic = r.pension.J基础', d.vm.pension.basic === r.pension.J基础, d.vm.pension.basic);
chk('vm.pension.account = J账户', d.vm.pension.account === r.pension.J账户, d.vm.pension.account);
chk('vm.pension.transitional = J过渡', d.vm.pension.transitional === r.pension.J过渡, d.vm.pension.transitional);
chk('totalDisplay 与 r.pension.total 相等(7457.38)', d.totalDisplay === r.pension.total && d.totalDisplay === 7457.38, d.totalDisplay);

console.log('== B. 中间量映射（任务点名） ==');
chk('vm.it.m = r.intermediates.M(' + r.intermediates.M + ')', d.vm.it.m === r.intermediates.M, d.vm.it.m);
chk('vm.it.gDeemed = G同(873.55)', Math.abs(d.vm.it.gDeemed-873.55)<0.01, d.vm.it.gDeemed);
chk('vm.it.gReal = G实(692.82)', Math.abs(d.vm.it.gReal-692.82)<0.01, d.vm.it.gReal);
chk('vm.it.cPing = C平', d.vm.it.cPing === r.intermediates.C平, d.vm.it.cPing);
chk('vm.it.zReal = Z实指数(1.0)', Math.abs(d.vm.it.zReal-1)<1e-9, d.vm.it.zReal);
chk('vm.it.zDeemed = Z同指数(1.0)', Math.abs(d.vm.it.zDeemed-1)<1e-9, d.vm.it.zDeemed);
chk('vm.yearsText.nShould 以 N应缴(33.0000) 构造', d.vm.yearsText.nShould.indexOf('33.0000年')>=0, d.vm.yearsText.nShould);
chk('vm.it.kShouldMonths = K应缴月(396)', d.vm.it.kShouldMonths === 396, d.vm.it.kShouldMonths);
chk('vm.yearsText.nRealDeemed 含 N实同(40.2500年)', d.vm.yearsText.nRealDeemed.indexOf('40.2500年')>=0, d.vm.yearsText.nRealDeemed);
chk('vm.yearsText.nDeemed 含 N同(7.2500年)', d.vm.yearsText.nDeemed.indexOf('7.2500年')>=0, d.vm.yearsText.nDeemed);
chk('vm.yearsText.n98 含 N实98(5.7500年)', d.vm.yearsText.n98.indexOf('5.7500年')>=0, d.vm.yearsText.n98);
chk('vm.rStore.total = R储', d.vm.rStore.total === r.intermediates.R储, d.vm.rStore.total);
chk('vm.rStore.kind=reconstruct（历史重建路径）', d.vm.rStore.kind === 'reconstruct', d.vm.rStore.kind);
chk('vm.rStore.principalText = R储本金(' + r.intermediates.R储本金 + ')', +d.vm.rStore.principalText === r.intermediates.R储本金, d.vm.rStore.principalText);
chk('不计息 R储利息=0 且 interestText 为 0', r.intermediates.R储利息===0 && +d.vm.rStore.interestText===0, d.vm.rStore.interestText);

console.log('== C. 公式行 formulaLines（text/expr/ref/key 齐全） ==');
chk('r.formulaLines 4 条', r.formulaLines.length === 4, r.formulaLines.length);
r.formulaLines.forEach(function (f) { chk('formulaLine key=' + f.key + ' 字段齐全(text/expr/ref)', f.text && f.expr && f.ref, f); });

console.log('== D. 延退对照卡 P-05 ==');
var sched = d.r.meta.retireSchedule;
chk('retireSchedule 6 字段', sched && ['statutoryYM','chosenYM','offsetWord','chosenOffsetMonths','flexibleMinYM','flexibleMaxYM'].every(function(k){return sched[k]!==undefined;}), sched);

console.log('== E. 按年记账表 vmYearly（year/interest/endBalance/rateText/rateSource） ==');
chk('vmYearly 覆盖 1992..2025 共 ' + (2025-1992+1) + ' 年', d.vmYearly.length === 34, d.vmYearly.length);
var y2025 = d.vmYearly.filter(function(a){return a.year===2025;})[0];
chk('2025 行字段齐全', y2025 && y2025.interest===r.account.yearly.filter(function(a){return a.year===2025;})[0].interest && y2025.endBalance!=null && y2025.rateText==='不计息' && y2025.rateSource==='none', y2025);

console.log('== F. 按月明细折叠卡 monthlyGroups（g.year/principalSum/account/items[]） ==');
var g2025 = d.monthlyGroups.filter(function(a){return a.year==='2025';})[0];
var m = g2025.items[0];
chk('2025 年组 9 个月', g2025.items.length === 9, g2025.items.length);
chk('g.principalSum 存在且为数值', typeof g2025.principalSum === 'number', g2025.principalSum);
chk('月字段 ym/typeText/base/c/cSource/z(字符串)/p8', m.ym && m.typeText && typeof m.base==='number' && typeof m.c==='number' && m.cSource && typeof m.z==='string' && typeof m.p8==='number', m);
var g92=d.monthlyGroups.filter(function(a){return a.year==='1992';})[0]; var md92=r.monthlyDetails[0];
chk('1992-10 首月 z 展示值=引擎 z.toFixed(4)(' + md92.z.toFixed(4) + ')', g92.items[0].z === md92.z.toFixed(4), g92.items[0].z);

console.log('== G. warnings 列表 + 政策版本 ==');
chk('r.meta.warnings 是数组', Array.isArray(d.r.meta.warnings), typeof d.r.meta.warnings);
chk('r.meta.policyDataVersion 非空', !!d.r.meta.policyDataVersion, d.r.meta.policyDataVersion);

console.log('== H. 弹性延缴卡 flexInfo（S1 无延缴应 months=0） ==');
chk('r.flexInfo.months=0 / totalCost=0', d.r.flexInfo.months===0 && d.r.flexInfo.totalCost===0, d.r.flexInfo);

console.log('== I. 计息场景三元（S3 官方利率：本金/利息均非占位） ==');
var s3 = { gender:'male',birthYM:'1965-09',workStartYM:'2000-09',retireYM:'2025-09',interestMode:'official',fallbackRate:0.0262,segments:[seg('enterprise','2000-09','2025-08',10000)] };
var r3 = Engine.calculate(s3); appHolder.globalData.lastResult = r3;
var inst3 = { data: JSON.parse(JSON.stringify(pageDef.data||{})) };
inst3.setData = function(dd){Object.keys(dd).forEach(function(k){inst3.data[k]=dd[k];});};
pageDef.onLoad.call(inst3);
var d3 = inst3.data;
chk('S3 rStore.kind=reconstruct', d3.vm.rStore.kind === 'reconstruct', d3.vm.rStore.kind);
chk('S3 principalText 非占位', d3.vm.rStore.principalText !== '—' && +d3.vm.rStore.principalText === r3.intermediates.R储本金, d3.vm.rStore.principalText);
chk('S3 interestText 非占位且=利息', d3.vm.rStore.interestText !== '—' && +d3.vm.rStore.interestText === r3.intermediates.R储利息, d3.vm.rStore.interestText);
chk('S3 R储=本金+利息', Math.abs((r3.intermediates.R储本金+r3.intermediates.R储利息)-r3.intermediates.R储)<0.01, null);
chk('S3 vmYearly rateSource 出现 official/assumed', d3.vmYearly.some(function(a){return a.rateSource==='official'||a.rateSource==='assumed';}), null);

console.log('== J. 手工余额：R储本金占位，vmYearly 空 ==');
var rm = Engine.calculate({gender:'male',birthYM:'1965-10',workStartYM:'1985-07',retireYM:'2025-10',interestMode:'none',accountBalanceManual:139000,segments:[]});
appHolder.globalData.lastResult = rm;
var instm = { data: JSON.parse(JSON.stringify(pageDef.data||{})) };
instm.setData = function(dd){Object.keys(dd).forEach(function(k){instm.data[k]=dd[k];});};
pageDef.onLoad.call(instm);
var dm = instm.data;
chk('手工余额 R储=139000', dm.vm.rStore.total === 139000, dm.vm.rStore.total);
chk('手工余额 rStore.kind=static', dm.vm.rStore.kind === 'static', dm.vm.rStore.kind);
chk('静态锚定说明含“不再单列本金与利息”', /不再单列本金与利息/.test(dm.vm.rStore.explain), dm.vm.rStore.explain);
chk('手工余额 vmYearly=[]', dm.vmYearly.length === 0, dm.vmYearly.length);

console.log('\n' + (fails ? '失败 ' + fails + ' 项 ❌' : '映射逐项核对全部通过 ✅'));
process.exit(fails?1:0);
