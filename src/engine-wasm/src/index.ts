import type { RawEngine, RawStream, ModelSpec, RecognizerOptions } from '../../core/src/index.ts';
import { resolveModel, modelPaths } from '../../core/src/index.ts';

/**
 * Minimal shape of the official sherpa-onnx WebAssembly JS API.
 * The host app is responsible for loading the wasm module and passing the
 * resulting `sherpa_onnx` object in.
 */
export interface SherpaOnlineApi {
  createOnlineRecognizer(config: unknown): SherpaOnlineRecognizer;
}

export interface SherpaWasmStream {
  acceptWaveform(sampleRate: number, samples: Float32Array): void;
  inputFinished(): void;
}

export interface SherpaOnlineRecognizer {
  createStream(): SherpaWasmStream;
  isReady(s: SherpaWasmStream): boolean;
  decode(s: SherpaWasmStream): void;
  getResult(s: SherpaWasmStream): { text: string };
  isEndpoint(s: SherpaWasmStream): boolean;
  reset(s: SherpaWasmStream): void;
}

const SILENCE_TAIL_SECONDS = 0.4;

export class WasmStream implements RawStream {
  private readonly recognizer: SherpaOnlineRecognizer;
  private readonly stream: SherpaWasmStream;

  constructor(recognizer: SherpaOnlineRecognizer, stream: SherpaWasmStream) {
    this.recognizer = recognizer;
    this.stream = stream;
  }

  push(samples: Float32Array): void {
    this.stream.acceptWaveform(16000, samples);
    this.decode();
  }

  poll(): string {
    this.decode();
    return this.recognizer.getResult(this.stream).text ?? '';
  }

  isEndpoint(): boolean {
    return this.recognizer.isEndpoint(this.stream);
  }

  reset(): void {
    this.recognizer.reset(this.stream);
  }

  finish(): void {
    const pad = new Float32Array(Math.round(16000 * SILENCE_TAIL_SECONDS));
    this.stream.acceptWaveform(16000, pad);
    this.stream.inputFinished();
    this.decode();
  }

  private decode(): void {
    let guard = 0;
    while (this.recognizer.isReady(this.stream) && guard++ < 4096) this.recognizer.decode(this.stream);
  }
}

export class WasmEngine implements RawEngine {
  readonly runtime = 'wasm' as const;

  private readonly recognizer: SherpaOnlineRecognizer;

  constructor(recognizer: SherpaOnlineRecognizer) {
    this.recognizer = recognizer;
  }

  createStream(): RawStream {
    return new WasmStream(this.recognizer, this.recognizer.createStream());
  }

  dispose(): void {
    // no-op hook; Emscripten handles cleanup.
  }
}

function buildConfig(spec: ModelSpec, baseUrl: string): Record<string, unknown> {
  const urls = modelPaths(spec, baseUrl);
  const config: Record<string, unknown> = {
    modelProvider: 'wasm',
    tokens: urls.tokens,
    numThreads: 1,
    decodingMethod: 'greedy_search',
  };
  if (urls.joiner) {
    config.transducer = { encoder: urls.encoder, decoder: urls.decoder, joiner: urls.joiner };
  } else {
    config.paraformer = { encoder: urls.encoder, decoder: urls.decoder };
  }
  return config;
}

/**
 * Create a WASM engine from an already-loaded sherpa_onnx wasm API.
 * Model files are served from `baseUrl` (a static/CDN directory) and loaded
 * into the Emscripten virtual filesystem by the host.
 */
export function createWasmEngine(api: SherpaOnlineApi, options: RecognizerOptions): RawEngine {
  const spec = resolveModel(options.model ?? 'zh-en');
  const base = options.modelDir ?? '/models';
  const config = buildConfig(spec, base);
  const recognizer = api.createOnlineRecognizer(config);
  return new WasmEngine(recognizer);
}