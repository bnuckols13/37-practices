/**
 * Review of a sung version: its own sheet, its own acceptance, its own
 * approved record. It never touches the accurate translation's review, so a
 * song's meaning can be approved without its music, and the other way round.
 *
 *   review <text> <units> --sung  ->  review/<unit>.sung.md
 *   accept <text> <units> --sung  ->  approved/<unit>.sung.json, or notes for the next `sing`
 */

import { paths, readJSON, writeJSON, readText, writeText, exists, fileSha, sha256, short, fail, config, today, rel } from '../io.mjs';
import { loadText, loadUnit } from '../text.mjs';
import { load, byId, scoped, matchSource } from '../glossary.mjs';
import { partOf, passageNo } from '../ids.mjs';
import * as markup from '../markup.mjs';
import { withHeader, isEdited, quote, decision } from './sheet.mjs';
import { parseSheet } from './parse.mjs';
import { soundProfile, songAdvice } from '../sound.mjs';
import { accurateEnglish, sungKey } from '../pack.mjs';
import { ApprovedSung } from '../../schemas/sung.mjs';

const same = (a, b) => String(a || '').replace(/\s+/g, ' ').trim() === String(b || '').replace(/\s+/g, ' ').trim();

const INSTRUCTIONS = `This is the sung version: a second English beside the accurate translation, made to carry the song
(its shape, rhymes, refrain and voice). Read each couplet aloud. Edit the text after **Sung**, **Kept**, **Let go**,
**Voice** and **Refrain cue**. Set each **Decision** to ok or redraft (blank means not yet decided).
It must still say what the accurate English says, keep every image, and add none.
Quoted lines (>) are reference only. When done: node translate/cli.mjs accept <text> <unit> --sung`;

const RHYME_WORD = { full: 'rhymes', near: 'half-rhymes', none: 'does not rhyme' };

export function writeSungSheet(slug, id, { force = false } = {}) {
  const text = loadText(slug);
  const P = paths(slug);
  const sung = readJSON(P.sung(id), null);
  if (!sung) fail(`${id}: no sung version yet (sing, then ingest --task sing)`);
  const p = P.sungSheet(id);
  if (exists(p) && !force && isEdited(readText(p))) return { skipped: 'hand-edited; accept it, or rerun with --force to overwrite', path: p };
  const unit = loadUnit(slug, id);
  const entries = byId(load());
  const poet = (unit.poet && entries.get(unit.poet)?.en) || '';
  const profile = soundProfile(unit);
  const acc = new Map(accurateEnglish(slug, unit).lines.map(l => [l.id, l.en]));
  const sungLine = new Map(sung.lines.map(l => [l.id, l.en]));
  const advice = songAdvice(sung.lines, accurateEnglish(slug, unit).lines, markup.strip);

  const out = [
    `# ${text.unitLabel} ${unit.n}${poet ? ' · ' + poet : ''}${unit.raga ? ' · rāga ' + unit.raga : ''} · sung version`,
    '', INSTRUCTIONS, '',
    `## ${text.unitLabel} · ${unit.id}`,
    quote([`${profile.rhymed} of ${profile.couplets.length} couplets rhyme or half-rhyme in the source.`
      + (profile.refrain ? ` The refrain is ${passageNo(profile.refrain)}; it is sung again after each later couplet.` : ''),
      ...(sung.questions.length ? ['Questions from the drafter:', ...sung.questions.map(q => '- ' + q)] : [])].join('\n')),
    `**Voice:** ${sung.voice}`,
    `**Refrain cue:** ${sung.refrainCue}`,
    '**Decision:**', '**Note to next draft:**',
  ];
  for (const c of profile.couplets) {
    const lines = unit.lines.filter(l => l.group === c.group);
    const note = sung.couplets.find(x => x.group === c.group) || { kept: '', letGo: '' };
    const tags = [c.refrain && 'refrain', c.bhanita && 'the poet names himself'].filter(Boolean);
    out.push('', `## ${passageNo(c.group)} · ${c.group}`, quote([
      ...(tags.length ? [`(${tags.join('; ')})`] : []),
      ...lines.map(l => `${l.src}   ${l.translit}`),
      `The source ${RHYME_WORD[c.rhyme]}${c.rhyme !== 'none' ? ` on -${c.halves.map(h => h.end.sound).join(' / -')}` : ''}.`,
      ...lines.map(l => `accurate ${partOf(l.id)}: ${acc.get(l.id) || ''}`),
      ...advice.filter(a => lines.some(l => a.startsWith(l.id + ':'))).map(a => 'NOTE ' + a),
    ].join('\n')));
    for (const l of lines) out.push(`**Sung ${partOf(l.id)}:** ${sungLine.get(l.id) || ''}`);
    out.push(`**Kept:** ${note.kept}`, `**Let go:** ${note.letGo}`, '**Decision:**', '**Note to next draft:**');
  }
  const body = out.join('\n') + '\n';
  writeText(p, withHeader('sung-sheet', { text: slug, unit: id, sung: short(fileSha(P.sung(id))) }, body));
  return { path: p };
}

