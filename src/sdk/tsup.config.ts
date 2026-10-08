import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/wasm.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node18',
  platform: 'neutral',
  external: ['sherpa-onnx-node'],
});