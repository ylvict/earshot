import type { RawEngine, RawStream, RecognizerOptions } from '../../src/core/src/index.ts';

export interface FakeScript {
  partial(samples: Float32Array): string;
  final(samples: Float32Array): string;
  isEndpoint?: (samples: Float32Array) => boolean;
}

class FakeStream implements RawStream {
  buffer: Float32Array = new Float32Array(0);
  private readonly rec: FakeEngine;
  private readonly script: FakeScript;

  constructor(rec: FakeEngine, script: FakeScript) {
    this.rec = rec;
    this.script = script;
  }

  push(samples: Float32Array): void {
    const merged = new Float32Array(this.buffer.length + samples.length);
    merged.set(this.buffer, 0);
    merged.set(samples, this.buffer.length);
    this.buffer = merged;
    this.rec.onPush(this, samples.length);
  }

  poll(): string {
    if (this.rec.finalText) return this.rec.finalText;
    return this.script.partial(this.buffer);
  }

  isEndpoint(): boolean {
    return this.script.isEndpoint ? this.script.isEndpoint(this.buffer) : false;
  }

  reset(): void {
    this.buffer = new Float32Array(0);
  }

  finish(): void {
    this.rec.finalText = this.script.final(this.buffer);
  }
}

export class FakeEngine implements RawEngine {
  readonly runtime = 'node' as const;
  finalText = '';
  readonly streams: FakeStream[] = [];
  disposals = 0;

  private readonly script: FakeScript;

  constructor(script: Partial<FakeScript> = {}) {
    this.script = {
      partial: () => '',
      final: (samples) => `heard(${samples.length})`,
      ...script,
    };
  }

  onPush(stream: FakeStream, _n: number): void {
    void stream;
  }

  createStream(): RawStream {
    const s = new FakeStream(this, this.script);
    this.streams.push(s);
    return s;
  }

  dispose(): void {
    this.disposals++;
  }
}

export function fakeEngine(script: Partial<FakeScript> = {}): FakeEngine {
  return new FakeEngine(script);
}

export function fakeEngineFactory(engine: FakeEngine) {
  return async (_options: RecognizerOptions) => engine as unknown as RawEngine;
}