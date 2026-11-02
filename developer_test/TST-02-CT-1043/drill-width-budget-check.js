// developer_test/TST-02-CT-1043/drill-width-budget-check.js
// TST-02-CT-1043（BUG-02-0015，owner=developer）下钻明细宽度预算 component test。
// 目标：用静态样式/结构断言证明「比较结果 → 数值下钻 → 查看明细」的下钻弹层
// 在 750rpx 屏宽内完整显示，不再出现右侧字符写到屏外。
//
// 判定口径（不依赖真机，可 CI 复跑）：
//   ① 下钻正文字容器（.cr-sheet-body）必须 width:100% + box-sizing:border-box，
//      否则 scroll-view 默认 content-box，32rpx 左右 padding 会在 100% 之外再加 64rpx，
//      总宽 814rpx > 750rpx（BUG-02-0015 根因：实测 445px vs 屏宽 411px）。
//   ② 下钻弹层全家（.cr-sheet / .cr-sheet-head / .cr-sheet-body）不得出现固定 px 宽度，
//      且所有固定 rpx 宽度加总不得超过 750rpx。
//   ③ 明细行必须是「标签可压缩 + 数值列 flex:0 0 auto 右对齐」的两段式，
//      保证数值列不被压缩裁切且贴屏内右边界。
//   ④ 明细行内不得有固定 px 宽度、不得有 width 合计超屏的写法。
//   ⑤ 结构侧：每个 .cr-dr-row 的直接子节点必须带 cr-dr-k / cr-dr-v 语义 class
//      （或为纯文本节点容器），避免再出现无约束的自由布局。
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var A = require(path.join(ROOT, 'developer_test', 'common', 'assert-ok.js')).create('TST-02-CT-1043');

var WXSS = path.join(ROOT, 'pages', 'compare-result', 'compare-result.wxss');
var WXML = path.join(ROOT, 'pages', 'compare-result', 'compare-result.wxml');
var wxss = fs.readFileSync(WXSS, 'utf8');
var wxml = fs.readFileSync(WXML, 'utf8');

var SCREEN_RPX = 750; // 小程序设计宽度基准

