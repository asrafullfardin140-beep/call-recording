'use strict';

(() => {
  const recordBtn = document.getElementById('recordBtn');
  const stopBtn = document.getElementById('stopBtn');
  const openFolderBtn = document.getElementById('openFolderBtn');
  const statusLabel = document.getElementById('statusLabel');
  const modeLabel = document.getElementById('modeLabel');
  const timerEl = document.getElementById('timer');
  const pulse = document.getElementById('pulse');
  const savePathEl = document.getElementById('savePath');
  const nextFileEl = document.getElementById('nextFile');
  const notice = document.getElementById('notice');
  const noticeTitle = document.getElementById('noticeTitle');
  const noticeBody = document.getElementById('noticeBody');
  const noticeActions = document.getElementById('noticeActions');

  /** @type {InstanceType<typeof window.CallRecorder> | null} */
  let recorder = null;
  let timerId = null;
  let pendingFileName = null;
  let isBusy = false;

  function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function setPulse(state) {
    pulse.dataset.state = state;
  }

  function showNotice(title, body, tone = 'info', actions = []) {
    notice.hidden = false;
    notice.dataset.tone = tone;
    noticeTitle.textContent = title;
    noticeBody.textContent = body;
    noticeActions.innerHTML = '';
    for (const action of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--link';
      btn.textContent = action.label;
      btn.addEventListener('click', action.onClick);
      noticeActions.appendChild(btn);
    }
  }

  function hideNotice() {
    notice.hidden = true;
    noticeActions.innerHTML = '';
  }

  async function refreshSavePath() {
    const info = await window.cybro.getSavePath();
    savePathEl.textContent = info.directory;
    nextFileEl.textContent = `Next file: ${info.nextFileName}`;
    pendingFileName = info.nextFileName;
    return info;
  }

  async function bootstrap() {
    await window.cybro.ensureRecordingsDir();
    await refreshSavePath();

    const perms = await window.cybro.checkPermissions();
    const hints = await window.cybro.platformAudioHints();

    if (perms.platform === 'darwin') {
      showNotice(
        hints.title,
        hints.body,
        'warn',
        [
          {
            label: 'Grant microphone',
            onClick: async () => {
              await window.cybro.requestMicrophone();
              await window.cybro.openSystemPrefs('microphone');
            }
          },
          {
            label: 'Screen Recording settings',
            onClick: () => window.cybro.openSystemPrefs('screen')
          }
        ]
      );
    } else if (perms.platform === 'win32') {
      showNotice(hints.title, hints.body, 'info');
    } else {
      showNotice(
        'Dev environment',
        'UI and mic path can be exercised here. Full system/loopback audio needs Windows or macOS.',
        'warn'
      );
    }
  }

  function startTimer(startedAt) {
    stopTimer();
    timerId = setInterval(() => {
      timerEl.textContent = formatTime(Date.now() - startedAt);
    }, 250);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function setRecordingUi(active) {
    recordBtn.disabled = active || isBusy;
    stopBtn.disabled = !active || isBusy;
    recordBtn.classList.toggle('is-live', active);
    recordBtn.querySelector('.btn__label').textContent = active ? 'Recording…' : 'Record call';
  }

  async function onRecord() {
    if (isBusy) return;
    hideNotice();
    isBusy = true;
    setRecordingUi(false);
    statusLabel.textContent = 'Requesting mic & system audio…';
    setPulse('saving');

    try {
      await window.cybro.requestMicrophone();
      await refreshSavePath();

      recorder = new window.CallRecorder({
        sampleRate: 48000,
        onLevel: () => {
          /* reserved for future meter */
        }
      });

      const result = await recorder.start();
      const startedAt = Date.now();
      startTimer(startedAt);
      setPulse('recording');
      setRecordingUi(true);
      statusLabel.textContent = 'Recording call';

      if (result.systemAudioAvailable) {
        modeLabel.textContent = 'Stereo WAV · L = mic · R = system audio';
      } else {
        modeLabel.textContent = 'Mic-only WAV · system audio unavailable';
        showNotice(
          'System audio not captured',
          'Recording microphone only. On Windows, allow screen/audio share when prompted. On macOS, grant Screen Recording or set up BlackHole — see README.',
          'warn',
          [
            {
              label: 'Open permissions help',
              onClick: () => window.cybro.openSystemPrefs('screen')
            }
          ]
        );
      }
    } catch (err) {
      console.error(err);
      setPulse('error');
      statusLabel.textContent = 'Could not start';
      timerEl.textContent = '00:00';
      setRecordingUi(false);
      showNotice(
        'Recording blocked',
        err && err.message ? err.message : String(err),
        'error',
        [
          {
            label: 'Microphone settings',
            onClick: () => window.cybro.openSystemPrefs('microphone')
          }
        ]
      );
      recorder = null;
    } finally {
      isBusy = false;
      if (recorder) setRecordingUi(true);
    }
  }

  async function onStop() {
    if (!recorder || isBusy) return;
    isBusy = true;
    setRecordingUi(false);
    stopBtn.disabled = true;
    statusLabel.textContent = 'Saving WAV…';
    setPulse('saving');
    stopTimer();

    try {
      const result = await recorder.stop();
      recorder = null;

      if (!result || !result.wav) {
        throw new Error('No audio was captured.');
      }

      const fileName = pendingFileName || `call-${Date.now()}.wav`;
      // Transfer ArrayBuffer to main via structured clone
      const saved = await window.cybro.saveRecording(fileName, result.wav);
      await refreshSavePath();

      timerEl.textContent = formatTime(result.durationMs);
      statusLabel.textContent = 'Saved';
      setPulse('idle');
      modeLabel.textContent =
        result.mode === 'stereo'
          ? 'Last take: stereo mic + system'
          : 'Last take: microphone only';

      showNotice(
        'Call recording saved',
        `${saved.path} (${Math.round(saved.bytes / 1024)} KB)`,
        'ok',
        [
          {
            label: 'Open folder',
            onClick: () => window.cybro.openRecordingsFolder()
          }
        ]
      );
    } catch (err) {
      console.error(err);
      setPulse('error');
      statusLabel.textContent = 'Save failed';
      showNotice(
        'Could not save recording',
        err && err.message ? err.message : String(err),
        'error'
      );
    } finally {
      isBusy = false;
      setRecordingUi(false);
    }
  }

  recordBtn.addEventListener('click', onRecord);
  stopBtn.addEventListener('click', onStop);
  openFolderBtn.addEventListener('click', async () => {
    await window.cybro.openRecordingsFolder();
  });

  bootstrap().catch((err) => {
    console.error(err);
    showNotice('Startup issue', String(err), 'error');
  });
})();
