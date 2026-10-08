import { createRecognizer } from '../src/sdk/src/index.ts';
import { open } from 'node:fs/promises';

// Streaming: feed a wav file in 600ms PCM chunks, watch partial results arrive.
// Usage: node src/sdk/examples/node-stream-file.ts ./speech.wav
const wavPath = process.argv[2] ?? './speech.wav';

const asr = await createRecognizer({ model: 'zh-en', modelDir: './models/cache' });
const session = asr.stream({ vad: true });

session.onText((line) => console.log('...', line.text));
session.onSegment((line) => console.log('>> segment:', line.text));
session.onEnd(() => console.log('>> ended'));

const CHUNK_BYTES = Math.floor(0.6 * 16000) * 2; // 600ms of PCM16

const fd = await open(wavPath, 'r');
const { size } = await fd.stat();
let offset = 44; // skip a standard wav header
const remaining = size - offset;
const payload = size - 44;

const int16 = (u8: Uint8Array) => new Int16Array(u8.buffer, u8.byteOffset, u8.length >> 1);

for (let pos = 0; pos < payload; pos += CHUNK_BYTES) {
  const n = Math.min(CHUNK_BYTES, payload - pos);
  const buf = Buffer.alloc(n);
  await fd.read(buf, 0, n, offset + pos);
  session.push(int16(buf));
}
await fd.close();

const lines = await session.end();
console.log('final:', JSON.stringify(lines, null, 2));
asr.dispose();
void remaining;