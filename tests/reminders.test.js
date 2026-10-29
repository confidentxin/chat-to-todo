'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldRemind, getDueReminders } = require('../src/reminders.js');
const NOW = new Date('2026-10-30T09:00:00+08:00');
const todo = { id: 'one', title: '开会', date: '2026-10-30', time: '09:10', done: false };

test('10 minutes before reminds', () => assert.equal(shouldRemind(todo, NOW), true));
test('16 minutes and 1 hour before do not remind', () => {
  ['09:16', '10:00'].forEach((time) => assert.equal(shouldRemind({ ...todo, time }, NOW), false));
});
test('5 minutes after and even 1 millisecond after do not remind', () => {
  assert.equal(shouldRemind({ ...todo, time: '08:55' }, NOW), false);
  assert.equal(shouldRemind(todo, new Date('2026-10-30T09:10:00.001+08:00')), false);
});
test('exact start and exact 15 minute boundary remind', () => {
  ['09:00', '09:15'].forEach((time) => assert.equal(shouldRemind({ ...todo, time }, NOW), true));
});
test('already reminded Set or Array does not repeat', () => {
  [new Set(['one']), ['one']].forEach((ids) => assert.equal(shouldRemind(todo, NOW, ids), false));
});
test('done todo does not remind', () => assert.equal(shouldRemind({ ...todo, done: true }, NOW), false));
test('missing and invalid date/time are skipped in order without throwing', () => {
  const invalid = [null, {}, { ...todo, date: null }, { ...todo, time: null },
    ...['2026-02-30', '2026-13-01', 'bad'].map((date) => ({ ...todo, date })),
    ...['24:00', '19:60', '9:10', 'bad'].map((time) => ({ ...todo, time }))];
  invalid.forEach((item) => assert.equal(shouldRemind(item, NOW), false));
  const second = { ...todo, id: 'two' };
  assert.deepEqual(getDueReminders([todo, ...invalid, second], NOW), [todo, second]);
  assert.deepEqual(getDueReminders(null, NOW), []);
  assert.equal(shouldRemind(todo, new Date('invalid')), false);
});
test('Shanghai cross-midnight and year boundary work regardless of host timezone', () => {
  assert.equal(shouldRemind({ ...todo, date: '2026-10-31', time: '00:05' }, new Date('2026-10-30T23:55:00+08:00')), true);
  assert.equal(shouldRemind({ ...todo, date: '2027-01-01', time: '00:05' }, new Date('2026-12-31T15:55:00Z')), true);
});
