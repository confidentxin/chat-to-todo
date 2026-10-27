(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ChatTodoExtractor = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CN_NUM = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '两': 2, '零': 0 };
  var WEEKDAY_NUM = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7 };
  var PERIODS = ['凌晨', '早上', '上午', '中午', '下午', '傍晚', '晚上', '夜里', '半夜', '早晨'];
  var PLACES = [
    '羽毛球馆', '体育馆', '篮球场', '足球场', '游泳馆', '健身房', '图书馆', '会议室', '办公室', '实验室',
    '咖啡馆', '咖啡店', '奶茶店', '火锅店', '食堂', '操场', '教室', '宿舍', '餐厅', '饭店', '商场',
    '超市', '地铁站', '公园', '公司', '学校', '家里'
  ];
  var INTENT_RE = /(约|交|记得|买|带|去|开会|完成|提交|报名|取|还|打|吃|看|练|跑步|复习|上课|见|集合|收|发|做|写|准备|打印|订|预约)/;
  var VAGUE_RE = /(尽快|有空|改天|回头|稍后|抽空|找时间)/;
  var GREETING_RE = /^(好的|收到|明白|OK|ok|哈哈+|嗯嗯|谢谢|辛苦了|好啊|好的呀|收到啦)[!！。.,，\s]*$/;

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function shanghaiParts(date) {
    var fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    var parts = {};
    fmt.formatToParts(date).forEach(function (p) { parts[p.type] = p.value; });
    return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour, minute: +parts.minute };
  }

  function normalizeRef(ref) {
    if (!ref) return new Date();
    if (ref instanceof Date) return ref;
    if (typeof ref === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(ref)) return new Date(ref + 'T09:00:00+08:00');
      return new Date(ref);
    }
    return new Date(ref);
  }

  function ymdString(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }

  function addDays(ymd, n) {
    var d = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + n));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  }

  function weekdayOf(ymd) {
    var dow = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day)).getUTCDay();
    return dow === 0 ? 7 : dow; // 1=周一 .. 7=周日
  }

  function parseChineseHour(s) {
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    if (s === '十') return 10;
    if (s === '十二') return 12;
    if (s === '十一') return 11;
    if (/^十[一二三四五六七八九]$/.test(s)) return 10 + CN_NUM[s.charAt(1)];
    if (/^[一二三四五六七八九]十$/.test(s)) return CN_NUM[s.charAt(0)] * 10;
    if (CN_NUM[s] != null) return CN_NUM[s];
    return null;
  }

  function convertHour(hour, period) {
    if (hour == null) return null;
    if (hour > 12) return hour;
    if (hour === 12) {
      if (period === '晚上' || period === '夜里' || period === '凌晨') return 0;
      return 12;
    }
    if (period === '下午' || period === '傍晚' || period === '晚上' || period === '夜里') return hour + 12;
    if (period === '中午') return hour >= 11 ? hour : hour + 12;
    return hour; // 凌晨/早上/上午/早晨：按原值
  }

  function findDate(text, base) {
    var m, rest;
    // 下周X / 上周X
    m = text.match(/(下|上)(?:周|星期|礼拜)([一二三四五六日天])/);
    if (m) {
      var target = WEEKDAY_NUM[m[2]];
      var cur = weekdayOf(base);
      var delta = m[1] === '下' ? (7 - cur + target) : (target - cur - 7);
      return { literal: m[0], date: addDays(base, delta) };
    }
    // 本周X / 这周X
    m = text.match(/(?:本|这)(?:周|星期|礼拜)([一二三四五六日天])/);
    if (m) {
      var target2 = WEEKDAY_NUM[m[1]];
      var delta2 = target2 - weekdayOf(base);
      return { literal: m[0], date: addDays(base, delta2) };
    }
    // 今天/明天/后天/大后天/昨天/前天
    m = text.match(/(大后天|后天|明天|明日|今天|今日|昨天|昨日|前天)/);
    if (m) {
      var offset = { '今天': 0, '今日': 0, '明天': 1, '明日': 1, '后天': 2, '大后天': 3, '昨天': -1, '昨日': -1, '前天': -2 }[m[1]];
      return { literal: m[0], date: addDays(base, offset), relativeWord: m[1] };
    }
    // X月X日/号
    m = text.match(/(\d{1,2})月(\d{1,2})(?:日|号)/);
    if (m) {
      var cand = { year: base.year, month: +m[1], day: +m[2] };
      var candMs = Date.UTC(cand.year, cand.month - 1, cand.day);
      var baseMs = Date.UTC(base.year, base.month - 1, base.day);
      if (candMs < baseMs) cand.year += 1;
      return { literal: m[0], date: cand };
    }
    // X/X
    m = text.match(/(\d{1,2})\/(\d{1,2})/);
    if (m) {
      var cand2 = { year: base.year, month: +m[1], day: +m[2] };
      if (Date.UTC(cand2.year, cand2.month - 1, cand2.day) < Date.UTC(base.year, base.month - 1, base.day)) cand2.year += 1;
      return { literal: m[0], date: cand2 };
    }
    // 裸周X / 星期X：取最近的未来（含今天）
    m = text.match(/(?:周|星期|礼拜)([一二三四五六日天])/);
    if (m) {
      var target3 = WEEKDAY_NUM[m[1]];
      var delta3 = (target3 - weekdayOf(base) + 7) % 7;
      return { literal: m[0], date: addDays(base, delta3) };
    }
    return null;
  }

  function findTime(text) {
    var m;
    // HH:MM，前面可带时段词
    m = text.match(/(凌晨|早上|上午|中午|下午|傍晚|晚上|夜里|半夜)?\s*(\d{1,2})[:：](\d{2})/);
    if (m) {
      var hour = convertHour(+m[2], m[1] || null);
      return { literal: m[0], time: pad(hour) + ':' + m[3], period: m[1] || null };
    }
    // 中文/数字 + 点 + 半/分
    m = text.match(/(凌晨|早上|上午|中午|下午|傍晚|晚上|夜里|半夜|早晨)?\s*([一二三四五六七八九十两\d]{1,3})\s*点\s*(半|一刻|三刻|(\d{1,2})分)?/);
    if (m) {
      var h = parseChineseHour(m[2]);
      if (h == null) return null;
      var minute = 0;
      if (m[3] === '半') minute = 30;
      else if (m[3] === '一刻') minute = 15;
      else if (m[3] === '三刻') minute = 45;
      else if (m[4]) minute = +m[4];
      var hour2 = convertHour(h, m[1] || null);
      return { literal: m[0], time: pad(hour2) + ':' + pad(minute), period: m[1] || null };
    }
    // 只有时段词：中午默认 12:00；其余不定
    m = text.match(/(中午|上午|下午|晚上|凌晨)/);
    if (m) {
      if (m[1] === '中午') return { literal: m[0], time: '12:00', period: '中午' };
      return { literal: m[0], time: null, period: m[1] };
    }
    return null;
  }

  function findLocation(text) {
    var i, word;
    var sorted = PLACES.slice().sort(function (a, b) { return b.length - a.length; });
    for (i = 0; i < sorted.length; i++) {
      word = sorted[i];
      if (text.indexOf(word) !== -1) return word;
    }
    var m = text.match(/(?:在|去|到)([\u4e00-\u9fa5]{2,8}?)(?:打|吃|开|见|等|集合|上课|练习|训练|，|。|！|？|、|\s|$)/);
    if (m && m[1].length >= 2) return m[1];
    return null;
  }

  function findPeople(text) {
    var people = [];
    function push(name) {
      if (!name) return;
      name = name.replace(/(一起|起来)$/, '');
      if (name.length < 2 || name.length > 4) return;
      if (['老师', '大家', '我们', '你们'].indexOf(name) !== -1) return;
      if (people.indexOf(name) === -1) people.push(name);
    }
    var m;
    var atRe = /@([\u4e00-\u9fa5]{2,3})(?=[一起去吃打在来，。，、\s]|$)/g;
    while ((m = atRe.exec(text)) !== null) push(m[1]);
    var heRe = /(?:和|跟|同)([\u4e00-\u9fa5]{2,3})(?:一起|去|吃|打|在|来|，|。|！|、|\s|$)/g;
    while ((m = heRe.exec(text)) !== null) push(m[1]);
    var shuoRe = /([\u4e00-\u9fa5]{2,3})说/g;
    while ((m = shuoRe.exec(text)) !== null) push(m[1]);
    return people;
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function stripSender(line) {
    var s = line.trim();
    s = s.replace(/^\[[^\]]+\]\s*/, '');
    s = s.replace(/^[^\s:：]{1,10}\s+\d{1,2}:\d{2}(?::\d{2})?\s*[:：]?\s*/, '');
    s = s.replace(/^\d{1,2}:\d{2}(?::\d{2})?\s*/, '');
    var m = s.match(/^([^\s:：]{1,8})[:：]\s+/);
    if (m && /^[\u4e00-\u9fa5A-Za-z0-9_]+$/.test(m[1])) s = s.slice(m[0].length);
    return s.trim();
  }

  function cleanTitle(content, dateInfo, timeInfo, location) {
    var t = content;
    if (dateInfo) t = t.replace(dateInfo.literal, '');
    if (timeInfo) t = t.replace(timeInfo.literal, '');
    if (location) t = t.replace(new RegExp('(在|去|到|回)?' + escapeRegExp(location)), '');
    t = t.replace(/@[^\s，,。]+/g, '');
    t = t.replace(/(和|跟|同)[\u4e00-\u9fa5]{2,3}一起/g, '');
    t = t.replace(/(和|跟|同)[\u4e00-\u9fa5]{2,3}/g, '');
    t = t.replace(/之前|截止|以前/g, '');
    t = t.replace(/^收到[，,、\s]*/, '');
    t = t.replace(/^前(?=统一|收|交|发|完成)/, '');
    t = t.replace(/^[，,。！!、\s]+/, '').replace(/[，,。！!、\s]+$/, '');
    t = t.replace(/^(一起|记得|请|麻烦)/, '');
    t = t.replace(/^(一起)/, '');
    t = t.replace(/[，,]\s*一起来$/, '').replace(/一起来$/, '');
    t = t.trim();
    // 末尾动词前置：作业交 -> 交作业；东西还 -> 还东西
    var vm = t.match(/^(.*?)(提交|交|还|取|买|带)$/);
    if (vm && vm[1].length >= 1) t = vm[2] + vm[1];
    t = t.replace(/^[，,。！!、\s]+/, '').replace(/[，,。！!、\s]+$/, '');
    return t;
  }

  function extractTodos(text, referenceDate) {
    var refDate = normalizeRef(referenceDate);
    var base = shanghaiParts(refDate);
    var baseYmd = { year: base.year, month: base.month, day: base.day };
    var lines = String(text == null ? '' : text).split(/\r?\n/);
    var todos = [];
    lines.forEach(function (rawLine) {
      var content = stripSender(rawLine);
      if (!content) return;
      if (GREETING_RE.test(content)) return;
      var dateInfo = findDate(content, baseYmd);
      var timeInfo = findTime(content);
      var location = findLocation(content);
      var people = findPeople(content);
      var hasIntent = INTENT_RE.test(content);
      if (!hasIntent && !dateInfo && !timeInfo && !location && people.length === 0) return;

      var dateStr = null;
      var timeStr = null;
      var uncertain = false;
      var uncertainReason = null;

      // 截止类：日期后紧跟 之前/截止/前
      var isDeadline = false;
      if (dateInfo) {
        var idx = content.indexOf(dateInfo.literal);
        var rest = content.slice(idx + dateInfo.literal.length);
        if (/^(之前|截止|前)/.test(rest) || /(截止|之前)/.test(content)) isDeadline = true;
      }

      if (dateInfo) {
        dateStr = ymdString(dateInfo.date.year, dateInfo.date.month, dateInfo.date.day);
        if (dateInfo.relativeWord === '昨天' || dateInfo.relativeWord === '昨日' || dateInfo.relativeWord === '前天') {
          uncertain = true;
          uncertainReason = '提到的日期已过去，请核对';
        }
      }
      if (timeInfo && timeInfo.time) timeStr = timeInfo.time;

      if (isDeadline) {
        timeStr = null;
        uncertain = true;
        uncertainReason = '只有截止日、无具体时刻';
      } else if (dateInfo && !timeInfo) {
        uncertain = true;
        uncertainReason = '只提到日期、未提到具体时刻';
      } else if (dateInfo && timeInfo && !timeInfo.time) {
        uncertain = true;
        uncertainReason = '只提到大概时段、未提到具体时刻';
      } else if (!dateInfo && timeInfo && timeInfo.time) {
        // 只有时刻：取最近的未来日期
        var nowMinutes = base.hour * 60 + base.minute;
        var parts = timeStr.split(':');
        var tMinutes = (+parts[0]) * 60 + (+parts[1]);
        var inferred = tMinutes > nowMinutes ? baseYmd : addDays(baseYmd, 1);
        dateStr = ymdString(inferred.year, inferred.month, inferred.day);
        uncertain = true;
        uncertainReason = '只提到时刻、日期是根据时刻推断的';
      } else if (!dateInfo && timeInfo && !timeInfo.time) {
        uncertain = true;
        uncertainReason = '只提到大概时段、未提到具体日期和时刻';
      } else if (!dateInfo && !timeInfo) {
        uncertain = true;
        if (VAGUE_RE.test(content)) uncertainReason = '含糊时间表述，未提到具体时间';
        else uncertainReason = '未提到具体时间';
      }

      var title = cleanTitle(content, dateInfo, timeInfo, location);
      if (!title) title = content;
      if (title.length > 60) title = title.slice(0, 60);

      var datetime = null;
      if (dateStr && timeStr) datetime = dateStr + 'T' + timeStr + ':00+08:00';

      todos.push({
        id: 'todo-' + (todos.length + 1),
        title: title,
        date: dateStr,
        time: timeStr,
        datetime: datetime,
        location: location,
        people: people,
        uncertain: uncertain,
        uncertainReason: uncertainReason,
        sourceLine: rawLine.trim()
      });
    });
    return todos;
  }

  return { extractTodos: extractTodos, parseChat: extractTodos, extractFromText: extractTodos };
});
