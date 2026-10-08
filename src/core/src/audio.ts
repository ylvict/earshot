import type { AudioInput } from './types';

export const DEFAULT_SAMPLE_RATE = 16000;

export interface Audio {
  samples: Float32Array;
  sampleRate: number;
}

export function isWav(bytes: Uint8Array): boolean {
  return bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
}

export function decodeWav(bytes: Uint8Array): Audio {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fmt = (view.getUint32(16, true) >>> 0).toString(16);
  void fmt;
  const audioFormat = view.getUint16(20, true);
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);

  // Locate the 'data' chunk.
  let offset = 12;
  let dataOffset = -1;
  let dataLength = 0;
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const size = view.getUint32(offset + 4, true);
    if (id === 'data') {
      dataOffset = offset + 8;
      dataLength = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (dataOffset < 0) throw new Error('WAV: missing data chunk');

  const count = Math.floor(dataLength / (bitsPerSample / 8) / channels);
  const samples = new Float32Array(count);

  if (audioFormat === 3) {
    for (let i = 0; i < count; i++) {
      samples[i] = view.getFloat32(dataOffset + i * 4 * channels, true);
    }
  } else if (bitsPerSample === 16) {
    for (let i = 0; i < count; i++) {
      samples[i] = view.getInt16(dataOffset + i * 2 * channels, true) / 32768;
    }
  } else if (bitsPerSample === 8) {
    for (let i = 0; i < count; i++) {
      samples[i] = (bytes[dataOffset + i * channels] - 128) / 128;
    }
  } else {
    throw new Error(`WAV: unsupported bits per sample ${bitsPerSample}`);
  }
  return { samples, sampleRate };
}

export function resample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.max(1, Math.round(samples.length / ratio)));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = samples[Math.min(idx, samples.length - 1)];
    const b = samples[Math.min(idx + 1, samples.length - 1)];
    out[i] = a + (b - a) * frac;
  }
  return out;
}

export function toAudio(input: AudioInput, targetRate: number = DEFAULT_SAMPLE_RATE): Audio {
  if (input instanceof Float32Array) return { samples: input, sampleRate: targetRate };
  if (input instanceof Int16Array) {
    const s = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) s[i] = input[i] / 32768;
    return { samples: s, sampleRate: targetRate };
  }
  if (input instanceof Int8Array) {
    const s = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) s[i] = input[i] / 128;
    return { samples: s, sampleRate: targetRate };
  }
  if (input instanceof Uint16Array) {
    const s = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) s[i] = (input[i] - 32768) / 32768;
    return { samples: s, sampleRate: targetRate };
  }
  if (input instanceof Int32Array) {
    const s = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) s[i] = input[i] / 2147483648;
    return { samples: s, sampleRate: targetRate };
  }
  if (input instanceof Uint8Array) return decodeWav(input);
  if (input instanceof ArrayBuffer) return decodeWav(new Uint8Array(input, 0));
  if (typeof ArrayBuffer.isView === 'function' && ArrayBuffer.isView(input)) {
    throw new Error('Unsupported typed array input');
  }
  if (typeof input === 'object' && input && 'samples' in input) {
    const s = resample(input.samples, input.sampleRate, targetRate);
    return { samples: s, sampleRate: targetRate };
  }
  throw new Error('Unsupported audio input');
}