/**
 * A concordance for each glossary term: every place its source forms occur in
 * the text (verse lines and commentary), each shown in context in the source
 * script and transliteration, with the English of that line and the aligned
 * Tibetan; a tally of how the term has been rendered so far; and which Tibetan
 * word the Tibetan translators used for it. Derived data, rebuilt on every export.
 */

import { paths, readJSON } from './io.mjs';
import { loadText, unitsIndex, loadUnit } from './text.mjs';
import { load, scoped, matchSource } from './glossary.mjs';
import { partOf } from './ids.mjs';
import * as markup from './markup.mjs';
import { tibetanToWylie, wylieToTibetan, tibetanIndex } from './translit/tibetan.mjs';
import { transliterate } from './translit/index.mjs';

export const MAX_HITS = 80;   // per term, so a Studio document stays small
const WINDOW = 3;             // words of context on each side

const CONTEXT = 36;   // characters of context at most on each side
const LONGWORD = 16;  // a context word longer than this (a compound) is cut down
const INWORD = 14;    // characters of a long compound kept on each side of the form

// A long compound is cut down to the part around the form: "…ntarpitānanda|stimita…".
const clip = (s, n, fromEnd) => (s.length <= n ? s : fromEnd ? '…' + s.slice(s.length - n) : s.slice(0, n) + '…');
const clipWords = (s, n, fromEnd) => {
  if (s.length <= n) return s;
  const cut = fromEnd ? s.slice(s.length - n) : s.slice(0, n);
  const at = fromEnd ? cut.indexOf(' ') : cut.lastIndexOf(' ');
  return fromEnd ? '…' + (at > 0 ? cut.slice(at + 1) : cut) : (at > 0 ? cut.slice(0, at) : cut) + '…';
};

/**
 * The word containing `form` and WINDOW words either side (at most CONTEXT characters),
 * in the source and, word-aligned, the transliteration. When the form is part of a
 * longer word (an inflection or a compound), only the form is marked (`hit`) and
 * the rest of the word is kept, cut down, in `wordPre`/`wordPost`. `pos`, when given,
 * is where in the source the form was matched; `formTl` is the form's transliteration,
 * used to mark the same part of the transliterated word.
 */
export function kwic(src, translit, form, pos = -1, formTl = '') {
  const words = String(src).split(/\s+/).filter(Boolean);
  const at = pos >= 0
    ? String(src).slice(0, pos).split(/\s+/).filter(Boolean).length - (/\S$/.test(String(src).slice(0, pos)) ? 1 : 0)
    : words.findIndex(w => w.normalize('NFC').includes(form.normalize('NFC')));
  if (at < 0) return null;
  const tl = String(translit || '').split(/\s+/).filter(Boolean);
  const aligned = tl.length === words.length;
  const slice = (xs, a, b) => xs.slice(Math.max(0, a), Math.max(0, b)).join(' ');
  // Context outward from the hit, word by word: long compounds cut down, CONTEXT characters at most.
  const around = (xs, a, b, before) => {
    const ws = xs.slice(Math.max(0, a), Math.max(0, b));
    const out = [];
    let len = 0;
    for (const w of before ? ws.reverse() : ws) {
      const c = w.length > LONGWORD ? clip(w, LONGWORD, before) : w;
      if (out.length && len + c.length > CONTEXT) { out.push('…'); break; }
      out.push(c); len += c.length + 1;
      if (c !== w) break;
    }
    return (before ? out.reverse() : out).join(' ').replace(/… …/g, '…');
  };
  // Trailing punctuation (। ॥ | ,) belongs to the context, not the highlighted word.
  const split = w => { const m = /^(.*?)([।॥|,;.:]*)$/u.exec(w || ''); return [m[1], m[2]]; };
  const join = (tail, rest) => [tail, rest].filter(Boolean).join(tail && rest ? ' ' : '');
  // Bengali script does not tell b from v, so neither does the search in the transliteration.
  const key = x => x.normalize('NFC').toLowerCase().replace(/v/g, 'b');
  const inWord = (word, f) => {
    const i = f ? key(word).indexOf(key(f)) : -1;
    if (i < 0 || word.length === f.length) return null;
    return { wordPre: clip(word.slice(0, i), INWORD, true), hit: word.slice(i, i + f.length), wordPost: clip(word.slice(i + f.length), INWORD, false) };
  };
  const [word, tail] = split(words[at]);
  const w = inWord(word, form);
  const out = {
    pre: around(words, at - WINDOW, at, true),
    ...(w || { hit: word }),
    post: join(tail, around(words, at + 1, at + 1 + WINDOW, false)),
  };
  if (aligned) {
    const [tlWord, tlTail] = split(tl[at]);
    const t = inWord(tlWord, formTl);
    Object.assign(out, {
      tlPre: around(tl, at - WINDOW, at, true),
      ...(t ? { tlWordPre: t.wordPre, tlHit: t.hit, tlWordPost: t.wordPost } : { tlHit: w ? clip(tlWord, 2 * INWORD + form.length, false) : tlWord }),
      tlPost: join(tlTail, around(tl, at + 1, at + 1 + WINDOW, false)),
    });
  }
  out.within = !!w;   // the form is part of a longer word: an inflection or a compound
  out.cut = [at - WINDOW > 0 || out.pre.startsWith('…'), at + 1 + WINDOW < words.length || out.post.endsWith('…')];
  return out;
}

