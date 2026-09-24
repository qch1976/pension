// calculator/retireSchedule.js
// 渐进式延迟法定退休年龄逐月对照表（P-05）。
// 政策依据：全国人大常委会《关于实施渐进式延迟法定退休年龄的决定》（2024-09-13 通过，2025-01-01 施行）
//          及国务院《关于渐进式延迟法定退休年龄的办法》第一条（中国政府网全文：
//          https://www.gov.cn/yaowen/liebiao/202409/content_6974294.htm）
// 规则（决定附件1/2/3 对照表口径，与新华社发布对照表逐行一致）：
//   - 男职工（原60周岁）：1965-01 起受影响，每 4 个出生月延迟 1 个月，1965-01→法定退休2025-02（60岁1月），
//     1976-09 起达到 63 周岁；
//   - 原55周岁女职工（女干部/管理技术岗）：1970-01 起受影响，每 4 个出生月延迟 1 个月，1970-01→2025-02（55岁1月），
//     1981-09 起达到 58 周岁；
//   - 原50周岁女职工（女工人）：1975-01 起受影响，每 2 个出生月延迟 1 个月，1975-01→2025-02（50岁1月），
//     1984-11 起达到 55 周岁。
//   过渡期内出生月尚未对应到一个完整延月步长的，按“出生月所在步长组”取延月数（对照表里同月数为一组）。
//   弹性提前最多 3 年且不得低于原法定年龄；弹性延迟最多 3 年（办法第三条）。

var D = require('./dateUtil.js');

var CONFIG = {
  male:   { originalAge: 60, startBirthYM: '1965-01', stepBirthMonths: 4, maxDelayMonths: 36 },
  cadre:  { originalAge: 55, startBirthYM: '1970-01', stepBirthMonths: 4, maxDelayMonths: 36 },
  worker: { originalAge: 50, startBirthYM: '1975-01', stepBirthMonths: 2, maxDelayMonths: 60 }
};

// 法定退休年月（不含弹性）。key: 'male' | 'cadre'(原55) | 'worker'(原50)
function statutoryRetireYM(key, birthYM) {
  var c = CONFIG[key];
  var base = D.toIndex(birthYM) + c.originalAge * 12; // 原法定退休月
  if (D.toIndex(birthYM) < D.toIndex(c.startBirthYM)) {
    return D.toYM(base); // 决定施行前已达原法定年龄 → 不延迟
  }
  var offsetMonths = D.toIndex(birthYM) - D.toIndex(c.startBirthYM);
  var group = Math.floor(offsetMonths / c.stepBirthMonths); // 0-based 步长组
  var delay = Math.min(c.maxDelayMonths, group + 1);        // 第1组延1月
  return D.toYM(base + delay);
}

// 延迟月数（相对原法定年龄），用于展示
function delayMonths(key, birthYM) {
  var stat = statutoryRetireYM(key, birthYM);
  var c = CONFIG[key];
  var base = D.toIndex(birthYM) + c.originalAge * 12;
  return D.toIndex(stat) - base;
}

// 受影响（进入延退过渡）判定
function isAffected(key, birthYM) {
  return D.toIndex(birthYM) >= D.toIndex(CONFIG[key].startBirthYM);
}

// 弹性退休允许区间（年月 index）：
//   下限 = max(原法定退休月, 法定退休月 - 36)；上限 = 法定退休月 + 36。
//   （办法第三条：弹性提前不低于原法定年龄；达到最低缴费年限为前提，资格另算。）
function flexibleRange(key, birthYM) {
  var c = CONFIG[key];
  var orig = D.toIndex(birthYM) + c.originalAge * 12;
  var stat = D.toIndex(statutoryRetireYM(key, birthYM));
  return {
    min: Math.max(orig, stat - 36),
    max: stat + 36,
    statutory: stat,
    original: orig
  };
}

// 按性别+女性身份取 key
function keyOf(gender, femaleType) {
  if (gender === 'male') return 'male';
  return femaleType === 'worker' ? 'worker' : 'cadre';
}

module.exports = {
  CONFIG: CONFIG,
  keyOf: keyOf,
  statutoryRetireYM: statutoryRetireYM,
  delayMonths: delayMonths,
  isAffected: isAffected,
  flexibleRange: flexibleRange
};
