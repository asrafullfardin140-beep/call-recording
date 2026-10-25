'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { RECORDINGS_FOLDER_NAME } = require('../shared/constants');

/**
 * Absolute path to Documents/Cybro Recorder (created on demand).
 */
function getRecordingsDir() {
  const documents = app.getPath('documents');
  return path.join(documents, RECORDINGS_FOLDER_NAME);
}

function ensureRecordingsDir() {
  const dir = getRecordingsDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Timestamped WAV filename, e.g. call-2026-10-25T19-16-42.wav
 */
function buildRecordingFilename(date = new Date()) {
  const iso = date.toISOString().replace(/[:.]/g, '-').replace('Z', '');
  return `call-${iso}.wav`;
}

function buildRecordingPath(date = new Date()) {
  return path.join(ensureRecordingsDir(), buildRecordingFilename(date));
}

module.exports = {
  getRecordingsDir,
  ensureRecordingsDir,
  buildRecordingFilename,
  buildRecordingPath
};
