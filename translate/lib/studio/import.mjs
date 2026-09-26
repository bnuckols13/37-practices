/**
 * studio import: the reviewer's decisions, pulled from the Studio's database,
 * become the same sections and labels a review sheet parses to, and go
 * through the one acceptance path (acceptSections). The repo stays the record:
 * each imported decision is kept as review/<unit>.studio.json.
 */

import path from 'node:path';
import { paths, readJSON, writeJSON, readText, exists, hashOf, short, fail, config } from '../io.mjs';
import { loadText, unitsIndex } from '../text.mjs';
import { load, save } from '../glossary.mjs';
import { reviewModel } from '../review/model.mjs';
import { noteLabelText, isEdited } from '../review/sheet.mjs';
import { acceptSections, applyGlossary } from '../accept.mjs';
import { Decision, GlossaryDecision } from '../../schemas/studio.mjs';
import { entrySha, textDocs } from './docs.mjs';
import { readInbox, writeOutbox } from './outbox.mjs';

const flat = s => String(s ?? '').replace(/\s+/g, ' ').trim();

/** One Studio decision doc -> sheet-shaped sections for acceptSections. */
export function sectionsFromDecision(model, doc) {
  const warnings = [];
  const maxN = Math.max(model.notesCount, ...Object.values(doc.sections).flatMap(s => (s.notes || []).map(n => n.n)), 0);
  let nextN = maxN;
  const seenN = new Set();
  const out = [];
  for (const sec of model.sections) {
    if (sec.kind === 'lacuna') continue;
    const d = doc.sections[sec.part];
    const labels = { ...sec.labels };
    if (d) {
      if (sec.kind === 'head') {
        if (d.title !== undefined) labels.Title = flat(d.title);
        if (d.summary !== undefined) labels.Summary = flat(d.summary);
      }
      if (sec.kind === 'group' || sec.kind === 'heading') {
        for (const l of sec.lines) if (d.en?.[l.part] !== undefined) labels[`EN ${l.part}`] = flat(d.en[l.part]);
      }
      if (sec.kind === 'comment') {
        if (d.translation !== undefined) labels.Translation = flat(d.translation);
        if (d.note !== undefined) labels.Note = flat(d.note);
      }
      if (d.notes && sec.kind !== 'comment') {
        for (const k of Object.keys(labels)) if (/^Note \d+ ·/.test(k)) delete labels[k];
        for (const n of d.notes) {
          let num = n.n;
          if (seenN.has(num)) { num = ++nextN; warnings.push(`${sec.key}: note ${n.n} appeared twice; renumbered ${num}`); }
          seenN.add(num);
          if (flat(n.text)) labels[noteLabelText({ ...n, n: num })] = flat(n.text);
        }
      }
      labels.Decision = d.decision === 'ok' ? 'ok' : d.decision === 'redraft' ? 'redraft' : '';
      if (d.next !== undefined && flat(d.next)) labels['Note to next draft'] = flat(d.next);
    }
    if (sec.kind === 'head' && doc.answers.length) {
      const qa = doc.answers.filter(a => flat(a.a)).map(a => `Q: ${flat(a.q)} A: ${flat(a.a)}`).join(' ');
      if (qa) labels['Note to next draft'] = [labels['Note to next draft'], qa].filter(Boolean).join(' ');
    }
    out.push({ level: 2, key: sec.key, labels });
  }
  return { sections: out, warnings };
}

/** Glossary decisions -> sheet-shaped glossary sections, carrying only the fields the reviewer edited. */
export function glossarySections(gdocs, g) {
  const sections = [], skipped = [];
  const FIELD = { en: 'EN', type: 'Type', policy: 'Policy', alt: 'Alt', variants: 'Variants', definition: 'Definition', symbolic: 'Symbolic', never: 'Never in a line' };
  for (const gd of gdocs) {
    const e = g.entries.find(x => x.id === gd.id);
    if (!e) { skipped.push(`${gd.id}: no such glossary entry`); continue; }
    if (!gd.decision && !gd.edited.length) continue;
    if (gd.entrySha !== entrySha(e)) { skipped.push(`${gd.id}: the entry changed after you edited it; review it again in the Studio`); continue; }
    const labels = {};
    for (const f of gd.edited) {
      const v = gd.fields[f];
      if (v === undefined) continue;
      labels[FIELD[f]] = Array.isArray(v) ? v.join('; ') : String(v);
    }
    labels.Decision = gd.decision || '';
    sections.push({ level: 3, key: gd.id, labels, updatedAt: gd.updatedAt });
  }
  return { sections, skipped };
}

const parse = (schema, list, kind) => {
  const ok = [], bad = [];
  for (const { id, doc } of list) {
    const r = schema.safeParse(doc);
    if (r.success) ok.push(r.data);
    else bad.push(`${kind}/${id}: ${r.error.issues[0].path.join('.')} ${r.error.issues[0].message}`);
  }
  return { ok, bad };
};

