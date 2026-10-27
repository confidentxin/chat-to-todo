'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractTodos } = require('../src/extractor.js');

// 基准日：2026-10-28，星期三（Asia/Shanghai）
const REF = new Date('2026-10-28T09:00:00+08:00');

test('a) 明天晚上19:30去体育馆打羽毛球', () => {
  const todos = extractTodos('明天晚上19:30一起去体育馆打羽毛球', REF);
  assert.equal(todos.length, 1);
  assert.equal(todos[0].date, '2026-10-29');
  assert.equal(todos[0].time, '19:30');
  assert.ok(todos[0].location && todos[0].location.includes('体育馆'));
  assert.equal(todos[0].uncertain, false);
});

test('b) 周五之前交作业：只有截止日', () => {
  const todos = extractTodos('作业周五之前交', REF);
  assert.equal(todos.length, 1);
  assert.equal(todos[0].date, '2026-10-30');
  assert.equal(todos[0].time, null);
  assert.equal(todos[0].uncertain, true);
  assert.match(todos[0].uncertainReason, /截止/);
});

test('c) 下周三中午一起吃饭', () => {
  const todos = extractTodos('下周三中午一起吃饭', REF);
  assert.equal(todos.length, 1);
  assert.equal(todos[0].date, '2026-11-04');
  assert.equal(todos[0].time, '12:00');
});

test('d) 无时间信息：不编造时间', () => {
  const todos = extractTodos('记得买牛奶', REF);
  assert.equal(todos.length, 1);
  assert.equal(todos[0].datetime, null);
  assert.equal(todos[0].date, null);
  assert.equal(todos[0].uncertain, true);
});

test('e) 今天下午3点开会', () => {
  const todos = extractTodos('今天下午3点开会', REF);
  assert.equal(todos.length, 1);
  assert.equal(todos[0].date, '2026-10-28');
  assert.equal(todos[0].time, '15:00');
  assert.equal(todos[0].uncertain, false);
});

test('f) 人名提取：和小明 / @小明', () => {
  const a = extractTodos('和小明一起去图书馆复习', REF);
  assert.deepEqual(a[0].people, ['小明']);
  const b = extractTodos('明天去图书馆复习，@小明 一起来', REF);
  assert.ok(b[0].people.includes('小明'));
});

test('地点提取：去咖啡馆', () => {
  const todos = extractTodos('明天下午3点去咖啡馆见面', REF);
  assert.equal(todos[0].location, '咖啡馆');
  assert.equal(todos[0].date, '2026-10-29');
});

test('纯寒暄行被过滤', () => {
  assert.deepEqual(extractTodos('好的', REF), []);
  assert.deepEqual(extractTodos('收到', REF), []);
  assert.deepEqual(extractTodos('哈哈', REF), []);
});

test('中文数字时刻：晚上七点半', () => {
  const todos = extractTodos('明天晚上七点半去体育馆打球', REF);
  assert.equal(todos[0].date, '2026-10-29');
  assert.equal(todos[0].time, '19:30');
});

test('下周一截止', () => {
  const todos = extractTodos('报名下周一截止', REF);
  assert.equal(todos[0].date, '2026-11-02');
  assert.equal(todos[0].uncertain, true);
});

test('发送人前缀被去掉，标题不含人名时间戳', () => {
  const todos = extractTodos('阿明 10:20：明天晚上19:30一起去体育馆打羽毛球', REF);
  assert.equal(todos.length, 1);
  assert.equal(todos[0].title, '打羽毛球');
  assert.equal(todos[0].date, '2026-10-29');
});

test('只有时刻时日期推断并标不确定', () => {
  const todos = extractTodos('七点半去跑步', REF);
  assert.equal(todos[0].time, '07:30');
  assert.equal(todos[0].uncertain, true);
});
