import { StreamSession } from '../../core/src/index.ts';
import type { AudioInput, RawEngine, TranscriptLine, StreamOptions } from '../../core/src/index.ts';

export interface TranscribeOptions {
  timestamps?: boolean;
}

export interface EarshotRecognizer {
  /** Recognize an utterance and return the final text (or lines with timestamps). */
  transcribe(input: AudioInput, options?: TranscribeOptions): Promise<string | TranscriptLine[]>;
  /** Open a streaming session: push audio, get words as they are heard. */
  stream(options?: StreamOptions): StreamSession;
  dispose(): void;
}

export function wrapEngine(engine: RawEngine): EarshotRecognizer {
  return {
    async transcribe(input: AudioInput, options?: TranscribeOptions): Promise<string | TranscriptLine[]> {
      const session = new StreamSession(engine);
      session.push(input);
      const lines = await session.end();
      return options?.timestamps ? lines : lines.map((l) => l.text).join('');
    },
    stream(options?: StreamOptions): StreamSession {
      return new StreamSession(engine, options);
    },
    dispose(): void {
      engine.dispose();
    },
  };
}