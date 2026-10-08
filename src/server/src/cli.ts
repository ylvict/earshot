import { parseArgs } from 'node:util';
import { createEarshotServer } from './app.ts';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      model: { type: 'string', default: 'zh-en' },
      'model-dir': { type: 'string' },
      port: { type: 'string', default: '8000' },
      host: { type: 'string', default: '0.0.0.0' },
    },
  });

  const port = Number(values.port);
  const server = createEarshotServer({ defaultModel: values.model, modelDir: values['model-dir'] });
  const actual = await server.listen(port, values.host);

  console.log(`[earshot] listening on http://${values.host}:${actual}`);
  console.log(`[earshot] model: ${values.model}`);
  console.log(`[earshot] REST    POST /v1/transcribe  (raw wav/pcm audio body)`);
  console.log(`[earshot] WS      ws://<host>:${actual}/v1/stream  (binary pcm16 in -> json out)`);
}

void main();