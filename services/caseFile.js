// services/caseFile.js
// E2（REQ-02-FMT-000 / IN-005 / VAL-001/002）：Case 文件解析器（纯逻辑，不依赖 wx API）。
//
// 文件结构（与 docs/mycases 同构）：
//   ``` My case: common ```          块标记（标签可含 common 表示共用块）
//   # 字段名: 值                      头部字段
//   # 缴费记录                        表格分区标题
//   | 年份 | 养老缴纳基数(年) | 年内缴纳月数 |   管道表（首行表头，容忍无结尾竖线/分隔行）
//   | 2000 | 6142 | 2 |
//   ``` My case 1 ```                方案差异块（compare 模式忽略并提示）
//
// 契约：
//   parseCaseFile(text, mode) -> {
//     mode, ok, fields{}, records[], planBlocks, ignoredDiffFields[],
//     errors:[{line,reason}], notices:[{line,reason}]
//   }
//   mode: 'basic' | 'compare'（默认 basic）。
'use strict';

// ---- 头部字段规范（§6.1）：归一化名 -> 规范键 ----
var FIELD_ALIASES = {
  '生日': 'birthday',
  '预计退休时间': 'retireYM',
  '参加工作时间': 'workStartYM',
  '首次建立养老账号': 'accountStartYM',
  '视同缴纳起始时间(事业单位)': 'deemedStartYM',
  '视同缴纳结束时间(事业单位)': 'deemedEndYM',
  '养老保险目前交到': 'paidToYM',
  '个人账户金额': 'accountBalance',
  '个人账户利率': 'accountRate',
  '往后的缴费性质': 'contributionNature',
  '每月缴费Z值': 'zValue'
};
// 方案差异字段（compare 模式若在文件中出现 -> 忽略并提示，REQ-02-IN-003）
var DIFF_KEYS = { retireYM: 1, contributionNature: 1, zValue: 1 };
// 数值型字段
var NUMERIC_KEYS = { accountBalance: 1, accountRate: 1, zValue: 1 };

function normFieldName(raw) {
  // 去空白/全角冒号；保留括号内容用于精确，同时提供去括号兜底
  return String(raw == null ? '' : raw).replace(/[\s：:]/g, '').trim();
}
function stripParen(s) {
  return String(s).replace(/[（(][^）)]*[）)]/g, '');
}
function resolveFieldKey(rawName) {
  var n = normFieldName(rawName);
  if (Object.prototype.hasOwnProperty.call(FIELD_ALIASES, n)) return FIELD_ALIASES[n];
  // 去掉括号补充说明再匹配（如「个人账户金额(截至2026-08，不用验证)」）
  var n2 = stripParen(n);
  var keys = Object.keys(FIELD_ALIASES);
  for (var i = 0; i < keys.length; i++) {
    var aliasNorm = normFieldName(keys[i]);
    if (aliasNorm === n2) return FIELD_ALIASES[keys[i]];
  }
  // 后缀匹配：以规范名结尾（如「从2026-09往后的缴费性质」「预计从2026-09往后每月缴费Z值」）
  var SUFFIX_RULES = [
    { suffix: '往后的缴费性质', key: 'contributionNature' },
    { suffix: '缴费性质', key: 'contributionNature' },
    { suffix: '每月缴费Z值', key: 'zValue' },
    { suffix: '缴费Z值', key: 'zValue' },
    { suffix: 'Z值', key: 'zValue' }
  ];
  for (var k = 0; k < SUFFIX_RULES.length; k++) {
    if (n2.indexOf(SUFFIX_RULES[k].suffix) >= 0) return SUFFIX_RULES[k].key;
  }
  for (var j = 0; j < keys.length; j++) {
    var base = normFieldName(stripParen(keys[j]));
    if (n2.indexOf(base) >= 0) return FIELD_ALIASES[keys[j]];
  }
  return null;
}

function toNumber(raw) {
  var s = String(raw).replace(/[,%元\s]/g, '');
  if (s === '') return NaN;
  return Number(s);
}