export function importStudio(slug, { target, dry = false, units = null, force = false } = {}) {
  loadText(slug);
  const P = paths(slug);
  const reviewer = config().reviewer || fail('set "reviewer" in translate/config.json');
  const live = new Set(unitsIndex(slug).units.map(u => u.id));
  const report = { units: [], glossary: null, problems: [], receipts: [] };
  const now = new Date().toISOString();

  const decisions = parse(Decision, readInbox(target, 'decisions'), 'decisions');
  const gdecisions = parse(GlossaryDecision, readInbox(target, 'glossaryDecisions'), 'glossaryDecisions');
  report.problems.push(...decisions.bad, ...gdecisions.bad);

  // Glossary first, into one shared copy, so units see the new statuses.
  const g = load();
  const inText = gdecisions.ok.filter(d => g.entries.some(e => e.id === d.id && (!e.texts.length || e.texts.includes(slug))));
  const gs = glossarySections(inText, g);
  const latest = inText.reduce((m, d) => (d.updatedAt > m ? d.updatedAt : m), '');
  const gloss = applyGlossary(g, gs.sections, reviewer, (latest || now).slice(0, 10));
  report.glossary = { ...gloss, skipped: gs.skipped };
  report.receipts.push({ collection: 'receipts', id: 'glossary', data: {
    v: 1, subject: 'glossary', decisionUpdatedAt: latest, at: now, result: gloss.problems.length ? 'problems' : 'applied',
    pending: [], redraft: [], unapproved: [], problems: [...gloss.problems, ...gs.skipped],
  } });

  for (const doc of decisions.ok) {
    const id = doc.unit;
    if (!live.has(id) || (units && !units.includes(id))) continue;
    const entry = { unit: id, result: '', pending: [], redraft: [], unapproved: [], problems: [] };
    const receipt = extra => report.receipts.push({ collection: 'receipts', id, data: {
      v: 1, subject: id, decisionUpdatedAt: doc.updatedAt, at: now, pending: entry.pending, redraft: entry.redraft,
      unapproved: entry.unapproved, problems: entry.problems, ...extra,
    } });
    if (!doc.ready) { entry.result = 'not sent'; report.units.push(entry); continue; }
    const auditPath = path.join(P.review, `${id}.studio.json`);
    if (readJSON(auditPath, null)?.updatedAt === doc.updatedAt) { entry.result = 'already imported'; report.units.push(entry); continue; }
    if (!force && exists(P.sheet(id)) && isEdited(readText(P.sheet(id)))) {
      entry.result = 'skipped';
      entry.problems.push(`review/${id}.md has hand edits; one review channel per song (use --force to prefer the Studio)`);
      receipt({ result: 'problems' });
      report.units.push(entry);
      continue;
    }
    let res;
    try {
      const model = reviewModel(slug, id);
      const { sections, warnings } = sectionsFromDecision(model, doc);
      res = acceptSections(slug, id, {
        sections, warnings, via: 'studio', date: (doc.readyAt || doc.updatedAt).slice(0, 10),
        reviewed: { draftSha: doc.draftSha, weaveSha: doc.weaveSha },
        reviewSha: short(hashOf(doc)),
        staleHint: 'Claude has loaded a newer draft into the Studio; review that one.',
      }, { dry, g, saveGlossary: false });
    } catch (e) {
      if (!/stale/.test(e.message)) throw e;
      entry.result = 'stale';
      entry.problems.push(e.message);
      receipt({ result: 'stale' });
      report.units.push(entry);
      continue;
    }
    Object.assign(entry, { pending: res.pending, redraft: res.redraft, unapproved: res.unapproved, problems: [...res.problems, ...res.warnings] });
    entry.result = res.approved ? 'approved' : 'not approved';
    receipt({ result: res.approved ? 'approved' : res.problems.length ? 'problems' : 'not-approved' });
    if (!dry) writeJSON(auditPath, doc);
    report.units.push(entry);
  }

  if (!dry) {
    save(g);
    // Push back receipts plus whatever changed (approved stages, glossary statuses).
    const docs = [...textDocs(slug).filter(d => d.collection !== 'meta'), ...report.receipts,
      ...textDocs(slug).filter(d => d.collection === 'meta')];
    report.outbox = writeOutbox(target, docs);
  }
  return report;
}

export function importReport(r) {
  const out = [];
  const g = r.glossary;
  if (g) {
    const bits = [g.approved.length && `approved ${g.approved.join(', ')}`, g.rejected.length && `rejected ${g.rejected.join(', ')}`,
      g.edited.length && `edited ${g.edited.join(', ')}`].filter(Boolean);
    out.push(`  glossary: ${bits.join('; ') || 'no changes'}`);
    for (const s of g.skipped) out.push(`    ! ${s}`);
    for (const p of g.problems) out.push(`    ✗ ${p}`);
  }
  for (const u of r.units) {
    out.push(`  ${u.unit}: ${u.result}`);
    if (u.pending.length) out.push(`    pending: ${u.pending.join(', ')}`);
    if (u.redraft.length) out.push(`    redraft: ${u.redraft.join(', ')} (the next \`draft\` will address the notes)`);
    if (u.unapproved.length) out.push(`    terms still to approve: ${u.unapproved.join(', ')}`);
    for (const p of u.problems) out.push(`    ✗ ${p}`);
  }
  for (const p of r.problems) out.push(`  ✗ ${p}`);
  if (r.outbox) out.push(`  outbox: ${r.outbox.count} doc(s) to push in ${r.outbox.batches.length} batch(es)`);
  return out.join('\n');
}
