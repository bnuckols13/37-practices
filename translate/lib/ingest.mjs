/**
 * ingest: validate a drafter's answer (from the inbox, or from the API in
 * milestone 2) and file it with provenance. Both modes end here, so both are
 * held to the same schema and the same checks.
 */

import fs from 'node:fs';
import { paths, readJSON, writeJSON, exists, fail, today, config, rel } from './io.mjs';
import { loadText, loadUnit } from './text.mjs';
import { load, save, mergeProposal } from './glossary.mjs';
import { TASKS, commentaryOnly } from './pack.mjs';
import * as markup from './markup.mjs';

export function validateAnswer(task, out, unit, glossary) {
  const probs = [];
  const known = new Set(glossary.entries.filter(e => e.status !== 'rejected').map(e => e.id));
  for (const p of out.proposals || []) known.add(p.id);
  const unitIds = new Set([unit.id, ...unit.lines.flatMap(l => [l.id, l.group]), ...unit.commentary.map(s => s.id)]);
  const segIds = new Set(unit.commentary.map(s => s.id));
  const checkMarkup = (where, s) => {
    for (const p of markup.problems(s)) probs.push(`${where}: ${p}`);
    for (const t of markup.terms(s)) if (!known.has(t.id)) probs.push(`${where}: unknown term id {${t.id}} (not in the glossary or your proposals)`);
  };

  if (task === 'draft' || task === 'redraft') {
    const want = unit.lines.filter(l => l.role !== 'lacuna').map(l => l.id);
    const got = out.lines.map(l => l.id);
    if (want.join() !== got.join()) probs.push(`line ids must be exactly [${want.join(', ')}] in order; got [${got.join(', ')}]`);
    for (const l of out.lines) {
      if (!l.en.trim()) probs.push(`${l.id}: empty translation`);
      checkMarkup(l.id, l.en);
      for (const t of l.terms) if (!known.has(t.id)) probs.push(`${l.id}: terms[] names unknown id ${t.id}`);
    }
    for (const n of out.notes) {
      if (!unitIds.has(n.anchor)) probs.push(`note anchored to unknown id ${n.anchor}`);
      for (const c of n.cites) if (!segIds.has(c)) probs.push(`note on ${n.anchor} cites unknown segment ${c}`);
      checkMarkup(`note on ${n.anchor}`, n.text);
    }
    for (const t of out.termsOmitted) if (!unitIds.has(t.line)) probs.push(`termsOmitted names unknown line ${t.line}`);
  }
  if (task === 'weave') {
    const want = unit.commentary.map(s => s.id), got = out.segments.map(s => s.id);
    if (want.join() !== got.join()) probs.push(`segment ids must be exactly [${want.join(', ')}] in order; got [${got.join(', ')}]`);
    for (const s of out.segments) {
      if (!s.translation.trim()) probs.push(`${s.id}: empty translation`);
      checkMarkup(`${s.id} translation`, s.translation);
      checkMarkup(`${s.id} note`, s.note);
      if (s.note.split(/\s+/).filter(Boolean).length > 60) probs.push(`${s.id}: note is longer than 60 words`);
      for (const e of s.equations) if (e.term && !known.has(e.term)) probs.push(`${s.id}: equation names unknown term ${e.term}`);
    }
  }
  return probs;
}

export function ingest(slug, ids, { task = 'draft', model, mode = 'session', answers = null } = {}) {
  loadText(slug);
  if (!TASKS[task]) fail(`unknown task "${task}"`);
  const P = paths(slug);
  const cfg = config();
  const by = model || (mode === 'session' ? cfg.sessionModel || 'claude (session)' : fail('model is required'));
  const g = load();
  const feedback = readJSON(P.feedback, {});
  const results = [];

  for (const id of ids) {
    let t = task;
    if (!answers && t === 'draft' && !exists(P.inboxFile(t, id)) && exists(P.inboxFile('redraft', id))) t = 'redraft';
    const inbox = P.inboxFile(t, id);
    if (!answers && !exists(inbox)) { results.push({ unit: id, ok: false, reason: `no answer at ${rel(inbox)}` }); continue; }

    const raw = answers ? answers[id] : readJSON(inbox);
    const parsed = TASKS[t].schema.safeParse(raw);
    if (!parsed.success) {
      fail(`${id}: the answer does not match the ${t} schema:\n  `
        + parsed.error.issues.slice(0, 12).map(i => `${i.path.join('.') || '(root)'}: ${i.message}`).join('\n  '));
    }
    const out = parsed.data;
    if (out.unit !== id) fail(`${id}: the answer is for unit "${out.unit}"`);
    const unit = loadUnit(slug, id);
    const pack = readJSON(P.pack(t, id) + '.json', null);
    if (!pack) fail(`${id}: no ${t} pack on file; run pack first`);
    if (pack.sourceSha !== unit.sourceSha) fail(`${id}: the source changed after this pack was built; rebuild the pack and redraft`);
    const probs = validateAnswer(t, out, unit, g);
    if (probs.length) fail(`${id}: ${probs.length} problem(s) in the answer:\n  ` + probs.join('\n  '));

    const merged = out.proposals.map(p => mergeProposal(g, p, { slug, by }));
    const provenance = {
      mode, model: by, date: today(), packSha: pack.sha, prompts: pack.prompts,
      glossarySha: pack.glossarySha, sourceSha: unit.sourceSha,
    };
    let wrote = '';
    if (t === 'draft' || t === 'redraft') { wrote = P.draft(id); writeJSON(wrote, { ...out, provenance }); }
    if (t === 'weave') { wrote = P.weave(id); writeJSON(wrote, { ...out, provenance }); }
    if (t === 'terms') wrote = 'glossary';
    if (t === 'redraft' || (t === 'weave' && commentaryOnly(feedback[id]))) delete feedback[id];
    if (!answers) fs.unlinkSync(inbox);
    results.push({ unit: id, ok: true, task: t, wrote, proposals: merged.filter(m => m.added).map(m => m.added) });
  }
  save(g);
  writeJSON(P.feedback, feedback);
  return results;
}
