# Models

Earshot's runtime models are defined in
[`src/core/src/manifest.json`](../src/core/src/manifest.json) — the single source
of truth for ids, aliases, file layouts and download URLs used by both SDKs and
the downloader.

## Included models

| Alias | Id | Kind | Language | License |
| --- | --- | --- | --- | --- |
| `zh-en` | `stream-zh-en` | streaming Zipformer transducer | Chinese + English | Apache-2.0* |
| `zh-en-paraformer` | `stream-paraformer-zh-en` | streaming Paraformer | Chinese + English | Apache-2.0* |

\* License note: the models are distributed under the license stated on their
sherpa-onnx release/model card. Training data (e.g. WenetSpeech) may carry its
own terms — verify before commercial use.

## Download

```bash
npm run download:models            # all
node models/scripts/download.mjs --model zh-en
```

Models land in `models/cache/<id>/` (git-ignored):

```
models/cache/stream-zh-en/
  encoder.onnx  decoder.onnx  joiner.onnx  tokens.txt
```

The Node engine auto-downloads a missing model on first use; set `modelDir` to
point at the cache if it isn't the current working directory.

## Network mirrors

Each model may declare `mirrors` in the manifest — extra URL prefixes that are
tried (in order) after the primary `archive` URL fails. The downloader uses a
40s per-source timeout, streams to disk, and skips any source that is
unreachable:

```
"mirrors": ["https://gh-proxy.com"]
```

This is useful in network environments where GitHub release downloads are
blocked or throttled. The Node engine's auto-download uses the same fallback
logic. Rerun `npm run download:models -- --model zh-en` (or delete
`models/cache/<id>`) to force a re-download.

## Bring your own model

Add an entry to `manifest.json` (fields: `id`, `kind`, `language`, `license`,
`archive`, `archiveMap`, `files`), then reference it by id:
`createRecognizer({ model: 'my-custom-id' })`.

Supported kinds today: `zipformer` (transducer: encoder/decoder/joiner/tokens)
and `paraformer` (encoder/decoder/tokens).