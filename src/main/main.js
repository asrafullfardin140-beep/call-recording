'use strict';

const path = require('path');
const fs = require('fs');
const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  session,
  desktopCapturer
} = require('electron');
const { IPC } = require('../shared/constants');
const {
  getRecordingsDir,
  ensureRecordingsDir,
  buildRecordingPath
} = require('./paths');
const {
  checkPermissions,
  requestMicrophoneAccess,
  openSystemPreferences,
  getPlatformAudioHints
} = require('./permissions');

/** @type {BrowserWindow | null} */
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 680,
    minWidth: 420,
    minHeight: 560,
    title: 'Cybro Recorder',
    backgroundColor: '#dce6ef',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Wire Chromium display-media so getDisplayMedia can return loopback audio.
 * Windows: audio: 'loopback' → WASAPI loopback.
 * macOS: best-effort; may still need Screen Recording / BlackHole (documented).
 */
function setupLoopbackDisplayMedia() {
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1, height: 1 }
      });
      if (!sources.length) {
        callback({});
        return;
      }
      // Prefer loopback when the platform supports it (Windows / some Linux).
      // On macOS Electron may fall back or require Screen Recording entitlement.
      callback({
        video: sources[0],
        audio: 'loopback'
      });
    } catch (err) {
      console.error('displayMedia handler failed:', err);
      callback({});
    }
  });
}

function registerIpc() {
  ipcMain.handle(IPC.GET_APP_INFO, () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch
  }));

  ipcMain.handle(IPC.GET_SAVE_PATH, () => {
    const nextPath = buildRecordingPath();
    return {
      directory: getRecordingsDir(),
      nextFile: nextPath,
      nextFileName: path.basename(nextPath)
    };
  });

  ipcMain.handle(IPC.ENSURE_RECORDINGS_DIR, () => ensureRecordingsDir());

  ipcMain.handle(IPC.OPEN_RECORDINGS_FOLDER, async () => {
    const dir = ensureRecordingsDir();
    const error = await shell.openPath(dir);
    return { ok: !error, error: error || null, directory: dir };
  });

  ipcMain.handle(IPC.SAVE_RECORDING, async (_event, payload) => {
    const { fileName, data } = payload || {};
    if (!fileName || !data) {
      throw new Error('Missing fileName or data');
    }
    // Only allow simple basenames inside the recordings folder.
    const safeName = path.basename(String(fileName));
    if (!safeName.toLowerCase().endsWith('.wav')) {
      throw new Error('Only .wav recordings are supported in MVP');
    }
    const dir = ensureRecordingsDir();
    const target = path.join(dir, safeName);
    const buffer = Buffer.from(data);
    fs.writeFileSync(target, buffer);
    return { path: target, bytes: buffer.length };
  });

  ipcMain.handle(IPC.CHECK_PERMISSIONS, () => checkPermissions());
  ipcMain.handle(IPC.REQUEST_MICROPHONE, () => requestMicrophoneAccess());
  ipcMain.handle(IPC.OPEN_SYSTEM_PREFS, (_e, section) => openSystemPreferences(section));
  ipcMain.handle(IPC.PLATFORM_AUDIO_HINTS, () => getPlatformAudioHints());
}

app.whenReady().then(() => {
  // Product name for menus / about
  app.setName('Cybro Recorder');
  setupLoopbackDisplayMedia();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
