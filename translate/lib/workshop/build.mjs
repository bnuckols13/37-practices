/**
 * workshop build: the Workshop page, where a maker turns a song into an
 * illuminated English poem through a lens (after Blake, the ballad, the
 * psalm…). One self-contained page like the Studio: the songs, their glosses
 * and Englishes, each song's mixing board and the lenses are baked in from the
 * engine; the English ear (lib/english.mjs, lib/board.mjs) is bundled so the
 * page hears a line as it is typed. Versions made there come back with
 * `versions import`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ENGINE, paths, readJSON, writeText, sha256, home } from '../io.mjs';
import { loadText, unitsIndex, loadUnit } from '../text.mjs';
import { load, byId, scoped, matchSource } from '../glossary.mjs';
import * as markup from '../markup.mjs';
import { cleanLine, lineEnd } from '../sound.mjs';
import { sourceBoard, readingText, markedWords } from '../reading.mjs';
import { lenses, listVersions } from '../versions.mjs';
import { loadPrompt } from '../prompts.mjs';
import { passageNo } from '../ids.mjs';
import { bundle, checkBuild } from '../studio/build.mjs';

const SRC = path.join(ENGINE, 'workshop');
export const SIZE_BUDGET = 400 * 1024;
const FONT_URL = 'https://fonts.googleapis.com/css2?family=Tiro+Bangla:ital@0;1&family=Galada'
  + '&family=IM+Fell+English:ital@0;1&family=Gentium+Book+Plus:ital,wght@0,400;0,700;1,400'
  + '&family=Source+Sans+3:wght@400;600&display=swap';
// The teaching's own words keep the edition's English in every version.
const TEACHING = ['citta', 'mahasukha', 'sunyata', 'sahaja', 'guru'];

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
// The manuscript's marks at a line end: daṇḍas and the refrain cue.
const splitMarks = s => { const m = /^(.*?)[\s।॥|]*(?:ধ্রু[\s।॥|]*)?$/u.exec(String(s).trim()); return (m ? m[1] : s).trim(); };

function song(slug, id, entries, inScope) {
  const unit = loadUnit(slug, id);
  const P = paths(slug);
  const approved = readJSON(P.approvedFile(id), null);
  const draft = readJSON(P.draft(id), null);
  const acc = approved && approved.sourceSha === unit.sourceSha ? approved : draft;
  const sung = readJSON(P.approvedSung(id), null) || readJSON(P.sung(id), null);
  const accLine = new Map((acc?.lines || []).map(l => [l.id, l]));
  const draftLine = new Map((draft?.lines || []).map(l => [l.id, l]));
  const sungLine = new Map((sung?.lines || []).map(l => [l.id, l.en]));
  const board = sourceBoard(unit, draft);
  const chimes = new Map(board.couplets.map(c => [c.group, c]));
  const verse = unit.lines.filter(l => l.role === 'line');
  const lines = verse.map(l => {
    const core = splitMarks(l.src);
    const words = core.split(/\s+/);
    const tl = cleanLine(l.translit);
    const sound = lineEnd(l.translit).sound;
    return {
      id: l.id, group: l.group, part: l.id.slice(-1), refrain: !!l.refrain, bhanita: !!l.bhanita,
      bn: words.slice(0, -1).join(' '), bnEnd: words[words.length - 1] || '',
      tl: sound && tl.endsWith(sound) ? tl.slice(0, -sound.length) : tl, tlEnd: sound && tl.endsWith(sound) ? sound : '',
      gloss: draftLine.get(l.id)?.gloss || accLine.get(l.id)?.gloss || '',
      en: markup.strip(accLine.get(l.id)?.en || ''),
      sung: markup.strip(sungLine.get(l.id) || ''),
      // Words a glossary entry keeps out of a line where its image stands.
      forbidden: matchSource(inScope, l.src, l.lang).flatMap(h => (inScope.find(e => e.id === h.id)?.forbiddenInLine || []).map(word => ({ word, term: entries.get(h.id)?.en || h.id }))),
    };
  });
  const groups = [...new Set(verse.map(l => l.group))];
  const poet = unit.poet ? entries.get(unit.poet)?.en || '' : '';
  return {
    id, n: unit.n, no: String(unit.n), title: acc?.title || `Song ${unit.n}`, poet, raga: unit.raga ? cap(unit.raga) : '',
    summary: markup.strip(acc?.summary || ''),
    lines,
    couplets: groups.map(g => {
      const c = chimes.get(g) || { kind: 'none', ends: [] };
      const first = verse.find(l => l.group === g);
      return { group: g, no: passageNo(g), kind: c.kind, ends: c.ends, refrain: !!first.refrain, bhanita: !!first.bhanita };
    }),
    board: Object.fromEntries(Object.entries(board.channels).map(([k, v]) => [k, { heat: v.heat, facts: v.facts }])),
    repeats: board.repeats.struck.slice(0, 5),
    narrator: board.narrator,
    reading: readingText(unit, board, [], { images: markedWords(acc?.lines), poet }),
    images: markedWords(acc?.lines),
    sungVoice: sung?.voice || '',
    examples: listVersions(slug, id).map(({ sourceSha, ...v }) => v),
  };
}

export function buildWorkshop(slug, ids = null) {
  const text = loadText(slug);
  const g = load();
  const entries = byId(g);
  const inScope = scoped(g, slug);
  const all = unitsIndex(slug).units.map(u => u.id).filter(id => exists(paths(slug).draft(id)) || exists(paths(slug).approvedFile(id)));
  const want = (ids || all).filter(id => all.includes(id));
  const data = {
    text: { slug, title: text.title.en, titleSrc: text.title.orig?.text || '', unitLabel: text.unitLabel },
    songs: want.map(id => song(slug, id, entries, inScope)),
    lenses: lenses(),
    prompt: loadPrompt('tasks/version.md').body,
    teaching: TEACHING.map(id => entries.get(id)).filter(Boolean).map(e => ({ id: e.id, en: e.en })),
  };
  const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
  const js = bundle(path.join(SRC, 'src', 'main.mjs')).replace(/<\/(script)/gi, '<\\/$1');
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const html = fs.readFileSync(path.join(SRC, 'body.html'), 'utf8')
    .replace('{{FONT_URL}}', () => FONT_URL.replace(/&/g, '&amp;'))
    .replace('{{CSS}}', () => css)
    .replace('{{DATA}}', () => json)
    .replace('{{JS}}', () => js);
  const problems = checkBuild(html, js).filter(p => !/references hosts|over the/.test(p));
  const hosts = [...new Set([...html.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map(m => m[1].toLowerCase()))];
  const allowed = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'code.claude.com', 'claude.ai', '37practices.space'];
  const bad = hosts.filter(h => !allowed.includes(h));
  if (bad.length) problems.push(`references hosts the page may not load from: ${bad.join(', ')}`);
  if (Buffer.byteLength(html) > SIZE_BUDGET) problems.push(`page is ${Math.round(Buffer.byteLength(html) / 1024)} KB, over the ${SIZE_BUDGET / 1024} KB budget`);
  if (problems.length) throw new Error('workshop build: ' + problems.join('; '));
  const p = path.join(home(), '.workshop', 'workshop.html');
  writeText(p, html);
  return { path: p, bytes: Buffer.byteLength(html), sha: sha256(html), units: data.songs.length, versions: data.songs.reduce((n, s) => n + s.examples.length, 0) };
}

function exists(p) { return fs.existsSync(p); }
