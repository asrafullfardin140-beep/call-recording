'use strict';

/**
 * Encode interleaved Int16 PCM into a WAV ArrayBuffer.
 * @param {Int16Array} samples
 * @param {number} sampleRate
 * @param {number} numChannels
 * @returns {ArrayBuffer}
 */
function encodeWav(samples, sampleRate, numChannels) {
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    view.setInt16(offset, samples[i], true);
    offset += 2;
  }
  return buffer;
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i += 1) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Convert Float32 [-1,1] to Int16.
 * @param {Float32Array} input
 * @returns {Int16Array}
 */
function floatTo16BitPCM(input) {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/**
 * Interleave two mono Float32 buffers into stereo L/R (or duplicate mono).
 */
function interleaveStereo(left, right) {
  const length = Math.max(left.length, right.length);
  const interleaved = new Float32Array(length * 2);
  for (let i = 0; i < length; i += 1) {
    interleaved[i * 2] = i < left.length ? left[i] : 0;
    interleaved[i * 2 + 1] = i < right.length ? right[i] : 0;
  }
  return interleaved;
}

window.CybroWav = {
  encodeWav,
  floatTo16BitPCM,
  interleaveStereo
};
