# Quickstart

## Install

```bash
npm install @earshot/sdk
```

The first time you transcribe, the model is downloaded automatically to
`./models/cache/` (or set `modelDir`).

## 1. Turn an utterance into text

```ts
import { createRecognizer } from '@earshot/sdk';

const asr = await createRecognizer({ model: 'zh-en' });
const text = await asr.transcribe(wavBuffer);   // WAV bytes, Float32Array, Int16Array...
console.log(text);                              // "大家好，欢迎来到Earshot"
```

## 2. Stream as you speak

```ts
const session = asr.stream({ vad: true });
session.onText((line) => console.log('...', line.text));   // partial
session.onSegment((seg) => console.log('>', seg.text));    // final per sentence
session.push(pcmChunk);                                    // mic chunks from any source
await session.end();
```

## 3. Serve it to other apps

```bash
http://localhost:8000/v1/transcribe   # REST, one-shot
ws://localhost:8000/v1/stream         # streaming, any language
```

## 4. Run in a browser

Serve the wasm assets + model files from any static host, load the official
sherpa-onnx wasm module, then:

```ts
import { createRecognizerInBrowser } from '@earshot/sdk/wasm';
const asr = createRecognizerInBrowser(sherpaOnnx, { modelDir: '/models' });
```

## Docs

- [API reference](API.md)
- [Design & architecture](DESIGN.md)
- [Deployment](DEPLOY.md)
- [Models & licensing](MODELS.md)