import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveModel, listModels, modelPaths } from '../../src/core/src/index.ts';

describe('manifest', () => {
  it('resolves the zh-en alias to the bilingual zipformer model', () => {
    const spec = resolveModel('zh-en');
    assert.equal(spec.id, 'stream-zh-en');
    assert.equal(spec.kind, 'zipformer');
    assert.equal(spec.language, 'zh-en');
    assert.match(spec.files.encoder, /\.onnx$/);
    assert.equal(spec.files.tokens, 'tokens.txt');
  });

  it('resolves an explicit model id', () => {
    const spec = resolveModel('stream-paraformer-zh-en');
    assert.equal(spec.kind, 'paraformer');
    assert.equal(spec.files.joiner, undefined);
  });

  it('throws on unknown models', () => {
    assert.throws(() => resolveModel('does-not-exist'), /Unknown model/);
  });

  it('builds paths from a base dir', () => {
    const spec = resolveModel('zh-en');
    const paths = modelPaths(spec, '/tmp/models/');
    assert.equal(paths.encoder, '/tmp/models/encoder.onnx');
  });

  it('exposes a non-empty model list', () => {
    assert.ok(listModels().length >= 2);
  });
});