// Pure review logic shared by the page and the tests: what a section's status
// is, what has been edited, how far a song is, and what to carry over when
// Claude loads a new draft. No DOM, no database.

export const flat = s => String(s ?? '').replace(/\s+/g, ' ').trim();
export const reviewable = sec => sec.kind !== 'lacuna';

export function emptyDecision(unit, now) {
  return { v: 1, unit: unit.id, draftSha: unit.draftSha, weaveSha: unit.weaveSha, updatedAt: now,
    ready: false, readyAt: null, answers: [], sections: {} };
}

/** The text a section shows now: the reviewer's edit if any, else Claude's draft. */
export function current(sec, d) {
  const out = { notes: d?.notes ?? sec.notes ?? [] };
  if (sec.kind === 'head') { out.title = d?.title ?? sec.title; out.summary = d?.summary ?? sec.summary; }
  if (sec.lines) out.en = Object.fromEntries(sec.lines.map(l => [l.part, d?.en?.[l.part] ?? l.en]));
  if (sec.kind === 'comment') { out.translation = d?.translation ?? sec.translation; out.note = d?.note ?? sec.note; }
  return out;
}

const sameNotes = (a, b) => JSON.stringify((a || []).map(n => [n.n, n.kind, flat(n.text), n.cites]))
  === JSON.stringify((b || []).map(n => [n.n, n.kind, flat(n.text), n.cites]));

export function edited(sec, d) {
  if (!d) return false;
  const c = current(sec, d);
  if (sec.kind === 'head' && (flat(c.title) !== flat(sec.title) || flat(c.summary) !== flat(sec.summary))) return true;
  if (sec.lines && sec.lines.some(l => flat(c.en[l.part]) !== flat(l.en))) return true;
  if (sec.kind === 'comment' && (flat(c.translation) !== flat(sec.translation) || flat(c.note) !== flat(sec.note))) return true;
  return sec.kind !== 'comment' && !sameNotes(c.notes, sec.notes);
}

/** draft | edited | approved | approved-edited | redraft */
export function statusOf(sec, d) {
  const e = edited(sec, d);
  if (d?.decision === 'ok') return e ? 'approved-edited' : 'approved';
  if (d?.decision === 'redraft') return 'redraft';
  return e ? 'edited' : 'draft';
}

export const STATUS_LABEL = {
  draft: 'Draft (Claude)', edited: 'Edited', approved: '✓ Approved',
  'approved-edited': '✓ Approved with your edits', redraft: '↺ Redraft requested',
};

export function progress(unit, decision) {
  const secs = unit.sections.filter(reviewable);
  let ok = 0, redraft = 0;
  for (const s of secs) {
    const d = decision?.sections?.[s.part];
    if (d?.decision === 'ok') ok++;
    else if (d?.decision === 'redraft') redraft++;
  }
  return { ok, redraft, total: secs.length };
}

/** Term ids a section uses (markup in its current text, plus source-side hits). */
export function termsIn(sec, d, termsOf) {
  const c = current(sec, d);
  const ids = new Set();
  const texts = [c.title, c.summary, c.translation, c.note, ...Object.values(c.en || {}), ...c.notes.map(n => n.text)];
  for (const t of texts) for (const x of termsOf(t || '')) ids.add(x.id);
  for (const l of sec.lines || []) for (const id of l.termHits || []) ids.add(id);
  return [...ids];
}

/** Does this section still need the reviewer's attention? */
export function needsAttention(sec, d, { termsOf, termDecided }) {
  if (!reviewable(sec)) return false;
  if (d?.decision !== 'ok') return true;
  return termsIn(sec, d, termsOf).some(id => !termDecided(id));
}

/**
 * Claude loaded a new draft: keep decisions and edits for sections whose draft
 * content (base) did not change; reset the rest and hand back what was reset.
 */
export function carryOver(unit, old, now) {
  const doc = emptyDecision(unit, now);
  const kept = [], reset = {};
  for (const sec of unit.sections.filter(reviewable)) {
    const prev = old?.sections?.[sec.part];
    if (!prev) continue;
    if (prev.base === sec.base) { doc.sections[sec.part] = prev; kept.push(sec.part); }
    else reset[sec.part] = prev;
  }
  doc.answers = old?.answers || [];
  doc.progress = progress(unit, doc);
  return { doc, kept, reset };
}
