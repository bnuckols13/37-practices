// The Studio's actions: each takes the current decision (or glossary decision)
// document and returns the next one. Pure, so the tests can drive the exact
// code the page runs and feed the result to `studio import`.

import { emptyDecision, progress, edited, flat } from './model.mjs';

const TEXT_FIELDS = ['title', 'summary', 'translation', 'note', 'notes', 'en'];

function withSection(decision, unit, part, fn, now) {
  const doc = decision && decision.draftSha === unit.draftSha ? decision : emptyDecision(unit, now);
  const sec = unit.sections.find(s => s.part === part);
  if (!sec) throw new Error(`no section ${part} in ${unit.id}`);
  const prev = doc.sections[part] || { base: sec.base, decision: null };
  const nextSec = fn(prev, sec);
  const next = { ...doc, sections: { ...doc.sections, [part]: nextSec }, updatedAt: now };
  next.progress = progress(unit, next);
  return next;
}

/**
 * Edit a section's text. An edit to an approved section clears the approval:
 * an approval covers exactly the text that was approved.
 * change: {title} | {summary} | {translation} | {note} | {notes: [...]} | {en: {partOfLine: text}}
 * Returns {doc, cleared}.
 */
export function edit(decision, unit, part, change, now) {
  let cleared = false;
  const doc = withSection(decision, unit, part, (prev, sec) => {
    const next = { ...prev };
    for (const k of Object.keys(change)) {
      if (!TEXT_FIELDS.includes(k)) throw new Error(`not an editable field: ${k}`);
      next[k] = k === 'en' ? { ...(prev.en || {}), ...change.en } : change[k];
    }
    const textChanged = JSON.stringify(sectionText(prev, sec)) !== JSON.stringify(sectionText(next, sec));
    if (textChanged && prev.decision === 'ok') { next.decision = null; cleared = true; }
    return next;
  }, now);
  return { doc, cleared };
}

function sectionText(d, sec) {
  return {
    title: flat(d.title ?? sec.title), summary: flat(d.summary ?? sec.summary),
    translation: flat(d.translation ?? sec.translation), note: flat(d.note ?? sec.note),
    en: Object.fromEntries((sec.lines || []).map(l => [l.part, flat(d.en?.[l.part] ?? l.en)])),
    notes: (d.notes ?? sec.notes ?? []).map(n => [n.n, n.kind, flat(n.text), n.cites]),
  };
}

/** ok | redraft | null (undecided). */
export function decide(decision, unit, part, value, now) {
  if (![null, 'ok', 'redraft'].includes(value)) throw new Error(`bad decision ${value}`);
  return withSection(decision, unit, part, prev => ({ ...prev, decision: value }), now);
}

/** A note for the next draft; it never clears an approval. */
export function noteForNextDraft(decision, unit, part, text, now) {
  return withSection(decision, unit, part, prev => ({ ...prev, next: text }), now);
}

/** Put a line (or field) back to Claude's draft. */
export function revert(decision, unit, part, now) {
  return withSection(decision, unit, part, prev => ({ base: prev.base, decision: null, ...(prev.next ? { next: prev.next } : {}) }), now);
}

export function answer(decision, unit, question, text, now) {
  const doc = decision && decision.draftSha === unit.draftSha ? decision : emptyDecision(unit, now);
  const answers = doc.answers.filter(a => a.q !== question);
  if (flat(text)) answers.push({ q: question, a: text });
  return { ...doc, answers, updatedAt: now };
}

export function send(decision, unit, now, ready = true) {
  const doc = decision && decision.draftSha === unit.draftSha ? decision : emptyDecision(unit, now);
  return { ...doc, ready, readyAt: ready ? now : null, updatedAt: now, progress: progress(unit, doc) };
}

export { edited };

// Glossary ---------------------------------------------------------------

const FIELD_OF_ENTRY = {
  en: e => e.en, type: e => e.type, policy: e => e.policy, alt: e => e.alt, variants: e => e.variants,
  definition: e => e.definition, symbolic: e => e.symbolic, never: e => e.forbiddenInLine,
};
export const GLOSSARY_FIELDS = Object.keys(FIELD_OF_ENTRY);

function emptyGlossaryDecision(entry, now) {
  return { v: 1, id: entry.id, entrySha: entry.entrySha, updatedAt: now, decision: null, fields: {}, edited: [] };
}

const base = (gd, entry, now) => (gd && gd.entrySha === entry.entrySha ? gd : emptyGlossaryDecision(entry, now));

/** The value a glossary field shows now. */
export function glossaryValue(entry, gd, field) {
  return gd && gd.entrySha === entry.entrySha && gd.edited.includes(field) ? gd.fields[field] : FIELD_OF_ENTRY[field](entry);
}

/** Edit one field; editing after a decision clears it. Returns {doc, cleared}. */
export function glossaryEdit(gd, entry, field, value, now) {
  if (!GLOSSARY_FIELDS.includes(field)) throw new Error(`not a glossary field: ${field}`);
  const doc = base(gd, entry, now);
  const orig = FIELD_OF_ENTRY[field](entry);
  const same = JSON.stringify(Array.isArray(orig) ? orig : flat(orig)) === JSON.stringify(Array.isArray(value) ? value : flat(value));
  const editedFields = doc.edited.filter(f => f !== field);
  const fields = { ...doc.fields };
  if (same) delete fields[field]; else { fields[field] = value; editedFields.push(field); }
  const cleared = !!doc.decision && doc.decision !== 'defer';
  return { doc: { ...doc, fields, edited: editedFields, decision: cleared ? null : doc.decision, updatedAt: now }, cleared };
}

export function glossaryDecide(gd, entry, value, now) {
  if (![null, 'approve', 'reject', 'defer'].includes(value)) throw new Error(`bad glossary decision ${value}`);
  return { ...base(gd, entry, now), decision: value, updatedAt: now };
}

/** Is a term settled for this review (approved already, or approved here)? */
export function termDecided(entry, gd) {
  if (!entry) return true;
  if (entry.status === 'approved') return !(gd && gd.entrySha === entry.entrySha && gd.decision === 'reject');
  return !!(gd && gd.entrySha === entry.entrySha && gd.decision === 'approve');
}
