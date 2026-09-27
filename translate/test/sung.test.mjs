// The sung version, end to end on the fixture: sound -> sing pack -> ingest -> sung sheet -> accept -> render -> check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratch, importAndMark, ingestAnswer, answer, decideAll, read } from './helpers.mjs';

const dir = scratch();
const T = p => path.join(dir, 'texts', 'fixture', p);
const { segment } = await import('../lib/project.mjs');
const { writePacks } = await import('../lib/pack.mjs');
const { loadUnit } = await import('../lib/text.mjs');
const { soundProfile, rhymeOf, syllables, profileText } = await import('../lib/sound.mjs');
const { writeSheet } = await import('../lib/review/write.mjs');
const { acceptSheet } = await import('../lib/accept.mjs');
const { writeSungSheet, acceptSungSheet } = await import('../lib/review/sung.mjs');
const { render } = await import('../lib/render/index.mjs');
const { check } = await import('../lib/check.mjs');

const SUNG = {
  unit: 'fx.01',
  voice: 'TEST FIXTURE. Lūyī, speaking plainly to a student.',
  refrainCue: 'The body is a tree',
  lines: [
    { id: 'fx.01.1a', en: 'The body is a [tree]{taruvara} of five branches;' },
    { id: 'fx.01.1b', en: 'time has come into the restless mind.' },
    { id: 'fx.01.2a', en: 'Make great bliss firm, and take its measure:' },
    { id: 'fx.01.2b', en: '[Lūyī]{p-luyi} says: ask the guru, and know.' },
  ],
  couplets: [
    { group: 'fx.01.1', kept: 'The tree and its five branches, in the order the source gives them.', letGo: 'The rhyme of ḍāla and kāla.' },
    { group: 'fx.01.2', kept: 'The imperative, and Lūyī naming himself.', letGo: '' },
  ],
  questions: [],
};
const sung = patch => ({ ...structuredClone(SUNG), ...patch });

await importAndMark(dir);
segment('fixture');
writePacks('fixture', ['fx.01'], 'draft');
await ingestAnswer(dir, 'draft', 'fx.01', answer('draft-fx.01.json'));
writePacks('fixture', ['fx.01'], 'weave');
await ingestAnswer(dir, 'weave', 'fx.01', answer('weave-fx.01.json'));

test('the sound of the source: syllables, rhymes, refrain and self-naming', () => {
  assert.deepEqual(syllables('kuṛiā'), ['ku', 'ṛi', 'ā']);
  assert.deepEqual(syllables('sāṅga'), ['sā', 'ṅga']);
  assert.equal(rhymeOf('nagara bāhiri re ḍombi tohori kuṛiā', 'chaichoi yāi so bāhma nāṛiā|| dhru||'), 'full');
  assert.equal(rhymeOf('x bāndhī', 'y sāndhi'), 'full', 'vowel length does not keep a rhyme apart');
  assert.equal(rhymeOf('x caṅgatā', 'y eṭṭā'), 'near');
  assert.equal(rhymeOf('x sāṅga', 'y lāga'), 'near');
  assert.equal(rhymeOf('x diṭhā', 'y baiṇa'), 'none', 'a shared final -a alone is not a rhyme');
  const p = soundProfile(loadUnit('fixture', 'fx.01'));
  assert.equal(p.refrain, 'fx.01.1');
  assert.equal(p.bhanita, 'fx.01.2');
  assert.deepEqual(p.couplets.map(c => c.rhyme), ['full', 'full']);
  assert.match(profileText(p), /fx\.01\.1 \[refrain\]: ḍāla .* \/ kāla .* → full rhyme on "-ḍāla" \/ "-kāla"/);
});

