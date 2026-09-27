/** new · import · segment · status */

import fs from 'node:fs';
import path from 'node:path';
import { paths, readJSON, writeJSON, writeText, readText, exists, fileSha, fail, rel, short } from './io.mjs';
import { Text } from '../schemas/text.mjs';
import { loadText, unitsIndex, unitIds, loadUnit } from './text.mjs';
import { importRaw, markedSources, integrity } from './source.mjs';
import { segment as runSegment } from './segment/index.mjs';

export function newText(slug, { lang, rule = 'lines', title, prefix, label }) {
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) fail('give the new text a slug: lowercase letters, digits, hyphens');
  const P = paths(slug);
  if (exists(P.text)) fail(`texts/${slug} already exists`);
  if (!lang) fail('--lang is required (e.g. oben, san, bod, pli)');
  const text = Text.parse({
    slug,
    idPrefix: prefix || slug.replace(/[^a-z]/g, '').slice(0, 3) || 'tx',
    unitLabel: label || (rule === 'caryagiti' ? 'Song' : 'Section'),
    title: { en: title || slug },
    lang: { root: lang },
    segmentation: { rule },
    witnesses: [{ id: 'source', lang: [lang], citation: 'TODO: edition / source of the text', license: 'TODO', usage: 'prompt+publish' }],
    publish: { dir: `translations/${slug}`, license: 'TODO: licence for our translation' },
  });
  writeJSON(P.text, text);
  writeText(P.style, `# Style notes: ${text.title.en}\n\nStanding preferences for this text. They travel with every drafting pack.\n\n- \n`);
  return [rel(P.text), rel(P.style)];
}

export function importSource(slug, { witness, content, label }) {
  const text = loadText(slug);
  if (!witness) fail('--witness is required (an id from text.json witnesses)');
  const r = importRaw(slug, text, witness, content, label);
  return r;
}

export function segment(slug, { retire = false } = {}) {
  const text = loadText(slug);
  const P = paths(slug);
  const bad = integrity(slug, text);
  if (bad.length) fail('source integrity:\n  ' + bad.join('\n  '));
  const sources = markedSources(slug, text);
  if (!sources.length) fail(`no source text yet; use \`import ${slug} --witness <id> <file>\``);
  const overrides = readJSON(P.overrides, { words: {} }).words || {};
  const units = runSegment(text, sources, overrides);

  const prev = unitsIndex(slug);
  const ids = units.flatMap(u => [u.id, ...u.lines.map(l => l.id), ...u.commentary.map(s => s.id)]);
  const live = new Set(ids);
  const vanished = prev.ids.filter(id => !live.has(id) && !prev.tombstones.includes(id));
  if (vanished.length && !retire) {
    fail(`these ids would disappear: ${vanished.join(', ')}\n  ids are never renumbered; fix the source, or rerun with --retire to tombstone them`);
  }
  const tombstones = [...new Set([...prev.tombstones, ...vanished])].filter(id => !live.has(id)).sort();

  const changed = [], parallelChanged = [];
  for (const u of units) {
    const p = P.unit(u.id);
    const before = exists(p) ? readJSON(p) : {};
    writeJSON(p, u);
    if (before.sourceSha !== u.sourceSha) changed.push(u.id);
    else if ((before.parallelSha || '') !== (u.parallelSha || '')) parallelChanged.push(u.id);
  }
  for (const f of fs.existsSync(P.units) ? fs.readdirSync(P.units) : []) {
    const id = f.replace(/\.json$/, '');
    if (f !== 'index.json' && !units.some(u => u.id === id)) fs.unlinkSync(path.join(P.units, f));
  }
  writeJSON(P.unitsIndex, {
    text: slug,
    units: units.map(u => ({
      id: u.id, n: u.n, raga: u.raga, poet: u.poet, witnesses: u.witnesses,
      lines: u.lines.filter(l => l.role !== 'lacuna').length, segments: u.commentary.length, sourceSha: u.sourceSha,
      ...(u.parallels ? { parallels: Object.keys(u.parallels) } : {}),
    })),
    ids, tombstones,
  });
  return { units, changed, parallelChanged, vanished, warnings: units.warnings || [] };
}

/** Pipeline stage per unit, derived purely from the files. */
export function status(slug) {
  loadText(slug);
  const P = paths(slug);
  return unitIds(slug).map(id => {
    const u = loadUnit(slug, id);
    const draft = readJSON(P.draft(id), null);
    const weave = readJSON(P.weave(id), null);
    const approved = readJSON(P.approvedFile(id), null);
    const sheet = readText(P.sheet(id), '');
    const hdr = /<!-- translate:sheet [^>]*draft=(\w+)/.exec(sheet);
    const stale = [];
    if (draft && draft.provenance.sourceSha !== u.sourceSha) stale.push('draft');
    if (weave && weave.provenance.sourceSha !== u.sourceSha) stale.push('weave');
    if (approved && approved.sourceSha !== u.sourceSha) stale.push('approved');
    if (hdr && draft && hdr[1] !== short(fileSha(P.draft(id)))) stale.push('sheet');
    const stage = approved ? 'approved' : sheet ? 'in review' : draft ? (u.commentary.length && !weave ? 'drafted' : 'ready for review') : 'segmented';
    return {
      id, lines: u.lines.filter(l => l.role !== 'lacuna').length, segments: u.commentary.length,
      draft: !!draft, weave: !!weave, sheet: !!sheet, approved: !!approved, stage, stale,
    };
  });
}
