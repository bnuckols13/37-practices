/**
 * Versions: poems in English made from a song through a lens, in the
 * Workshop (or by hand, or in a session). Filed one per file under
 * texts/<text>/versions/<unit>/<id>.json. They never touch the accurate or the
 * sung English, and no review gate stands between a maker and the folder; the
 * reviewer chooses which ones the Reading Room shows (`versions keep`).
 */

import fs from 'node:fs';
import { paths, readJSON, writeJSON, exists, readText, promptPath, today, fail } from './io.mjs';
import { loadUnit, unitsIndex, loadText } from './text.mjs';
import { load, scoped } from './glossary.mjs';
import * as markup from './markup.mjs';
import { Version, VersionFiled } from '../schemas/version.mjs';
import { forbiddenHere } from './review/sung.mjs';

export function lenses() {
  return readJSON(promptPath('lenses.json')).lenses;
}

const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
export const slugify = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/** Every filed version of a unit, oldest first. */
export function listVersions(slug, id) {
  const dir = paths(slug).versionDir(id);
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
    .map(f => readJSON(`${dir}/${f}`)).sort((a, b) => (a.made || '').localeCompare(b.made || '') || a.id.localeCompare(b.id));
}

/**
 * What is wrong with a version (errors) and what a reviewer may want to know
 * (warnings). The rules a maker cannot break are the edition's: the song's
 * shape, its refrain, and no esoteric reading inside a line.
 */
export function validateVersion(slug, v, { filed = false } = {}) {
  const errors = [], warnings = [];
  const r = (filed ? VersionFiled : Version).safeParse(v);
  if (!r.success) return { errors: r.error.issues.map(i => `${i.path.join('.') || 'version'}: ${i.message}`), warnings };
  let unit;
  try { unit = loadUnit(slug, v.unit); } catch { return { errors: [`unknown unit ${v.unit}`], warnings }; }
  const verse = unit.lines.filter(l => l.role === 'line');
  const ids = verse.map(l => l.id);
  const got = v.lines.map(l => l.id);
  if (got.join() !== ids.join()) errors.push(`lines must be ${ids.join(', ')} in that order (got ${got.join(', ') || 'none'})`);
  const groups = [...new Set(verse.map(l => l.group))];
  const cs = v.couplets.map(c => c.group);
  if (cs.join() !== groups.join()) errors.push(`couplets must be ${groups.join(', ')} in that order (got ${cs.join(', ') || 'none'})`);
  const known = new Set(lenses().map(l => l.id).concat('own'));
  if (!known.has(v.lens)) errors.push(`unknown lens "${v.lens}" (one of ${[...known].join(', ')})`);
  const inScope = scoped(load(), slug);
  for (const l of v.lines) {
    if (!l.en.trim()) errors.push(`${l.id}: empty line`);
    if (markup.terms(l.en).length) errors.push(`${l.id}: versions are plain text; drop the glossary markup`);
    for (const f of forbiddenHere(inScope, unit, l)) errors.push(`${l.id}: "${f.word}" inside a line (${f.id} says: translate the image, put the reading in a note)`);
  }
  const refrain = verse.find(l => l.refrain);
  if (refrain && v.refrainCue.trim()) {
    const first = v.lines.find(l => l.id === refrain.id)?.en || '';
    if (!first.startsWith(v.refrainCue.trim().replace(/[…\s.]+$/, ''))) errors.push(`the refrain cue "${v.refrainCue}" is not the opening of the refrain ("${first}")`);
  }
  for (const c of v.couplets) {
    if (words(c.kept) > 40) warnings.push(`${c.group}: kept runs to ${words(c.kept)} words (40 or fewer)`);
    if (words(c.letGo) > 40) warnings.push(`${c.group}: let go runs to ${words(c.letGo)} words (40 or fewer)`);
  }
  if (v.latitude === 'close' && v.added.length) warnings.push(`a close version lists additions (${v.added.join('; ')}); call it free, or take them out`);
  if (filed && v.sourceSha !== unit.sourceSha) warnings.push(`made from an older text of ${v.unit} (the source changed since)`);
  return { errors, warnings };
}

/**
 * File versions handed over from the Workshop (one object or a list). Each
 * gets an id from its lens and title, made unique in its unit's folder.
 */
export function importVersions(slug, input, { by = '', via = 'workshop', dry = false } = {}) {
  loadText(slug);
  const P = paths(slug);
  const list = Array.isArray(input) ? input : Array.isArray(input?.versions) ? input.versions : [input];
  const out = [];
  for (const raw of list) {
    const maker = String(raw.by || by || '').trim();
    const body = Object.fromEntries(Object.keys(Version.shape).map(k => [k, raw[k]]));
    for (const [k, d] of Object.entries({ title: '', voice: '', refrainCue: '', added: [], note: '', latitude: 'close' })) if (body[k] === undefined) body[k] = d;
    const { errors, warnings } = validateVersion(slug, body);
    if (!maker) errors.push('who made it? give --by "<name>" (or a "by" field)');
    if (errors.length) { out.push({ unit: body.unit || '?', ok: false, errors, warnings }); continue; }
    const unit = loadUnit(slug, body.unit);
    const base = slugify(raw.id || `${body.lens}-${body.title || 'untitled'}`) || 'version';
    let id = base, n = 2;
    while (exists(P.version(unit.id, id)) && readJSON(P.version(unit.id, id)).made !== raw.made) id = `${base}-${n++}`;
    const filed = VersionFiled.parse({ ...body, id, by: maker, made: raw.made || today(), via: raw.via || via, sourceSha: unit.sourceSha, status: raw.status === 'kept' ? 'kept' : 'draft' });
    if (!dry) writeJSON(P.version(unit.id, id), filed);
    out.push({ unit: unit.id, ok: true, id, path: P.version(unit.id, id), warnings });
  }
  return out;
}

/** The reviewer's choice: show this version in the Reading Room (or stop showing it). */
export function keepVersion(slug, id, vid, { undo = false } = {}) {
  const P = paths(slug);
  const p = P.version(id, vid);
  if (!exists(p)) fail(`${id}: no version "${vid}" (see: versions list ${slug} ${id})`);
  const v = readJSON(p);
  const { errors } = validateVersion(slug, v, { filed: true });
  if (errors.length && !undo) fail(`${id}/${vid} cannot be kept: ${errors.join('; ')}`);
  writeJSON(p, { ...v, status: undo ? 'draft' : 'kept' });
  return { path: p, status: undo ? 'draft' : 'kept' };
}

/** Every unit that has versions, for `versions list` and the Workshop. */
export function allVersions(slug, ids = null) {
  const want = ids ? new Set(ids) : null;
  return unitsIndex(slug).units.filter(u => !want || want.has(u.id)).map(u => ({ unit: u.id, versions: listVersions(slug, u.id) })).filter(x => x.versions.length);
}

export const lensName = id => (lenses().find(l => l.id === id)?.name) || (id === 'own' ? 'own' : id);
export const lensAfter = id => lenses().find(l => l.id === id)?.after || '';

/** A Workshop hand-over: a JSON file, or - for stdin. */
export const readInput = file => JSON.parse(file === '-' ? fs.readFileSync(0, 'utf8') : readText(file));