function isSeparatorRow(cells) {
  return cells.join('').replace(/[-:\s|]/g, '') === '' && /-/.test(cells.join(''));
}

// 解析一组“块内”文本行。startLineNo=该块首行在原文中的行号（1基）。
function parseBlock(lines, startLineNo, ctx) {
  var tableHeaderSeen = false;

  for (var i = 0; i < lines.length; i++) {
    var lineNo = startLineNo + i;
    var raw = lines[i];
    var line = raw.replace(/\s+$/, '');
    var trimmed = line.trim();
    if (trimmed === '') continue;

    // 注释/分区标题
    if (trimmed.charAt(0) === '#') {
      var body = trimmed.slice(1).trim();
      // 纯标题（无冒号）且为表格分区标记
      if (body.indexOf(':') < 0 && body.indexOf('：') < 0) {
        if (/缴费记录/.test(body)) continue;
        // 其它无冒号标题行：容忍（非字段声明）
        ctx.notices.push({ line: lineNo, reason: '无法识别的标题行：' + body });
        continue;
      }
      var ci = body.search(/[:：]/);
      var name = body.slice(0, ci).trim();
      var value = body.slice(ci + 1).trim();
      if (!name) {
        ctx.errors.push({ line: lineNo, reason: '缺失字段名' });
        continue;
      }
      var key = resolveFieldKey(name);
      if (!key) {
        ctx.errors.push({ line: lineNo, reason: '无法识别的头部字段：' + name });
        continue;
      }
      if (value === '') {
        ctx.errors.push({ line: lineNo, reason: '字段「' + name + '」缺少值' });
        continue;
      }
      if (NUMERIC_KEYS[key]) {
        var num = toNumber(value);
        if (!isFinite(num)) {
          ctx.errors.push({ line: lineNo, reason: '字段「' + name + '」不是数字：' + value });
          continue;
        }
        ctx.fields[key] = num;
      } else {
        ctx.fields[key] = value;
      }
      continue;
    }

    // 管道表行
    if (trimmed.charAt(0) === '|') {
      var cells = trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
      var isHeader = /年份/.test(cells[0]) || cells.join('').indexOf('年份') >= 0;
      if (isHeader) { tableHeaderSeen = true; continue; }   // 表头行
      if (!tableHeaderSeen) {
        // 表前出现的管道行：不能当作表头（不含“年份”），按列数/数据校验
      }
      if (isSeparatorRow(cells)) continue;
      if (cells.length !== 3) {
        ctx.errors.push({ line: lineNo, reason: '缴费表行列数应为 3，实际 ' + cells.length });
        continue;
      }
      var year = toNumber(cells[0]);
      var baseV = toNumber(cells[1]);
      var months = toNumber(cells[2]);
      if (!isFinite(year) || !isFinite(baseV) || !isFinite(months)) {
        ctx.errors.push({ line: lineNo, reason: '缴费表数值列非数字：' + cells.join(' | ') });
        continue;
      }
      ctx.records.push({ year: year, base: baseV, months: months });
      continue;
    }

    // 其它非空、非块标记文本
    ctx.notices.push({ line: lineNo, reason: '忽略无法解析的文本：' + trimmed });
  }
}

// 将全文切分为带标签的块。
function splitBlocks(text) {
  var lines = String(text).split(/\r?\n/);
  var blocks = [];
  var current = null;
  var pre = [];
  var preStart = 1;

  for (var i = 0; i < lines.length; i++) {
    var lineNo = i + 1;
    var t = lines[i].trim();
    var fence = t.match(/^```(.*)$/);
    if (fence) {
      var label = fence[1].replace(/```$/g, '').trim();
      if (current === null) {
        // 开块：先固化块前内容
        if (pre.some(function (l) { return l.trim() !== ''; })) {
          blocks.push({ label: '', lines: pre.slice(), startLine: preStart });
        }
        current = { label: label, lines: [], startLine: lineNo + 1 };
      } else {
        // 闭块
        blocks.push({ label: current.label, lines: current.lines, startLine: current.startLine });
        current = null;
        pre = [];
        preStart = lineNo + 1;
      }
      continue;
    }
    if (current === null) {
      if (pre.length === 0) preStart = lineNo;
      pre.push(lines[i]);
    } else {
      current.lines.push(lines[i]);
    }
  }
  // 未闭合块：把已收集内容作为一个块
  if (current) blocks.push({ label: current.label, lines: current.lines, startLine: current.startLine });
  if (current === null && pre.some(function (l) { return l.trim() !== ''; })) {
    blocks.push({ label: '', lines: pre.slice(), startLine: preStart });
  }
  return blocks;
}