/** The sentence of an English translation in which a term is marked, with the term's surface. */
export function sentenceWith(translation, id) {
  const sentences = String(translation || '').split(/(?<=[.;:!?])\s+/);
  const s = sentences.find(x => markup.terms(x).some(t => t.id === id));
  if (!s) return null;
  const surface = markup.terms(s).find(t => t.id === id).surface;
  const plain = markup.strip(s);
  const i = plain.indexOf(surface);
  const LIM = 110;
  const text = plain.length <= 2 * LIM ? plain
    : (i > LIM ? '…' + plain.slice(i - LIM, i).replace(/^\S*\s/, '') : plain.slice(0, i)) + surface + clipWords(plain.slice(i + surface.length), LIM, false);
  return { en: text, surface };
}

/**
 * A Tibetan form in context. Tibetan has no spaces between words, so the context is
 * counted in syllables (split after each tsheg); `n` syllables each side, or all.
 */
export function kwicTibetan(src, form, n = 6, pos = -1) {
  const s = String(src).normalize('NFC'), f = form.normalize('NFC');
  const i = pos >= 0 ? pos : tibetanIndex(s, f);
  if (i < 0) return null;
  const pre = s.slice(0, i).split(/(?<=་)/u).filter(Boolean), post = s.slice(i + f.length).split(/(?<=་)/u).filter(Boolean);
  const a = pre.slice(Math.max(0, pre.length - n)).join(''), b = post.slice(0, n).join('');
  const wy = x => (x ? tibetanToWylie(x) : '');
  return { pre: a, hit: f, post: b, tlPre: wy(a), tlHit: wy(f), tlPost: wy(b), cut: [pre.length > n, post.length > n] };
}

