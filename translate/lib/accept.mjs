/**
 * accept: read the reviewer's sheet. Glossary decisions always apply. The
 * unit is approved only when every section says ok and every term it uses is
 * approved; otherwise redraft requests and notes go to feedback.json and the
 * next `draft` becomes a redraft.
 */

import { paths, readJSON, writeJSON, readText, fileSha, sha256, short, exists, fail, config, today, glossarySheetPath, rel } from './io.mjs';
import { loadText, loadUnit } from './text.mjs';
import { load, save } from './glossary.mjs';
import { Entry, EntryType, Policy } from '../schemas/glossary.mjs';
import { Approved } from '../schemas/approved.mjs';
import * as markup from './markup.mjs';
import { partOf } from './ids.mjs';
import { parseSheet, parseNoteLabel } from './review/parse.mjs';
import { decision, parseSymbolic, splitList } from './review/sheet.mjs';

const same = (a, b) => String(a || '').replace(/\s+/g, ' ').trim() === String(b || '').replace(/\s+/g, ' ').trim();

/** Apply glossary sections (### … · id) to the glossary in place. */
export function applyGlossary(g, sections, reviewer, date = today()) {
  const res = { approved: [], rejected: [], deferred: [], edited: [], problems: [] };
  for (const s of sections) {
    const e = g.entries.find(x => x.id === s.key);
    if (!e) { res.problems.push(`glossary: no entry "${s.key}"`); continue; }
    const L = s.labels;
    const before = JSON.stringify(e);
    try {
      if ('EN' in L && L.EN) e.en = L.EN;
      if ('Type' in L) e.type = EntryType.parse(L.Type.trim());
      if ('Policy' in L) e.policy = Policy.parse(L.Policy.trim());
      if ('Alt' in L) e.alt = splitList(L.Alt);
      if ('Variants' in L) e.variants = splitList(L.Variants);
      if ('Definition' in L) e.definition = L.Definition;
      if ('Symbolic' in L) e.symbolic = parseSymbolic(L.Symbolic, `glossary ${e.id}`);
      if ('Never in a line' in L) e.forbiddenInLine = splitList(L['Never in a line']);
    } catch (err) { res.problems.push(`glossary ${e.id}: ${err.message}`); continue; }
    if (JSON.stringify(e) !== before) res.edited.push(e.id);
    const d = decision(L.Decision, 'glossary');
    if (d === 'invalid') res.problems.push(`glossary ${e.id}: decision "${L.Decision}" is not approve, reject or defer`);
    else if (d === 'approve') {
      if (!e.definition.trim()) { res.problems.push(`glossary ${e.id}: needs a definition before approval`); continue; }
      // Re-applying the same decision must not re-date the entry.
      if (e.status !== 'approved') { e.status = 'approved'; e.provenance.approved = { by: reviewer, date }; res.approved.push(e.id); }
    } else if (d === 'reject') {
      if (e.status !== 'rejected') { e.status = 'rejected'; e.provenance.rejected = { by: reviewer, date }; res.rejected.push(e.id); }
    }
    else res.deferred.push(e.id);
    const r = Entry.safeParse(e);
    if (!r.success) res.problems.push(`glossary ${e.id}: ${r.error.issues[0].message}`);
  }
  return res;
}

/** The markdown review sheet: parse it, check it was written for the current draft, then accept. */
export function acceptSheet(slug, id, { dry = false } = {}) {
  const P = paths(slug);
  const sheetText = readText(P.sheet(id));
  const { header, sections, warnings } = parseSheet(sheetText);
  if (header.kind !== 'sheet' || header.unit !== id) fail(`${rel(P.sheet(id))} is not the sheet for ${id}`);
  return acceptSections(slug, id, {
    sections, warnings, via: 'sheet', date: today(),
    reviewed: { draftSha: header.draft, weaveSha: header.weave },
    reviewSha: sha256(sheetText).slice(0, 12),
    staleHint: `Copy your edits aside, then: review ${slug} ${id} --force`,
  }, { dry });
}

/**
 * The one acceptance path for both review channels (sheet and Studio).
 * `sections` use the sheet's shape: level-2 sections keyed by unit, group or
 * segment id with **Label:** values; level-3 sections are glossary entries.
 */
