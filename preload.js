'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chatTodo', {
  smoke: process.env.CHAT_TODO_SMOKE === '1',
  setExpanded: (value) => ipcRenderer.invoke('set-expanded', !!value),
  moveWindow: (dx, dy) => ipcRenderer.send('move-window', dx, dy)
});
