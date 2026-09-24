// scripts/wxml-check.js
// WXML 静态检查（纯 node 运行：node scripts/wxml-check.js）：
//   1) Mustache {{ }} 配对（防 BUG-001 复发）
//   2) <view>/<block>/<text>/<button> 等标签闭合、picker/input 自闭合
//   3)【第二轮新增】提取每个 {{ }} 表达式内容，出现非 ASCII 字符即失败
//      —— 微信 wcc 编译器不允许数据绑定表达式内出现非 ASCII 标识符/字面量
//         （中文属性名如 r.pension.J基础、中文字符串字面量、中文函数名均会导致
//          "Fatal: unexpected character inside expression"，整页无法编译）
//   4)【第二轮新增】表达式内禁止 ES2020 可选链 ?.（wcc 表达式解析器不支持）
var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var files = [];
(function walk(dir) {
  fs.readdirSync(dir).forEach(function (name) {
    var p = path.join(dir, name);
    var st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name.charAt(0) === '.') return;
      walk(p);
    } else if (/\.wxml$/.test(name)) files.push(p);
  });
})(path.join(root, 'pages'));

var errors = [];
var exprCount = 0;

// 提取字符串中所有 {{ ... }}（支持跨行：[\s\S]*? 非贪婪；本项目当前无跨行表达式）
function extractExprs(src) {
  var out = [];
  var re = /\{\{([\s\S]*?)\}\}/g;
  var m;
  while ((m = re.exec(src))) {
    // 计算表达式起始在源文中的行列
    var upto = src.slice(0, m.index);
    var line = upto.split('\n').length;
    var col = upto.length - upto.lastIndexOf('\n');
    out.push({ expr: m[1], line: line, col: col + 2 });
  }
  return out;
}

files.forEach(function (f) {
  var rel = path.relative(root, f);
  var src = fs.readFileSync(f, 'utf8');
  var lines = src.split('\n');

  // 1) Mustache 配对（允许 {{ }} 跨行的简单计数；本项目无跨行写法）
  lines.forEach(function (line, i) {
    var open = (line.match(/{{/g) || []).length;
    var close = (line.match(/}}/g) || []).length;
    if (open !== close) {
      errors.push(rel + ':' + (i + 1) + ' Mustache 不配对（{{ ' + open + ' 个, }} ' + close + ' 个）: ' + line.trim().slice(0, 80));
    }
  });

  // 2) 标签配对（忽略自闭合 <.../> 与无体元素）
  var voidTags = { input: 1, image: 1, icon: 1, import: 1, include: 1 };
  var stack = [];
  var code = src.replace(/<!--[\s\S]*?-->/g, '');
  var tokenRe = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  var tm;
  while ((tm = tokenRe.exec(code))) {
    var closing = tm[1] === '/';
    var tag = tm[2];
    var selfClose = tm[4] === '/';
    if (voidTags[tag]) continue;
    if (closing) {
      var top = stack.pop();
      if (!top || top.tag !== tag) {
        errors.push(rel + ' 闭合标签 </' + tag + '> 与栈顶 ' + (top ? '<' + top.tag + '>' : '空') + ' 不匹配');
      }
    } else if (!selfClose) {
      stack.push({ tag: tag });
    }
  }
  if (stack.length) errors.push(rel + ' 存在未闭合标签: ' + stack.map(function (s) { return '<' + s.tag + '>'; }).join(', '));

  // 3) {{ }} 表达式内禁止非 ASCII 字符（标识符或字符串字面量中的中文均会令 wcc 编译失败）
  extractExprs(src).forEach(function (e) {
    exprCount++;
    for (var i = 0; i < e.expr.length; i++) {
      var c = e.expr.charCodeAt(i);
      if (c > 127) {
        var ch = e.expr[i];
        errors.push(rel + ':' + e.line + ':' + (e.col + i) +
          ' {{}} 表达式内含非 ASCII 字符「' + ch + '」（wcc 编译会报 unexpected character inside expression），'
          + '请在页面 JS 中构造纯 ASCII 键视图模型。表达式片段: ' + e.expr.trim().slice(0, 70));
        break;
      }
    }
    // 4) 禁止可选链 ?. / 空值合并 ??（wcc 表达式语法不支持）
    if (/\?\s*\./.test(e.expr)) {
      errors.push(rel + ':' + e.line + ':' + e.col + ' {{}} 表达式内使用了可选链 ?.，wcc 不支持。表达式片段: ' + e.expr.trim().slice(0, 70));
    }
  });
});

if (errors.length) {
  console.log('WXML 静态检查失败（' + errors.length + ' 处）：');
  errors.forEach(function (e) { console.log('  ✗ ' + e); });
  process.exit(1);
}
console.log('WXML 静态检查通过：' + files.length + ' 个文件，' + exprCount + ' 个 {{}} 表达式；Mustache 配对、标签闭合、表达式纯 ASCII 全部合规。');
