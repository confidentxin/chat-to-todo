(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ChatTodoIcs = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function escapeText(value) {
    return String(value == null ? '' : value).replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
  }

  function fold(line) {
    var result = '', bytes = 0;
    // 按 Unicode 码点遍历，续行的空格也计入 75 字节。
    Array.from(line).forEach(function (ch) {
      var code = ch.codePointAt(0);
      var size = code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
      if (bytes + size > 75) { result += '\r\n '; bytes = 1; }
      result += ch;
      bytes += size;
    });
    return result;
  }

  function startDate(todo) {
    if (!todo || typeof todo.date !== 'string' || typeof todo.time !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(todo.date) || !/^\d{2}:\d{2}$/.test(todo.time)) return null;
    var year = +todo.date.slice(0, 4);
    var hour = +todo.time.slice(0, 2), minute = +todo.time.slice(3);
    if (year < 1 || hour > 23 || minute > 59) return null;
    // 用 UTC 容器表示上海墙上时间，避免受运行电脑所在时区影响。
    var date = new Date(todo.date + 'T' + todo.time + ':00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== todo.date) return null;
    return date;
  }

  function compact(date) { return date.toISOString().slice(0, 19).replace(/[-:]/g, ''); }

  function buildIcs(todos, options) {
    options = options || {};
    var now = options.dtstamp != null ? options.dtstamp : options.now;
    if (typeof now === 'function') now = now();
    if (typeof now === 'string' && /^\d{8}T\d{6}Z$/.test(now)) {
      now = now.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z');
    }
    var stamp = compact(new Date(now == null ? Date.now() : now)) + 'Z';
    var exported = [], skipped = [];
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//chat-to-todo//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    // 上海自 1991 年后固定 UTC+8；显式时区定义便于日历离线导入。
    lines.push('BEGIN:VTIMEZONE', 'TZID:Asia/Shanghai', 'BEGIN:STANDARD',
      'DTSTART:19920101T000000', 'TZOFFSETFROM:+0800', 'TZOFFSETTO:+0800',
      'END:STANDARD', 'END:VTIMEZONE');
    todos.forEach(function (todo, index) {
      var start = startDate(todo);
      if (!start) { skipped.push(todo); return; }
      var end = new Date(start.getTime() + 60 * 60 * 1000);
      var id = String(todo.id || 'todo').replace(/[^A-Za-z0-9_-]/g, '-');
      lines.push('BEGIN:VEVENT', 'UID:' + id + '-' + index + '-' + compact(start) + '@chat-to-todo',
        'DTSTAMP:' + stamp, 'DTSTART;TZID=Asia/Shanghai:' + compact(start),
        'DTEND;TZID=Asia/Shanghai:' + compact(end), 'SUMMARY:' + escapeText(todo.title));
      if (todo.location) lines.push('LOCATION:' + escapeText(todo.location));
      var description = [];
      if (todo.people && todo.people.length) description.push('相关人：' + (Array.isArray(todo.people) ? todo.people.join('、') : todo.people));
      if (todo.uncertainReason) description.push('不确定原因：' + todo.uncertainReason);
      if (description.length) lines.push('DESCRIPTION:' + escapeText(description.join('\n')));
      lines.push('END:VEVENT');
      exported.push(todo);
    });
    lines.push('END:VCALENDAR');
    return { ics: lines.map(fold).join('\r\n') + '\r\n', exported: exported, skipped: skipped };
  }

  return { buildIcs: buildIcs };
});
