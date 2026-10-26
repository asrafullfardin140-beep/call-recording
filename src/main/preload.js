'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const { IPC } = require('../shared/constants');

contextBridge.exposeInMainWorld('cybro', {
  getAppInfo: () => ipcRenderer.invoke(IPC.GET_APP_INFO),
  getSavePath: () => ipcRenderer.invoke(IPC.GET_SAVE_PATH),
  ensureRecordingsDir: () => ipcRenderer.invoke(IPC.ENSURE_RECORDINGS_DIR),
  openRecordingsFolder: () => ipcRenderer.invoke(IPC.OPEN_RECORDINGS_FOLDER),
  saveRecording: (fileName, data) =>
    ipcRenderer.invoke(IPC.SAVE_RECORDING, { fileName, data }),
  checkPermissions: () => ipcRenderer.invoke(IPC.CHECK_PERMISSIONS),
  requestMicrophone: () => ipcRenderer.invoke(IPC.REQUEST_MICROPHONE),
  openSystemPrefs: (section) => ipcRenderer.invoke(IPC.OPEN_SYSTEM_PREFS, section),
  platformAudioHints: () => ipcRenderer.invoke(IPC.PLATFORM_AUDIO_HINTS)
});
