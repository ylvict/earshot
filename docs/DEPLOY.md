# Deployment

## @ylvict/earshot-server

The service only needs Node.js ≥ 18. No Python, no CUDA.

```bash
npm install @ylvict/earshot-server @ylvict/earshot-core
npm run download:models        # optional — first use auto-downloads

npx asr-server --model zh-en --port 8000 --host 0.0.0.0 --model-dir ./models/cache
```

- Prebuilt sherpa-onnx binaries are fetched automatically per platform
  (macOS arm64/x64, Linux x64/arm64, Windows x64). Alpine (musl) has no
  prebuilt binary — build from source if you need it.
- Concurrency: the native addon is multi-threaded; each WebSocket client gets
  its own `RawStream`. Scale horizontally behind a load balancer, or run one
  instance per CPU.
- Containerize with the official Node image (glibc-based).

## Browser / WASM hosts

- Ship the wasm runtime and model files behind a CDN; point `modelDir` at the
  CDN base URL. Browsers cache aggressively.
- The WASM build is single-threaded per page. For many concurrent streams,
  prefer `@ylvict/earshot-server` + WebSocket, or a small worker pool.

## Costs

No per-call fees — inference is local. You pay for your own servers, GPU (if
any) and CDN bandwidth.

## Model licensing

Earshot is an orchestration layer (MIT). The engine (sherpa-onnx) is
Apache-2.0. **Models have their own licenses** — check `models/manifest.json`
and each model card before commercial use.