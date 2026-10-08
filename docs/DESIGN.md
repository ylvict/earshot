# Design

Earshot is a local-first, streaming speech-to-text platform built on
[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx). It exposes **one contract**
across three surfaces: a Node SDK, a browser (WASM) SDK, and a service API.

## One contract, three transports

All business logic lives in a single, platform-agnostic package —
`@ylvict/earshot-core`. Each surface is a thin transport over the same types and the
same streaming semantics:

| Surface | Package | Transport |
| --- | --- | --- |
| Node SDK | `@ylvict/earshot-sdk` | in-process calls over the sherpa-onnx native addon |
| Browser SDK | `@ylvict/earshot-sdk/wasm` | in-browser WASM inference |
| Service API | `@ylvict/earshot-server` | REST (`POST /v1/transcribe`) + WebSocket (`/v1/stream`) |

The core defines:

- `RawEngine` / `RawStream` — the minimal engine interface every backend implements
- `StreamSession` — the streaming state machine (push → partial → segment → end)
- `AudioInput` — accepts `Float32Array`, `Int16Array`, buffers, ArrayBuffers or WAV bytes
- `ModelSpec` + manifest — model aliases (`'zh-en'`), file layout, download info

Because the server and both SDKs share `StreamSession`, "partial", "final" and
"end" mean the same thing everywhere. A scripted fake engine (see
`tests/helpers/fake-engine.ts`) lets the whole stack be tested without models.

## Package layout

```
src/
  core/          @ylvict/earshot-core        published — contracts, session, audio, manifest
  engine-node/   @ylvict/earshot-engine-node internal — sherpa-onnx-node adapter + model downloader
  engine-wasm/   @ylvict/earshot-engine-wasm internal — browser wasm adapter (assets served via CDN)
  sdk/           @ylvict/earshot-sdk         published — Node entry + ./wasm browser entry
  server/        @ylvict/earshot-server      published — REST + WebSocket service
tests/           mirrors src/ (uses the fake engine; no models required)
docs/            design, API, quickstart, deployment, models
models/          non-code assets: manifest + download script (cache/ is git-ignored)
```

## Streaming semantics

```
push(audio) ──► session ──► raw.poll() ──► { type: 'partial', text, start, end }
push(audio) ──► session ──► raw.poll() ──► { type: 'partial', ... }
end()        ──► raw.finish()      ──► { type: 'segment', isPartial: false }
                                     ──► { type: 'end' }
```

## Concurrency and cost

- Node backend runs on the multi-threaded C++ addon; one `RawStream` per request.
- WASM is single-threaded per page; scale out by workers/tabs or by pointing the
  client at `@ylvict/earshot-server`.
- Everything runs locally — no per-call fees. You only pay for your own
  infrastructure (servers, GPU, CDN bandwidth).

## Licensing

- Earshot code: MIT.
- sherpa-onnx engine: Apache-2.0.
- Models: licenses vary (see `models`/manifest.json and each model card — check
  before commercial use).