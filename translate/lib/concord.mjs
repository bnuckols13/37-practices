/**
 * A concordance for each glossary term: every place its source forms occur in
 * the text (verse lines and commentary), each shown in context in the source
 * script and transliteration, with the English of that line; and a tally of how
 * the term has been rendered so far. Derived data, rebuilt on every export.
 */

import { paths, readJSON } from './io.mjs';
import { loadText, unitsIndex, loadUnit } from './text.mjs';
import { load, scoped, matchSource } from './glossary.mjs';
import { partOf } from './ids.mjs';
import * as markup from './markup.mjs';

export const MAX_HITS = 80;   // per term, so a Studio document stays small
const WINDOW = 3;             // words of context on each side

/** The word containing `form` and WINDOW words either side, in the source and (word-aligned) transliteration. */
export function kwic(src, translit, form) {
  const words = String(src).split(/\s+/).filter(Boolean);
  const at = words.findIndex(w => w.normalize('NFC').includes(form.normalize('NFC')));
  if (at < 0) return null;
  const tl = String(translit || '').split(/\s+/).filter(Boolean);
  const aligned = tl.length === words.length;
  const slice = (xs, a, b) => xs.slice(Math.max(0, a), Math.max(0, b)).join(' ');
  // Trailing punctuation (। ॥ | ,) belongs to the context, not the highlighted word.
  const split = w => { const m = /^(.*?)([।॥|,;.:]*)$/u.exec(w || ''); return [m[1], m[2]]; };
  const join = (tail, rest) => [tail, rest].filter(Boolean).join(tail && rest ? ' ' : '');
  const [hit, tail] = split(words[at]);
  const out = { pre: slice(words, at - WINDOW, at), hit, post: join(tail, slice(words, at + 1, at + 1 + WINDOW)) };
  if (aligned) {
    const [tlHit, tlTail] = split(tl[at]);
    Object.assign(out, { tlPre: slice(tl, at - WINDOW, at), tlHit, tlPost: join(tlTail, slice(tl, at + 1, at + 1 + WINDOW)) });
  }
  out.within = hit !== form;   // the form is part of a longer word: an inflection or a compound
  out.cut = [at - WINDOW > 0, at + 1 + WINDOW < words.length];
  return out;
}

/** The reading text of a unit: the approved record if there is one, else the draft and weave. */
function readingOf(slug, id) {
  const P = paths(slug);
  const a = readJSON(P.approvedFile(id), null);
  if (a) return { lines: a.lines, segments: a.commentary, notes: a.notes };
  const d = readJSON(P.draft(id), null);
  const w = readJSON(P.weave(id), null);
  return { lines: d?.lines || [], segments: w?.segments || [], notes: d?.notes || [] };
}

export function concordance(slug) {
  const text = loadText(slug);
  const entries = scoped(load(), slug, { includeRejected: false });
  const units = unitsIndex(slug).units.map(u => loadUnit(slug, u.id));
  const out = new Map(entries.map(e => [e.id, { id: e.id, hits: [], renderings: new Map(), total: 0, verse: 0, comm: 0 }]));
  const commLang = text.lang.commentary;

  for (const u of units) {
    const r = readingOf(slug, u.id);
    const enOf = new Map(r.lines.map(l => [l.id, l.en]));
    const lineIds = new Set(u.lines.map(l => l.id));
    // Occurrences in the source: verse lines, then commentary segments.
    const sources = [
      ...u.lines.filter(l => l.role !== 'lacuna' && l.src).map(l => ({ kind: l.role === 'heading' ? 'heading' : 'verse', id: l.id, src: l.src, translit: l.translit, lang: l.lang })),
      ...u.commentary.map(c => ({ kind: 'comm', id: c.id, src: c.src, translit: c.translit, lang: c.lang || commLang, anchor: c.anchor })),
    ];
    for (const s of sources) {
      for (const hit of matchSource(entries, s.src, s.lang)) {
        const c = out.get(hit.id);
        const k = kwic(s.src, s.translit, hit.form);
        if (!c || !k) continue;
        c.total++; c[s.kind === 'comm' ? 'comm' : 'verse']++;
        if (c.hits.length >= MAX_HITS) continue;
        const en = s.kind !== 'comm' && enOf.has(s.id) ? enOf.get(s.id) : '';
        const surface = en ? markup.terms(en).find(t => t.id === hit.id)?.surface || '' : '';
        c.hits.push({
          unit: u.id, n: u.n, id: s.id, kind: s.kind, part: partOf(s.id),
          ...(s.kind === 'comm' ? { on: s.anchor === u.id ? '' : partOf(s.anchor) } : {}),
          lang: s.lang, ...k, ...(en ? { en: markup.strip(en) } : {}), ...(surface ? { surface } : {}),
        });
      }
    }
    // Renderings: every [surface]{id} in the English of the verse, the notes and the commentary.
    const tally = (s, where) => {
      for (const t of markup.terms(s || '')) {
        const c = out.get(t.id); if (!c) continue;
        const key = t.surface;
        const row = c.renderings.get(key) || c.renderings.set(key, { surface: key, n: 0, verse: 0, comm: 0 }).get(key);
        row.n++; row[where]++;
      }
    };
    for (const l of r.lines) if (lineIds.has(l.id)) tally(l.en, 'verse');
    for (const sg of r.segments) { tally(sg.translation, 'comm'); tally(sg.note, 'comm'); }
    for (const n of r.notes) tally(n.text, 'comm');
  }
  for (const c of out.values()) c.renderings = [...c.renderings.values()].sort((a, b) => b.n - a.n || a.surface.localeCompare(b.surface));
  return out;
}

/** One Studio document per term that occurs or has been rendered. */
export function concordDocs(slug) {
  const docs = [];
  for (const c of concordance(slug).values()) {
    if (!c.total && !c.renderings.length) continue;
    docs.push({ collection: 'concord', id: c.id, data: { v: 1, text: slug, ...c, capped: c.total > c.hits.length } });
  }
  return docs;
}
