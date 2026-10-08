import { Emitter } from './emitter.ts';
import { toAudio, resample } from './audio.ts';
import { DEFAULT_SAMPLE_RATE } from './audio.ts';
import type { AudioInput, EarshotEvents, RawEngine, RawStream, TranscriptLine, StreamOptions } from './types.ts';

export class StreamSession {
  readonly events = new Emitter<EarshotEvents>();

  private raw!: RawStream;
  private readonly engine: RawEngine;
  private readonly targetRate: number;
  private consumedSamples = 0;
  private startOfSegment = 0;
  private lastPartial = '';
  private ended = false;
  private segments: TranscriptLine[] = [];
  private readonly vad: boolean;

  constructor(
    engine: RawEngine,
    options: StreamOptions = {},
  ) {
    this.engine = engine;
    this.raw = this.engine.createStream();
    this.targetRate = DEFAULT_SAMPLE_RATE;
    this.vad = options.vad === true;
  }

  push(input: AudioInput): this {
    if (this.ended) throw new Error('Cannot push after end()');
    const { samples, sampleRate } = toAudio(input, this.targetRate);
    const flat = sampleRate === this.targetRate ? samples : resample(samples, sampleRate, this.targetRate);
    this.raw.push(flat);
    this.consumedSamples += flat.length;
    this.flush();
    return this;
  }

  private flush(): void {
    const text = this.raw.poll();
    if (text && text !== this.lastPartial) {
      this.lastPartial = text;
      this.events.emit('text', this.line(text, true));
    }
    if (this.vad && text && this.raw.isEndpoint()) {
      const line = this.line(text, false);
      this.segments.push(line);
      this.events.emit('segment', line);
      this.raw.reset();
      this.lastPartial = '';
      this.startOfSegment = this.consumedSamples;
    }
  }

  private line(text: string, isPartial: boolean): TranscriptLine {
    return {
      text,
      start: this.startOfSegment / this.targetRate,
      end: this.consumedSamples / this.targetRate,
      isPartial,
    };
  }

  end(): Promise<TranscriptLine[]> {
    if (this.ended) return Promise.resolve(this.segments);
    this.ended = true;
    this.raw.finish();
    const final = this.raw.poll();
    if (final && final !== this.lastPartial) {
      const line = this.line(final, false);
      this.segments.push(line);
      this.events.emit('segment', line);
    } else if (this.lastPartial) {
      const line = this.line(this.lastPartial, false);
      this.segments.push(line);
      this.events.emit('segment', line);
    }
    this.startOfSegment = this.consumedSamples;
    this.events.emit('end');
    return Promise.resolve(this.segments);
  }

  onText(fn: EarshotEvents['text']): this {
    this.events.on('text', fn);
    return this;
  }

  onSegment(fn: EarshotEvents['segment']): this {
    this.events.on('segment', fn);
    return this;
  }

  onEnd(fn: EarshotEvents['end']): this {
    this.events.on('end', fn);
    return this;
  }

  async results(): Promise<TranscriptLine[]> {
    if (!this.ended) await new Promise<void>((resolve) => this.events.on('end', resolve));
    return this.segments;
  }

  [Symbol.asyncIterator](): AsyncIterator<TranscriptLine> {
    const queue: TranscriptLine[] = [];
    const waiters: Array<(l: TranscriptLine | null) => void> = [];
    const onSegment = (line: TranscriptLine) => {
      const w = waiters.shift();
      if (w) w(line);
      else queue.push(line);
    };
    const onEnd = () => {
      let w;
      while ((w = waiters.shift())) w(null);
    };
    this.events.on('segment', onSegment);
    this.events.on('end', onEnd);
    return {
      next: () =>
        new Promise<IteratorResult<TranscriptLine>>((resolve) => {
          if (queue.length) return resolve({ done: false, value: queue.shift()! });
          if (this.ended) return resolve({ done: true, value: undefined });
          waiters.push((line) =>
            line ? resolve({ done: false, value: line }) : resolve({ done: true, value: undefined }),
          );
        }),
    };
  }
}