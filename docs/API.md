# API Reference

Everything below is defined once in `@ylvict/earshot-core` and reused unchanged by the
Node SDK, the WASM SDK and the service protocol.

## TypeScript types

```ts
type AudioInput =
  | Float32Array | Int16Array | Int8Array | Uint8Array | Uint16Array | Int32Array
  | ArrayBuffer
  | { samples: Float32Array; sampleRate: number };

interface TranscriptLine {
  text: string;
  start: number;   // seconds, from session start
  end: number;     // seconds
  isPartial: boolean;
}

interface RecognizerOptions {
  model?: string;        // id or alias, e.g. 'zh-en'
  modelDir?: string;     // Node: local dir · WASM: CDN base URL
  sampleRate?: number;
  runtime?: 'auto' | 'node' | 'wasm';
  logLevel?: 'silent' | 'info';
}

interface StreamOptions {
  vad?: boolean;
  language?: 'zh' | 'en' | 'zh-en' | 'auto';
}
```

## Node SDK (`@ylvict/earshot-sdk`)

```ts
const asr = await createRecognizer({ model: 'zh-en' });

// one-shot
const text: string = await asr.transcribe(wavBuffer);
const withTimestamps = await asr.transcribe(audio, { timestamps: true }); // TranscriptLine[]

// streaming
const session = asr.stream({ vad: true });
session.onText((line) => render(line));      // partial words as you speak
session.onSegment((seg) => commit(seg));     // each finished sentence
session.onEnd(() => stop());
session.push(pcmChunk);                       // any accepted audio input
const lines = await session.end();            // final result

// sessions are async iterable too
for await (const line of asr.stream()) handle(line);
```

## Browser SDK (`@ylvict/earshot-sdk/wasm`)

Load the official sherpa-onnx wasm module, then pass the resulting
`sherpa_onnx` object in. The recognizer surface is identical to Node.

```ts
import { createRecognizerInBrowser } from '@ylvict/earshot-sdk/wasm';

// api = the sherpa_onnx object from the official wasm loader
const asr = createRecognizerInBrowser(api, { model: 'zh-en', modelDir: 'https://cdn.example.com/models' });
const text = await asr.transcribe(analyzerBuffer);
```

## Service API (`@ylvict/earshot-server`)

Start it:

```bash
npm run build
npm run download:models            # optional: models auto-download on first use
node src/server/dist/cli.js --model zh-en --port 8000
```

### REST

```
GET  /health                 → { status, service, version }
GET  /models                 → { models: [{ id, language, license }] }

POST /v1/transcribe          body: raw WAV bytes (or raw 16-bit PCM)
       ?model=zh-en          model id/alias
       ?timestamps=1         include per-line timestamps
       → { text } | { text, lines: TranscriptLine[] }
```

### WebSocket (`/v1/stream`)

Binary audio chunks in, JSON events out.

```
client → { type: 'end' }  (or 'stop')
client → { type: 'ping' }

server → { type: 'ready',  model }
server → { type: 'partial', text, start, end }     # streaming words
server → { type: 'segment', text, start, end }     # final sentence
server → { type: 'end',    lines }
server → { type: 'error',  error }
```

Binary messages are treated as raw 16-bit PCM at 16 kHz, **or** as complete
WAV files when the payload starts with a `RIFF` header — Earshot detects it.