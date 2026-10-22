// developer_test/common/case-fixture.js
// 加载客户用例夹具（My-Case / MyWife-Case）的公共件（testcase-structure SKILL 公共逻辑入 common/）。
'use strict';
var path = require('path');
var fs = require('fs');

// ROOT 指向仓根（common/ 的上两级）
var ROOT = path.join(__dirname, '..', '..');

function loadMy() {
  return fs.readFileSync(path.join(ROOT, 'docs', 'customer_usecases', 'My-Case.md'), 'utf8');
}
function loadWife() {
  return fs.readFileSync(path.join(ROOT, 'docs', 'customer_usecases', 'MyWife-Case.md'), 'utf8');
}

module.exports = { ROOT: ROOT, loadMy: loadMy, loadWife: loadWife };
