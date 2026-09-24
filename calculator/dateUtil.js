// calculator/dateUtil.js
// 年月粒度工具：所有时间计算精确到月（spec 4.7）
// 'YYYY-MM' 与“月序号”(year*12+monthIndex) 互转，月序号差即相隔月数。

function toIndex(ym) {
  if (!ym) return null;
  var parts = String(ym).split('-');
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
    throw new Error('非法年月格式: ' + ym + '（应为 YYYY-MM）');
  }
  return y * 12 + (m - 1); // 该月在时间轴上的序号
}

function toYM(idx) {
  var y = Math.floor(idx / 12);
  var m = (idx % 12) + 1;
  return y + '-' + (m < 10 ? '0' + m : '' + m);
}

function yearOf(idx) { return Math.floor(idx / 12); }
function monthOf(idx) { return (idx % 12) + 1; }

// 闭区间 [start,end] 月数
function monthsBetween(startYM, endYM) {
  return toIndex(endYM) - toIndex(startYM) + 1;
}

function addMonths(ym, n) {
  return toYM(toIndex(ym) + n);
}

function prevMonth(ym) { return addMonths(ym, -1); }

// 两个年月间的整年数（向下取整，用于非整数岁取 M：spec T-14 按满整岁）
function wholeYearsBetween(startYM, endYM) {
  return Math.floor((toIndex(endYM) - toIndex(startYM)) / 12);
}

module.exports = {
  toIndex: toIndex,
  toYM: toYM,
  yearOf: yearOf,
  monthOf: monthOf,
  monthsBetween: monthsBetween,
  addMonths: addMonths,
  prevMonth: prevMonth,
  wholeYearsBetween: wholeYearsBetween
};
