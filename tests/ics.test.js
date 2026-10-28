'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractTodos } = require('../src/extractor.js');
const { buildIcs } = require('../src/ics.js');
const REF = new Date('2026-10-28T09:00:00+08:00');
const OPTIONS = { now: REF };
const todo = { id: 'same', title: '事项', date: '2026-10-29', time: '19:30' };
const unfold = (ics) => ics.replace(/\r\n /g, '');

test('羽毛球示例导出上海时间、标题、地点和相关人', () => {
  const result = buildIcs(extractTodos('明天晚上19:30一起去体育馆打羽毛球，@小明 一起来', REF), OPTIONS);
  assert.equal(result.exported.length, 1);
  assert.equal(result.skipped.length, 0);
  assert.equal((result.ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(result.ics, /DTSTART;TZID=Asia\/Shanghai:20261029T193000/);
  assert.match(result.ics, /DTEND;TZID=Asia\/Shanghai:20261029T203000/);
  assert.match(result.ics, /SUMMARY:.*打羽毛球/);
  assert.match(result.ics, /LOCATION:体育馆/);
  assert.match(result.ics, /DESCRIPTION:.*小明/);
  assert.ok(result.ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(result.ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal(result.ics.replace(/\r\n/g, '').includes('\n'), false);
});

test('只有截止日的作业被跳过', () => {
  const result = buildIcs(extractTodos('作业周五之前交', REF), OPTIONS);
  assert.equal(result.exported.length, 0);
  assert.equal(result.skipped.length, 1);
  assert.doesNotMatch(result.ics, /BEGIN:VEVENT/);
});

test('反斜杠、逗号、分号、换行转义为单个逻辑行', () => {
  const ics = unfold(buildIcs([{ ...todo, title: '甲\\乙,丙;丁\r\n戊\n己' }], OPTIONS).ics);
  const summaries = ics.split('\r\n').filter((line) => line.startsWith('SUMMARY:'));
  assert.deepEqual(summaries, ['SUMMARY:甲\\\\乙\\,丙\\;丁\\n戊\\n己']);
});

test('长中文及 emoji 按 UTF-8 75 字节折行且不丢失字符', () => {
  const title = '中文😀标题,;'.repeat(40);
  const ics = buildIcs([{ ...todo, title }], OPTIONS).ics;
  ics.split('\r\n').forEach((line) => assert.ok(Buffer.byteLength(line, 'utf8') <= 75));
  assert.ok(ics.includes('\r\n '));
  assert.ok(unfold(ics).includes('SUMMARY:' + title.replace(/,/g, '\\,').replace(/;/g, '\\;') + '\r\n'));
});

test('重复 id 的 UID 仍唯一，DTSTAMP 可注入且格式正确', () => {
  const ics = unfold(buildIcs([todo, todo], { dtstamp: '20261028T010000Z' }).ics);
  const uids = ics.match(/^UID:.*$/gm);
  assert.equal(new Set(uids).size, 2);
  assert.equal((ics.match(/DTSTAMP:20261028T010000Z/g) || []).length, 2);
  assert.equal(ics, buildIcs([todo, todo], OPTIONS).ics);
});

test('23:30 跨午夜及年末结束时间', () => {
  const ics = buildIcs([{ ...todo, date: '2026-12-31', time: '23:30' }], OPTIONS).ics;
  assert.match(ics, /DTEND;TZID=Asia\/Shanghai:20270101T003000/);
});

test('混合清单及非法日期时间只跳过，不抛错', () => {
  const invalid = [{ ...todo, time: null }, { ...todo, date: null },
    { ...todo, date: '2026-02-30' }, { ...todo, time: '24:00' },
    { ...todo, time: '19:60' }, { ...todo, date: 'not-date' }, null];
  const result = buildIcs([todo, ...invalid], OPTIONS);
  assert.equal(result.exported.length, 1);
  assert.equal(result.skipped.length, invalid.length);
});

test('地点与说明转义，不确定原因保留，无可选字段时省略', () => {
  const ics = unfold(buildIcs([{ ...todo, location: '甲,乙', people: ['小明'], uncertainReason: '待核对;时间\n地点' }], OPTIONS).ics);
  assert.ok(ics.includes('LOCATION:甲\\,乙\r\n'));
  assert.ok(ics.includes('DESCRIPTION:相关人：小明\\n不确定原因：待核对\\;时间\\n地点\r\n'));
  const empty = buildIcs([todo], OPTIONS).ics;
  assert.doesNotMatch(empty, /LOCATION:|DESCRIPTION:/);
});
