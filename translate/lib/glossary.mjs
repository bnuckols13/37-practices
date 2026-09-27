/**
 * The cumulative glossary: one file, our own prose, shared across texts.
 * Proposed entries ride in drafting packs (so a proposal made in song 1 is
 * reused in song 2); only approved entries appear on published pages.
 */

import { glossaryPath, readJSON, writeJSON, hashOf, fail, today } from './io.mjs';
import { Glossary, Entry, Form } from '../schemas/glossary.mjs';
import { TERM_ID_RE } from './ids.mjs';
import { tibetanSpans } from './translit/tibetan.mjs';

export function load() {
  const r = Glossary.safeParse(readJSON(glossaryPath(), { entries: [] }));
  if (!r.success) fail(`glossary/glossary.json: ${r.error.issues.slice(0, 5).map(i => i.path.join('.') + ' ' + i.message).join('; ')}`);
  return r.data;
}

export function save(g) {
  const entries = g.entries.map(e => Entry.parse(e)).sort((a, b) => a.id.localeCompare(b.id));
  writeJSON(glossaryPath(), { entries });
}

export const byId = g => new Map(g.entries.map(e => [e.id, e]));

export function scoped(g, slug, { includeRejected = false } = {}) {
  return g.entries.filter(e => (!e.texts.length || e.texts.includes(slug)) && (includeRejected || e.status !== 'rejected'));
}

/** Hash of what a pack sees; changes whenever an in-scope entry changes. */
export const scopeSha = (g, slug) => hashOf(scoped(g, slug));

/** Every place a literal form stands in a text, as [start, end) spans. */
function spansOf(s, form, lang) {
  if (lang === 'bod') return tibetanSpans(s, form);
  const f = form.normalize('NFC'), out = [];
  for (let i = s.indexOf(f); i >= 0 && f; i = s.indexOf(f, i + 1)) out.push([i, i + f.length]);
  return out;
}

/**
 * Glossary hits in one source string: literal forms and regexes for its language.
 * The longest term wins: a form standing inside a longer form of another entry is
 * not a hit there (citta inside bodhicitta, vajra inside Hevajra, bhaga inside
 * bhagavatī), while the same form elsewhere in the string still is. Compounds are
 * kept: citta inside a compound no entry covers is still citta. Each hit gives
 * the form found and where (`at`, the first place it counts).
 */
// Shastri's folio numbers ([৫ক]) and the brackets of his restorations (স[মা]হিঅ) sit inside
// words; matching reads through them. `pos` maps an index in the cleaned text back to the source.
function readable(src) {
  const s = String(src).normalize('NFC');
  let text = '', pos = [];
  for (let i = 0; i < s.length;) {
    const folio = /^\[[০-৯0-9]+[কখ]?\]/u.exec(s.slice(i));
    if (folio) { i += folio[0].length; continue; }
    if (s[i] === '[' || s[i] === ']') { i++; continue; }
    text += s[i]; pos.push(i); i++;
  }
  pos.push(s.length);
  return { text, pos };
}

export function matchSource(entries, src, lang) {
  const { text: s, pos } = lang === 'bod' ? { text: String(src).normalize('NFC'), pos: null } : readable(src);
  const occ = [];
  for (const e of entries) {
    for (const f of e.match[lang] || []) if (f) for (const [a, b] of spansOf(s, f, lang)) occ.push({ id: e.id, form: f, a, b });
    for (const re of e.matchRe[lang] || []) {
      let r;
      try { r = new RegExp(re, 'gu'); } catch { continue; }
      for (const m of s.matchAll(r)) if (m[0]) occ.push({ id: e.id, form: m[0], a: m.index, b: m.index + m[0].length });
    }
  }
  const inside = o => occ.some(p => p.id !== o.id && p.a <= o.a && p.b >= o.b && p.b - p.a > o.b - o.a);
  const first = new Map();
  for (const o of occ) {
    if (inside(o)) continue;
    const cur = first.get(o.id);
    if (!cur || o.a < cur.a) first.set(o.id, o);
  }
  // In glossary order, as before; `at` is where the form starts in the source as given.
  return entries.filter(e => first.has(e.id)).map(e => { const o = first.get(e.id); return { id: e.id, form: o.form, at: pos ? pos[o.a] : o.a }; });
}

