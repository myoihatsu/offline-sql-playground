// electron-main.js — Electron wrapper for SQL Playground
const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 700,
    minHeight: 500,
    title: 'SQL Playground',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Allow loading WASM from file://
      webSecurity: false
    }
  });

  // Load index.html directly from the filesystem
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Remove default menu
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
