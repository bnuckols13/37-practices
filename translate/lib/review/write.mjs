/**
 * Review sheets: one markdown file per unit, commentary interleaved with the
 * passages it reads, then the glossary terms still to decide. The reviewer
 * edits only **Label:** lines; quoted (>) lines are reference and are ignored.
 */

import { paths, readText, writeText, exists, fileSha, short, fail, glossarySheetPath } from '../io.mjs';
import { loadText } from '../text.mjs';
import { load, scoped, scopeSha } from '../glossary.mjs';
import { withHeader, isEdited, quote, entryBlock, noteLabelText } from './sheet.mjs';
import { reviewModel } from './model.mjs';

export { termIdsUsed } from './model.mjs';

const INSTRUCTIONS = `Edit the text after **EN**, **Title**, **Summary**, **Note**, **Translation** and the glossary fields.
Set each **Decision** to ok or redraft (blank means not yet decided); glossary decisions are approve, reject or defer.
Keep [surface]{term-id} markup around glossary terms. Delete a note's text to drop it; add one as **Note 9 · imagery:** …
Quoted lines (>) are reference only and are ignored. When done: node translate/cli.mjs accept <text> <unit>`;

const noteLine = n => `**${noteLabelText(n)}:** ${n.text}`;

function segmentBlock(sec) {
  const ref = [sec.src, sec.translit];
  if (sec.equations.length) ref.push('Equations: ' + sec.equations.map(e => `${e.src} = ${e.en}${e.term ? ' (' + e.term + ')' : ''}`).join('; '));
  if (sec.citations.length) ref.push('Quotes: ' + sec.citations.map(c => `"${c.quoted}" (${c.work || 'unidentified'}${c.confident ? '' : ', unsure'})`).join('; '));
  for (const f of sec.flags) ref.push(`FLAG · ${f.kind} · ${f.level}: ${f.note}`);
  return [
    `## ${sec.who} on ${sec.label} · ${sec.key}`,
    quote(ref.filter(Boolean).join('\n')),
    `**Translation:** ${sec.labels.Translation}`,
    `**Note:** ${sec.labels.Note}`,
    `**Decision:**`,
  ].join('\n');
}

function groupBlock(sec) {
  const out = [sec.kind === 'heading' ? `## Heading · ${sec.key}` : `## ${sec.label} · ${sec.key}`];
  const tags = [sec.refrain && 'refrain', sec.bhanita && 'bhaṇitā: the poet names himself'].filter(Boolean);
  const ref = [];
  if (tags.length) ref.push(`(${tags.join('; ')})`);
  for (const l of sec.lines) {
    ref.push(`${l.src}   ${l.translit}`);
    if (l.drafterTranslit && l.drafterTranslit !== l.translit.replace(/\|+/g, '').trim()) ref.push(`drafter's transliteration: ${l.drafterTranslit}`);
    if (l.gloss) ref.push(`*${l.gloss}*`);
    if (l.emended.length) ref.push('emended: ' + l.emended.map(e => `${e.from} → ${e.to}${e.reason ? ' (' + e.reason + ')' : ''}`).join('; '));
  }
  out.push(quote(ref.join('\n')));
  for (const l of sec.lines) out.push(`**EN ${l.part}:** ${l.en}`);
  for (const n of sec.notes) out.push(noteLine(n));
  const flags = sec.lines.flatMap(l => l.flags.map(f => `FLAG ${l.part} · ${f.kind} · ${f.level}: ${f.note}`));
  if (flags.length) out.push(quote(flags.join('\n')));
  out.push('**Decision:**', '**Note to next draft:**');
  return out.join('\n');
}

/** The markdown sheet: a formatter over reviewModel. */
export function sheetBody(slug, id) {
  const m = reviewModel(slug, id);
  const { text, unit } = m;
  const [head, ...rest] = m.sections;
  const out = [
    `# ${text.unitLabel} ${unit.n}${m.poet ? ' · ' + m.poet : ''}${unit.raga ? ' · rāga ' + unit.raga : ''}`,
    '', INSTRUCTIONS, '',
    `## ${text.unitLabel} · ${unit.id}`,
    `**Title:** ${head.title}`,
    `**Summary:** ${head.summary}`,
    ...head.notes.map(noteLine),
  ];
  if (head.questions.length) out.push(quote(['Questions from the drafter:', ...head.questions.map(q => '- ' + q)].join('\n')));
  if (head.termsOmitted.length) out.push(quote('Terms left unmarked: ' + head.termsOmitted.map(t => `${t.id} in ${t.line} (${t.reason})`).join('; ')));
  out.push('**Decision:**', '**Note to next draft:**');

  for (const sec of rest) {
    out.push('');
    if (sec.kind === 'comment') out.push(segmentBlock(sec));
    else if (sec.kind === 'lacuna') out.push(`## Lacuna · ${sec.key}`, quote(`A gap in the witness${sec.note ? ': ' + sec.note : ''}. Nothing to translate.`));
    else out.push(groupBlock(sec));
  }

  if (m.termsToDecide.length) {
    out.push('', '## Glossary · terms to decide',
      quote('Approve, reject or defer each proposed term. A song can be approved only when every term it uses is approved.'));
    for (const { entry, usedIn } of m.termsToDecide) out.push('', entryBlock(entry, usedIn.length ? [`Used in: ${usedIn.join(', ')}`] : []));
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
