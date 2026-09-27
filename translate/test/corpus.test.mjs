// The Workshop's corpora: the lenses, the Study room's touchstone poems, the
// Practice room's exercises, and the version prompt that carries their rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPrompt } from '../lib/prompts.mjs';

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = p => JSON.parse(fs.readFileSync(path.join(ENGINE, p), 'utf8'));
const words = s => String(s).split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const str = s => typeof s === 'string' && s.trim().length > 0;

const CHANNELS = ['lineation', 'syntax', 'rhythm', 'rhyme'];
const LENS_TRADITIONS = ['english', 'sufi', 'zen', 'shakespeare', 'bardic'];
const STUDY_TRADITIONS = ['morton', 'sufi', 'zen', 'shakespeare', 'bardic'];
const PRACTICE_TRADITIONS = [...STUDY_TRADITIONS, 'maker'];
const PRACTICE_CHANNELS = ['space', 'lineation', 'syntax', 'rhythm', 'rhyme', 'perception', 'narrator', 'narrative', 'revision', 'performance'];
const LANGS = ['en', 'fa', 'ar', 'zh', 'ja', 'ga', 'sga'];
const SCRIPTS = ['fa', 'ar', 'zh', 'ja'];

// GitHub's heading anchors: lower case, punctuation dropped, each space a hyphen.
const slug = h => h.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
const anchors = file => new Set(fs.readFileSync(path.join(ENGINE, file), 'utf8').split('\n')
  .filter(l => /^#{1,6}\s/.test(l)).map(l => slug(l.replace(/^#+\s*/, ''))));

/** A research reference: the note exists, and its #anchor names one of its headings. */
function research(ref, where) {
  assert.match(ref, /^research\/[a-z0-9-]+\.md(#.+)?$/, `${where}: research "${ref}"`);
  const [file, anchor] = ref.split('#');
  assert.ok(fs.existsSync(path.join(ENGINE, file)), `${where}: ${file} does not exist`);
  if (anchor) assert.ok(anchors(file).has(anchor), `${where}: no heading "#${anchor}" in ${file}`);
}

test('lenses: unique ids, four channels in [0, 1], a known tradition, short public touchstones', () => {
  const { lenses } = json('prompts/lenses.json');
  assert.ok(lenses.length >= 20);
  const ids = lenses.map(l => l.id);
  assert.equal(new Set(ids).size, ids.length, 'lens ids are unique');
  for (const l of lenses) {
    assert.match(l.id, /^[a-z][a-z0-9]*$/, l.id);
    for (const k of ['name', 'how', 'why', 'suits']) assert.ok(str(l[k]), `${l.id}: ${k}`);
    assert.match(l.after, /^after /, `${l.id}: "after" reads as "after …"`);
    assert.equal(typeof l.touchstone, 'string', `${l.id}: touchstone`);
    assert.ok(words(l.touchstone) <= 20, `${l.id}: touchstone runs to ${words(l.touchstone)} words`);
    assert.deepEqual(Object.keys(l.board).sort(), [...CHANNELS].sort(), `${l.id}: board channels`);
    for (const c of CHANNELS) assert.ok(typeof l.board[c] === 'number' && l.board[c] >= 0 && l.board[c] <= 1, `${l.id} ${c}`);
    assert.ok(LENS_TRADITIONS.includes(l.tradition), `${l.id}: tradition "${l.tradition}"`);
  }
  for (const id of ['blake', 'ballad', 'hymn', 'psalm', 'hopkins', 'cathay', 'shanty', 'owen']) {
    assert.equal(lenses.find(l => l.id === id)?.tradition, 'english', id);
  }
  for (const t of LENS_TRADITIONS) assert.ok(lenses.some(l => l.tradition === t), `a lens from the ${t} tradition`);
  // The lenses from the other traditions work inside a caryā's shape: each says
  // what becomes of the refrain and of the signature.
  for (const l of lenses.filter(x => x.tradition !== 'english')) {
    assert.match(l.how, /refrain/, `${l.id}: the refrain`);
    assert.match(l.how, /says/, `${l.id}: the signature`);
  }
  assert.equal(lenses.find(l => l.id === 'sonnet').board.syntax, 0.35, 'the sonnet runs cool syntax under hot sound');
});

test('study: five traditions, 14–18 touchstone poems, each text witnessed and read in short notes', () => {
  const study = json('workshop/study.json');
  assert.deepEqual(study.traditions.map(t => t.id).sort(), [...STUDY_TRADITIONS].sort());
  for (const t of study.traditions) {
    assert.ok(str(t.name) && str(t.summary), t.id);
    research(t.research, `tradition ${t.id}`);
  }
  const { poems } = study;
  assert.ok(poems.length >= 14 && poems.length <= 18, `${poems.length} poems`);
  assert.equal(new Set(poems.map(p => p.id)).size, poems.length, 'poem ids are unique');
  for (const t of STUDY_TRADITIONS) assert.ok(poems.some(p => p.tradition === t), `a poem from ${t}`);
  for (const p of poems) {
    const at = `poem ${p.id}`;
    assert.match(p.id, /^[a-z0-9][a-z0-9-]*$/, at);
    assert.ok(STUDY_TRADITIONS.includes(p.tradition), `${at}: tradition "${p.tradition}"`);
    for (const k of ['title', 'poet', 'date', 'verified']) assert.ok(str(p[k]), `${at}: ${k}`);
    assert.ok(LANGS.includes(p.lang), `${at}: lang "${p.lang}"`);
    assert.ok(Array.isArray(p.original) && p.original.some(str) && p.original.every(l => typeof l === 'string'), `${at}: original`);
    for (const k of ['translit', 'gloss']) {
      if (p[k] === undefined) continue;
      assert.ok(Array.isArray(p[k]) && p[k].every(l => typeof l === 'string'), `${at}: ${k}`);
      assert.equal(p[k].length, p.original.length, `${at}: ${k} runs line for line with the original`);
    }
    if (SCRIPTS.includes(p.lang)) assert.ok(p.translit, `${at}: a transliteration for ${p.lang}`);
    if (p.lang === 'en') assert.ok(!p.english && !p.translit && !p.gloss, `${at}: an English poem needs no English`);
    if (p.english !== undefined) {
      assert.ok(Array.isArray(p.english) && p.english.some(str), `${at}: english`);
      assert.match(p.englishBy, /\b1[0-9]{3}\b/, `${at}: englishBy names who and when`);
      assert.ok(Number(p.englishBy.match(/\b(1[0-9]{3})\b/)[1]) < 1929, `${at}: the English was published before 1929`);
    } else assert.equal(p.englishBy, undefined, `${at}: englishBy without english`);
    assert.ok(p.notes.length >= 3 && p.notes.length <= 6, `${at}: ${p.notes.length} notes`);
    for (const n of p.notes) assert.ok(str(n) && words(n) <= 40, `${at}: a note of ${words(n)} words: ${n}`);
    assert.ok(p.questions.length >= 2 && p.questions.length <= 4, `${at}: ${p.questions.length} questions`);
    for (const q of p.questions) assert.match(q, /\?$/, `${at}: a question ends with "?"`);
    research(p.research, at);
  }
  // The same problems, solved five ways: one row per problem, one cell per tradition.
  for (const r of study.across || []) {
    assert.ok(str(r.problem), 'an across row names its problem');
    for (const c of ['carya', 'sufi', 'zen', 'shakespeare', 'bardic']) assert.ok(str(r[c]), `across "${r.problem}": ${c}`);
  }
});

test('practice: 28–36 exercises, each with a tradition, a channel, steps and a source note', () => {
  const { exercises } = json('workshop/practice.json');
  assert.ok(exercises.length >= 28 && exercises.length <= 36, `${exercises.length} exercises`);
  assert.equal(new Set(exercises.map(e => e.id)).size, exercises.length, 'exercise ids are unique');
  for (const t of PRACTICE_TRADITIONS) assert.ok(exercises.some(e => e.tradition === t), `an exercise from ${t}`);
  for (const e of exercises) {
    const at = `exercise ${e.id}`;
    assert.match(e.id, /^[a-z0-9][a-z0-9-]*$/, at);
    assert.ok(str(e.title), `${at}: title`);
    assert.ok(PRACTICE_TRADITIONS.includes(e.tradition), `${at}: tradition "${e.tradition}"`);
    assert.ok(PRACTICE_CHANNELS.includes(e.channel), `${at}: channel "${e.channel}"`);
    assert.ok(Number.isInteger(e.minutes) && e.minutes > 0, `${at}: minutes`);
    assert.ok(Array.isArray(e.steps) && e.steps.length >= 2 && e.steps.every(str), `${at}: steps`);
    assert.ok(str(e.why) && (e.why.match(/[.!?](\s|$)/g) || []).length === 1, `${at}: why is one sentence`);
    research(e.source, at);
  }
});

test('the version prompt loads, at version 2, with the rules the traditions added', () => {
  const p = loadPrompt('tasks/version.md');
  assert.equal(p.version, 2);
  assert.match(p.body, /Same shape/);
  for (const rule of ['Turn where the song turns', 'Add nothing to the line; remove nothing it names', 'No "I" and no hearer the song lacks',
    'An identity stays an identity', "Keep the signature's person", 'Never cool the refrain', "Keep the poem's paradoxes and silences"]) {
    assert.ok(p.body.includes(`**${rule}.**`), `rule: ${rule}`);
  }
});
