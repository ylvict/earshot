# Earshot

Hear it. Read it. Local-first streaming speech-to-text for Node.js, browsers (WASM) and your own service — powered by [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx). No cloud API, no usage fees, no registration.

> [中文文档 → README.zh.md](README.zh.md)

[![npm](https://img.shields.io/npm/v/@ylvict/earshot-sdk)](https://www.npmjs.com/package/@ylvict/earshot-sdk) [![build](https://img.shields.io/github/actions/workflow/status/ylvict/earshot/ci.yml?label=build)](https://github.com/ylvict/earshot/actions) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

```bash
npm install @ylvict/earshot-sdk
```

## 🚀 Quick Start

```ts
import { createRecognizer } from '@ylvict/earshot-sdk';

// One line — audio to text
const asr = await createRecognizer({ model: 'zh-en' });
const text = await asr.transcribe(wavBuffer);     // "大家好，欢迎来到Earshot"

// Real time — speak, and it reads along
const session = asr.stream({ vad: true });
session.onText((line) => render(line));           // partial words as you speak
session.push(micChunk);                            // any Float32Array/Int16Array/WAV
const lines = await session.end();
```

## ✨ Features

- **Zero configuration** — no API keys, no sign-up, no account
- **Local inference** — Chinese + English, works offline
- **Streaming in** — feed audio chunk by chunk, get words as they are heard
- **Streaming out** — same events in Node, the browser, and over WebSocket
- **One API, three surfaces** — SDK, browser WASM, service API
- **Speech-friendly input** — Float32Array, Int16Array, buffers, or WAV bytes
- **Light** — no Python, no PyTorch, no CUDA; Node ≥ 18 and that's it
- **Auto-models** — download a bilingual zh/en model on first use (`'zh-en'`)
- **Cross-platform** — macOS, Linux, Windows, ARM; prebuilt binaries included

## 📖 API

| Method | Description |
| --- | --- |
| `createRecognizer(options)` | Create a recognizer (Node addon backend) |
| `asr.transcribe(audio, opts?)` | One utterance → text (`TranscriptLine[]` if `timestamps`) |
| `asr.stream(opts?)` | Streaming session — `.push()`, `.onText()`, `.onSegment()`, `.end()` |
| `createRecognizerInBrowser(api, opts)` | Same API, WASM inference in the browser |
| `POST /v1/transcribe` | Service one-shot transcription (raw audio body) |
| `WS /v1/stream` | Service streaming: binary audio in, JSON events out |

### 💬 Streaming session

```ts
const session = asr.stream({ vad: true });
session.onText((line) => console.log('...', line.text));     // { type: 'partial' }
session.onSegment((seg) => commit(seg));                     // { type: 'segment' }
session.push(pcm16Chunk);                                    // keep feeding
const lines = await session.end();                           // final result
```

Sessions are async iterable too: `for await (const line of asr.stream()) …`

### 🖥️ As a service

```bash
npx asr-server --model zh-en --port 8000
curl -F file=@hello.wav http://localhost:8000/v1/transcribe   # → { text }
```

WebSocket clients push PCM chunks and receive `partial`/`segment`/`end` events —
the exact same events the SDK emits locally.

### 🌐 In the browser (WASM)

Load the official sherpa-onnx wasm module, then hand it to Earshot:

```ts
import { createRecognizerInBrowser } from '@ylvict/earshot-sdk/wasm';
const asr = createRecognizerInBrowser(sherpaOnnx, {
  model: 'zh-en',
  modelDir: 'https://cdn.example.com/models',
});
```

## 📁 Samples

| Sample | Description |
| --- | --- |
| `examples/node-transcribe` | One-shot audio → text |
| `examples/node-stream-file` | Wav file → streaming text |
| `examples/node-live-mic` | Microphone (ffmpeg) → live streaming text |
| `npm run start:server` | REST + WebSocket service |
| `examples/browser-wasm` | Browser-side streaming (WASM — in progress) |

## 🔍 How It Works

Earshot wraps [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (next-gen
Kaldi): ONNX models (Zipformer transducer / Paraformer) run fully locally on
its multi-threaded native Node addon or its in-browser WebAssembly build. One
shared contract — `push → partial → segment → end` — sits underneath the SDK,
the WASM SDK and the WebSocket service, so every consumer sees identical
streaming semantics.

## 📦 Packages

| Package | Surface | Notes |
| --- | --- | --- |
| [`@ylvict/earshot-core`](src/core) | shared contract | types, session, audio, manifest |
| [`@ylvict/earshot-sdk`](src/sdk) | Node SDK + WASM entry | what most apps install |
| [`@ylvict/earshot-server`](src/server) | REST + WebSocket | for non-Node clients |

## 📚 Docs

- [Design & architecture](docs/DESIGN.md)
- [API reference](docs/API.md)
- [Quickstart](docs/QUICKSTART.md)
- [Deployment](docs/DEPLOY.md)
- [Models & licensing](docs/MODELS.md)

## License

[MIT](LICENSE) — Earshot is an orchestration layer. The sherpa-onnx engine is
Apache-2.0; downloaded models carry their own licenses, check
[docs/MODELS.md](docs/MODELS.md) before commercial use.