export function acceptSungSheet(slug, id, { dry = false } = {}) {
  loadText(slug);
  const P = paths(slug);
  const reviewer = config().reviewer || fail('set "reviewer" in translate/config.json');
  if (!exists(P.sungSheet(id))) fail(`${id}: no sung review sheet; run: review ${slug} ${id} --sung`);
  const sheetText = readText(P.sungSheet(id));
  const { header, sections, warnings } = parseSheet(sheetText);
  if (header.kind !== 'sung-sheet' || header.unit !== id) fail(`${rel(P.sungSheet(id))} is not the sung sheet for ${id}`);
  const sung = readJSON(P.sung(id));
  const sungSha = short(fileSha(P.sung(id)));
  if (header.sung !== sungSha) fail(`${id}: the sung sheet is stale (the sung version changed after it was made). Copy your edits aside, then: review ${slug} ${id} --sung --force`);
  const unit = loadUnit(slug, id);
  if (sung.provenance.sourceSha !== unit.sourceSha) fail(`${id}: the source changed after this version was sung; sing it again first`);

  const g = load();
  const inScope = scoped(g, slug);
  const byKey = new Map(sections.map(s => [s.key, s]));
  const problems = [];
  const status = {}, edited = {}, notesToNext = {};
  const need = key => {
    const s = byKey.get(key);
    if (!s) { problems.push(`section ${key} is missing from the sheet`); return { labels: {} }; }
    status[key] = decision(s.labels.Decision);
    if (status[key] === 'invalid') problems.push(`${key}: decision "${s.labels.Decision}" is not ok or redraft`);
    if (s.labels['Note to next draft']) notesToNext[key] = s.labels['Note to next draft'];
    return s;
  };

  const head = need(unit.id);
  const voice = head.labels.Voice ?? sung.voice;
  const refrainCue = head.labels['Refrain cue'] ?? sung.refrainCue;
  edited[unit.id] = !same(voice, sung.voice) || !same(refrainCue, sung.refrainCue);

  const lines = [], couplets = [];
  for (const gid of [...new Set(unit.lines.filter(l => l.role === 'line').map(l => l.group))]) {
    const s = need(gid);
    for (const l of unit.lines.filter(x => x.group === gid)) {
      const orig = sung.lines.find(x => x.id === l.id)?.en ?? '';
      const en = s.labels[`Sung ${partOf(l.id)}`];
      if (en === undefined) problems.push(`${gid}: the **Sung ${partOf(l.id)}:** line is missing`);
      else if (!en.trim()) problems.push(`${l.id}: empty line`);
      if (en !== undefined && !same(en, orig)) edited[gid] = true;
      lines.push({ id: l.id, en: (en ?? orig).trim() });
    }
    const orig = sung.couplets.find(c => c.group === gid) || { kept: '', letGo: '' };
    const kept = s.labels.Kept ?? orig.kept, letGo = s.labels['Let go'] ?? orig.letGo;
    if (!same(kept, orig.kept) || !same(letGo, orig.letGo)) edited[gid] = true;
    couplets.push({ group: gid, kept: kept.trim(), letGo: letGo.trim() });
  }

  // The final text: markup, terms, and words that must never stand in a verse line.
  const approvedIds = new Set(g.entries.filter(e => e.status === 'approved').map(e => e.id));
  const knownIds = new Set(g.entries.filter(e => e.status !== 'rejected').map(e => e.id));
  const unapproved = new Set();
  for (const l of lines) {
    for (const p of markup.problems(l.en)) problems.push(`${l.id}: ${p}`);
    for (const t of markup.terms(l.en)) {
      if (!knownIds.has(t.id)) problems.push(`${l.id}: unknown or rejected term {${t.id}}`);
      else if (!approvedIds.has(t.id)) unapproved.add(t.id);
    }
    for (const f of forbiddenHere(inScope, unit, l)) problems.push(`${l.id}: "${f.word}" inside a sung line (${f.id} says: translate the image, put the reading in a note)`);
  }
  const refrainFirst = lines.find(l => unit.lines.find(u => u.id === l.id)?.refrain);
  if (refrainFirst && refrainCue.trim() && !markup.strip(refrainFirst.en).startsWith(refrainCue.trim().replace(/[…\s.]+$/, ''))) {
    problems.push(`the refrain cue "${refrainCue}" is not the opening of the refrain ("${markup.strip(refrainFirst.en)}")`);
  }

  const keys = Object.keys(status);
  const pending = keys.filter(k => status[k] === 'pending');
  const redraft = keys.filter(k => status[k] === 'redraft');
  const result = {
    unit: id, dry, approved: false, glossary: { approved: [], rejected: [], deferred: [], edited: [], problems: [] },
    problems, warnings, pending, redraft, unapproved: [...unapproved],
    edited: Object.keys(edited).filter(k => edited[k]), sections: keys.length, sung: true,
  };

  if (!problems.length && !pending.length && !redraft.length && !unapproved.size) {
    const record = ApprovedSung.parse({
      unit: id, sourceSha: unit.sourceSha, voice: voice.trim(), refrainCue: refrainCue.trim(), lines, couplets,
      provenance: {
        sung: sung.provenance,
        review: {
          by: reviewer, date: today(), sheetSha: sha256(sheetText).slice(0, 12), sungSha,
          decisions: Object.fromEntries(keys.map(k => [k, edited[k] ? 'edited' : 'ok'])),
        },
      },
    });
    result.approved = true;
    result.path = P.approvedSung(id);
    result.record = record;
    if (!dry) writeJSON(P.approvedSung(id), record);
  }
  if (!dry) {
    const fb = readJSON(P.feedback, {});
    if (redraft.length || Object.keys(notesToNext).length) {
      fb[sungKey(id)] = { date: today(), redraft, notes: notesToNext,
        edits: Object.fromEntries(lines.filter(l => !same(l.en, sung.lines.find(x => x.id === l.id)?.en)).map(l => [l.id, l.en])) };
    } else if (result.approved) delete fb[sungKey(id)];
    writeJSON(P.feedback, fb);
  }
  return result;
}

/**
 * Glossary words that must not stand in this line. As for the accurate text,
 * a term's forbidden words bind only where its image is present: in the
 * source line, or marked in the English.
 */
export function forbiddenHere(inScope, unit, line) {
  const src = unit.lines.find(l => l.id === line.id);
  const present = new Set([...markup.terms(line.en).map(t => t.id), ...(src ? matchSource(inScope, src.src, src.lang).map(h => h.id) : [])]);
  const plain = markup.strip(line.en).toLowerCase();
  const out = [];
  for (const e of inScope) {
    if (!present.has(e.id)) continue;
    for (const f of e.forbiddenInLine) {
      if (new RegExp(`(^|[^\\p{L}])${f.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'u').test(plain)) out.push({ id: e.id, word: f });
    }
  }
  return out;
}
