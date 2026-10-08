import { createNodeEngine } from '../../engine-node/src/index.ts';
import type { RecognizerOptions } from '../../core/src/index.ts';
import { wrapEngine } from './wrap.ts';
import type { EarshotRecognizer } from './wrap.ts';

export type { EarshotRecognizer, TranscribeOptions } from './wrap.ts';
export type { RecognizerOptions, TranscriptLine, StreamSession, AudioInput } from '../../core/src/index.ts';

/** Create a ready-to-use recognizer powered by the sherpa-onnx native addon. */
export async function createRecognizer(options: RecognizerOptions = {}): Promise<EarshotRecognizer> {
  const engine = await createNodeEngine(options);
  return wrapEngine(engine);
}