// tests/wxml-expr-check.js
// ============================================================================
// 第二轮回归新增（测试方独立编写，不依赖/不覆盖开发者 scripts/wxml-check.js）：
// WXML 数据绑定表达式合法性静态校验器。
//
// 背景：pages/result/result.wxml 曾因 {{ }} 表达式内使用中文属性名
// （r.pension.J基础 等）触发微信 wcc 编译器 21 处
//   "Fatal: unexpected character inside expression"，整页无法编译；
// 而第一轮仅校验 mustache 是否配对，未校验表达式内容，导致漏测。
//
// 本扫描器独立提取每个 {{ }} 表达式并断言：
//   a) 表达式内不允许任何非 ASCII 字符（标识符 / 字符串字面量 / 函数名中的
//      中文、全角符号等均会令 wcc 报 unexpected character inside expression）；
//   b) {{ }} 必须配对（计数 + 顺序，防止 }}{{ 交叉嵌套这类计数发现不了的问题）；
//   c) 表达式内不允许 wcc 不支持的 JS 语法：
//        - 可选链 a?.b / a?.[0] / a?.()
//        - 空值合并 ??
//        - 箭头函数 =>
//        - 分号 ;（表达式语句分隔，wxml 不支持多语句）
//      （wxml 仅支持受限表达式：运算、比较、三元、字面量、成员访问、管道/数组等）
//
// 输出：每个违规输出 文件相对路径:行:列 与表达式片段；退出码 0=全部通过，1=有违规。
// 用法：node tests/wxml-expr-check.js [--json]
// ============================================================================
var fs = require('fs');
var path = require('path');

var argvRootIdx = process.argv.indexOf('--root');
var PROJECT_ROOT = argvRootIdx >= 0 ? path.resolve(process.argv[argvRootIdx + 1]) : path.join(__dirname, '..');
var findings = [];
var fileStats = [];

function rel(p) { return path.relative(PROJECT_ROOT, p).split(path.sep).join('/'); }

// 递归收集 pages/ 下全部 .wxml（另兼容 app.wxml 放根目录的情况）
function collectWxml(dir, out) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(function (name) {
    var p = path.join(dir, name);
    var st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name.charAt(0) === '.') return;
      collectWxml(p, out);
    } else if (/\.wxml$/.test(name)) out.push(p);
  });
}
var files = [];
['app.wxml'].forEach(function (f) {
  var p = path.join(PROJECT_ROOT, f);
  if (fs.existsSync(p)) files.push(p);
});
collectWxml(path.join(PROJECT_ROOT, 'pages'), files);

// 字符索引 -> {line, col}（1-based）
function locAt(src, index) {
  var line = 1, col = 1;
  for (var i = 0; i < index && i < src.length; i++) {
    if (src.charCodeAt(i) === 10) { line++; col = 1; } else col++;
  }
  return { line: line, col: col };
}

// ---- 规则 c：表达式内 wcc 不支持的语法（正则均基于 ASCII，不会误伤中文） ----
var UNSUPPORTED = [
  { re: /\?\s*\.(?!\s*\?)/g, name: 'optional-chaining(?.)', desc: '可选链 ?.（wcc 表达式解析器不支持 ES2020 可选链）' },
  { re: /\?\?/g, name: 'nullish-coalescing(??)', desc: '空值合并 ??（wcc 不支持；请用三元表达式）' },
  { re: /=>/g, name: 'arrow-function(=>)', desc: '箭头函数 =>（wcc 表达式不允许函数定义）' },
  { re: /;/g, name: 'semicolon(;)', desc: '分号 ;（wxml 表达式不支持多语句）' }
];

