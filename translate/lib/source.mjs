/**
 * Source files. A paste or download is kept byte-for-byte in source/raw/
 * (with its sha256 in the manifest). The working copy source/<witness>.txt
 * is the same text plus whole-line @directives; `check` proves that removing
 * the directives gives back the raw text, so nothing is edited silently.
 * Corrections go through @emend lines, which are recorded on the unit.
 */

import path from 'node:path';
import { paths, readJSON, writeJSON, readText, writeText, exists, sha256, nfc, normalizeLines, today, fail, rel } from './io.mjs';

export const isDirective = line => /^\s*@/.test(line);

export function manifest(slug) {
  return readJSON(paths(slug).manifest, { witnesses: {} });
}

export function importRaw(slug, text, witnessId, content, label = '') {
  const w = text.witnesses.find(x => x.id === witnessId);
  if (!w) fail(`unknown witness "${witnessId}"; add it to text.json first`);
  if (w.usage === 'reviewer-only') {
    fail(`${witnessId} is reviewer-only (copyrighted); keep it under translate/.private/, never in source/`);
  }
  if (!content.trim()) fail('nothing to import (empty input)');
  const P = paths(slug);
  const m = manifest(slug);
  const list = m.witnesses[witnessId] ||= [];
  const file = `${witnessId}-${String(list.length + 1).padStart(3, '0')}.txt`;
  writeText(path.join(P.raw, file), content);
  list.push({ file, sha256: sha256(content), bytes: Buffer.byteLength(content), date: today(), label });
  writeJSON(P.manifest, m);

  const marked = path.join(P.source, witnessId + '.txt');
  const prev = readText(marked, '');
  const sep = prev && !prev.endsWith('\n') ? '\n' : '';
  writeText(marked, prev + sep + `@-- imported ${file}${label ? ' · ' + label : ''}\n` + nfc(content).replace(/\r\n?/g, '\n') + (content.endsWith('\n') ? '' : '\n'));
  return { file, marked };
}

/** The marked working copies, in text.json witness order. */
export function markedSources(slug, text) {
  const P = paths(slug);
  const out = [];
  for (const w of text.witnesses) {
    const p = path.join(P.source, w.id + '.txt');
    if (!exists(p)) continue;
    if (w.usage === 'reviewer-only') fail(`${rel(p)}: reviewer-only witness text must not live in source/`);
    out.push({ witness: w, path: p, content: readText(p) });
  }
  return out;
}

/** Problems with source integrity: raw sha mismatches, or marked copy != raw minus directives. */
export function integrity(slug, text) {
  const P = paths(slug);
  const m = manifest(slug);
  const problems = [];
  for (const [wid, list] of Object.entries(m.witnesses)) {
    let raw = '';
    for (const e of list) {
      const p = path.join(P.raw, e.file);
      if (!exists(p)) { problems.push(`missing raw file source/raw/${e.file}`); continue; }
      const c = readText(p);
      if (sha256(c) !== e.sha256) problems.push(`source/raw/${e.file} changed since import (sha256 mismatch)`);
      raw += c + '\n';
    }
    const markedPath = path.join(P.source, wid + '.txt');
    if (!exists(markedPath)) { problems.push(`missing working copy source/${wid}.txt`); continue; }
    const stripped = readText(markedPath).split(/\r?\n/).filter(l => !isDirective(l)).join('\n');
    const a = normalizeLines(raw), b = normalizeLines(stripped);
    if (a !== b) {
      const al = a.split('\n'), bl = b.split('\n');
      let i = 0;
      while (i < al.length && al[i] === bl[i]) i++;
      problems.push(`source/${wid}.txt differs from its raw import at text line ${i + 1}: `
        + `raw "${(al[i] || '∅').slice(0, 60)}" vs working "${(bl[i] || '∅').slice(0, 60)}". Use @emend for corrections.`);
    }
  }
  for (const w of text.witnesses) {
    if (w.usage !== 'reviewer-only' && exists(path.join(P.source, w.id + '.txt')) && !m.witnesses[w.id]) {
      problems.push(`source/${w.id}.txt has no raw import in the manifest (use the import command)`);
    }
  }
  return problems;
}
