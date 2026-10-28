'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { extractTodos } = require('../src/extractor.js');
const { buildIcs } = require('../src/ics.js');

const root = path.join(__dirname, '..');
const ref = new Date('2026-10-28T09:00:00+08:00');
const files = ['chat-badminton.txt', 'chat-homework.txt'];
const todos = files.flatMap((file) => extractTodos(fs.readFileSync(path.join(root, 'examples', file), 'utf8'), ref));
// 作业示例含两条只有截止日的待办，均跳过；ICS 本身不写注释。
const result = buildIcs(todos, { now: ref });
fs.writeFileSync(path.join(root, 'examples', 'example.ics'), result.ics, 'utf8');
console.log('wrote examples/example.ics: exported ' + result.exported.length + ', skipped ' + result.skipped.length);
