'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const SMOKE = process.env.CHAT_TODO_SMOKE === '1';
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: SMOKE ? 380 : 150,
    height: SMOKE ? 560 : 170,
    resizable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#fff3b0',
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

  if (SMOKE) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const image = await win.capturePage();
          const docsDir = path.join(__dirname, 'docs');
          fs.mkdirSync(docsDir, { recursive: true });
          fs.writeFileSync(path.join(docsDir, 'screenshot.png'), image.toPNG());
        } catch (e) {
          // 截图失败时退出码非 0，让调用方知道验证未过
          app.exit(2);
          return;
        }
        app.quit();
      }, 1500);
    });
  }
}

ipcMain.handle('set-expanded', (_event, value) => {
  if (!win) return;
  if (value) win.setSize(380, 560);
  else win.setSize(150, 170);
});

ipcMain.on('move-window', (_event, dx, dy) => {
  if (!win) return;
  const pos = win.getPosition();
  win.setPosition(Math.round(pos[0] + dx), Math.round(pos[1] + dy));
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
