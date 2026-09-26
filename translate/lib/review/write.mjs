/**
 * Review sheets: one markdown file per unit, commentary interleaved with the
 * passages it reads, then the glossary terms still to decide. The reviewer
 * edits only **Label:** lines; quoted (>) lines are reference and are ignored.
 */

import { paths, readJSON, readText, writeText, exists, fileSha, short, fail, glossarySheetPath } from '../io.mjs';
import { loadText, loadUnit } from '../text.mjs';
import { load, byId, scoped, scopeSha } from '../glossary.mjs';
import { passageNo, partOf } from '../ids.mjs';
import * as markup from '../markup.mjs';
import { withHeader, isEdited, quote, entryBlock } from './sheet.mjs';

const INSTRUCTIONS = `Edit the text after **EN**, **Title**, **Summary**, **Note**, **Translation** and the glossary fields.
Set each **Decision** to ok or redraft (blank means not yet decided); glossary decisions are approve, reject or defer.
Keep [surface]{term-id} markup around glossary terms. Delete a note's text to drop it; add one as **Note 9 · imagery:** …
Quoted lines (>) are reference only and are ignored. When done: node translate/cli.mjs accept <text> <unit>`;

function noteLabel(n, i) {
  return `**Note ${i + 1} · ${n.kind}${n.cites.length ? ' · cites ' + n.cites.join(', ') : ''}:** ${n.text}`;
}

function flagLines(line) {
  return line.flags.map(f => `FLAG ${partOf(line.id)} · ${f.kind} · ${f.level}: ${f.note}`);
}

/** Groups in unit order: consecutive lines sharing a group id. */
function groupsOf(unit) {
  const out = [];
  for (const l of unit.lines) {
    const last = out[out.length - 1];
    if (last && last.id === l.group) last.lines.push(l);
    else out.push({ id: l.group, lines: [l] });
  }
  return out;
}