/** The first parallel witness's text for a line or segment id, if any. */
function parallelFor(u, kind, id) {
  for (const [witness, p] of Object.entries(u.parallels || {})) if (p[kind][id]) return { witness, lang: p.lang, ...p[kind][id] };
  return null;
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
  const out = new Map(entries.map(e => [e.id, { id: e.id, hits: [], renderings: new Map(), total: 0, verse: 0, comm: 0, tibetan: { aligned: 0, forms: new Map() } }]));
  const byId = new Map(entries.map(e => [e.id, e]));
  // The Tibetan word for a term in an aligned passage: the longest of the entry's Tibetan
  // forms found there, tallied under its dictionary form so that pa and pa'i count together.
  // A word a drafter read at this very place counts here even when it is not a match form
  // (a reading such as sgra gcan, "Rāhu", for kāla in 1.1b).
  const tibetanIn = (e, par, at) => {
    const here = e.forms.filter(f => f.lang === 'bod' && f.where === at && f.script).map(f => f.script);
    const found = [...(e.match.bod || []), ...here].filter(f => tibetanIndex(par.src, f) >= 0).sort((a, b) => b.length - a.length)[0];
    if (!found) return null;
    const form = e.forms.find(f => f.lang === 'bod' && f.script === found);
    const key = form?.lemma || form?.translit || tibetanToWylie(found);
    return { script: found, key };
  };
  const commLang = text.lang.commentary;
  const scriptOf = wid => text.witnesses.find(w => w.id === wid)?.script || '';

  for (const u of units) {
    const r = readingOf(slug, u.id);
    const enOf = new Map(r.lines.map(l => [l.id, l.en]));
    const segEn = new Map(r.segments.map(sg => [sg.id, sg.translation]));
    const lineIds = new Set(u.lines.map(l => l.id));
    // Occurrences in the source: verse lines, then commentary segments.
    const sources = [
      ...u.lines.filter(l => l.role !== 'lacuna' && l.src).map(l => ({ kind: l.role === 'heading' ? 'heading' : 'verse', id: l.id, src: l.src, translit: l.translit, lang: l.lang, witness: l.witness })),
      ...u.commentary.map(c => ({ kind: 'comm', id: c.id, src: c.src, translit: c.translit, lang: c.lang || commLang, anchor: c.anchor, witness: c.witness })),
    ];
    for (const s of sources) {
      const par = parallelFor(u, s.kind === 'comm' ? 'commentary' : 'lines', s.id);
      for (const hit of matchSource(entries, s.src, s.lang)) {
        const c = out.get(hit.id);
        const k = s.lang === 'bod' ? kwicTibetan(s.src, hit.form, 6, hit.at)
          : kwic(s.src, s.translit, hit.form, hit.at, transliterate(hit.form, { lang: s.lang, script: scriptOf(s.witness) }));
        if (!c || !k) continue;
        c.total++; c[s.kind === 'comm' ? 'comm' : 'verse']++;
        // Which Tibetan word renders the term here, among the forms the glossary knows.
        const bw = par ? tibetanIn(byId.get(hit.id), par, s.id) : null;
        const boForm = bw?.script;
        if (par) {
          c.tibetan.aligned++;
          if (bw) {
            const row = c.tibetan.forms.get(bw.key) || c.tibetan.forms.set(bw.key, { script: wylieToTibetan(bw.key), wylie: bw.key, n: 0 }).get(bw.key);
            row.n++;
          }
        }
        if (c.hits.length >= MAX_HITS) continue;
        // The English: the verse line, or the sentence of the comment's translation that renders the term.
        let en = '', surface = '';
        if (s.kind !== 'comm' && enOf.has(s.id)) {
          en = markup.strip(enOf.get(s.id));
          surface = markup.terms(enOf.get(s.id)).find(t => t.id === hit.id)?.surface || '';
        } else if (s.kind === 'comm') {
          const found = sentenceWith(segEn.get(s.id), hit.id);
          if (found) ({ en, surface } = found);
        }
        // A verse line shows its whole Tibetan line; a comment only the Tibetan around a known form.
        const bo = !par ? null
          : s.kind !== 'comm' ? { witness: par.witness, src: par.src, translit: par.translit, ...(boForm ? { at: kwicTibetan(par.src, boForm, Infinity) } : {}) }
          : boForm ? { witness: par.witness, at: kwicTibetan(par.src, boForm) } : null;
        c.hits.push({
          unit: u.id, n: u.n, id: s.id, kind: s.kind, part: partOf(s.id),
          ...(s.kind === 'comm' ? { on: s.anchor === u.id ? '' : partOf(s.anchor) } : {}),
          lang: s.lang, ...k, ...(en ? { en } : {}), ...(surface ? { surface } : {}), ...(bo ? { bo } : {}),
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
  for (const c of out.values()) {
    c.renderings = [...c.renderings.values()].sort((a, b) => b.n - a.n || a.surface.localeCompare(b.surface));
    c.tibetan.forms = [...c.tibetan.forms.values()].sort((a, b) => b.n - a.n || a.wylie.localeCompare(b.wylie));
  }
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
