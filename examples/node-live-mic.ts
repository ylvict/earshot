import { createRecognizer } from '../src/sdk/src/index.ts';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';

// Live microphone transcription via ffmpeg -> Earshot streaming recognizer.
// Usage:
//   node examples/node-live-mic.ts                # list devices, then pick
//   node examples/node-live-mic.ts --list         # list devices and exit
//   node examples/node-live-mic.ts ":1"           # use a specific device
// Press Ctrl+C to stop.

interface AudioDevice {
  index: number;
  name: string;
}

function listAudioDevices(): AudioDevice[] {
  const out = spawnSync('ffmpeg', ['-f', 'avfoundation', '-list_devices', 'true', '-i', ''], { encoding: 'utf8' });
  const text = `${out.stderr ?? ''}${out.stdout ?? ''}`;
  const devices: AudioDevice[] = [];
  let inAudio = false;
  for (const line of text.split('\n')) {
    if (/audio devices/i.test(line)) inAudio = true;
    else if (/video devices/i.test(line)) inAudio = false;
    else if (inAudio) {
      const m = line.match(/\[(\d+)\]\s+(.+)$/);
      if (m) devices.push({ index: Number(m[1]), name: m[2].trim() });
    }
  }
  return devices;
}

async function pickDevice(): Promise<string> {
  const arg = process.argv[2];
  if (arg && arg !== '--list') return arg;

  const devices = listAudioDevices();
  if (arg === '--list') {
    if (!devices.length) console.error('No audio input devices found.');
    else for (const d of devices) console.log(`  :${d.index}  ${d.name}`);
    process.exit(0);
  }
  if (!devices.length) {
    console.error('ffmpeg found no audio input devices. Try: node examples/node-live-mic.ts ":1"');
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const list = devices.map((d) => `  :${d.index}  ${d.name}`).join('\n');
  const answer = await new Promise<string>((resolve) => rl.question(`Audio input devices:\n${list}\nPick one (Enter = first): `, resolve));
  rl.close();

  const given = answer.trim();
  const chosen = given === '' ? devices[0] : devices.find((d) => d.index === Number(given));
  if (!chosen) {
    console.error(`Unknown device '${given}'.`);
    process.exit(1);
  }
  return `:${chosen.index}`;
}

const device = await pickDevice();

const asr = await createRecognizer({ model: 'zh-en', modelDir: './models/cache' });
const session = asr.stream();

let shown = '';
session.onText((line) => {
  const text = line.text.trim();
  if (text === shown.trim()) return;
  shown = text;
  process.stdout.write(`\r${text.padEnd(70)}`);
});
session.onSegment((line) => {
  console.log(`\r>> ${line.text.trim()}`);
  shown = '';
});

const CHUNK_SAMPLES = 16000 * 0.6; // 600ms of 16k audio
const CHUNK_BYTES = CHUNK_SAMPLES * 2; // PCM16

const ffmpeg = spawn(
  'ffmpeg',
  ['-f', 'avfoundation', '-i', device, '-ar', '16000', '-ac', '1', '-f', 's16le', '-'],
  { stdio: ['ignore', 'pipe', 'inherit'] },
);

ffmpeg.on('error', (err) => {
  if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
    console.error('ffmpeg not found. Install it with: brew install ffmpeg');
  } else {
    console.error('ffmpeg failed to start:', err.message);
  }
  process.exit(1);
});

console.log(`\nListening on device '${device}' (16kHz mono). Speak, then press Ctrl+C.\n`);

let buf = Buffer.alloc(0);
ffmpeg.stdout.on('data', (chunk: Buffer) => {
  buf = Buffer.concat([buf, chunk]);
  while (buf.length >= CHUNK_BYTES) {
    const piece = buf.subarray(0, CHUNK_BYTES);
    buf = buf.subarray(CHUNK_BYTES);
    session.push(new Int16Array(piece.buffer, piece.byteOffset, piece.length >> 1));
  }
});

async function stop(): Promise<void> {
  ffmpeg.kill();
  const tail = buf.length >= 2 ? new Int16Array(buf.buffer, buf.byteOffset, buf.length >> 1) : new Int16Array(0);
  if (tail.length) session.push(tail);
  const lines = await session.end();
  console.log('\n\nfinal transcript:');
  for (const line of lines) console.log(`  [${line.start.toFixed(2)}s-${line.end.toFixed(2)}s] ${line.text.trim()}`);
  asr.dispose();
  process.exit(0);
}

process.on('SIGINT', () => void stop());