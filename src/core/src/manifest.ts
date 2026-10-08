import data from './manifest.json' with { type: 'json' };

export interface ModelSpec {
  id: string;
  kind: 'zipformer' | 'paraformer';
  language: string;
  license: string;
  sizeHint: string;
  archive: string;
  /** Optional mirror prefixes, e.g. ['https://gh-proxy.com'] — tried after `archive`. */
  mirrors?: string[];
  /** target name -> file name inside the archive (used by the downloader). */
  archiveMap: Record<string, string>;
  /** target name -> local file name once extracted. */
  files: Record<string, string>;
}

const raw = data as unknown as { models: ModelSpec[]; aliases: Record<string, string> };
const MODELS: readonly ModelSpec[] = raw.models.map((m) => Object.freeze(m));
const ALIASES: Record<string, string> = raw.aliases ?? {};

export function listModels(): readonly ModelSpec[] {
  return MODELS;
}

export function resolveModel(modelOrAlias: string): ModelSpec {
  const id = ALIASES[modelOrAlias] ?? modelOrAlias;
  const spec = MODELS.find((m) => m.id === id);
  if (!spec) {
    throw new Error(
      `Unknown model '${modelOrAlias}'. Available: ${MODELS.map((m) => m.id).join(', ')} ` +
        `(aliases: ${Object.entries(ALIASES).map(([a, id2]) => `${a}->${id2}`).join(', ')})`,
    );
  }
  return spec;
}

export function modelPaths(spec: ModelSpec, baseDir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [target, file] of Object.entries(spec.files)) {
    out[target] = `${baseDir.replace(/\/$/, '')}/${file}`;
  }
  return out;
}

/** Ordered download candidates: the canonical archive, then each mirror. */
export function archiveSources(spec: ModelSpec): string[] {
  const primary = spec.archive;
  const mirrors = (spec.mirrors ?? []).map((m) => `${m.replace(/\/$/, '')}/${spec.archive}`);
  return [primary, ...mirrors];
}