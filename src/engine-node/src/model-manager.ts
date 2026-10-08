import { promises as fs, existsSync, createWriteStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ModelSpec } from '../../core/src/manifest.ts';
import { archiveSources } from '../../core/src/manifest.ts';

const execFileAsync = promisify(execFile);

export function resolveModelDir(spec: ModelSpec, modelDir?: string): string {
  return modelDir ? join(modelDir, spec.id) : join(cwd(), 'models', 'cache', spec.id);
}

function cwd(): string {
  return process.cwd();
}

export async function ensureModels(spec: ModelSpec, modelDir?: string): Promise<string> {
  const dir = resolveModelDir(spec, modelDir);
  const local = Object.values(spec.files);
  if (local.every((f) => existsSync(join(dir, f)))) return dir;

  await fs.mkdir(dir, { recursive: true });
  const tmp = join(dir, '.download');
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(tmp, { recursive: true });

  const archivePath = join(tmp, 'model.tar.bz2');
  let downloaded = false;
  for (const url of archiveSources(spec)) {
    try {
      await download(url, archivePath);
      downloaded = true;
      if (url !== spec.archive) console.log(`[earshot] model download fell back to mirror: ${url}`);
      break;
    } catch (err) {
      console.warn(`[earshot] failed to download ${url}: ${(err as Error).message}`);
    }
  }
  if (!downloaded) throw new Error(`Failed to download model '${spec.id}' from all sources`);

  const extractDir = join(tmp, 'x');
  await fs.mkdir(extractDir, { recursive: true });
  await execFileAsync('tar', ['-xjf', archivePath, '-C', extractDir]);

  const wanted = Object.entries(spec.archiveMap); // target -> source name in archive
  const found = await findFiles(extractDir);
  for (const [target, sourceName] of wanted) {
    const src = found.get(sourceName);
    if (!src) throw new Error(`Model archive is missing expected file '${sourceName}'`);
    const dest = join(dir, spec.files[target]);
    await fs.mkdir(dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }

  await fs.rm(tmp, { recursive: true, force: true });
  return dir;
}

async function download(url: string, dest: string): Promise<void> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 40_000);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  const out = createWriteStream(dest);
  let got = 0;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    got += chunk.length;
    if (!out.write(chunk)) await new Promise<void>((done) => out.once('drain', () => done()));
  }
  await new Promise<void>((resolve, reject) => {
    out.once('finish', () => resolve());
    out.once('error', reject);
    out.end();
  });
  if (!got) throw new Error('Downloaded archive is empty');
}

async function findFiles(root: string): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  async function walk(dir: string): Promise<void> {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else found.set(entry.name, full);
    }
  }
  await walk(root);
  return found;
}