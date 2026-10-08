import { createRequire } from 'node:module';
import type { ModelSpec, RawEngine, RawStream, RecognizerOptions } from '../../core/src/index.ts';
import { resolveModel, modelPaths } from '../../core/src/index.ts';
import { ensureModels } from './model-manager.ts';

const require = createRequire(import.meta.url);

const SILENCE_TAIL_SECONDS = 0.4;

interface SherpaStream {
  acceptWaveform(obj: { sampleRate: number; samples: Float32Array }): void;
  inputFinished(): void;
}

interface SherpaRecognizer {
  createStream(): SherpaStream;
  isReady(s: SherpaStream): boolean;
  decode(s: SherpaStream): void;
  getResult(s: SherpaStream): { text: string };
  isEndpoint(s: SherpaStream): boolean;
  reset(s: SherpaStream): void;
}

type SherpaRecognizerConstructor = new (config: unknown) => SherpaRecognizer;

function loadSherpa(): SherpaRecognizerConstructor | null {
  try {
    const mod = require('sherpa-onnx-node') as { OnlineRecognizer?: SherpaRecognizerConstructor };
    return mod.OnlineRecognizer ?? null;
  } catch {
    return null;
  }
}

export class NodeStream implements RawStream {
  private readonly rec: SherpaRecognizer;
  private readonly stream: SherpaStream;

  constructor(rec: SherpaRecognizer, stream: SherpaStream) {
    this.rec = rec;
    this.stream = stream;
  }

  push(samples: Float32Array): void {
    this.stream.acceptWaveform({ sampleRate: 16000, samples });
    this.decode();
  }

  poll(): string {
    this.decode();
    return this.rec.getResult(this.stream).text ?? '';
  }

  isEndpoint(): boolean {
    return this.rec.isEndpoint(this.stream);
  }

  reset(): void {
    this.rec.reset(this.stream);
  }

  finish(): void {
    const pad = new Float32Array(Math.round(16000 * SILENCE_TAIL_SECONDS));
    this.stream.acceptWaveform({ sampleRate: 16000, samples: pad });
    this.stream.inputFinished();
    this.decode();
  }

  private decode(): void {
    let guard = 0;
    while (this.rec.isReady(this.stream) && guard++ < 4096) this.rec.decode(this.stream);
  }
}

export class NodeEngine implements RawEngine {
  readonly runtime = 'node' as const;

  private readonly recognizer: SherpaRecognizer;

  constructor(recognizer: SherpaRecognizer) {
    this.recognizer = recognizer;
  }

  createStream(): RawStream {
    return new NodeStream(this.recognizer, this.recognizer.createStream());
  }

  dispose(): void {
    // sherpa-onnx-node has no explicit dispose; kept as a no-op hook.
  }
}

function buildConfig(spec: ModelSpec, paths: Record<string, string>): Record<string, unknown> {
  void spec;
  const encoder = paths.encoder;
  const decoder = paths.decoder;
  const modelConfig: Record<string, unknown> = { numThreads: 2, provider: 'cpu', debug: false, tokens: paths.tokens };
  if (paths.joiner) {
    modelConfig.transducer = { encoder, decoder, joiner: paths.joiner };
  } else {
    modelConfig.paraformer = { encoder, decoder };
  }
  return {
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig,
    decodingMethod: 'greedy_search',
    enableEndpoint: true,
    rule1MinTrailingSilence: 2.4,
    rule2MinTrailingSilence: 6.0,
    rule3MinUtteranceLength: 300,
  };
}

export async function createNodeEngine(options: RecognizerOptions): Promise<RawEngine> {
  const OnlineRecognizer = loadSherpa();
  if (!OnlineRecognizer) {
    throw new Error(
      "sherpa-onnx-node is not installed. Run: npm install sherpa-onnx-node (it is bundled with @earshot/engine-node).",
    );
  }
  const spec = resolveModel(options.model ?? 'zh-en');
  const dir = await ensureModels(spec, options.modelDir);
  const paths = modelPaths(spec, dir);
  const config = buildConfig(spec, paths);
  const recognizer = new OnlineRecognizer(config);
  return new NodeEngine(recognizer);
}