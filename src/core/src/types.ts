export type RuntimeKind = 'node' | 'wasm';

export type ModelLang = 'zh' | 'en' | 'zh-en' | 'auto';

export type AudioInput =
  | Float32Array
  | Int16Array
  | Int8Array
  | Uint8Array
  | Uint16Array
  | Int32Array
  | ArrayBuffer
  | {
      samples: Float32Array;
      sampleRate: number;
    };

export interface TranscriptLine {
  text: string;
  start: number;
  end: number;
  isPartial: boolean;
}

export interface RecognizerOptions {
  /** Model id or alias, e.g. 'zh-en'. Defaults to 'zh-en'. */
  model?: string;
  language?: ModelLang;
  /** Directory (Node) or base URL (WASM) where model files live. */
  modelDir?: string;
  sampleRate?: number;
  runtime?: RuntimeKind;
  logLevel?: 'silent' | 'info';
}

export interface StreamOptions {
  /** Enable voice-activity detection auto-segmentation. */
  vad?: boolean;
  language?: ModelLang;
}

export interface RawStream {
  /** Feed already-normalized float32 samples. */
  push(samples: Float32Array): void;
  /** Force the engine to decode buffered audio and return current partial text. */
  poll(): string;
  isEndpoint(): boolean;
  reset(): void;
  /** Signal that no more audio will arrive. */
  finish(): void;
}

export interface RawEngine {
  readonly runtime: RuntimeKind;
  createStream(): RawStream;
  dispose(): void;
}

export type EngineResolver = (options: RecognizerOptions) => Promise<RawEngine>;

export interface EarshotEvents {
  text: (line: TranscriptLine) => void;
  segment: (line: TranscriptLine) => void;
  end: () => void;
  error: (err: Error) => void;
}