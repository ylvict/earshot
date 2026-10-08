import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawEngine, RecognizerOptions } from '../../core/src/index.ts';
import { StreamSession, listModels } from '../../core/src/index.ts';
import { createNodeEngine as defaultNodeEngine } from '../../engine-node/src/index.ts';

export type EngineFactory = (options: RecognizerOptions) => Promise<RawEngine>;

export interface ServerOptions {
  engineFactory?: EngineFactory;
  defaultModel?: string;
  modelDir?: string;
}

export interface EarshotServer {
  server: http.Server;
  listen(port?: number, host?: string): Promise<number>;
  close(): Promise<void>;
}

const DEFAULT_MODEL = 'zh-en';

export function createEarshotServer(options: ServerOptions = {}): EarshotServer {
  const makeEngine: EngineFactory =
    options.engineFactory ?? (async (o) => defaultNodeEngine(o));
  const wss = new WebSocketServer({ noServer: true });
  const server = http.createServer((req, res) => handleHttp(req, res));

  server.on('upgrade', (req, socket, head) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/v1/stream') {
      wss.handleUpgrade(req, socket, head, (ws) => handleWs(ws, req));
    } else {
      socket.destroy();
    }
  });

  async function handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        return json(res, 200, { status: 'ok', service: 'earshot', version: '0.1.0' });
      }
      if (req.method === 'GET' && url.pathname === '/models') {
        return json(res, 200, { models: listModels().map((m) => ({ id: m.id, language: m.language, license: m.license })) });
      }
      if (req.method === 'POST' && url.pathname === '/v1/transcribe') {
        const body = await readBody(req);
        const timestamps = url.searchParams.get('timestamps') === '1' || url.searchParams.get('timestamps') === 'true';
        const model = url.searchParams.get('model') ?? options.defaultModel ?? DEFAULT_MODEL;
        const engine = await makeEngine({ model, modelDir: options.modelDir });
        try {
          const session = new StreamSession(engine);
          session.push(isWavBuffer(body) ? body : pcm16(body));
          const lines = await session.end();
          return json(res, 200, timestamps ? { text: joinLines(lines), lines } : { text: joinLines(lines) });
        } finally {
          engine.dispose();
        }
      }
      return json(res, 404, { error: 'not found' });
    } catch (err) {
      return json(res, 500, { error: (err as Error).message });
    }
  }

  async function handleWs(ws: WebSocket, req: IncomingMessage): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const model = url.searchParams.get('model') ?? DEFAULT_MODEL;
    let engine: RawEngine | null = null;
    let session: StreamSession | null = null;
    try {
      engine = await makeEngine({ model, modelDir: options.modelDir });
      session = new StreamSession(engine);
      session.onText((l) => send(ws, { type: 'partial', text: l.text, start: l.start, end: l.end }));
      session.onSegment((l) => send(ws, { type: 'segment', text: l.text, start: l.start, end: l.end }));
      send(ws, { type: 'ready', model });
    } catch (err) {
      send(ws, { type: 'error', error: (err as Error).message });
      ws.close(1011, 'engine error');
      return;
    }

    ws.on('message', (data) => {
      try {
        handleMessage(data as Buffer);
      } catch (err) {
        send(ws, { type: 'error', error: (err as Error).message });
      }
    });
    ws.on('close', () => {
      void session?.end().catch(() => undefined);
      engine?.dispose();
    });

    function handleMessage(data: Buffer): void {
      const first = data[0];
      if (first === 0x7b || first === 0x22) {
        const msg = JSON.parse(data.toString('utf8')) as { type?: string };
        if (msg.type === 'end' || msg.type === 'stop') {
          void session?.end().then((lines) => {
            send(ws, { type: 'end', lines });
            ws.close();
          });
        }
        if (msg.type === 'ping') send(ws, { type: 'pong' });
        return;
      }
      const input = isWavBuffer(data) ? data : pcm16(data);
      session?.push(input);
    }
  }

  return {
    server,
    listen(port = 8000, host = '0.0.0.0'): Promise<number> {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.removeListener('error', reject);
          resolve((server.address() as { port: number }).port);
        });
      });
    },
    close(): Promise<void> {
      return new Promise((resolve) => {
        wss.close();
        server.close(() => resolve());
      });
    },
  };
}

function joinLines(lines: { text: string }[]): string {
  return lines.map((l) => l.text).join('');
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function isWavBuffer(b: Buffer): boolean {
  return b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46;
}

function pcm16(b: Buffer): Int16Array {
  return new Int16Array(b.buffer, b.byteOffset, b.length >> 1);
}