/**
 * Context packs: everything the drafter sees for one unit and one task.
 * Deterministic (no dates), so the same inputs give the same sha. The same
 * blocks feed both modes:
 *   session  packs/<task>/<unit>.md  -> a fresh subagent writes inbox/<task>/<unit>.json
 *   api      packs/<task>/<unit>.json -> Messages API, cache breakpoints on blocks 1-3 (milestone 2)
 */

import { z } from 'zod';
import { paths, readJSON, readText, writeText, writeJSON, hashOf, exists, fail, fileSha, short } from './io.mjs';
import { loadText, loadUnit, witnessOf, unitIds } from './text.mjs';
import { load, scoped, scopeSha, compact, matchSource } from './glossary.mjs';
import { loadPrompt, textPrompt } from './prompts.mjs';
import { partOf } from './ids.mjs';

/** A redraft asked only on commentary rows is a new weave, not a new draft of the song. */
export const commentaryOnly = fb => !!fb?.redraft?.length && fb.redraft.every(k => /^m\d+$/.test(partOf(k)));
import { Draft, TermsResult, TibetanTerms } from '../schemas/draft.mjs';
import { Weave } from '../schemas/weave.mjs';
import { Sung } from '../schemas/sung.mjs';
import { soundProfile, profileText } from './sound.mjs';
import { sourceBoard, readingText, markedWords } from './reading.mjs';

/** Feedback on a sung version is kept apart from feedback on the translation. */
export const sungKey = id => id + '#sung';

export const TASKS = {
  draft: { prompt: 'tasks/draft.md', schema: Draft, out: 'drafts' },
  redraft: { prompt: 'tasks/redraft.md', schema: Draft, out: 'drafts' },
  weave: { prompt: 'tasks/weave.md', schema: Weave, out: 'commentary' },
  terms: { prompt: 'tasks/terms.md', schema: TermsResult, out: 'glossary' },
  'terms-bo': { prompt: 'tasks/terms-bo.md', schema: TibetanTerms, out: 'glossary' },
  sing: { prompt: 'tasks/sing.md', schema: Sung, out: 'sung' },
};

/** The accurate English a sung version is made from: the approved text if current, else the draft. */
export function accurateEnglish(slug, unit) {
  const P = paths(slug);
  const a = readJSON(P.approvedFile(unit.id), null);
  const d = readJSON(P.draft(unit.id), null);
  if (!d && !a) fail(`${unit.id}: translate the unit before singing it (draft, then ingest)`);
  const flags = new Map((d?.lines || []).map(l => [l.id, l.flags]));
  const lines = a && a.sourceSha === unit.sourceSha ? a.lines : d.lines;
  return { from: a && a.sourceSha === unit.sourceSha ? 'approved' : 'draft', lines: lines.map(l => ({ ...l, flags: flags.get(l.id) || [] })) };
}

export const jsonSchema = task => z.toJSONSchema(TASKS[task].schema);

const fence = (lang, s) => '```' + lang + '\n' + s + '\n```';

function textFacts(text) {
  const usable = text.witnesses.filter(w => w.usage === 'prompt+publish');
  const names = text.lang.names;
  return [
    `## This text: ${text.title.en}`,
    text.description,
    `Root language: ${names[text.lang.root] || text.lang.root}` + (text.lang.commentary ? `; commentary language: ${names[text.lang.commentary] || text.lang.commentary}` : ''),
    text.commentary ? `Commentary: ${text.commentary.title} by ${text.commentary.author}.` : '',
    'Witnesses you may work from:',
    ...usable.map(w => `- ${w.id}: ${w.citation}`),
  ].filter(Boolean).join('\n');
}

function exemplar(slug, text, currentId) {
  const P = paths(slug);
  for (const id of text.exemplars) {
    if (id === currentId || !exists(P.approvedFile(id))) continue;
    const a = readJSON(P.approvedFile(id));
    const u = loadUnit(slug, id);
    const src = new Map(u.lines.map(l => [l.id, l]));
    return `## Exemplar: approved unit ${id} (a style reference, not something to copy)\n`
      + a.lines.map(l => `${l.id}  ${src.get(l.id)?.src || ''}\n       ${l.translit}\n    →  ${l.en}`).join('\n');
  }
  return '';
}

