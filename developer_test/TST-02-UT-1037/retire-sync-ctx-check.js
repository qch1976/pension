// developer_test/TST-02-UT-1037/retire-sync-ctx-check.js
// TST-02-UT-1037（BUG-02-0008，owner=developer）node 断言，纯逻辑不依赖 wx。
// 校验 syncUnspecifiedRetire：未手改退休月的卡随最新 ctx 的法定退休月重算；手选卡保留。
'use strict';
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var PM = require(path.join(ROOT, 'calculator', 'planModel.js'));
var A = require(path.join(ROOT, 'developer_test', 'common', 'assert-ok.js')).create('TST-02-UT-1037');

var CTX_DEMO = { gender: 'male', femaleType: '', birthYM: '1965-10' };   // 法定 2026-01
var CTX_REAL = { gender: 'male', femaleType: '', birthYM: '1973-07' };   // 法定 2035-09

// 造一张带指定退休月/touched 的卡（其余字段保持 emptyPlan 默认）
function card(retireYM, touched) {
  var p = PM.emptyPlan(CTX_DEMO);
  p.retireYM = retireYM;
  p.retireTouched = !!touched;
  return p;
}

// ① 未触碰卡 retireYM=演示法定 2026-01，真实 ctx(1973-07) → 刷新为 2035-09，changed=true，其它字段不变
(function () {
  var c = card('2026-01', false);
  c.z = '1'; c.segType = 'enterprise'; c.windowStartYM = '2026-09';
  var r = PM.syncUnspecifiedRetire([c], CTX_REAL);
  A.eq(r.changed, true, '① 未触碰卡随真实 ctx changed=true');
  A.eq(r.plans[0].retireYM, '2035-09', '① retireYM 刷新 2026-01 -> 2035-09');
  A.eq(r.plans[0].z, '1', '① z 不变');
  A.eq(r.plans[0].segType, 'enterprise', '① segType 不变');
  A.eq(r.plans[0].windowStartYM, '2026-09', '① windowStartYM 不变');
  A.eq(r.plans[0].retireTouched, false, '① retireTouched 仍 false');
})();

// ② retireTouched=true（手选弹性值）→ 原样保留，changed=false
(function () {
  var c = card('2031-05', true);
  var r = PM.syncUnspecifiedRetire([c], CTX_REAL);
  A.eq(r.changed, false, '② 手选卡 changed=false');
  A.eq(r.plans[0].retireYM, '2031-05', '② 手选退休月不被覆盖');
  A.eq(r.plans[0].retireTouched, true, '② retireTouched 保持 true');
})();

// ③ 新法定值与现值相同（仅 historyEndYM 等无关字段变化）→ changed=false（不多余 persist）
(function () {
  var c = card('2035-09', false);
  var r = PM.syncUnspecifiedRetire([c], CTX_REAL);
  A.eq(r.changed, false, '③ 法定值相同 changed=false');
  A.eq(r.plans[0].retireYM, '2035-09', '③ 值不变');
})();

// ④ hasContext=false（缺 gender/birth，或 female 缺 femaleType）→ plans 原样、changed=false
(function () {
  var c = card('2026-01', false);
  A.eq(PM.syncUnspecifiedRetire([c], { gender: '', birthYM: '' }).changed, false, '④ 空 ctx changed=false');
  A.eq(PM.syncUnspecifiedRetire([c], { gender: 'female', femaleType: '', birthYM: '1981-07' }).changed, false,
    '④ female 缺 femaleType changed=false');
  A.eq(PM.syncUnspecifiedRetire([c], null).changed, false, '④ null ctx changed=false');
  A.eq(PM.syncUnspecifiedRetire([c], CTX_REAL).plans[0] !== undefined, true, '④ 结构正常');
})();

// ⑤ 混合：卡 A touched=true、卡 B touched=false → 只刷 B，A 不变
(function () {
  var a = card('2031-05', true);
  var b = card('2026-01', false);
  var r = PM.syncUnspecifiedRetire([a, b], CTX_REAL);
  A.eq(r.plans[0].retireYM, '2031-05', '⑤ 手选卡 A 不变');
  A.eq(r.plans[1].retireYM, '2035-09', '⑤ 未触碰卡 B 刷新');
  A.eq(r.changed, true, '⑤ 有卡刷新 changed=true');
})();

// ⑥ 女性档：female/1981-07 + femaleType=worker → 法定 2034-11（非 2026-01）；cadre → 2039-06
(function () {
  var cw = card('2026-01', false);
  var rw = PM.syncUnspecifiedRetire([cw], { gender: 'female', femaleType: 'worker', birthYM: '1981-07' });
  A.eq(rw.plans[0].retireYM, '2034-11', '⑥ female worker 1981-07 法定=2034-11');
  A.ok(rw.plans[0].retireYM !== '2026-01', '⑥ 女性档不残留 2026-01');
  var cc = card('2026-01', false);
  var rc = PM.syncUnspecifiedRetire([cc], { gender: 'female', femaleType: 'cadre', birthYM: '1981-07' });
  A.eq(rc.plans[0].retireYM, '2039-06', '⑥ female cadre 1981-07 法定=2039-06');
})();

// ⑦ 多卡一致刷；emptyPlan(ctx) 新卡再 sync 幂等（addPlan 场景）
(function () {
  var plans = [card('2026-01', false), card('2026-01', false), card('2026-01', false)];
  var r = PM.syncUnspecifiedRetire(plans, CTX_REAL);
  A.eq(r.plans.filter(function (p) { return p.retireYM === '2035-09'; }).length, 3, '⑦ 三卡一致刷新');
  // 已用真实 ctx 新建的卡再 sync 应幂等
  var fresh = PM.emptyPlan(CTX_REAL);
  A.eq(fresh.retireYM, '2035-09', '⑦ emptyPlan(真实ctx) 直接带正确法定值');
  A.eq(PM.syncUnspecifiedRetire([fresh], CTX_REAL).changed, false, '⑦ 新卡再 sync 幂等 changed=false');
})();

// ⑧ 回归 sanity：defaultRetireYM / initialPlans / isValidPlan 既有口径不破坏
(function () {
  A.eq(PM.defaultRetireYM(CTX_REAL), '2035-09', '⑧ defaultRetireYM 真实=2035-09');
  A.eq(PM.defaultRetireYM({}), '', '⑧ defaultRetireYM ctx 不足为空');
  A.eq(PM.initialPlans(CTX_REAL).length, 2, '⑧ initialPlans 默认 2 张');
  var p = PM.emptyPlan(CTX_REAL);
  p.z = '1'; p.segType = 'enterprise';
  A.eq(PM.isValidPlan(p, CTX_REAL, require(path.join(ROOT, 'calculator', 'dateUtil.js'))), true,
    '⑧ 真实 ctx 填全卡 isValidPlan=true');
})();

A.finish();
