'use strict';

/** Default folder name under the user's Documents directory. */
const RECORDINGS_FOLDER_NAME = 'Cybro Recorder';

/** WAV sample rate for MVP recordings. */
const SAMPLE_RATE = 48000;

/** IPC channel names. */
const IPC = {
  GET_APP_INFO: 'cybro:get-app-info',
  GET_SAVE_PATH: 'cybro:get-save-path',
  OPEN_RECORDINGS_FOLDER: 'cybro:open-recordings-folder',
  ENSURE_RECORDINGS_DIR: 'cybro:ensure-recordings-dir',
  SAVE_RECORDING: 'cybro:save-recording',
  CHECK_PERMISSIONS: 'cybro:check-permissions',
  REQUEST_MICROPHONE: 'cybro:request-microphone',
  OPEN_SYSTEM_PREFS: 'cybro:open-system-prefs',
  PLATFORM_AUDIO_HINTS: 'cybro:platform-audio-hints'
};

module.exports = {
  RECORDINGS_FOLDER_NAME,
  SAMPLE_RATE,
  IPC
};