/** A parallel witness's text for one id, keyed by witness: { toh2293: { lang, src, translit } }. */
export function parallelOf(unit, kind, id) {
  const out = {};
  for (const [wid, p] of Object.entries(unit.parallels || {})) if (p[kind][id]) out[wid] = { lang: p.lang, ...p[kind][id] };
  return Object.keys(out).length ? out : undefined;
}

function unitJSON(unit) {
  return JSON.stringify({
    id: unit.id, n: unit.n, title: unit.title || undefined, raga: unit.raga || undefined, poet: unit.poet || undefined,
    lines: unit.lines.map(l => ({
      id: l.id, role: l.role, couplet: l.couplet, refrain: l.refrain, bhanita: l.bhanita,
      lang: l.lang, witness: l.witness, src: l.src || undefined, translit: l.translit || undefined, note: l.note,
      emended: l.emended, parallel: parallelOf(unit, 'lines', l.id),
    })),
    commentary: unit.commentary.map(s => ({ id: s.id, anchor: s.anchor, lang: s.lang, witness: s.witness, src: s.src, translit: s.translit, parallel: parallelOf(unit, 'commentary', s.id) })),
  }, null, 2);
}

/** For terms-bo: each glossary hit, with the aligned Tibetan it should be read off. */
function tibetanHits(unit, entries) {
  const rows = [];
  const items = [
    ...unit.lines.filter(l => l.role !== 'lacuna').map(l => ({ ...l, kind: 'lines' })),
    ...unit.commentary.map(s => ({ ...s, kind: 'commentary' })),
  ];
  for (const it of items) {
    const par = parallelOf(unit, it.kind, it.id);
    if (!par) continue;
    const hits = matchSource(entries, it.src, it.lang);
    if (!hits.length) continue;
    const [wid, t] = Object.entries(par)[0];
    const already = entries.filter(e => hits.some(h => h.id === e.id) && (e.match.bod || []).some(f => t.src.includes(f)));
    rows.push(`- ${it.id}: ${hits.map(h => `${h.id} (${h.form})`).join(', ')}`
      + (already.length ? `  [already matched in the Tibetan: ${already.map(e => e.id).join(', ')}]` : '')
      + `\n    ${wid}: ${it.kind === 'lines' ? t.src + '\n    ' + t.translit : t.translit.length > 400 ? '(see the unit JSON; long)' : t.translit}`);
  }
  return rows.join('\n') || '(no glossary term occurs in a line or segment that has Tibetan)';
}

function hitsBlock(entries, items) {
  const rows = [];
  for (const it of items) {
    const h = matchSource(entries, it.src, it.lang);
    if (h.length) rows.push(`- ${it.id}: ${h.map(x => `${x.id} (${x.form})`).join(', ')}`);
  }
  return rows.length ? rows.join('\n') : '(none detected)';
}