files.forEach(function (file) {
  var src = fs.readFileSync(file, 'utf8');
  var r = rel(file);
  var exprCount = 0;

  // ---------- b) mustache 配对：计数 + 顺序栈 ----------
  var depth = 0, minDepth = 0, openCount = 0, closeCount = 0;
  for (var k = 0; k + 1 < src.length; k++) {
    if (src[k] === '{' && src[k + 1] === '{') { depth++; openCount++; k++; }
    else if (src[k] === '}' && src[k + 1] === '}') {
      depth--; closeCount++; k++;
      if (depth < minDepth) {
        var loc = locAt(src, k - 1);
        findings.push({ file: r, line: loc.line, col: loc.col, rule: 'mustache-order',
          msg: '出现多余的 }}（没有对应的 {{）' });
        minDepth = depth;
      }
    }
  }
  if (openCount !== closeCount) {
    findings.push({ file: r, line: 1, col: 1, rule: 'mustache-count',
      msg: '{{ 与 }} 数量不配对（{{ = ' + openCount + '，}} = ' + closeCount + '）' });
  } else if (depth !== 0) {
    findings.push({ file: r, line: 1, col: 1, rule: 'mustache-nest',
      msg: '{{ }} 嵌套交叉，结束时深度=' + depth });
  }

  // ---------- 提取每个表达式（非贪婪，本项目无跨行表达式；兼容单行多表达式） ----------
  var re = /\{\{([\s\S]*?)\}\}/g, m;
  while ((m = re.exec(src))) {
    exprCount++;
    var expr = m[1];
    var start = m.index + 2; // 表达式首字符在 src 中的索引

    // ---------- a) 逐字符扫描非 ASCII（每个表达式只报一条，定位首个违规字符） ----------
    var firstBad = -1, badChars = 0;
    for (var i = 0; i < expr.length; i++) {
      var code = expr.charCodeAt(i);
      if (code > 127) {
        if (firstBad < 0) firstBad = i;
        badChars++;
      }
    }
    if (firstBad >= 0) {
      var loc2 = locAt(src, start + firstBad);
      findings.push({ file: r, line: loc2.line, col: loc2.col, rule: 'non-ascii-in-expr',
        msg: '{{}} 表达式内含 ' + badChars + ' 个非 ASCII 字符，首个为 U+' +
          expr.charCodeAt(firstBad).toString(16).toUpperCase() + '「' + expr[firstBad] +
          '」，wcc 将报 unexpected character inside expression。表达式片段: ' + expr.trim().slice(0, 80) });
    }

    // ---------- c) 不支持的语法 ----------
    UNSUPPORTED.forEach(function (u) {
      u.re.lastIndex = 0;
      var um;
      while ((um = u.re.exec(expr))) {
        var loc3 = locAt(src, start + um.index);
        findings.push({ file: r, line: loc3.line, col: loc3.col, rule: u.name,
          msg: u.desc + '。表达式片段: ' + expr.trim().slice(0, 80) });
      }
    });
  }
  fileStats.push({ file: r, exprs: exprCount });
});

// ============================== 输出 ==============================
if (process.argv.indexOf('--json') >= 0) {
  console.log(JSON.stringify({
    scannedFiles: fileStats.length,
    totalExprs: fileStats.reduce(function (s, f) { return s + f.exprs; }, 0),
    files: fileStats,
    findings: findings
  }, null, 1));
} else {
  console.log('扫描 WXML 文件 ' + fileStats.length + ' 个：');
  fileStats.forEach(function (f) { console.log('  - ' + f.file + '：' + f.exprs + ' 个 {{}} 表达式'); });
  if (findings.length) {
    console.log('\n发现 ' + findings.length + ' 处违规：');
    findings.forEach(function (f) {
      console.log('  ✗ [' + f.rule + '] ' + f.file + ':' + f.line + ':' + f.col + ' ' + f.msg);
    });
  } else {
    var total = fileStats.reduce(function (s, f) { return s + f.exprs; }, 0);
    console.log('\n✅ 全部通过：' + fileStats.length + ' 个文件 / ' + total +
      ' 个 {{}} 表达式，无非 ASCII 字符、mustache 配对、无可选链/?? /=>/; 等 wcc 不支持语法。');
  }
}
process.exit(findings.length ? 1 : 0);