test('the sing pack carries the accurate English, the sound and the commentary\'s reading', () => {
  const [p] = writePacks('fixture', ['fx.01'], 'sing');
  const md = read(p.md);
  assert.match(md, /# Task: sing/);
  assert.match(md, /## The accurate English \(the draft translation; do not change it\)\n\n- fx\.01\.h1: Rāga Paṭamañjarī[\s\S]*\n- fx\.01\.1a: The body is a fine \[tree\]\{taruvara\}/);
  assert.match(md, /    flag · meaning: kāla may be 'time' or 'death'/, 'the drafter sees which senses the translation left open');
  assert.match(md, /## How the source sounds\n\nRāga: paṭamañjarī/);
  assert.match(md, /## How the commentary reads it/);
  assert.equal(JSON.parse(read(p.json)).draftSha.length, 12);
});

test('ingest holds a sung version to the shape, the refrain and the glossary', async () => {
  await assert.rejects(ingestAnswer(dir, 'sing', 'fx.01', sung({ lines: SUNG.lines.slice(1) })), /line ids must be exactly/);
  await assert.rejects(ingestAnswer(dir, 'sing', 'fx.01', sung({ refrainCue: 'Time has come' })), /must be the opening words of the refrain/);
  await assert.rejects(ingestAnswer(dir, 'sing', 'fx.01', sung({ refrainCue: '' })), /has a refrain: give its refrainCue/);
  const bad = sung();
  bad.lines[0].en = 'The body is a [tree]{taruvara}: the five aggregates;';
  await assert.rejects(ingestAnswer(dir, 'sing', 'fx.01', bad), /"aggregates" inside a sung line/);
  const [r] = await ingestAnswer(dir, 'sing', 'fx.01', sung());
  assert.ok(r.ok);
  const s = JSON.parse(read(T('sung/fx.01.json')));
  assert.equal(s.provenance.draftSha.length, 12);
});

test('a redraft request reaches the next sing pack', () => {
  const sheet = writeSungSheet('fixture', 'fx.01').path;
  assert.match(read(sheet), /^<!-- translate:sung-sheet text=fixture unit=fx\.01 sung=[0-9a-f]{12} sheet=[0-9a-f]{12} -->/);
  assert.match(read(sheet), /The source rhymes on -ḍāla \/ -kāla\./);
  assert.match(read(sheet), /accurate 1a: The body is a fine \[tree\]\{taruvara\} with five branches;/);
  const s = read(sheet);
  fs.writeFileSync(sheet, s.replace(/(## 1\.1 · fx\.01\.1[\s\S]*?)\*\*Decision:\*\*\n\*\*Note to next draft:\*\*/,
    '$1**Decision:** redraft\n**Note to next draft:** try for the rhyme on branch and time'));
  const r = acceptSungSheet('fixture', 'fx.01');
  assert.ok(!r.approved);
  assert.deepEqual(r.redraft, ['fx.01.1']);
  const fb = JSON.parse(read(T('feedback.json')));
  assert.equal(fb['fx.01#sung'].notes['fx.01.1'], 'try for the rhyme on branch and time');
  assert.ok(!fb['fx.01'], 'the translation\'s own feedback is untouched');
  assert.match(read(writePacks('fixture', ['fx.01'], 'sing')[0].md), /## Reviewer notes \(address every one\)[\s\S]*branch and time/);
});

test('an approved sung version is published beside the approved translation', async () => {
  // The translation and its terms first: a sung version is published only beside an approved song.
  writeSheet('fixture', 'fx.01', { force: true });
  decideAll(T('review/fx.01.md'), 'ok', 'approve');
  assert.ok(acceptSheet('fixture', 'fx.01').approved);
  writeSungSheet('fixture', 'fx.01', { force: true });
  const sheet = T('review/fx.01.sung.md');
  decideAll(sheet, 'ok');
  fs.writeFileSync(sheet, read(sheet).replace('**Sung 1b:** time has come into the restless mind.', '**Sung 1b:** into the restless mind, time has come.'));
});

test('accept --sung checks the refrain cue against the edited refrain', () => {
  const sheet = T('review/fx.01.sung.md');
  fs.writeFileSync(sheet, read(sheet).replace('**Sung 1a:** The body is a [tree]{taruvara} of five branches;', '**Sung 1a:** A [tree]{taruvara} is the body, five branches;'));
  const r = acceptSungSheet('fixture', 'fx.01', { dry: true });
  assert.ok(!r.approved);
  assert.match(r.problems.join('\n'), /refrain cue "The body is a tree" is not the opening of the refrain/);
});

test('an approved sung version renders as a song: lines, refrain cue, the rhyme heard', () => {
  const sheet = T('review/fx.01.sung.md');
  fs.writeFileSync(sheet, read(sheet).replace('**Sung 1a:** A [tree]{taruvara} is the body, five branches;', '**Sung 1a:** The body is a [tree]{taruvara} of five branches;'));
  const r = acceptSungSheet('fixture', 'fx.01');
  assert.ok(r.approved, JSON.stringify(r.problems));
  const a = JSON.parse(read(T('approved/fx.01.sung.json')));
  assert.equal(a.provenance.review.decisions['fx.01.1'], 'edited');
  assert.equal(a.provenance.review.decisions['fx.01.2'], 'ok');
  assert.ok(!JSON.parse(read(T('feedback.json')))['fx.01#sung'], 'feedback cleared on approval');

  fs.mkdirSync(process.env.SITE_ROOT, { recursive: true });
  render('fixture');
  const html = read(path.join(process.env.SITE_ROOT, 'translations', 'fixture', '01.html'));
  assert.match(html, /<main class="text has-sung" id="main">/);
  assert.match(html, /<p class="en">The body is a fine <a class="gl"[^>]*>tree<\/a> with five branches;<\/p><p class="sung">The body is a <a class="gl"[^>]*>tree<\/a> of five branches;<\/p>/);
  assert.match(html, /<p class="sung">into the restless mind, time has come\.<\/p>/);
  assert.match(html, /<p class="cue">The body is a tree…<\/p>/, 'the refrain is cued after the couplet that follows it');
  assert.equal((html.match(/class="cue"/g) || []).length, 1, 'no cue after the refrain itself');
  assert.match(html, /<p class="heard" lang="bn-Latn">kāā tarubara pañca bi <span class="rh">ḍāla<\/span>/);
  assert.match(html, /<p class="voice"><span class="who">Sung\.<\/span> TEST FIXTURE\./);
  assert.match(html, /The sung version was drafted with Claude and approved by [^<]+ after revising its one couplet\.|The sung version was drafted with Claude and approved by [^<]+ after revising one of its two couplets\./);
  const js = read(path.join(process.env.SITE_ROOT, 'translations', 'assets', 'reader.js'));
  assert.match(js, /\['sung', 'As a song'/);
  const { errors } = check('fixture');
  assert.deepEqual(errors.filter(e => /sung/.test(e)), []);
});

test('a song without a sung version renders exactly as before', () => {
  fs.unlinkSync(T('approved/fx.01.sung.json'));
  render('fixture');
  const html = read(path.join(process.env.SITE_ROOT, 'translations', 'fixture', '01.html'));
  assert.doesNotMatch(html, /has-sung|class="sung"|class="cue"|class="heard"/);
});