function candidates(slug, unit, entries) {
  // Words, without punctuation, dashes or folio marks ([৫ক]); ধ্রু is the refrain cue, not a word of the song.
  const STOP = new Set(['ধ্রু']);
  const tok = s => s.normalize('NFC').replace(/\[[০-৯0-9]+[কখ]?\]/gu, '').split(/[\s—–-]+/)
    .map(t => t.replace(/[।॥|,;:.!?()\[\]'"“”‘’\d০-৯]+/gu, '')).filter(t => [...t].length > 2 && !STOP.has(t));
  const known = new Set(entries.flatMap(e => Object.values(e.match).flat()));
  const here = new Map(), all = new Map();
  const add = (m, t) => m.set(t, (m.get(t) || 0) + 1);
  for (const x of [...unit.lines, ...unit.commentary]) for (const t of tok(x.src)) add(here, t);
  for (const id of unitIds(slug)) {
    const u = loadUnit(slug, id);
    for (const x of [...u.lines, ...u.commentary]) for (const t of tok(x.src)) add(all, t);
  }
  const rows = [...here.keys()].filter(t => !known.has(t))
    .sort((a, b) => (all.get(b) - all.get(a)) || a.localeCompare(b)).slice(0, 60)
    .map(t => `- ${t}  (${here.get(t)} here, ${all.get(t)} in the text so far)`);
  return rows.join('\n') || '(no candidates)';
}

function inputBlock(slug, text, unit, task, entries) {
  const P = paths(slug);
  const parts = [`## Unit ${unit.id}`, fence('json', unitJSON(unit))];
  const lines = unit.lines.filter(l => l.role !== 'lacuna');
  if (task === 'draft' || task === 'redraft') {
    parts.push('## Glossary hits in the source lines', hitsBlock(entries, lines));
    if (unit.commentary.length) parts.push('## Glossary hits in the commentary', hitsBlock(entries, unit.commentary));
  }
  if (task === 'redraft') {
    const prev = readJSON(P.draft(unit.id), null);
    if (!prev) fail(`${unit.id}: no previous draft to redraft`);
    const { provenance, ...body } = prev;
    const fb = readJSON(P.feedback, {})[unit.id];
    parts.push('## Your previous draft', fence('json', JSON.stringify(body, null, 2)));
    parts.push('## Reviewer notes', fb ? fence('json', JSON.stringify(fb, null, 2)) : '(none recorded)');
  }
  if (task === 'weave') {
    const d = readJSON(P.draft(unit.id), null);
    if (!d) fail(`${unit.id}: draft the unit before weaving its commentary`);
    parts.push('## Current English draft (reference only)', d.lines.map(l => `- ${l.id}: ${l.en}`).join('\n'));
    parts.push('## Glossary hits in the commentary', hitsBlock(entries, unit.commentary));
    const fb = readJSON(P.feedback, {})[unit.id];
    const prev = readJSON(P.weave(unit.id), null);
    if (fb && prev) {
      const { provenance, ...body } = prev;
      parts.push('## Your previous commentary translation', fence('json', JSON.stringify(body, null, 2)));
      parts.push('## Reviewer notes (address every one)', fence('json', JSON.stringify(fb, null, 2)));
    }
  }
  if (task === 'sing') {
    const acc = accurateEnglish(slug, unit);
    parts.push(`## The accurate English (the ${acc.from} translation; do not change it)`,
      acc.lines.map(l => `- ${l.id}: ${l.en}\n    gloss: ${l.gloss}`
        + l.flags.map(f => `\n    flag · ${f.kind}: ${f.note}`).join('')).join('\n'));
    parts.push('## How the source sounds', profileText(soundProfile(unit)));
    parts.push('## How the song works (the mixing board: hot is repetition and pattern, cool is variation)',
      readingText(unit, sourceBoard(unit, readJSON(P.draft(unit.id), null)), [], { images: markedWords(acc.lines) }));
    const w = readJSON(P.weave(unit.id), null);
    if (w?.segments?.length) {
      parts.push('## How the commentary reads it (for the song\'s sense and mood only; readings never go into a line)',
        w.segments.map(s => `- ${s.id}: ${s.note}`).join('\n'));
    }
    const fb = readJSON(P.feedback, {})[sungKey(unit.id)];
    const prev = readJSON(P.sung(unit.id), null);
    if (fb && prev) {
      const { provenance, ...body } = prev;
      parts.push('## Your previous sung version', fence('json', JSON.stringify(body, null, 2)));
      parts.push('## Reviewer notes (address every one)', fence('json', JSON.stringify(fb, null, 2)));
    }
  }
  if (task === 'terms') parts.push('## Candidate words not yet in the glossary', candidates(slug, unit, entries));
  if (task === 'terms-bo') parts.push('## Glossary terms in lines and segments that have Tibetan', tibetanHits(unit, entries));
  if ((task === 'draft' || task === 'redraft') && Object.keys(unit.parallels || {}).length) {
    parts.push('## Glossary hits in the Tibetan', hitsBlock(entries, lines.flatMap(l => {
      const par = parallelOf(unit, 'lines', l.id);
      return par ? Object.values(par).map(t => ({ id: l.id, src: t.src, lang: t.lang })) : [];
    })));
  }
  return parts.join('\n\n');
}

export function buildPack(slug, id, task) {
  if (!TASKS[task]) fail(`unknown task "${task}" (${Object.keys(TASKS).join(', ')})`);
  const text = loadText(slug);
  const unit = loadUnit(slug, id);
  if (task === 'terms-bo' && !Object.keys(unit.parallels || {}).length) fail(`${id}: no Tibetan is aligned with this unit yet; mark it in source/ and run segment`);
  for (const w of [...unit.witnesses, ...Object.keys(unit.parallels || {})]) {
    const wit = witnessOf(text, w);
    if (!wit) fail(`${id}: unknown witness ${w}`);
    if (wit.usage !== 'prompt+publish') fail(`${id}: witness ${w} is ${wit.usage}; it may not go into a drafting pack`);
  }
  const g = load();
  const entries = scoped(g, slug);
  const system = loadPrompt('system.md');
  const tp = textPrompt(slug);
  const taskP = loadPrompt(TASKS[task].prompt);
  const brief = [
    tp.body, textFacts(text),
    '## Style notes from the reviewer', readText(paths(slug).style, '').trim() || '(none yet)',
    '## Glossary (approved and proposed entries in scope)', entries.map(compact).join('\n') || '(empty so far)',
    exemplar(slug, text, id),
  ].filter(Boolean).join('\n\n');

  const pack = {
    text: slug, unit: id, task,
    prompts: { system: system.version, text: tp.version, task: taskP.version },
    glossarySha: scopeSha(g, slug),
    sourceSha: unit.sourceSha,
    ...(unit.parallelSha ? { parallelSha: unit.parallelSha } : {}),
    ...(task === 'sing' ? { draftSha: short(fileSha(paths(slug).draft(id))) } : {}),
    blocks: [
      { role: 'system', cache: true, text: system.body },
      { role: 'user', cache: true, text: brief },
      { role: 'user', cache: true, text: taskP.body },
      { role: 'user', cache: false, text: inputBlock(slug, text, unit, task, entries) },
    ],
    schema: jsonSchema(task),
  };
  return { ...pack, sha: hashOf(pack) };
}

export function packMarkdown(pack, inboxPath) {
  const [system, brief, task, input] = pack.blocks.map(b => b.text);
  return `<!-- translate:pack text=${pack.text} unit=${pack.unit} task=${pack.task} sha=${pack.sha} -->
# Drafting pack: ${pack.unit} · ${pack.task}

**For the drafter.** This file is your complete brief. Treat SYSTEM as your standing instructions, then read TEXT BRIEF, TASK and INPUT. Answer by writing one JSON object that matches OUTPUT SCHEMA to:

    ${inboxPath}

Write nothing else to that file, and do not consult or reproduce published translations of this text.

---

# SYSTEM

${system}

---

# TEXT BRIEF

${brief}

---

# TASK

${task}

---

# INPUT

${input}

---

# OUTPUT SCHEMA

${fence('json', JSON.stringify(pack.schema, null, 2))}
`;
}

/** Write packs for the selected units; draft switches to redraft where the reviewer asked for one. */
export function writePacks(slug, ids, task) {
  const P = paths(slug);
  const feedback = readJSON(P.feedback, {});
  const out = [];
  for (const id of ids) {
    let t = task;
    if (t === 'draft' && feedback[id]?.redraft?.length && exists(P.draft(id))) t = commentaryOnly(feedback[id]) ? 'weave' : 'redraft';
    if (t === 'weave' && !loadUnit(slug, id).commentary.length) continue;
    const pack = buildPack(slug, id, t);
    const inbox = P.inboxFile(t, id);
    const base = P.pack(t, id);
    writeJSON(base + '.json', pack);
    writeText(base + '.md', packMarkdown(pack, inbox));
    out.push({ unit: id, task: t, md: base + '.md', json: base + '.json', inbox, sha: pack.sha });
  }
  return out;
}

export function sessionInstructions(slug, packs) {
  if (!packs.length) return '  nothing to pack (no units, or no commentary to weave)';
  const byTask = {};
  for (const p of packs) (byTask[p.task] ||= []).push(p);
  const lines = [];
  for (const [task, list] of Object.entries(byTask)) {
    lines.push(`  ${list.length} ${task} pack(s):`);
    for (const p of list) lines.push(`    ${p.md}\n      -> ${p.inbox}`);
    lines.push('', '  Session mode: give each pack to a fresh Claude subagent ("read the pack and write its JSON answer to the inbox path"),',
      `  then validate and file the answers with:`,
      `    node translate/cli.mjs ingest ${slug} ${list.map(p => p.unit).join(',')} --task ${task}`, '');
  }
  return lines.join('\n');
}
