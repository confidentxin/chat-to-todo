(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ChatTodoReminders = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function shouldRemind(todo, now, remindedIds) {
    if (!todo || todo.done || todo.id == null ||
        typeof todo.date !== 'string' || typeof todo.time !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(todo.date) || !/^\d{2}:\d{2}$/.test(todo.time)) return false;
    if ((remindedIds instanceof Set && remindedIds.has(todo.id)) ||
        (Array.isArray(remindedIds) && remindedIds.indexOf(todo.id) !== -1)) return false;
    if (+todo.date.slice(0, 4) < 1 || +todo.time.slice(0, 2) > 23 || +todo.time.slice(3) > 59) return false;
    var start = new Date(todo.date + 'T' + todo.time + ':00Z');
    if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== todo.date ||
        !(now instanceof Date) || !Number.isFinite(now.getTime())) return false;
    var parts = {};
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(now).forEach(function (p) { parts[p.type] = p.value; });
    // UTC 容器只用于比较上海墙上时间，保留秒和毫秒以排除刚过时的待办。
    var wall = new Date(parts.year + '-' + parts.month + '-' + parts.day + 'T' +
      parts.hour + ':' + parts.minute + ':' + parts.second + 'Z');
    var difference = start.getTime() - wall.getTime() - now.getUTCMilliseconds();
    return difference >= 0 && difference <= 15 * 60 * 1000;
  }

  function getDueReminders(todos, now, remindedIds) {
    if (!Array.isArray(todos)) return [];
    return todos.filter(function (todo) { return shouldRemind(todo, now, remindedIds); });
  }

  return { shouldRemind: shouldRemind, getDueReminders: getDueReminders };
});
