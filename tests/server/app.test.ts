import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import { createEarshotServer } from '../../src/server/src/index.ts';
import type { EarshotServer, ServerOptions } from '../../src/server/src/index.ts';
import { fakeEngine, fakeEngineFactory } from '../helpers/fake-engine.ts';

let server: EarshotServer | null = null;
const openSockets: WebSocket[] = [];

afterEach(async () => {
  for (const ws of openSockets) ws.close();
  openSockets.length = 0;
  if (server) {
    await server.close();
    server = null;
  }
});

async function startServer(): Promise<number> {
  const engine = fakeEngine({
    partial: () => 'partial',
    final: () => 'final text',
  });
  const options: ServerOptions = { engineFactory: fakeEngineFactory(engine) };
  server = createEarshotServer(options);
  return server.listen(0, '127.0.0.1');
}

describe('@earshot/server', () => {
  it('GET /health reports ok', async () => {
    const port = await startServer();
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok', service: 'earshot', version: '0.1.0' });
  });

  it('GET /models lists available models', async () => {
    const port = await startServer();
    const res = await fetch(`http://127.0.0.1:${port}/models`);
    const body = (await res.json()) as { models: unknown[] };
    assert.ok(body.models.length > 0);
  });

  it('POST /v1/transcribe returns transcribed text', async () => {
    const port = await startServer();
    const res = await fetch(`http://127.0.0.1:${port}/v1/transcribe`, {
      method: 'POST',
      body: Buffer.alloc(320, 0),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { text: string };
    assert.equal(body.text, 'final text');
  });

  it('POST /v1/transcribe returns lines when timestamps requested', async () => {
    const port = await startServer();
    const res = await fetch(`http://127.0.0.1:${port}/v1/transcribe?timestamps=1`, {
      method: 'POST',
      body: Buffer.alloc(320),
    });
    const body = (await res.json()) as { text: string; lines: { text: string; isPartial: boolean }[] };
    assert.equal(body.lines.length, 1);
    assert.equal(body.lines[0].isPartial, false);
  });

  it('WS /v1/stream streams partial and final results', async () => {
    const port = await startServer();
    const events: string[] = await new Promise((resolve, reject) => {
      const collected: string[] = [];
      const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/stream`);
      openSockets.push(ws);
      ws.addEventListener('message', (ev) => {
        const msg = JSON.parse(String(ev.data)) as { type: string };
        collected.push(msg.type);
        if (msg.type === 'ready') {
          ws.send(Buffer.alloc(320));
          ws.send(JSON.stringify({ type: 'end' }));
        }
        if (msg.type === 'end') resolve(collected);
      });
      ws.addEventListener('error', (e) => reject(new Error(`ws error: ${String(e)}`)));
    });
    assert.ok(events.includes('ready'));
    assert.ok(events.includes('partial'));
    assert.ok(events.includes('segment'));
    assert.ok(events.includes('end'));
  });

  it('404s unknown routes', async () => {
    const port = await startServer();
    const res = await fetch(`http://127.0.0.1:${port}/nope`, { method: 'POST', body: 'x' });
    assert.equal(res.status, 404);
  });
});