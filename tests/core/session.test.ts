import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { StreamSession } from '../../src/core/src/index.ts';
import { fakeEngine } from '../helpers/fake-engine.ts';

describe('StreamSession', () => {
  it('pushes audio and emits partial text as it decodes', async () => {
    const engine = fakeEngine({
      partial: (samples) => `partial(${samples.length})`,
    });
    const session = new StreamSession(engine);
    const partials: string[] = [];
    const segments: string[] = [];
    session.onText((l) => partials.push(l.text));
    session.onSegment((l) => segments.push(l.text));

    session.push(new Float32Array(9600));
    session.push(new Float32Array(9600));

    assert.ok(partials.length >= 1);
    assert.equal(partials[0], 'partial(9600)');
    assert.deepEqual(segments, []);

    const lines = await session.end();
    assert.equal(lines.length, 1);
    assert.equal(lines[0].text, 'heard(19200)');
    assert.equal(lines[0].isPartial, false);
    assert.deepEqual(segments, ['heard(19200)']);
  });

  it('throws if you push after end()', async () => {
    const session = new StreamSession(fakeEngine());
    await session.end();
    assert.throws(() => session.push(new Float32Array(1)), /Cannot push after end/);
  });

  it('exposes results as an async iterable', async () => {
    const engine = fakeEngine({ final: () => 'hello there' });
    const session = new StreamSession(engine);
    session.push(new Float32Array(3200));
    const collected: string[] = [];
    const grab = (async () => {
      for await (const line of session) collected.push(line.text);
    })();
    await session.end();
    await grab;
    assert.deepEqual(collected, ['hello there']);
  });

  it('computes start/end in seconds from consumed audio', async () => {
    const engine = fakeEngine({ final: () => 'x' });
    const session = new StreamSession(engine);
    session.push(new Float32Array(16000));
    session.push(new Float32Array(16000));
    const lines = await session.end();
    assert.equal(lines[0].start, 0);
    assert.equal(lines[0].end, 2);
  });

  it('emits a segment when endpooint fires in vad mode and keeps streaming', async () => {
    let hits = 0;
    const engine = fakeEngine({
      partial: (s) => `p${s.length}`,
      final: () => 'last',
      isEndpoint: () => ++hits === 2,
    });
    const session = new StreamSession(engine, { vad: true });
    const segments: string[] = [];
    session.onSegment((l) => segments.push(l.text));

    session.push(new Float32Array(16000)); // 1s, not an endpoint
    session.push(new Float32Array(16000)); // 1s, endpoint -> 'p32000'
    session.push(new Float32Array(16000)); // keeps going

    assert.deepEqual(segments, ['p32000']);
    const lines = await session.end();
    assert.equal(lines.length, 2);
    assert.equal(lines[1].text, 'last');
    assert.equal(lines[1].start, 2);
  });
});