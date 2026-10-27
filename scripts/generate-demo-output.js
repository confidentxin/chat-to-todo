'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { extractTodos } = require('../src/extractor.js');

const root = path.join(__dirname, '..');
const ref = new Date('2026-10-28T09:00:00+08:00');
const files = ['chat-badminton.txt', 'chat-homework.txt', 'chat-dinner.txt'];

let out = '# Demo 输出（真实运行结果）\n\n';
out += '用 `node scripts/generate-demo-output.js` 生成，基准日 2026-10-28（星期三，Asia/Shanghai），提取为本地规则，无 API 调用。\n\n';

for (const file of files) {
  const text = fs.readFileSync(path.join(root, 'examples', file), 'utf8');
  const todos = extractTodos(text, ref);
  out += '## ' + file + '\n\n';
  out += '原文：\n\n```\n' + text.trim() + '\n```\n\n';
  out += '提取结果（' + todos.length + ' 条）：\n\n';
  for (const t of todos) {
    out += '- ' + t.title;
    out += ' | 日期 ' + (t.date || '未定');
    out += ' | 时间 ' + (t.time || '未定');
    out += ' | 地点 ' + (t.location || '无');
    out += ' | 相关人 ' + (t.people.length ? t.people.join('、') : '无');
    out += ' | 不确定 ' + (t.uncertain ? '是（' + t.uncertainReason + '）' : '否');
    out += '\n';
  }
  out += '\n';
}

const docsDir = path.join(root, 'docs');
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, 'demo-output.md'), out, 'utf8');
console.log('wrote docs/demo-output.md');
