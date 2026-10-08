# Earshot

听见它，读出它。本地优先的流式语音转文字，覆盖 Node.js、浏览器（WASM）和自建服务 —— 基于 [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)。无需云端 API、没有使用费用、不用注册。

> [English → README.md](README.md)

[![npm](https://img.shields.io/npm/v/@ylvict/earshot-sdk)](https://www.npmjs.com/package/@ylvict/earshot-sdk) [![build](https://img.shields.io/github/actions/workflow/status/ylvict/earshot/ci.yml?label=build)](https://github.com/ylvict/earshot/actions) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

```bash
npm install @ylvict/earshot-sdk
```

## 🚀 快速开始

```ts
import { createRecognizer } from '@ylvict/earshot-sdk';

// 一行 —— 音频转文字
const asr = await createRecognizer({ model: 'zh-en' });
const text = await asr.transcribe(wavBuffer);     // "大家好，欢迎来到Earshot"

// 实时 —— 边说边出字
const session = asr.stream({ vad: true });
session.onText((line) => render(line));           // 边说边出的部分结果
session.push(micChunk);                            // Float32Array / Int16Array / WAV 均可
const lines = await session.end();
```

## ✨ 特性

- **零配置** —— 无需 API Key、无需注册、无需账户
- **本地推理** —— 中英双语，可离线运行
- **流式输入** —— 分片喂入音频，边听边出字
- **流式输出** —— Node、浏览器、WebSocket 三端事件完全一致
- **一套 API，三种形态** —— SDK、浏览器 WASM、服务 API
- **宽容的输入** —— Float32Array、Int16Array、Buffer、WAV 字节都能吃
- **轻量** —— 无 Python、无 PyTorch、无 CUDA；只要 Node ≥ 18
- **自动模型** —— 首次使用自动下载中英双语模型（`'zh-en'`）
- **跨平台** —— macOS、Linux、Windows、ARM，预编译二进制开箱即用

## 📖 API

| 方法 | 说明 |
| --- | --- |
| `createRecognizer(options)` | 创建识别器（Node 原生后端） |
| `asr.transcribe(audio, opts?)` | 一句音频 → 文字（`timestamps` 时返回 `TranscriptLine[]`） |
| `asr.stream(opts?)` | 流式会话 —— `.push()` / `.onText()` / `.onSegment()` / `.end()` |
| `createRecognizerInBrowser(api, opts)` | 浏览器 WASM，同一套 API |
| `POST /v1/transcribe` | 服务端一次性转写（原始音频 body） |
| `WS /v1/stream` | 服务端流式：二进制 PCM 进，JSON 事件出 |

### 💬 流式会话

```ts
const session = asr.stream({ vad: true });
session.onText((line) => console.log('...', line.text));     // { type: 'partial' }
session.onSegment((seg) => commit(seg));                     // { type: 'segment' }
session.push(pcm16Chunk);                                    // 持续喂养
const lines = await session.end();                           // 最终结果
```

会话本身也是 async iterable：`for await (const line of asr.stream()) …`

### 🖥️ 作为服务

```bash
npx asr-server --model zh-en --port 8000
curl -F file=@hello.wav http://localhost:8000/v1/transcribe   # → { text }
```

WebSocket 客户端推入 PCM 分片，收到 `partial`/`segment`/`end` 事件 ——
与 SDK 本地发出的事件完全同构。

### 🌐 浏览器（WASM）

先加载官方 sherpa-onnx wasm 模块，再交给 Earshot：

```ts
import { createRecognizerInBrowser } from '@ylvict/earshot-sdk/wasm';
const asr = createRecognizerInBrowser(sherpaOnnx, {
  model: 'zh-en',
  modelDir: 'https://cdn.example.com/models',
});
```

## 📁 示例

| 示例 | 说明 |
| --- | --- |
| `examples/node-transcribe` | 一次性音频 → 文字 |
| `examples/node-stream-file` | wav 文件 → 流式文字 |
| `examples/node-live-mic` | 麦克风（ffmpeg）→ 实时流式文字 |
| `npm run start:server` | REST + WebSocket 服务 |
| `examples/browser-wasm` | 浏览器端流式转写（WASM —— 进行中） |

## 🔍 工作原理

Earshot 封装了 [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)（next-gen
Kaldi）：ONNX 模型（Zipformer transducer / Paraformer）完全本地运行在
多线程的原生 Node 插件或浏览器的 WebAssembly 构建上。一套共享契约
—— `push → partial → segment → end` —— 同时垫在 SDK、WASM SDK 与
WebSocket 服务之下，任何消费者看到的流式语义都一致。

## 📦 包结构

| 包 | 形态 | 说明 |
| --- | --- | --- |
| [`@ylvict/earshot-core`](src/core) | 公共契约 | 类型、会话、音频、模型清单 |
| [`@ylvict/earshot-sdk`](src/sdk) | Node SDK + WASM 入口 | 大多数应用装这个 |
| [`@ylvict/earshot-server`](src/server) | REST + WebSocket | 给非 Node 客户端 |

## 📚 文档

- [设计文档](docs/DESIGN.md)
- [API 参考](docs/API.md)
- [快速上手](docs/QUICKSTART.md)
- [部署指南](docs/DEPLOY.md)
- [模型与许可](docs/MODELS.md)

## License

[MIT](LICENSE) —— Earshot 是编排层。sherpa-onnx 引擎为 Apache-2.0；下载的
模型各自带各自许可，商用前请查阅 [docs/MODELS.md](docs/MODELS.md)。