/** One compact line per entry, for packs and `glossary show`. */
export function compact(e) {
  const forms = e.forms.map(f => [f.lang, f.script, f.translit].filter(Boolean).join(' ') + (f.att ? ` (${f.att})` : '')).join('; ');
  const sym = e.symbolic.readings.length || e.symbolic.image
    ? ` | symbolic: ${e.symbolic.image || '—'} → ${e.symbolic.readings.map(r => `${r.referent} (per ${r.per}${r.where.length ? ', ' + r.where.join(',') : ''})`).join('; ') || 'unattested'}`
    : '';
  return `${e.id} [${e.type}, ${e.status}, ${e.policy}] EN "${e.en}"`
    + (e.variants.length ? ` variants: ${e.variants.join(', ')}` : '')
    + (forms ? ` | forms: ${forms}` : '')
    + (e.definition ? ` | def: ${e.definition}` : '')
    + sym
    + (e.forbiddenInLine.length ? ` | never inside a verse line: ${e.forbiddenInLine.join(', ')}` : '');
}

/** A drafter's proposal becomes a proposed entry (or enriches an existing one). */
export function mergeProposal(g, p, { slug, by }) {
  if (!TERM_ID_RE.test(p.id)) return { skipped: `bad id "${p.id}"` };
  const existing = g.entries.find(e => e.id === p.id);
  const match = {};
  for (const m of p.match) (match[m.lang] ||= []).includes(m.form) || match[m.lang].push(m.form);
  if (existing) {
    // Never overwrite a decided entry; only add new source forms and attestations.
    for (const [lang, forms] of Object.entries(match)) {
      const cur = existing.match[lang] ||= [];
      for (const f of forms) if (!cur.includes(f)) cur.push(f);
    }
    for (const f of p.forms) {
      if (!existing.forms.some(x => x.lang === f.lang && x.translit === f.translit && x.where === f.where)) existing.forms.push(f);
    }
    if (!existing.texts.length || existing.texts.includes(slug)) { /* shared or already scoped */ } else existing.texts.push(slug);
    return { enriched: p.id };
  }
  g.entries.push(Entry.parse({
    id: p.id, type: p.type, status: 'proposed', en: p.en, alt: p.alt, policy: p.policy,
    forms: p.forms, match, definition: p.definition,
    symbolic: { image: p.symbolicImage, readings: p.symbolicReadings },
    forbiddenInLine: p.forbiddenInLine, texts: [slug],
    provenance: { proposed: { by, date: today() } },
  }));
  return { added: p.id };
}

/**
 * A Tibetan equivalent read off an aligned line (the terms-bo task) joins the entry as a form
 * attested in another witness (AO). Only a clear equivalent also becomes a match form, so the
 * concordance counts it everywhere: a likely one is often a reading (the Tibetan's "moon" for
 * dhamaṇa), and matching it would claim every moon. Decided entries only gain forms.
 */
export function mergeTibetan(g, eq) {
  const e = g.entries.find(x => x.id === eq.id);
  if (!e) return { skipped: `unknown entry ${eq.id}` };
  const script = eq.script.normalize('NFC');
  const fresh = !e.forms.some(f => f.lang === 'bod' && f.script === script);
  if (fresh) e.forms.push(Form.parse({ lang: 'bod', script, translit: eq.wylie, lemma: eq.lemma || '', att: 'AO', where: eq.line }));
  if (eq.confidence === 'clear') {
    const m = e.match.bod ||= [];
    if (!m.includes(script)) m.push(script);
  }
  return fresh ? { added: `${eq.id}: ${eq.wylie}` } : { known: eq.id };
}

/** Structural problems in the glossary as a whole. */
export function lint(g) {
  const out = [];
  const seen = new Set();
  for (const e of g.entries) {
    if (seen.has(e.id)) out.push(`duplicate id ${e.id}`);
    seen.add(e.id);
    for (const re of Object.values(e.matchRe).flat()) {
      try { new RegExp(re, 'u'); } catch { out.push(`${e.id}: bad regex ${re}`); }
    }
    if (e.status === 'approved' && !e.definition) out.push(`${e.id}: approved without a definition`);
    if (e.definition.split(/\s+/).length > 60) out.push(`${e.id}: definition longer than 60 words`);
  }
  return out;
}
