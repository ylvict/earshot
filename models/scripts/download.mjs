#!/usr/bin/env node
// Downloads and extracts Earshot models into ./models/cache/<id>.
// Usage:
//   node models/scripts/download.mjs              # all models
//   node models/scripts/download.mjs --model zh-en

import { mkdir, readdir, copyFile, rm, readFile, writeFile } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const manifestUrl = join(root, 'src', 'core', 'src', 'manifest.json');
const cacheDir = join(root, 'models', 'cache');

const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
const argModel = parseArg('--model');

const targets = argModel
  ? manifest.models.filter((m) => m.id === argModel || (manifest.aliases[argModel] ?? undefined) === m.id)
  : manifest.models;

if (!targets.length) {
  console.error(`No model matched '${argModel}'.`);
  process.exit(1);
}

for (const model of targets) {
  console.log(`\n▶ ${model.id}  (${model.language})  ${model.sizeHint}`);
  await ensureModel(model);
}
console.log('\nDone. Model files live in models/cache/<id>/.');

async function ensureModel(model) {
  const dir = join(cacheDir, model.id);
  await mkdir(dir, { recursive: true });
  const local = Object.values(model.files);
  if (local.every((f) => existsSync(join(dir, f)))) {
    console.log('  already present, skipping');
    return;
  }
  const tmp = join(dir, '.download');
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });

  console.log(`  downloading ${model.archive}`);
  const sources = [model.archive, ...(model.mirrors ?? []).map((m) => `${m.replace(/\/$/, '')}/${model.archive}`)];
  let res;
  for (const url of sources) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 40_000);
    try {
      res = await fetch(url, { signal: controller.signal });
    } catch (err) {
      clearTimeout(t);
      console.warn(`  (skipping ${url}: ${err.cause?.message ?? err.message})`);
      continue;
    }
    clearTimeout(t);
    if (res.ok) {
      if (url !== model.archive) console.log(`  (via mirror ${url})`);
      break;
    }
    console.warn(`  (skipping ${url}: HTTP ${res.status})`);
  }
  if (!res?.ok) throw new Error(`download failed: ${model.archive}`);

  const archive = join(tmp, 'model.tar.bz2');
  await streamDownload(res, archive);

  console.log('  extracting');
  const extract = join(tmp, 'x');
  await mkdir(extract, { recursive: true });
  await exec('tar', ['-xjf', archive, '-C', extract]);

  const found = await indexFiles(extract);
  for (const [target, srcName] of Object.entries(model.archiveMap)) {
    const src = found.get(srcName);
    if (!src) throw new Error(`archive missing ${srcName}`);
    const dest = join(dir, model.files[target]);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(src, dest);
    console.log(`  -> ${model.files[target]}`);
  }
  await rm(tmp, { recursive: true, force: true });
}

async function streamDownload(res, dest) {
  const out = createWriteStream(dest);
  let got = 0;
  for await (const chunk of res.body) {
    got += chunk.length;
    if (!out.write(chunk)) await new Promise((done) => out.once('drain', done));
  }
  await new Promise((resolve, reject) => out.end((e) => (e ? reject(e) : resolve())));
  if (!got) throw new Error('downloaded archive is empty');
  const mb = (got / 1e6).toFixed(1);
  console.log(`  received ${mb !== '0.0' ? mb + ' MB' : got + ' bytes'}`);
}

function parseArg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function indexFiles(rootDir) {
  const map = new Map();
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else map.set(entry.name, full);
    }
  }
  await walk(rootDir);
  return map;
}