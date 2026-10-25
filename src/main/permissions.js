'use strict';

const { systemPreferences, shell } = require('electron');

/**
 * Summarize OS-level permission state for the UI.
 * Full mic/system-audio checks need real Mac/Windows hardware.
 */
function checkPermissions() {
  const platform = process.platform;
  const result = {
    platform,
    microphone: 'unknown',
    systemAudio: 'unknown',
    messages: []
  };

  if (platform === 'darwin') {
    try {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      result.microphone = status; // granted | denied | restricted | not-determined | unknown
    } catch {
      result.microphone = 'unknown';
    }

    result.systemAudio = 'setup-required';
    result.messages.push(
      'macOS needs Microphone permission. System/loopback audio usually needs Screen Recording permission and/or a virtual audio device (e.g. BlackHole) — see README.'
    );
  } else if (platform === 'win32') {
    result.microphone = 'prompt-on-record';
    result.systemAudio = 'wasapi-loopback';
    result.messages.push(
      'Windows uses WASAPI loopback (via Chromium desktop capture) for system audio plus the default microphone. Allow mic access when prompted.'
    );
  } else {
    result.microphone = 'prompt-on-record';
    result.systemAudio = 'limited';
    result.messages.push(
      'This Linux environment can exercise the UI and mic path; packaged targets are macOS arm64 and Windows.'
    );
  }

  return result;
}

async function requestMicrophoneAccess() {
  if (process.platform === 'darwin') {
    try {
      const granted = await systemPreferences.askForMediaAccess('microphone');
      return { granted, status: granted ? 'granted' : 'denied' };
    } catch (err) {
      return { granted: false, status: 'error', error: String(err) };
    }
  }
  return { granted: true, status: 'prompt-in-renderer' };
}

/**
 * Open the relevant OS settings pane so the user can grant Screen Recording / Mic.
 */
async function openSystemPreferences(section = 'privacy') {
  if (process.platform === 'darwin') {
    // Microphone or Screen Recording panes
    const urls = {
      microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
      screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
      privacy: 'x-apple.systempreferences:com.apple.preference.security?Privacy'
    };
    await shell.openExternal(urls[section] || urls.privacy);
    return { opened: true };
  }
  if (process.platform === 'win32') {
    await shell.openExternal('ms-settings:privacy-microphone');
    return { opened: true };
  }
  return { opened: false, reason: 'Unsupported on this platform' };
}

function getPlatformAudioHints() {
  if (process.platform === 'darwin') {
    return {
      title: 'macOS system audio',
      body:
        'Mic capture works after granting Microphone access. For the other side of the call, either enable Screen Recording for Cybro Recorder (ScreenCaptureKit path) or install a virtual cable such as BlackHole 2ch and set your meeting app output to Multi-Output (speakers + BlackHole), then select BlackHole as an input if loopback is unavailable.',
      docs: 'See README → macOS system audio setup.'
    };
  }
  if (process.platform === 'win32') {
    return {
      title: 'Windows system audio',
      body:
        'Cybro uses Chromium/Electron loopback (WASAPI) for what you hear, mixed with your microphone into one WAV. Keep the meeting tab unmuted so loopback has signal.',
      docs: 'See README → How call recording works.'
    };
  }
  return {
    title: 'System audio',
    body: 'Packaged builds target Windows (WASAPI loopback) and macOS Apple Silicon. Dev on Linux is UI/mic only.',
    docs: 'See README.'
  };
}

module.exports = {
  checkPermissions,
  requestMicrophoneAccess,
  openSystemPreferences,
  getPlatformAudioHints
};
