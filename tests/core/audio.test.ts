import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toAudio, decodeWav, resample, DEFAULT_SAMPLE_RATE } from '../../src/core/src/index.ts';

function makeWav(samples: Int16Array, sampleRate = 16000): Uint8Array {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i], true);
  return new Uint8Array(buf);
}

describe('audio', () => {
  it('normalizes Int16Array to float32', () => {
    const input = new Int16Array([0, 16384, -16384, 32767]);
    const { samples, sampleRate } = toAudio(input);
    assert.equal(sampleRate, DEFAULT_SAMPLE_RATE);
    assert.ok(Math.abs(samples[0] - 0) < 1e-6);
    assert.ok(Math.abs(samples[1] - 0.5) < 1e-6);
    assert.ok(Math.abs(samples[2] + 0.5) < 1e-6);
    assert.ok(Math.abs(samples[3] - 0.999969) < 1e-5);
  });

  it('resamples a lower-rate buffer up to the target', () => {
    const input = { samples: new Float32Array(8000).fill(0.5), sampleRate: 8000 };
    const { samples, sampleRate } = toAudio(input, DEFAULT_SAMPLE_RATE);
    assert.equal(sampleRate, DEFAULT_SAMPLE_RATE);
    assert.equal(samples.length, 16000);
    assert.ok(Math.abs(samples[0] - 0.5) < 1e-5);
  });

  it('keeps 16kHz audio untouched', () => {
    const input = { samples: new Float32Array(1000).fill(0.25), sampleRate: 16000 };
    const { samples } = toAudio(input, DEFAULT_SAMPLE_RATE);
    assert.equal(samples.length, 1000);
  });

  it('decodes a 16-bit mono wav byte buffer', () => {
    const wav = makeWav(new Int16Array([1000, -1000, 0]));
    const { samples, sampleRate } = decodeWav(wav);
    assert.equal(sampleRate, 16000);
    assert.equal(samples.length, 3);
    assert.ok(Math.abs(samples[0] - 1000 / 32768) < 1e-6);
    assert.equal(samples[2], 0);
  });

  it('toAudio auto-detects wav bytes and keeps the native rate', () => {
    const wav = makeWav(new Int16Array([1, 2, 3]), 44100);
    const { samples, sampleRate } = toAudio(wav);
    assert.equal(sampleRate, 44100); // leaves resampling to the caller
    assert.equal(samples.length, 3);
  });

  it('resample preserves a constant signal value', () => {
    const src = new Float32Array(16000).fill(0.7);
    const out = resample(src, 16000, 32000);
    assert.equal(out.length, 32000);
    assert.ok(Math.abs(out[123] - 0.7) < 1e-5);
  });
});