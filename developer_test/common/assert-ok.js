// developer_test/common/assert-ok.js
// 公共断言计数器（testcase-structure SKILL：多 testcase 共用公共逻辑入 common/）。
// 用法：
//   var A = require('../../common/assert-ok.js').create('TST-02-UT-1001');
//   A.ok(cond, 'name'); A.eq(a,b,'name'); A.approx(a,b,eps,'name'); A.throws(fn,frag,'name');
//   ...  A.finish();  // 打印 pass/fail 并按 fail 退出码
'use strict';

function create(tag) {
  var pass = 0, fail = 0;
  var api = {
    tag: tag,
    ok: function (c, n) { if (c) pass++; else { fail++; console.log('  FAIL[' + tag + ']: ' + n); } },
    eq: function (a, b, n) {
      if (a === b) pass++;
      else { fail++; console.log('  FAIL[' + tag + ']: ' + n + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
    },
    approx: function (a, b, eps, n) {
      if (typeof eps === 'string') { n = eps; eps = null; }
      if (Math.abs(a - b) <= (eps == null ? 0.001 : eps)) pass++;
      else { fail++; console.log('  FAIL[' + tag + ']: ' + n + ' (|' + a + ' - ' + b + '| > ' + (eps == null ? 0.001 : eps) + ')'); }
    },
    throws: function (fn, frag, n) {
      var got = null;
      try { fn(); } catch (e) { got = (e && e.message) || String(e); }
      if (got && got.indexOf(frag) !== -1) pass++;
      else { fail++; console.log('  FAIL[' + tag + ']: ' + n + ' (期望含「' + frag + '」, 实际: ' + got + ')'); }
    },
    contains: function (text, sub, n) {
      if (String(text).indexOf(sub) !== -1) pass++;
      else { fail++; console.log('  FAIL[' + tag + ']: ' + n + ' :: 缺「' + sub + '」'); }
    },
    finish: function () {
      console.log(tag + ': pass=' + pass + ' fail=' + fail);
      process.exit(fail ? 1 : 0);
    }
  };
  return api;
}

module.exports = { create: create };
