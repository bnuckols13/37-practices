/**
 * The cumulative glossary: one file, our own prose, shared across texts.
 * Proposed entries ride in drafting packs (so a proposal made in song 1 is
 * reused in song 2); only approved entries appear on published pages.
 */

import { glossaryPath, readJSON, writeJSON, hashOf, fail, today } from './io.mjs';
import { Glossary, Entry, Form } from '../schemas/glossary.mjs';
import { TERM_ID_RE } from './ids.mjs';
import { tibetanIndex } from './translit/tibetan.mjs';

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

/** Glossary hits in one source string: literal forms and regexes for its language. */
export function matchSource(entries, src, lang) {
  const hits = [];
  const s = String(src).normalize('NFC');
  const has = lang === 'bod' ? f => tibetanIndex(s, f) >= 0 : f => s.includes(f.normalize('NFC'));
  for (const e of entries) {
    const forms = (e.match[lang] || []).filter(f => f && has(f));
    for (const re of e.matchRe[lang] || []) {
      let m;
      try { m = s.match(new RegExp(re, 'u')); } catch { continue; }
      if (m) forms.push(m[0]);
    }
    if (forms.length) hits.push({ id: e.id, form: forms[0] });
  }
  return hits;
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
 * attested in another witness (AO), and as a match form so the concordance finds it.
 * Decided entries only gain forms, as with any proposal.
 */
export function mergeTibetan(g, eq) {
  const e = g.entries.find(x => x.id === eq.id);
  if (!e) return { skipped: `unknown entry ${eq.id}` };
  const script = eq.script.normalize('NFC');
  const fresh = !e.forms.some(f => f.lang === 'bod' && f.script === script);
  if (fresh) e.forms.push(Form.parse({ lang: 'bod', script, translit: eq.wylie, lemma: eq.lemma || '', att: 'AO', where: eq.line }));
  const m = e.match.bod ||= [];
  if (!m.includes(script)) m.push(script);
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
