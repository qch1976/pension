// developer_test/TST-02-UT-1006/caseimport-choose-cancel-check.js
// TST-02-UT-1006（REQ-02-IN-001，owner=developer）node 断言。
// case-specific：chooseMessageFile 取消时安静返回 {cancelled:true}（不报错、不抛异常）。
'use strict';
var path = require('path');
var A = require(path.join(__dirname, '..', 'common', 'assert-ok.js')).create('TST-02-UT-1006');

// case-specific input：fake wx.chooseMessageFile 走 fail(cancel)
var CI;
function loadWithWx(wxImpl) {
  global.wx = wxImpl;
  var p = path.join(__dirname, '..', '..', 'services', 'caseImport.js');
  delete require.cache[require.resolve(p)];
  CI = require(p);
}

// expect output 断言
Promise.resolve().then(function () {
  // 情形1：用户主动取消（errMsg 含 cancel）
  loadWithWx({
    chooseMessageFile: function (o) { o.fail({ errMsg: 'chooseMessageFile:fail cancel' }); }
  });
  return CI.chooseCaseFile().then(function (r1) {
    A.ok(r1 && r1.cancelled === true, '取消 errMsg 含 cancel -> {cancelled:true}');
    A.ok(!('error' in r1), '取消不携带 error（安静返回）');

    // 情形2：success 但 tempFiles 为空 -> 视为取消
    loadWithWx({
      chooseMessageFile: function (o) { o.success({ tempFiles: [] }); }
    });
    return CI.chooseCaseFile().then(function (r2) {
      A.ok(r2 && r2.cancelled === true, 'tempFiles 为空 -> {cancelled:true}');

      // 情形3：非取消类失败 -> 返回 error（非 cancelled）
      loadWithWx({
        chooseMessageFile: function (o) { o.fail({ errMsg: 'chooseMessageFile:fail auth deny' }); }
      });
      return CI.chooseCaseFile().then(function (r3) {
        A.ok(r3 && r3.cancelled === false && typeof r3.error === 'string', '非取消失败 -> {cancelled:false,error}');
        A.finish();
      });
    });
  });
}).catch(function (e) {
  console.log('  FATAL: ' + (e && e.stack || e));
  process.exit(1);
});
