import { createWasmEngine } from '../../engine-wasm/src/index.ts';
import type { SherpaOnlineApi } from '../../engine-wasm/src/index.ts';
import type { RecognizerOptions } from '../../core/src/index.ts';
import { wrapEngine } from './wrap.ts';
import type { EarshotRecognizer } from './wrap.ts';

export type { EarshotRecognizer, TranscribeOptions } from './wrap.ts';
export type { RecognizerOptions, TranscriptLine, StreamSession, AudioInput } from '../../core/src/index.ts';
export type { SherpaOnlineApi } from '../../engine-wasm/src/index.ts';

/**
 * Create a recognizer in the browser. Pass the `sherpa_onnx` object returned
 * by the official wasm loader, and set `modelDir` to the CDN base URL that
 * serves the model files.
 */
export function createRecognizerInBrowser(api: SherpaOnlineApi, options: RecognizerOptions = {}): EarshotRecognizer {
  const engine = createWasmEngine(api, options);
  return wrapEngine(engine);
}