function segmentBlock(text, seg, useg, label) {
  const who = text.commentary?.author || 'Commentary';
  const ref = [useg.src, seg?.translit || useg.translit];
  if (seg?.equations.length) ref.push('Equations: ' + seg.equations.map(e => `${e.src} = ${e.en}${e.term ? ' (' + e.term + ')' : ''}`).join('; '));
  if (seg?.citations.length) ref.push('Quotes: ' + seg.citations.map(c => `"${c.quoted}" (${c.work || 'unidentified'}${c.confident ? '' : ', unsure'})`).join('; '));
  for (const f of seg?.flags || []) ref.push(`FLAG · ${f.kind} · ${f.level}: ${f.note}`);
  return [
    `## ${who} on ${label} · ${useg.id}`,
    quote(ref.filter(Boolean).join('\n')),
    `**Translation:** ${seg ? seg.translation : '(not woven yet: run weave)'}`,
    `**Note:** ${seg ? seg.note : ''}`,
    `**Decision:**`,
  ].join('\n');
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

export function sheetBody(slug, id) {
  const text = loadText(slug);
  const P = paths(slug);
  const unit = loadUnit(slug, id);
  const draft = readJSON(P.draft(id), null);
  if (!draft) fail(`${id}: no draft yet (draft, then ingest)`);
  const weave = readJSON(P.weave(id), null);
  if (unit.commentary.length && !weave) fail(`${id}: weave the commentary first (weave, then ingest --task weave)`);
  const g = load();
  const entries = byId(g);
  const dl = new Map(draft.lines.map(l => [l.id, l]));
  const ws = new Map((weave?.segments || []).map(s => [s.id, s]));
  const notesAt = anchorSet => draft.notes.map((n, i) => [n, i]).filter(([n]) => anchorSet.has(n.anchor));
  const segsAt = anchorSet => unit.commentary.filter(s => anchorSet.has(s.anchor));

  const poet = unit.poet && entries.get(unit.poet)?.en;
  const out = [
    `# ${text.unitLabel} ${unit.n}${poet ? ' · ' + poet : ''}${unit.raga ? ' · rāga ' + unit.raga : ''}`,
    '', INSTRUCTIONS, '',
    `## ${text.unitLabel} · ${unit.id}`,
    `**Title:** ${draft.title}`,
    `**Summary:** ${draft.summary}`,
    ...notesAt(new Set([unit.id])).map(([n, i]) => noteLabel(n, i)),
  ];
  if (draft.questions.length || weave?.questions.length) {
    out.push(quote(['Questions from the drafter:', ...[...draft.questions, ...(weave?.questions || [])].map(q => '- ' + q)].join('\n')));
  }
  if (draft.termsOmitted.length) out.push(quote('Terms left unmarked: ' + draft.termsOmitted.map(t => `${t.id} in ${t.line} (${t.reason})`).join('; ')));
  out.push('**Decision:**', '**Note to next draft:**');
  for (const s of segsAt(new Set([unit.id]))) out.push('', segmentBlock(text, ws.get(s.id), s, 'the whole ' + text.unitLabel.toLowerCase()));

  for (const grp of groupsOf(unit)) {
    const first = grp.lines[0];
    out.push('');
    if (first.role === 'lacuna') {
      out.push(`## Lacuna · ${grp.id}`, quote(`A gap in the witness${first.note ? ': ' + first.note : ''}. Nothing to translate.`));
      continue;
    }
    const tags = [first.refrain && 'refrain', first.bhanita && 'bhaṇitā: the poet names himself'].filter(Boolean);
    out.push(first.role === 'heading' ? `## Heading · ${grp.id}` : `## ${passageNo(grp.id)} · ${grp.id}`);
    const ref = [];
    if (tags.length) ref.push(`(${tags.join('; ')})`);
    for (const l of grp.lines) {
      const d = dl.get(l.id);
      ref.push(`${l.src}   ${l.translit}`);
      if (d?.translit && d.translit !== l.translit.replace(/\|+/g, '').trim()) ref.push(`drafter's transliteration: ${d.translit}`);
      if (d?.gloss) ref.push(`*${d.gloss}*`);
      if (l.emended) ref.push('emended: ' + l.emended.map(e => `${e.from} → ${e.to}${e.reason ? ' (' + e.reason + ')' : ''}`).join('; '));
    }
    out.push(quote(ref.join('\n')));
    for (const l of grp.lines) out.push(`**EN ${partOf(l.id)}:** ${dl.get(l.id)?.en ?? ''}`);
    const anchors = new Set([grp.id, ...grp.lines.map(l => l.id)]);
    for (const [n, i] of notesAt(anchors)) out.push(noteLabel(n, i));
    const flags = grp.lines.flatMap(l => (dl.get(l.id) ? flagLines(dl.get(l.id)) : []));
    if (flags.length) out.push(quote(flags.join('\n')));
    out.push('**Decision:**', '**Note to next draft:**');
    for (const s of segsAt(anchors)) out.push('', segmentBlock(text, ws.get(s.id), s, passageNo(grp.id)));
  }

  const used = termIdsUsed(draft, weave);
  const toDecide = [...used].map(tid => entries.get(tid)).filter(e => e && e.status === 'proposed');
  if (toDecide.length) {
    out.push('', '## Glossary · terms to decide',
      quote('Approve, reject or defer each proposed term. A song can be approved only when every term it uses is approved.'));
    for (const e of toDecide) {
      const where = draft.lines.filter(l => markup.terms(l.en).some(t => t.id === e.id)).map(l => l.id);
      out.push('', entryBlock(e, where.length ? [`Used in: ${where.join(', ')}`] : []));
    }
  }
  return out.join('\n') + '\n';
}

export function writeSheet(slug, id, { force = false } = {}) {
  const P = paths(slug);
  const p = P.sheet(id);
  if (exists(p) && !force && isEdited(readText(p))) return { skipped: 'hand-edited; accept it, or rerun with --force to overwrite', path: p };
  const body = sheetBody(slug, id);
  const draftSha = short(fileSha(P.draft(id)));
  const weaveSha = exists(P.weave(id)) ? short(fileSha(P.weave(id))) : 'none';
  writeText(p, withHeader('sheet', { text: slug, unit: id, draft: draftSha, weave: weaveSha }, body));
  return { path: p };
}

export function writeGlossarySheet(slug, { force = false } = {}) {
  loadText(slug);
  const p = glossarySheetPath(slug);
  if (exists(p) && !force && isEdited(readText(p))) fail(`${p} is hand-edited; accept it first, or rerun with --force`);
  const g = load();
  const proposed = scoped(g, slug).filter(e => e.status === 'proposed');
  if (!proposed.length) fail('no proposed terms to review');
  const body = [
    `# Glossary review · ${slug}`, '',
    'Edit any field. Set each **Decision** to approve, reject or defer. Only approved entries appear on published pages.',
    `When done: node translate/cli.mjs accept ${slug} --glossary`, '',
    ...proposed.map(e => entryBlock(e) + '\n'),
  ].join('\n');
  writeText(p, withHeader('glossary-sheet', { text: slug, glossary: short(scopeSha(g, slug)) }, body));
  return p;
}
