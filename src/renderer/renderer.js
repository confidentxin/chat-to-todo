'use strict';

const STORAGE_KEY = 'chat-to-todo.todos.v1';
let pending = [];
let confirmed = [];
let expanded = false;
let uidCounter = 1;

const $ = (id) => document.getElementById(id);

function loadConfirmed() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    confirmed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(confirmed)) confirmed = [];
  } catch (e) {
    confirmed = [];
  }
}

function saveConfirmed() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(confirmed));
  } catch (e) {
    // 本地存储不可用时只保留内存态，不抛错
  }
}

function setStatus(text) {
  $('status').textContent = text || '';
}

function describeMeta(t) {
  const parts = [];
  if (t.date) parts.push(t.date);
  if (t.time) parts.push(t.time);
  if (t.location) parts.push('地点：' + t.location);
  if (t.people && t.people.length) parts.push('相关人：' + t.people.join('、'));
  return parts.join(' · ') || '时间地点未定';
}

function setExpanded(next) {
  expanded = next;
  document.body.classList.toggle('expanded', expanded);
  document.body.classList.toggle('collapsed', !expanded);
  if (window.chatTodo && window.chatTodo.setExpanded) {
    window.chatTodo.setExpanded(expanded);
  }
}

function toggleExpanded() {
  setExpanded(!expanded);
}

function makeInput(type, value, onChange, placeholder) {
  const input = document.createElement('input');
  input.type = type;
  input.value = value || '';
  if (placeholder) input.placeholder = placeholder;
  input.addEventListener('input', () => onChange(input.value));
  input.addEventListener('change', () => onChange(input.value));
  return input;
}

function renderPending() {
  const list = $('pendingList');
  list.textContent = '';
  $('pendingCount').textContent = String(pending.length);
  $('pendingEmpty').style.display = pending.length ? 'none' : 'block';

  pending.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'todo-card';

    const titleInput = makeInput('text', t.title, (v) => { t.title = v; }, '事项');
    titleInput.style.fontWeight = '600';
    card.appendChild(titleInput);

    const fields = document.createElement('div');
    fields.className = 'todo-fields';
    fields.appendChild(makeInput('date', t.date, (v) => { t.date = v || null; }));
    fields.appendChild(makeInput('time', t.time, (v) => { t.time = v || null; }));
    fields.appendChild(makeInput('text', t.location, (v) => { t.location = v || null; }, '地点'));
    fields.appendChild(makeInput('text', (t.people || []).join(', '), (v) => {
      t.people = v.split(/[,，、\s]+/).filter(Boolean);
    }, '相关人（逗号分隔）'));
    card.appendChild(fields);

    if (t.uncertain) {
      const note = document.createElement('div');
      note.className = 'uncertain-note';
      note.textContent = '待确认：' + (t.uncertainReason || '时间不确定');
      card.appendChild(note);
    } else {
      const badge = document.createElement('div');
      badge.className = 'uncertain-note';
      badge.textContent = '时间已解析';
      card.appendChild(badge);
    }

    const actions = document.createElement('div');
    actions.className = 'todo-actions';
    const badge = document.createElement('span');
    badge.className = 'badge' + (t.uncertain ? '' : ' ok');
    badge.textContent = t.uncertain ? '不确定' : '已确定';
    actions.appendChild(badge);

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.textContent = '确认';
    confirmBtn.addEventListener('click', () => {
      if (!t.title.trim()) { setStatus('标题不能为空，先填好再确认。'); return; }
      confirmed.push({
        id: 'todo-confirmed-' + Date.now() + '-' + (uidCounter++),
        title: t.title.trim(),
        date: t.date || null,
        time: t.time || null,
        location: t.location || null,
        people: t.people || [],
        uncertain: t.uncertain,
        uncertainReason: t.uncertainReason || null,
        done: false
      });
      pending = pending.filter((x) => x !== t);
      saveConfirmed();
      renderPending();
      renderConfirmed();
      setStatus('已确认 1 条，保存在本地。');
    });
    actions.appendChild(confirmBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '删除';
    delBtn.addEventListener('click', () => {
      pending = pending.filter((x) => x !== t);
      renderPending();
    });
    actions.appendChild(delBtn);
    card.appendChild(actions);
    list.appendChild(card);
  });
}

