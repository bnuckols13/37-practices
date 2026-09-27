/**
 * Files, hashes, paths. Everything the engine knows lives in files under
 * HOME (texts/, glossary/); prompts live with the code in ENGINE/prompts.
 * HOME and SITE_ROOT are read from the environment on every call so tests
 * can point the engine at a scratch directory.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const home = () => path.resolve(process.env.TRANSLATE_HOME || ENGINE);
export const siteRoot = () => path.resolve(process.env.SITE_ROOT || path.join(ENGINE, '..'));

export class UserError extends Error {}
export const fail = msg => { throw new UserError(msg); };

export const nfc = s => String(s).normalize('NFC');
export const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
export const short = h => String(h || '').slice(0, 12);
export const today = () => new Date().toISOString().slice(0, 10);

// Canonical JSON (sorted keys) for hashing; files on disk keep insertion order.
export function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined)
      .map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}
export const hashOf = v => sha256(stable(v));

export const exists = p => fs.existsSync(p);

export function readText(p, fallback) {
  if (!fs.existsSync(p)) {
    if (fallback !== undefined) return fallback;
    fail(`missing file: ${rel(p)}`);
  }
  return fs.readFileSync(p, 'utf8');
}

export function writeText(p, s) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s, 'utf8');
}

export function readJSON(p, fallback) {
  const s = readText(p, fallback === undefined ? undefined : null);
  if (s === null) return fallback;
  try { return JSON.parse(s); } catch (e) { fail(`${rel(p)} is not valid JSON: ${e.message}`); }
}

export const toJSON = v => JSON.stringify(v, null, 2) + '\n';
export const writeJSON = (p, v) => writeText(p, toJSON(v));
export const fileSha = p => fs.existsSync(p) ? sha256(fs.readFileSync(p, 'utf8')) : '';

export function listFiles(dir, re = /./) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => re.test(f)).sort();
}

export const rel = p => path.relative(process.cwd(), p) || '.';

export const config = () => readJSON(path.join(ENGINE, 'config.json'), {});

/** Every path belonging to one text. */
export function paths(slug) {
  const dir = path.join(home(), 'texts', slug);
  return {
    dir,
    text: path.join(dir, 'text.json'),
    style: path.join(dir, 'style.md'),
    overrides: path.join(dir, 'translit.overrides.json'),
    feedback: path.join(dir, 'feedback.json'),
    source: path.join(dir, 'source'),
    raw: path.join(dir, 'source', 'raw'),
    manifest: path.join(dir, 'source', 'raw', 'manifest.json'),
    units: path.join(dir, 'units'),
    unitsIndex: path.join(dir, 'units', 'index.json'),
    packs: path.join(dir, 'packs'),
    inbox: path.join(dir, 'inbox'),
    drafts: path.join(dir, 'drafts'),
    commentary: path.join(dir, 'commentary'),
    review: path.join(dir, 'review'),
    approved: path.join(dir, 'approved'),
    unit: id => path.join(dir, 'units', id + '.json'),
    draft: id => path.join(dir, 'drafts', id + '.json'),
    weave: id => path.join(dir, 'commentary', id + '.json'),
    sheet: id => path.join(dir, 'review', id + '.md'),
    approvedFile: id => path.join(dir, 'approved', id + '.json'),
    pack: (task, id) => path.join(dir, 'packs', task, id),
    inboxFile: (task, id) => path.join(dir, 'inbox', task, id + '.json'),
    tibetanTerms: id => path.join(dir, 'tibetan', id + '.json'),   // terms-bo answers, as filed
    sung: id => path.join(dir, 'sung', id + '.json'),               // the unit sounded in English (sing)
    sungSheet: id => path.join(dir, 'review', id + '.sung.md'),
    approvedSung: id => path.join(dir, 'approved', id + '.sung.json'),
    versions: path.join(dir, 'versions'),                           // poems made from a song (the Workshop)
    versionDir: id => path.join(dir, 'versions', id),
    version: (id, vid) => path.join(dir, 'versions', id, vid + '.json'),
  };
}

export const glossaryPath = () => path.join(home(), 'glossary', 'glossary.json');
export const glossarySheetPath = slug => path.join(home(), 'glossary', 'review', slug + '.md');
export const promptPath = name => path.join(ENGINE, 'prompts', name);

/** Whitespace/NFC normalization used for integrity comparisons. */
export function normalizeLines(s) {
  return nfc(s).replace(/\r\n?/g, '\n').split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}