export function acceptSections(slug, id, { sections, warnings = [], reviewed, reviewSha, via = 'sheet', date = today(), staleHint = '' },
  { dry = false, g: sharedGlossary = null, saveGlossary = true } = {}) {
  const text = loadText(slug);
  const P = paths(slug);
  const reviewer = config().reviewer || fail('set "reviewer" in translate/config.json');
  const draft = readJSON(P.draft(id));
  const weave = readJSON(P.weave(id), null);
  const draftSha = short(fileSha(P.draft(id)));
  const weaveSha = weave ? short(fileSha(P.weave(id))) : 'none';
  if (reviewed.draftSha !== draftSha || reviewed.weaveSha !== weaveSha) {
    fail(`${id}: the review is stale (the draft or commentary changed after it was made). ${staleHint}`.trim());
  }
  const unit = loadUnit(slug, id);
  if (draft.provenance.sourceSha !== unit.sourceSha) fail(`${id}: the source changed after drafting; redraft first`);

  const g = sharedGlossary || load();
  const gloss = applyGlossary(g, sections.filter(s => s.level === 3), reviewer, date);
  const problems = [...gloss.problems];
  const byKey = new Map(sections.filter(s => s.level === 2).map(s => [s.key, s]));
  const status = {};   // section key -> ok | redraft | pending | invalid
  const edited = {};   // section key -> true when the reviewer changed its text
  const notesToNext = {};
  const need = key => {
    const s = byKey.get(key);
    if (!s) { problems.push(`section ${key} is missing from the sheet`); return { labels: {} }; }
    status[key] = decision(s.labels.Decision);
    if (status[key] === 'invalid') problems.push(`${key}: decision "${s.labels.Decision}" is not ok or redraft`);
    if (s.labels['Note to next draft']) notesToNext[key] = s.labels['Note to next draft'];
    return s;
  };

  // Song head
  const head = need(unit.id);
  const title = head.labels.Title ?? draft.title;
  const summary = head.labels.Summary ?? draft.summary;
  edited[unit.id] = !same(title, draft.title) || !same(summary, draft.summary);

  // Lines, grouped as on the sheet
  const lines = [];
  const noteLabels = [];
  const groups = [...new Set(unit.lines.filter(l => l.role !== 'lacuna').map(l => l.group))];
  for (const gid of groups) {
    const s = need(gid);
    for (const l of unit.lines.filter(x => x.group === gid)) {
      const d = draft.lines.find(x => x.id === l.id);
      const en = s.labels[`EN ${partOf(l.id)}`];
      if (en === undefined) problems.push(`${gid}: the **EN ${partOf(l.id)}:** line is missing`);
      if (en !== undefined && !same(en, d.en)) edited[gid] = true;
      lines.push({ id: l.id, en: en ?? d.en, gloss: d.gloss, translit: d.translit });
    }
    noteLabels.push([gid, s]);
  }
  noteLabels.unshift([unit.id, head]);

  // Notes: keep numbering; an emptied note is dropped; a new number is a new note on that section.
  const notes = [];
  const seen = new Set();
  for (const [key, s] of noteLabels) {
    for (const [label, value] of Object.entries(s.labels)) {
      const nl = parseNoteLabel(label);
      if (!nl) continue;
      seen.add(nl.n);
      const orig = draft.notes[nl.n - 1];
      if (orig && (!same(orig.text, value) || orig.kind !== nl.kind || orig.cites.join() !== nl.cites.join())) edited[key] = true;
      if (!orig) edited[key] = true;
      if (value.trim()) notes.push({ anchor: orig ? orig.anchor : key, kind: nl.kind, text: value.trim(), cites: nl.cites });
    }
  }
  draft.notes.forEach((n, i) => {
    if (!seen.has(i + 1)) {
      const key = unit.lines.find(l => l.id === n.anchor)?.group || n.anchor;
      if (byKey.has(key)) edited[key] = true;
    }
  });

  // Commentary segments
  const commentary = [];
  for (const us of unit.commentary) {
    const s = need(us.id);
    const w = weave?.segments.find(x => x.id === us.id);
    const translation = s.labels.Translation ?? w?.translation ?? '';
    const note = s.labels.Note ?? w?.note ?? '';
    if (w && (!same(translation, w.translation) || !same(note, w.note))) edited[us.id] = true;
    commentary.push({ id: us.id, anchor: us.anchor, translit: w?.translit || us.translit, translation, note, citations: w?.citations || [] });
  }

  // Markup and terms in the final text
  const approvedIds = new Set(g.entries.filter(e => e.status === 'approved').map(e => e.id));
  const knownIds = new Set(g.entries.filter(e => e.status !== 'rejected').map(e => e.id));
  const texts = [
    ...lines.map(l => [l.id, l.en]), ...notes.map(n => [`note on ${n.anchor}`, n.text]),
    ...commentary.flatMap(c => [[`${c.id} translation`, c.translation], [`${c.id} note`, c.note]]),
  ];
  const unapproved = new Set();
  for (const [where, s] of texts) {
    for (const p of markup.problems(s)) problems.push(`${where}: ${p}`);
    for (const t of markup.terms(s)) {
      if (!knownIds.has(t.id)) problems.push(`${where}: unknown or rejected term {${t.id}}`);
      else if (!approvedIds.has(t.id)) unapproved.add(t.id);
    }
  }

  const keys = Object.keys(status);
  const pending = keys.filter(k => status[k] === 'pending');
  const redraft = keys.filter(k => status[k] === 'redraft');
  const approvable = !problems.length && !pending.length && !redraft.length && !unapproved.size;
  const result = {
    unit: id, dry, approved: false, glossary: gloss, problems, warnings, pending, redraft,
    unapproved: [...unapproved], edited: Object.keys(edited).filter(k => edited[k]), sections: keys.length,
  };

  if (approvable) {
    const record = Approved.parse({
      unit: id, n: unit.n, title, summary, sourceSha: unit.sourceSha, lines, notes, commentary,
      provenance: {
        draft: draft.provenance, weave: weave?.provenance || null,
        review: {
          by: reviewer, date, via, sheetSha: reviewSha, draftSha, weaveSha,
          decisions: Object.fromEntries(keys.map(k => [k, edited[k] ? 'edited' : 'ok'])),
        },
      },
    });
    // The commentator's explicit glosses become grounded symbolic readings.
    const per = text.commentary?.author || 'the commentary';
    for (const w of weave?.segments || []) {
      for (const eq of w.equations) {
        const e = eq.term && g.entries.find(x => x.id === eq.term);
        if (!e) continue;
        if (!e.symbolic.readings.some(r => r.referent === eq.en && r.where.includes(w.id))) {
          e.symbolic.readings.push({ referent: eq.en, per, where: [w.id] });
        }
      }
    }
    result.approved = true;
    result.path = P.approvedFile(id);
    result.record = record;
    if (!dry) writeJSON(P.approvedFile(id), record);
  }

  if (!dry) {
    if (saveGlossary) save(g);
    const fb = readJSON(P.feedback, {});
    if (redraft.length || Object.keys(notesToNext).length) {
      fb[id] = { date, redraft, notes: notesToNext, edits: Object.fromEntries(lines.filter((l, i) => !same(l.en, draft.lines[i]?.en)).map(l => [l.id, l.en])) };
    } else if (result.approved) delete fb[id];
    writeJSON(P.feedback, fb);
  }
  return result;
}