function isCommonLabel(label) {
  return /common|共用|公共|共享/i.test(String(label || ''));
}

function parseCaseFile(text, mode) {
  var m = mode === 'compare' ? 'compare' : 'basic';

  var base = {
    mode: m,
    fields: {},
    records: [],
    planBlocks: [],
    ignoredDiffFields: [],
    errors: [],
    notices: []
  };

  // VAL-001：空文件 / 不可读
  if (text == null || String(text).replace(/\s/g, '') === '') {
    base.errors.push({ line: 0, reason: '文件为空或不可读' });
    base.ok = false;
    return base;
  }

  var blocks = splitBlocks(text);

  if (m === 'basic') {
    // REQ-02-IN-005：一份文件只能包含一份数据。
    var nonEmpty = blocks.filter(function (b) {
      return b.lines.some(function (l) { return l.trim() !== ''; });
    });
    if (nonEmpty.length > 1) {
      base.errors.push({
        line: 0,
        reason: '一份文件只能包含一份数据（检测到 ' + nonEmpty.length + ' 个数据块）'
      });
      // 仍解析首个块，便于界面部分回填（Q3）
      var ctx0 = { fields: base.fields, records: base.records, errors: base.errors, notices: base.notices };
      parseBlock(nonEmpty[0].lines, nonEmpty[0].startLine, ctx0);
      base.ok = false;
      return base;
    }
    var only = nonEmpty[0] || { lines: [], startLine: 1 };
    var ctxb = { fields: base.fields, records: base.records, errors: base.errors, notices: base.notices };
    parseBlock(only.lines, only.startLine, ctxb);
    base.ok = base.errors.length === 0;
    return base;
  }

  // compare：解析 common 块；方案差异块忽略并提示（IN-003）。
  var common = blocks.filter(function (b) { return isCommonLabel(b.label); })[0];
  if (!common) {
    // 无显式 common 标签：若仅有一个块，视作共用块
    var nonEmptyC = blocks.filter(function (b) { return b.lines.some(function (l) { return l.trim() !== ''; }); });
    common = nonEmptyC.length === 1 ? nonEmptyC[0] : null;
  }
  if (!common) {
    base.errors.push({ line: 0, reason: '方案比较文件缺少共用数据块（common）' });
    base.ok = false;
    return base;
  }

  var ctx = { fields: base.fields, records: base.records, errors: base.errors, notices: base.notices };
  parseBlock(common.lines, common.startLine, ctx);

  // 处理方案差异块
  blocks.forEach(function (b) {
    if (b === common) return;
    var hasContent = b.lines.some(function (l) { return l.trim() !== ''; });
    if (!hasContent) return;
    base.planBlocks.push(b.label || '未命名方案');
    var diffCtx = { fields: {}, records: [], errors: [], notices: [] };
    parseBlock(b.lines, b.startLine, diffCtx);
    Object.keys(diffCtx.fields).forEach(function (k) {
      if (DIFF_KEYS[k]) {
        if (base.ignoredDiffFields.indexOf(k) < 0) base.ignoredDiffFields.push(k);
      }
    });
  });

  if (base.ignoredDiffFields.length) {
    base.notices.push({ line: 0, reason: '方案差异项以界面为准' });
  }
  base.ok = base.errors.length === 0;
  return base;
}

module.exports = {
  parseCaseFile: parseCaseFile,
  // 暴露供单测
  _resolveFieldKey: resolveFieldKey,
  _splitBlocks: splitBlocks,
  _FIELD_ALIASES: FIELD_ALIASES
};
