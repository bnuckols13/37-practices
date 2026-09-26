/**
 * The review model: one unit's draft and commentary as ordered sections,
 * each carrying the labels an unedited review sheet would have. The markdown
 * sheet and the Studio are two views of this one model, and both come back
 * through acceptSections, so the two review paths cannot drift apart.
 */

import { paths, readJSON, fileSha, short, hashOf, fail } from '../io.mjs';
import { loadText, loadUnit } from '../text.mjs';
import { load, byId, scoped, matchSource } from '../glossary.mjs';
import { passageNo, partOf } from '../ids.mjs';
import * as markup from '../markup.mjs';
import { noteLabelText } from './sheet.mjs';

/** Groups in unit order: consecutive lines sharing a group id. */
export function groupsOf(unit) {
  const out = [];
  for (const l of unit.lines) {
    const last = out[out.length - 1];
    if (last && last.id === l.group) last.lines.push(l);
    else out.push({ id: l.group, lines: [l] });
  }
  return out;
}

export function termIdsUsed(draft, weave) {
  const ids = new Set();
  for (const l of draft.lines) { markup.terms(l.en).forEach(t => ids.add(t.id)); l.terms.forEach(t => ids.add(t.id)); }
  for (const n of draft.notes) markup.terms(n.text).forEach(t => ids.add(t.id));
  for (const s of weave?.segments || []) {
    markup.terms(s.translation).forEach(t => ids.add(t.id));
    markup.terms(s.note).forEach(t => ids.add(t.id));
    s.equations.forEach(e => e.term && ids.add(e.term));
  }
  for (const p of [...draft.proposals, ...(weave?.proposals || [])]) ids.add(p.id);
  return ids;
}

const withBase = s => ({ ...s, base: short(hashOf({ ...s, labels: undefined })) });

export function reviewModel(slug, id) {
  const text = loadText(slug);
  const P = paths(slug);
  const unit = loadUnit(slug, id);
  const draft = readJSON(P.draft(id), null);
  if (!draft) fail(`${id}: no draft yet (draft, then ingest)`);
  const weave = readJSON(P.weave(id), null);
  if (unit.commentary.length && !weave) fail(`${id}: weave the commentary first (weave, then ingest --task weave)`);
  const g = load();
  const entries = byId(g);
  const inScope = scoped(g, slug);
  const dl = new Map(draft.lines.map(l => [l.id, l]));
  const ws = new Map((weave?.segments || []).map(s => [s.id, s]));
  const who = text.commentary?.author || 'Commentary';

  const notesAt = anchors => draft.notes.map((n, i) => ({ n: i + 1, ...n })).filter(n => anchors.has(n.anchor));
  const noteLabels = notes => Object.fromEntries(notes.map(n => [noteLabelText(n), n.text]));
  const comment = (us, label, anchorKey) => {
    const w = ws.get(us.id);
    return withBase({
      kind: 'comment', key: us.id, part: partOf(us.id), anchorKey, label, who,
      src: us.src, translit: w?.translit || us.translit, woven: !!w,
      translation: w ? w.translation : '', note: w ? w.note : '',
      equations: w?.equations || [], citations: w?.citations || [], flags: w?.flags || [],
      labels: { Translation: w ? w.translation : '(not woven yet: run weave)', Note: w ? w.note : '', Decision: '' },
    });
  };

  const sections = [];
  const headNotes = notesAt(new Set([unit.id]));
  sections.push(withBase({
    kind: 'head', key: unit.id, part: 'head', title: draft.title, summary: draft.summary, notes: headNotes,
    questions: [...draft.questions, ...(weave?.questions || [])], termsOmitted: draft.termsOmitted,
    labels: { Title: draft.title, Summary: draft.summary, ...noteLabels(headNotes), Decision: '', 'Note to next draft': '' },
  }));
  for (const s of unit.commentary.filter(c => c.anchor === unit.id)) {
    sections.push(comment(s, 'the whole ' + text.unitLabel.toLowerCase(), unit.id));
  }

  for (const grp of groupsOf(unit)) {
    const first = grp.lines[0];
    if (first.role === 'lacuna') {
      sections.push({ kind: 'lacuna', key: grp.id, part: partOf(grp.id), note: first.note || '', labels: {} });
      continue;
    }
    const anchors = new Set([grp.id, ...grp.lines.map(l => l.id)]);
    const notes = notesAt(anchors);
    const lines = grp.lines.map(l => {
      const d = dl.get(l.id);
      return {
        id: l.id, part: partOf(l.id), lang: l.lang, witness: l.witness, src: l.src, translit: l.translit,
        drafterTranslit: d?.translit || '', gloss: d?.gloss || '', en: d?.en ?? '', flags: d?.flags || [],
        emended: l.emended || [], termHits: matchSource(inScope, l.src, l.lang).map(h => h.id),
      };
    });
    sections.push(withBase({
      kind: first.role === 'heading' ? 'heading' : 'group', key: grp.id, part: partOf(grp.id),
      label: first.role === 'heading' ? 'Heading' : passageNo(grp.id),
      refrain: !!first.refrain, bhanita: !!first.bhanita, lines, notes,
      labels: {
        ...Object.fromEntries(lines.map(l => [`EN ${l.part}`, l.en])),
        ...noteLabels(notes), Decision: '', 'Note to next draft': '',
      },
    }));
    for (const s of unit.commentary.filter(c => anchors.has(c.anchor))) sections.push(comment(s, passageNo(grp.id), grp.id));
  }

  const used = termIdsUsed(draft, weave);
  const termsToDecide = [...used].map(tid => entries.get(tid)).filter(e => e && e.status === 'proposed')
    .map(e => ({ entry: e, usedIn: draft.lines.filter(l => markup.terms(l.en).some(t => t.id === e.id)).map(l => l.id) }));

  return {
    text, unit, draft, weave, entries, sections, termsToDecide,
    poet: (unit.poet && entries.get(unit.poet)?.en) || '',
    draftSha: short(fileSha(P.draft(id))),
    weaveSha: weave ? short(fileSha(P.weave(id))) : 'none',
    notesCount: draft.notes.length,
  };
}