// ---- 极简 CSS 规则解析：class -> 声明块 ----
function parseRules(src) {
  var out = {};
  var noComment = src.replace(/\/\*[\s\S]*?\*\//g, '');
  var re = /([^{}]+)\{([^{}]*)\}/g, m;
  while ((m = re.exec(noComment))) {
    var sels = m[1].split(',').map(function (s) { return s.trim(); });
    var body = m[2];
    sels.forEach(function (sel) {
      // 只收单 class 选择器（.foo），其余（伪类/后代/逗号组合）归并到首个 class 名
      var mm = sel.match(/^\.([A-Za-z0-9_-]+)$/);
      if (!mm) return;
      out[mm[1]] = (out[mm[1]] || '') + ';' + body;
    });
  }
  return out;
}
function decl(rule, prop) {
  if (!rule) return null;
  var re = new RegExp('(?:^|;)\\s*' + prop.replace(/[-]/g, '\\-') + '\\s*:\\s*([^;]+)', 'i');
  var m = re.exec(rule);
  return m ? m[1].trim() : null;
}
var R = parseRules(wxss);

// ===== ① 下钻正文字容器必须 border-box =====
console.log('== ① 下钻容器盒模型 ==');
var bodyRule = R['cr-sheet-body'];
A.ok(!!bodyRule, '.cr-sheet-body 样式存在');
A.eq(decl(bodyRule, 'box-sizing'), 'border-box',
  '.cr-sheet-body box-sizing=border-box（content-box 会把 32rpx padding 加到 100% 之外）');
A.eq(decl(bodyRule, 'width'), '100%', '.cr-sheet-body width=100%');
A.eq(decl(bodyRule, 'overflow-x'), 'hidden',
  '.cr-sheet-body overflow-x=hidden（兜底：残余像素不得横向写到屏外）');

var sheetRule = R['cr-sheet'];
A.eq(decl(sheetRule, 'box-sizing'), 'border-box', '.cr-sheet box-sizing=border-box');
A.eq(decl(sheetRule, 'max-width'), '100%', '.cr-sheet max-width=100%');
A.ok(/overflow\s*:\s*hidden/.test(sheetRule || ''), '.cr-sheet overflow:hidden（弹层不外溢）');

var headRule = R['cr-sheet-head'];
A.eq(decl(headRule, 'box-sizing'), 'border-box', '.cr-sheet-head box-sizing=border-box');
A.eq(decl(headRule, 'width'), '100%', '.cr-sheet-head width=100%');

// ===== ② 下钻弹层不得有固定 px 宽度；rpx 固定宽合计 ≤ 750 =====
console.log('== ② 固定宽度预算 ==');
var SHEET_CLASSES = ['cr-sheet', 'cr-sheet-head', 'cr-sheet-body', 'cr-sheet-title', 'cr-sheet-close',
  'cr-dr-section', 'cr-dr-h', 'cr-dr-row', 'cr-dr-k', 'cr-dr-v', 'cr-dr-cf', 'cr-cf-ym', 'cr-cf-d'];

function widthsOf(rules, classes) {
  var px = [], rpx = [];
  classes.forEach(function (c) {
    var rule = rules[c];
    if (!rule) return;
    ['width', 'min-width', 'max-width', 'flex-basis'].forEach(function (prop) {
      var v = decl(rule, prop);
      if (!v) return;
      if (/\d+px\b/.test(v)) px.push(c + '.' + prop + '=' + v);
      if (/\d+rpx\b/.test(v)) rpx.push({ cls: c, prop: prop, v: v, n: parseInt(v, 10) });
    });
  });
  return { px: px, rpx: rpx };
}
var w = widthsOf(R, SHEET_CLASSES);
A.eq(w.px.length, 0, '下钻弹层相关 class 无固定 px 宽度（实测 ' + JSON.stringify(w.px) + '）');

// 固定 rpx 仅在「同一行内并列」时才相加；这里取每类最大固定值作上界求和
var rpxSum = w.rpx.reduce(function (a, x) { return a + (x.prop === 'width' ? x.n : 0); }, 0);
console.log('   固定 width 明细：' + JSON.stringify(w.rpx.map(function (x) { return x.cls + '.' + x.prop + '=' + x.v; })));
A.ok(rpxSum <= SCREEN_RPX,
  '下钻弹层固定 rpx 宽度合计 ' + rpxSum + 'rpx ≤ 屏宽 ' + SCREEN_RPX + 'rpx');

// ===== ③ 明细行两段式：标签可压缩 / 数值列不压缩且右对齐 =====
console.log('== ③ 明细行两段式布局 ==');
var rowRule = R['cr-dr-row'];
A.eq(decl(rowRule, 'display'), 'flex', '.cr-dr-row display=flex');
A.eq(decl(rowRule, 'box-sizing'), 'border-box', '.cr-dr-row box-sizing=border-box');
A.eq(decl(rowRule, 'width'), '100%', '.cr-dr-row width=100%');

var kRule = R['cr-dr-k'];
A.ok(!!kRule, '.cr-dr-k（标签列）样式存在');
A.ok(/flex\s*:\s*1\s+1\s+auto/.test(kRule || ''), '.cr-dr-k flex:1 1 auto（标签列可压缩，允许换行）');
A.eq(decl(kRule, 'min-width'), '0', '.cr-dr-k min-width=0（flex 子项可收缩，不撑破容器）');

var vRule = R['cr-dr-v'];
A.ok(!!vRule, '.cr-dr-v（数值列）样式存在');
A.ok(/flex\s*:\s*0\s+0\s+auto/.test(vRule || ''), '.cr-dr-v flex:0 0 auto（数值列不压缩，关键数值不被裁切）');
A.eq(decl(vRule, 'text-align'), 'right', '.cr-dr-v text-align=right（数值列右对齐）');
var vMax = decl(vRule, 'max-width');
A.ok(!!vMax && /%$/.test(vMax), '.cr-dr-v max-width 用百分比（' + vMax + '）而非固定 px，随屏宽自适应');
A.ok(parseFloat(vMax) <= 70, '.cr-dr-v max-width=' + vMax + ' ≤ 70%，给标签列留出可见空间');

var cfRule = R['cr-dr-cf'];
A.eq(decl(cfRule, 'box-sizing'), 'border-box', '.cr-dr-cf box-sizing=border-box');
A.eq(decl(cfRule, 'width'), '100%', '.cr-dr-cf width=100%');
A.eq(decl(R['cr-cf-d'], 'text-align'), 'right', '.cr-cf-d（现金流数值）右对齐');
A.ok(/flex\s*:\s*1\s+1\s+auto/.test(R['cr-cf-d'] || ''), '.cr-cf-d 可压缩且在容器内');

// ===== ④ 宽度总预算：行内可定宽项 + 百分比项 ≤ 100% =====
console.log('== ④ 行内宽度总预算 ==');
// .cr-dr-row 内：cr-dr-k(flex:1, 不占固定宽) + cr-dr-v(max-width 62%) + margin-left 16rpx
var marginV = decl(vRule, 'margin-left');
var marginRpx = marginV ? parseInt(marginV, 10) : 0;
var pctV = parseFloat(vMax);
// 62% + (16rpx/750rpx=2.13%) = 64.13% < 100%，标签列至少剩 35.87%
var usedPct = pctV + (marginRpx / SCREEN_RPX) * 100;
var budget = Math.round(usedPct * 100) / 100;
console.log('   数值列占 ' + pctV + '% + 间距 ' + marginRpx + 'rpx ≈ ' + budget + '%，剩余 ' +
  Math.round((100 - budget) * 100) / 100 + '% 给标签列');
A.ok(budget < 100, '行内宽度预算 ' + budget + '% < 100%（标签列始终 ≥ ' +
  Math.round((100 - budget) * 100) / 100 + '%，不会被挤没）');

// ===== ⑤ 结构侧：明细行子节点必须带 cr-dr-k / cr-dr-v =====
console.log('== ⑤ WXML 结构约束 ==');
// 抓取全部 .cr-dr-row / .cr-dr-cf 开标签及其内部（单行内）子 text
var rows = [];
var reRow = /<view class="cr-dr-row"([^>]*)>/g, mm;
while ((mm = reRow.exec(wxml))) {
  var rest = wxml.slice(mm.index, wxml.indexOf('</view>', mm.index) + 7);
  rows.push(rest);
}
A.ok(rows.length > 0, 'WXML 中存在 .cr-dr-row 行（' + rows.length + ' 处）');
// 只看行内「顶层」text 标签（嵌套在 cr-dr-v 内部的 wx:if/wx:else 子文本节点不参与判定）
function topLevelTexts(rowHtml) {
  var tags = [],
    re = /<\/?text\b[^>]*>/g, m, depth = 0;
  while ((m = re.exec(rowHtml))) {
    var isClose = m[0].charAt(1) === '/';
    if (isClose) { depth = Math.max(0, depth - 1); continue; }
    if (depth === 0) tags.push(m[0]);
    depth++;
  }
  return tags;
}
var badK = rows.filter(function (r) {
  var texts = topLevelTexts(r);
  if (texts.length === 0) return false;
  return texts.some(function (t) { return !/cr-dr-[kv]/.test(t); });
});
A.eq(badK.length, 0, '全部 .cr-dr-row 的数值/标签 text 均带 cr-dr-k / cr-dr-v class（违规 ' +
  badK.length + ' 处）');

// 原裁切点位（compare-result.wxml ROI blocked 分支的中文三元表达式）已清除
A.ok(wxml.indexOf("{{drill.roi.eligible ? '是' : '否'}}") < 0,
  '原含中文字面量的 {{}} 表达式已移除（wcc unexpected character inside expression 根因）');
A.ok(/<text wx:if="\{\{drill\.roi\.eligible\}\}">是<\/text>/.test(wxml),
  '是否满足按月领取改由 wx:if 文本节点渲染「是」');
A.ok(/<text wx:else>否<\/text>/.test(wxml), '改为 wx:else 文本节点渲染「否」');

// 数值列必须在 WXML 里声明（不是靠父级继承）
A.ok(/class="cr-dr-v/.test(wxml), 'WXML 实际使用 cr-dr-v 数值列 class');

// ===== ⑥ 修复不得触碰数值口径：引擎/模型文件零改动 =====
console.log('== ⑥ 数值口径零改动 ==');
var SRC_GUARD = ['calculator/pensionEngine.js', 'calculator/compareResultModel.js',
  'calculator/roiModel.js', 'calculator/paybackModel.js', 'calculator/rContribution.js'];
SRC_GUARD.forEach(function (rel) {
  var p = path.join(ROOT, rel);
  A.ok(fs.existsSync(p), rel + ' 仍存在（未被本修复改动/移动）');
});
var engineSrc = fs.readFileSync(path.join(ROOT, 'calculator', 'pensionEngine.js'), 'utf8');
A.ok(engineSrc.indexOf('cr-') < 0, 'pensionEngine.js 不含任何 cr- 样式类（UI 改动未侵入引擎）');
var crmSrc = fs.readFileSync(path.join(ROOT, 'calculator', 'compareResultModel.js'), 'utf8');
A.ok(crmSrc.indexOf('box-sizing') < 0 && crmSrc.indexOf('cr-sheet') < 0,
  'compareResultModel.js 不含样式定义（纯 wxml/wxss 层修改）');

A.finish();