function renderConfirmed() {
  const list = $('confirmedList');
  list.textContent = '';
  $('confirmedCount').textContent = String(confirmed.length);
  $('confirmedEmpty').style.display = confirmed.length ? 'none' : 'block';

  confirmed.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'todo-card' + (t.done ? ' done' : '');
    const title = document.createElement('div');
    title.className = 'todo-title';
    title.textContent = t.title;
    card.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'todo-meta';
    meta.textContent = describeMeta(t) + (t.uncertain && t.uncertainReason ? '（' + t.uncertainReason + '）' : '');
    card.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'todo-actions';
    const doneLabel = document.createElement('label');
    const doneBox = document.createElement('input');
    doneBox.type = 'checkbox';
    doneBox.checked = !!t.done;
    doneBox.addEventListener('change', () => {
      t.done = doneBox.checked;
      saveConfirmed();
      renderConfirmed();
    });
    doneLabel.appendChild(doneBox);
    doneLabel.appendChild(document.createTextNode(' 完成'));
    actions.appendChild(doneLabel);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '删除';
    delBtn.addEventListener('click', () => {
      confirmed = confirmed.filter((x) => x !== t);
      saveConfirmed();
      renderConfirmed();
    });
    actions.appendChild(delBtn);
    card.appendChild(actions);
    list.appendChild(card);
  });
}

function extractNow() {
  const text = $('chatInput').value;
  if (!text.trim()) { setStatus('先粘贴聊天文字，或上传 .txt 文件。'); return; }
  const extractor = window.ChatTodoExtractor;
  if (!extractor || !extractor.extractTodos) {
    setStatus('提取器未加载，请重启应用。');
    return;
  }
  pending = extractor.extractTodos(text).map((t) => ({
    id: t.id,
    title: t.title,
    date: t.date,
    time: t.time,
    location: t.location,
    people: t.people,
    uncertain: t.uncertain,
    uncertainReason: t.uncertainReason
  }));
  renderPending();
  setStatus(pending.length ? ('提取到 ' + pending.length + ' 条待办，请逐条确认。') : '没有提取到待办，换一段带约事、交代的聊天试试。');
}

function exportMarkdown() {
  if (!confirmed.length) { setStatus('已确认清单是空的，先确认几条再导出。'); return; }
  const lines = ['# 待办清单', ''];
  confirmed.forEach((t) => {
    const box = t.done ? '[x]' : '[ ]';
    let line = '- ' + box + ' ' + t.title;
    const meta = [];
    if (t.date) meta.push(t.date);
    if (t.time) meta.push(t.time);
    if (t.location) meta.push(t.location);
    if (t.people && t.people.length) meta.push(t.people.join('、'));
    if (meta.length) line += '（' + meta.join(' ') + '）';
    if (t.uncertain && t.uncertainReason) line += '（' + t.uncertainReason + '）';
    lines.push(line);
  });
  lines.push('');
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '待办清单.md';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus('已导出 ' + confirmed.length + ' 条待办为 Markdown。');
}

function attachDrag(el) {
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let dragging = false;
  let startTime = 0;

  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, input, textarea, a, label')) return;
    startX = e.clientX;
    startY = e.clientY;
    lastX = e.clientX;
    lastY = e.clientY;
    dragging = false;
    startTime = Date.now();
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (startTime === 0) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    if (!dragging && Math.hypot(e.clientX - startX, e.clientY - startY) > 4) dragging = true;
    if (dragging && window.chatTodo && window.chatTodo.moveWindow) {
      window.chatTodo.moveWindow(dx, dy);
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (startTime === 0) return;
    const wasDragging = dragging;
    const elapsed = Date.now() - startTime;
    startTime = 0;
    dragging = false;
    if (!wasDragging && elapsed < 600 && el.id === 'pet') {
      toggleExpanded();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadConfirmed();
  renderPending();
  renderConfirmed();
  setExpanded(false);

  $('pet').addEventListener('click', () => {
    // 点击兜底：拖拽逻辑已在 mouseup 处理切换，这里不重复切换
  });
  attachDrag($('pet'));
  attachDrag($('panelHeader'));

  $('collapseBtn').addEventListener('click', () => setExpanded(false));
  $('extractBtn').addEventListener('click', extractNow);
  $('exportBtn').addEventListener('click', exportMarkdown);
  $('addManualBtn').addEventListener('click', () => {
    const title = $('manualInput').value.trim();
    if (!title) { setStatus('先输入一条待办的标题。'); return; }
    pending.push({
      id: 'todo-manual-' + (uidCounter++),
      title: title,
      date: null,
      time: null,
      location: null,
      people: [],
      uncertain: true,
      uncertainReason: '手动添加，未提到具体时间'
    });
    $('manualInput').value = '';
    renderPending();
  });
  $('fileInput').addEventListener('change', () => {
    const file = $('fileInput').files && $('fileInput').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { $('chatInput').value = String(reader.result || ''); setStatus('已读入 ' + file.name + '，点「提取待办」即可提取。'); };
    reader.onerror = () => setStatus('读取文件失败，请重试。');
    reader.readAsText(file, 'utf-8');
  });

  // 截图验证模式：自动展开并跑一条示例，方便截到面板
  if (window.chatTodo && window.chatTodo.smoke) {
    $('chatInput').value = '明天晚上19:30一起去体育馆打羽毛球，@小明 一起来';
    extractNow();
    setExpanded(true);
  }
});
