'use strict';

/**
 * CallRecorder — captures microphone + system/loopback audio, mixes to stereo WAV.
 * L = microphone, R = system (when both available); mono mix-down fallback if needed.
 */
class CallRecorder {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 48000;
    this.onLevel = options.onLevel || (() => {});
    this.onError = options.onError || (() => {});

    /** @type {AudioContext | null} */
    this.audioContext = null;
    /** @type {MediaStream | null} */
    this.micStream = null;
    /** @type {MediaStream | null} */
    this.systemStream = null;
    /** @type {ScriptProcessorNode | null} */
    this.processor = null;
    /** @type {GainNode | null} */
    this.silentGain = null;

    this.micChunks = [];
    this.systemChunks = [];
    this.recording = false;
    this.startedAt = null;
    this.systemAudioAvailable = false;
    this.mode = 'idle'; // idle | stereo | mic-only
  }

  async start() {
    if (this.recording) return;

    this.micChunks = [];
    this.systemChunks = [];
    this.systemAudioAvailable = false;

    // 1) Microphone (required)
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        },
        video: false
      });
    } catch (err) {
      const error = new Error(
        'Microphone access was denied or unavailable. Grant mic permission and try again.'
      );
      error.cause = err;
      throw error;
    }

    // 2) System / loopback (best-effort)
    try {
      // Video is required by getDisplayMedia; we discard video tracks immediately.
      this.systemStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: {
          width: 16,
          height: 16,
          frameRate: 1
        }
      });
      this.systemStream.getVideoTracks().forEach((t) => {
        t.stop();
        this.systemStream.removeTrack(t);
      });
      const audioTracks = this.systemStream.getAudioTracks();
      if (audioTracks.length === 0) {
        this._teardownSystem();
        this.systemAudioAvailable = false;
      } else {
        this.systemAudioAvailable = true;
        audioTracks.forEach((track) => {
          track.addEventListener('ended', () => {
            // User stopped share — keep mic recording if still active
            this.systemAudioAvailable = false;
          });
        });
      }
    } catch (err) {
      console.warn('System/loopback audio unavailable; continuing mic-only.', err);
      this._teardownSystem();
      this.systemAudioAvailable = false;
    }

    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    const ctx = this.audioContext;

    const micSource = ctx.createMediaStreamSource(this.micStream);
    let systemSource = null;
    if (this.systemAudioAvailable && this.systemStream) {
      systemSource = ctx.createMediaStreamSource(this.systemStream);
    }

    // ScriptProcessor is deprecated but widely available without worklet bundling.
    const bufferSize = 4096;
    this.processor = ctx.createScriptProcessor(bufferSize, 2, 2);

    const micGain = ctx.createGain();
    micGain.gain.value = 1;
    micSource.connect(micGain);

    const systemGain = ctx.createGain();
    systemGain.gain.value = 1;
    if (systemSource) systemSource.connect(systemGain);

    // Merge into a stereo bus: L=mic, R=system (or silence)
    const merger = ctx.createChannelMerger(2);
    micGain.connect(merger, 0, 0);
    if (systemSource) {
      systemGain.connect(merger, 0, 1);
    }

    merger.connect(this.processor);
    // Keep processor alive without audible feedback into speakers
    this.silentGain = ctx.createGain();
    this.silentGain.gain.value = 0;
    this.processor.connect(this.silentGain);
    this.silentGain.connect(ctx.destination);

    this.processor.onaudioprocess = (event) => {
      if (!this.recording) return;
      const input = event.inputBuffer;
      const left = input.getChannelData(0);
      const right =
        input.numberOfChannels > 1 ? input.getChannelData(1) : new Float32Array(left.length);

      this.micChunks.push(new Float32Array(left));
      this.systemChunks.push(new Float32Array(right));

      let peak = 0;
      for (let i = 0; i < left.length; i += 1) {
        peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
      }
      this.onLevel(peak);
    };

    this.recording = true;
    this.startedAt = Date.now();
    this.mode = this.systemAudioAvailable ? 'stereo' : 'mic-only';
    return {
      mode: this.mode,
      systemAudioAvailable: this.systemAudioAvailable
    };
  }

  async stop() {
    if (!this.recording) {
      return null;
    }
    this.recording = false;

    if (this.processor) {
      this.processor.onaudioprocess = null;
      try {
        this.processor.disconnect();
      } catch {
        /* ignore */
      }
      this.processor = null;
    }
    if (this.silentGain) {
      try {
        this.silentGain.disconnect();
      } catch {
        /* ignore */
      }
      this.silentGain = null;
    }

    this._stopStream(this.micStream);
    this.micStream = null;
    this._teardownSystem();

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch {
        /* ignore */
      }
      this.audioContext = null;
    }

    const mic = concatFloat32(this.micChunks);
    const system = concatFloat32(this.systemChunks);
    this.micChunks = [];
    this.systemChunks = [];

    const { encodeWav, floatTo16BitPCM, interleaveStereo } = window.CybroWav;
    const interleaved = interleaveStereo(mic, system);
    const pcm = floatTo16BitPCM(interleaved);
    const wav = encodeWav(pcm, this.sampleRate, 2);
    const durationMs = this.startedAt ? Date.now() - this.startedAt : 0;

    return {
      wav,
      durationMs,
      mode: this.mode,
      sampleRate: this.sampleRate,
      channels: 2
    };
  }

  _teardownSystem() {
    this._stopStream(this.systemStream);
    this.systemStream = null;
  }

  _stopStream(stream) {
    if (!stream) return;
    stream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
  }
}

function concatFloat32(chunks) {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

window.CallRecorder = CallRecorder;
