import { createRecognizer } from '../src/sdk/src/index.ts';
import type { EarshotRecognizer } from '../src/sdk/src/wrap.ts';
import { DEFAULT_SAMPLE_RATE } from '../src/core/src/index.ts';

// One-shot: audio -> text.
const asr: EarshotRecognizer = await createRecognizer({ model: 'zh-en', modelDir: './models/cache' });

const silences = { samples: new Float32Array(DEFAULT_SAMPLE_RATE).fill(0), sampleRate: DEFAULT_SAMPLE_RATE };
const lines = (await asr.transcribe(silences, { timestamps: true })) as Array<{ text: string; start: number; end: number }>;

console.log('[transcribe] lines =', JSON.stringify(lines, null, 2));
asr.dispose();