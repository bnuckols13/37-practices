/**
 * The Studio outbox: documents to write into the artifact's database, as
 * files plus ArtifactData batch manifests (at most 50 writes each). This is
 * the only module that knows the shape of an ArtifactData batch entry.
 * A per-target ledger (seeded.json) keeps later exports to what changed, and
 * records each document's version: the database refuses to overwrite a
 * document unless the write names the version it expects (if_version). Only
 * Claude writes these collections, so each successful set is version + 1.
 */

import fs from 'node:fs';
import path from 'node:path';
import { home, ENGINE, readJSON, writeJSON, hashOf, exists, fail } from '../io.mjs';

export const MAX_DOC_BYTES = 200 * 1024;
export const BATCH_SIZE = 50;
export const studioDir = target => path.join(home(), '.studio', target);
export const studioConfigPath = () => path.join(ENGINE, 'studio.json');

export function studioConfig() {
  return readJSON(studioConfigPath(), { targets: {} });
}

/** Which Studio (staging, prod) a text is reviewed in. */
export function targetFor(slug, explicit) {
  const cfg = studioConfig();
  if (explicit) {
    if (!cfg.targets[explicit]) fail(`no Studio target "${explicit}" in translate/studio.json`);
    return explicit;
  }
  const hit = Object.entries(cfg.targets).find(([, t]) => (t.texts || []).includes(slug));
  if (!hit) fail(`no Studio lists "${slug}"; add it to a target's "texts" in translate/studio.json`);
  return hit[0];
}

export function writeOutbox(target, docs, { all = false, discard = false } = {}) {
  const dir = studioDir(target);
  const out = path.join(dir, 'out');
  // A new export replaces the last one's pending versions; if its batches were written, the ledger would fall behind the database.
  const unrecorded = Object.keys(readJSON(path.join(dir, 'pending.json'), {})).length;
  if (unrecorded && !discard) fail(`the last export's ${unrecorded} write(s) were never recorded: if its batches went in, run "studio seeded" first; if none did, export again with --discard`);
  fs.rmSync(out, { recursive: true, force: true });
  const ledger = readLedger(dir);
  const pending = {};
  const writes = [];
  for (const d of docs) {
    const key = `${d.collection}/${d.id}`;
    const body = JSON.stringify(d.data);
    if (Buffer.byteLength(body) > MAX_DOC_BYTES) fail(`${key} is ${Math.round(body.length / 1024)} KiB, over the ${MAX_DOC_BYTES / 1024} KiB budget`);
    const h = hashOf(d.data);
    const was = ledger[key];
    if (!all && was?.sha === h) continue;
    pending[key] = { sha: h, version: (was?.version || 0) + 1 };
    const file = path.join(out, d.collection, d.id + '.json');
    writeJSON(file, d.data);
    writes.push({ op: 'set', collection: d.collection, doc_id: d.id, file_path: file, ...(was ? { if_version: was.version } : {}) });
  }
  const batches = [];
  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const p = path.join(out, `batch-${String(batches.length + 1).padStart(3, '0')}.json`);
    writeJSON(p, { writes: writes.slice(i, i + BATCH_SIZE) });
    batches.push(p);
  }
  if (writes.length) writeJSON(path.join(dir, 'pending.json'), pending);
  else fs.rmSync(path.join(dir, 'pending.json'), { force: true });
  return { batches, count: writes.length, unchanged: docs.length - writes.length };
}

/** The ledger, upgrading entries written before versions were recorded (each had been set once). */
function readLedger(dir) {
  const raw = readJSON(path.join(dir, 'seeded.json'), {});
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, typeof v === 'string' ? { sha: v, version: 1 } : v]));
}

/** After every batch succeeded: remember what the Studio now holds. */
export function markSeeded(target) {
  const dir = studioDir(target);
  const pending = readJSON(path.join(dir, 'pending.json'), null);
  if (!pending) fail('nothing pending; run studio export first');
  const ledger = { ...readLedger(dir), ...pending };
  writeJSON(path.join(dir, 'seeded.json'), ledger);
  fs.rmSync(path.join(dir, 'pending.json'));
  return Object.keys(pending).length;
}

/** Documents pulled with ArtifactData list (out_dir): <inbox>/<collection>/<doc_id>.json */
export function readInbox(target, collection) {
  const dir = path.join(studioDir(target), 'inbox', collection);
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => {
    const raw = readJSON(path.join(dir, f));
    // Tolerate a wrapper ({id, version, data}) as well as the bare document.
    const doc = raw && typeof raw.data === 'object' && raw.data && raw.v === undefined ? raw.data : raw;
    return { id: f.replace(/\.json$/, ''), doc };
  });
}
