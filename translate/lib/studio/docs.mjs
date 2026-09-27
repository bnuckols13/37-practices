/**
 * The documents Claude writes into the Studio's database: one per unit (built
 * from the shared review model), one per glossary entry, one concordance per
 * term (read only when the reviewer opens that term), and one index per text
 * that drives the rail and the first-run checklist.
 */

import { paths, readJSON, readText, exists, hashOf, short, config } from '../io.mjs';
import { loadText, unitsIndex } from '../text.mjs';
import { load, scoped } from '../glossary.mjs';
import { reviewModel } from '../review/model.mjs';
import { formatSymbolic } from '../review/sheet.mjs';
import { partOf } from '../ids.mjs';
import * as markup from '../markup.mjs';
import { concordDocs } from '../concord.mjs';

/** What a glossary decision was made against: the reviewer-editable fields and status only. */
export function entrySha(e) {
  return short(hashOf({ en: e.en, type: e.type, policy: e.policy, alt: e.alt, variants: e.variants, definition: e.definition,
    symbolic: e.symbolic, forbiddenInLine: e.forbiddenInLine, status: e.status }));
}

export function unitDoc(slug, id) {
  const m = reviewModel(slug, id);
  const htmlLang = l => m.text.lang.html[l] || l;
  const [head] = m.sections;
  // The Tibetan (or any parallel) rides along for display. It is added after the
  // review model has hashed each section, so it never resets a decision.
  const pars = Object.entries(m.unit.parallels || {});
  const parOf = (kind, id) => pars.filter(([, p]) => p[kind][id]).map(([wid, p]) => ({ witness: wid, html: htmlLang(p.lang), ...p[kind][id] }));
  const sections = m.sections.map(sec => {
    const { labels, key, part, ...rest } = sec;
    const out = { part, id: key, ...rest };
    if (rest.lines) out.lines = rest.lines.map(l => ({ ...l, html: htmlLang(l.lang), par: parOf('lines', l.id) }));
    if (rest.kind === 'comment') {
      out.anchorPart = rest.anchorKey === m.unit.id ? 'head' : partOf(rest.anchorKey);
      out.par = parOf('commentary', key);
    }
    delete out.anchorKey;
    return out;
  });
  return {
    v: 1, text: slug, id, n: m.unit.n, poet: m.poet, poetId: m.unit.poet, raga: m.unit.raga,
    draftSha: m.draftSha, weaveSha: m.weaveSha, title: head.title, summary: head.summary,
    questions: head.questions, notesCount: m.notesCount,
    commentLang: htmlLang(m.text.lang.commentary || 'san'),
    termsToDecide: m.termsToDecide.map(t => t.entry.id),
    parallels: pars.map(([wid, p]) => ({ id: wid, lang: p.lang, name: m.text.lang.names[p.lang] || p.lang, label: m.text.witnesses.find(w => w.id === wid)?.label || wid })),
    sections,
  };
}

export function glossaryDoc(slug, e, usedIn = []) {
  return {
    v: 1, id: e.id, text: slug, status: e.status, type: e.type, en: e.en, policy: e.policy, alt: e.alt, variants: e.variants,
    definition: e.definition, symbolic: formatSymbolic(e.symbolic), forbiddenInLine: e.forbiddenInLine,
    forms: e.forms.map(f => ({ lang: f.lang, script: f.script, translit: f.translit, lemma: f.lemma || '', att: f.att, where: f.where })),
    usedIn, proposedBy: e.provenance.proposed?.by || '', entrySha: entrySha(e),
  };
}

/** Where each term is used across the drafted units of a text. */
export function termUsage(slug) {
  const P = paths(slug);
  const used = new Map();
  for (const u of unitsIndex(slug).units) {
    const d = readJSON(P.draft(u.id), null);
    if (!d) continue;
    for (const l of d.lines) for (const t of markup.terms(l.en)) (used.get(t.id) || used.set(t.id, []).get(t.id)).push(l.id);
  }
  return used;
}

export function metaDoc(slug) {
  const text = loadText(slug);
  const P = paths(slug);
  const g = load();
  const inScope = scoped(g, slug, { includeRejected: true });
  const byId = new Map(g.entries.map(e => [e.id, e]));
  const idx = unitsIndex(slug);
  const songs = idx.units.map(u => {
    const d = readJSON(P.draft(u.id), null);
    const w = readJSON(P.weave(u.id), null);
    const a = readJSON(P.approvedFile(u.id), null);
    const needsWeave = u.segments > 0 && !w;
    return {
      id: u.id, n: u.n, title: a?.title || d?.title || '', poet: byId.get(u.poet)?.en || '',
      stage: a ? 'approved' : d ? (needsWeave ? 'drafting' : 'in review') : 'not drafted',
      reviewable: !!d && !needsWeave, approved: !!a,
    };
  });
  const style = readText(P.style, '');
  const styleSet = /^\s*-\s+\S/m.test(style);
  const title = text.title.en;
  const checklist = [
    { id: 'source', label: 'Load the source text', done: idx.units.length > 0,
      prompt: `Import the next songs of ${title} into the engine (from Wikisource, or I'll paste the text).` },
    { id: 'glossary', label: 'Seed the glossary', done: inScope.length > 0,
      prompt: `Seed the glossary for ${title} from the songs loaded so far, and put the proposals in my Studio.` },
    { id: 'style', label: 'Set your style notes', done: styleSet,
      prompt: `Add this to my style notes for ${title}: …` },
    { id: 'draft', label: 'Draft the first song', done: songs.some(s => s.reviewable || s.approved),
      prompt: `Draft the next song of ${title} with its commentary and load it into my Studio.` },
    { id: 'review', label: 'Review a song and send it', done: songs.some(s => s.approved),
      prompt: `Pull my Studio decisions for ${title}.` },
  ];
  return {
    v: 1, slug, title, alt: text.title.alt, unitLabel: text.unitLabel, total: text.catalog.total || songs.length,
    lost: text.catalog.lost, partial: text.catalog.partial, reviewer: config().reviewer || '',
    commentary: text.commentary?.author || '', langNames: text.lang.names, htmlLangs: text.lang.html, style, songs, checklist,
    glossaryCount: inScope.length, toDecide: inScope.filter(e => e.status === 'proposed').length,
  };
}

/** Every document to seed for a text: glossary, units (drafted ones), concordances, then the index last. */
export function textDocs(slug) {
  const idx = unitsIndex(slug);
  const P = paths(slug);
  const usage = termUsage(slug);
  const docs = [];
  for (const e of scoped(load(), slug, { includeRejected: true })) {
    docs.push({ collection: 'glossary', id: e.id, data: glossaryDoc(slug, e, usage.get(e.id) || []) });
  }
  for (const u of idx.units) {
    if (!exists(P.draft(u.id))) continue;
    if (u.segments > 0 && !exists(P.weave(u.id))) continue;
    docs.push({ collection: 'units', id: u.id, data: unitDoc(slug, u.id) });
  }
  docs.push(...concordDocs(slug));
  docs.push({ collection: 'meta', id: `text-${slug}`, data: metaDoc(slug) });
  return docs;
}