export function acceptGlossarySheet(slug, { dry = false } = {}) {
  loadText(slug);
  const reviewer = config().reviewer || fail('set "reviewer" in translate/config.json');
  const p = glossarySheetPath(slug);
  if (!exists(p)) fail(`no glossary sheet; run: review ${slug} --glossary`);
  const { header, sections, warnings } = parseSheet(readText(p));
  if (header.kind !== 'glossary-sheet') fail(`${rel(p)} is not a glossary sheet`);
  const g = load();
  const gloss = applyGlossary(g, sections.filter(s => s.level === 3), reviewer, today());
  if (!dry && !gloss.problems.length) save(g);
  return { unit: 'glossary', dry, glossary: gloss, problems: gloss.problems, warnings, pending: [], redraft: [], unapproved: [], edited: [], approved: false, glossaryOnly: true };
}

export function report(r) {
  const out = [];
  const g = r.glossary;
  const gl = [g.approved.length && `approved ${g.approved.join(', ')}`, g.rejected.length && `rejected ${g.rejected.join(', ')}`,
    g.deferred.length && `deferred ${g.deferred.join(', ')}`, g.edited.length && `edited ${g.edited.join(', ')}`].filter(Boolean);
  if (r.glossaryOnly) out.push(`  glossary: ${gl.join('; ') || 'no changes'}${r.dry ? ' (dry run)' : ''}`);
  else if (r.approved) out.push(`  ${r.unit}: approved${r.dry ? ' (dry run)' : ' -> ' + rel(r.path)} · ${r.edited.length} of ${r.sections} sections edited`);
  else {
    out.push(`  ${r.unit}: not approved yet${r.dry ? ' (dry run)' : ''}`);
    if (r.pending.length) out.push(`    pending: ${r.pending.join(', ')}`);
    if (r.redraft.length) out.push(`    redraft: ${r.redraft.join(', ')}  (notes saved; the next \`draft\` will be a redraft)`);
    if (r.unapproved.length) out.push(`    terms still to approve: ${r.unapproved.join(', ')}`);
  }
  if (!r.glossaryOnly && gl.length) out.push(`    glossary: ${gl.join('; ')}`);
  for (const p of r.problems) out.push(`    ✗ ${p}`);
  for (const w of r.warnings) out.push(`    ! ${w}`);
  return out.join('\n');
}
