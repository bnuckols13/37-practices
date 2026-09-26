// Negative fixtures: each broken state must make `check` report an error.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratch, importAndMark, ingestAnswer, answer, decideAll, read } from './helpers.mjs';

const dir = scratch();
const T = p => path.join(dir, 'texts', 'fixture', p);
const { segment } = await import('../lib/project.mjs');
const { writePacks } = await import('../lib/pack.mjs');
const { writeSheet } = await import('../lib/review/write.mjs');
const { acceptSheet } = await import('../lib/accept.mjs');
const { check } = await import('../lib/check.mjs');

await importAndMark(dir);
segment('fixture');
writePacks('fixture', ['fx.01'], 'draft');
await ingestAnswer(dir, 'draft', 'fx.01', answer('draft-fx.01.json'));
writePacks('fixture', ['fx.01'], 'weave');
await ingestAnswer(dir, 'weave', 'fx.01', answer('weave-fx.01.json'));
writeSheet('fixture', 'fx.01');
decideAll(T('review/fx.01.md'));
assert.ok(acceptSheet('fixture', 'fx.01').approved);

const errorsOf = () => check('fixture').errors.join('\n');
function mutate(file, fn, body) {
  const orig = read(file);
  fs.writeFileSync(file, fn(orig));
  try { body(); } finally { fs.writeFileSync(file, orig); }
}
const mutateJSON = (file, fn, body) => mutate(file, s => { const o = JSON.parse(s); fn(o); return JSON.stringify(o); }, body);

test('baseline is clean', () => assert.equal(errorsOf(), ''));

test('a missing line in the draft', () => mutateJSON(T('drafts/fx.01.json'), d => d.lines.pop(),
  () => assert.match(errorsOf(), /line ids no longer match the unit/)));

test('an unknown term id in approved text', () => mutateJSON(T('approved/fx.01.json'), a => { a.lines[1].en = 'The body is a [tree]{nope}'; },
  () => assert.match(errorsOf(), /unknown term \{nope\}/)));

test('a rendering that differs from the approved glossary rendering', () => mutateJSON(T('approved/fx.01.json'), a => { a.lines[1].en = 'The body is a fine [shrub]{taruvara}'; },
  () => assert.match(errorsOf(), /"shrub" for \{taruvara\}/)));

test('the esoteric referent inside a verse line', () => mutateJSON(T('approved/fx.01.json'), a => { a.lines[1].en = 'The aggregates are a [tree]{taruvara}'; },
  () => assert.match(errorsOf(), /"aggregates" inside a verse line/)));

test('forbidden words bind only where their image is in the line', () => mutateJSON(T('approved/fx.01.json'), a => { a.lines[3].en = 'Make the aggregates firm and take their measure:'; },
  () => assert.doesNotMatch(errorsOf(), /inside a verse line/)));

test('an uncited note that reports the commentator', () => mutateJSON(T('approved/fx.01.json'), a => { a.notes[0].cites = []; },
  () => assert.match(errorsOf(), /mentions Munidatta but cites no segment/)));

test('a quotation longer than 25 words', () => mutateJSON(T('approved/fx.01.json'), a => {
  a.notes[1].text = '"' + Array(30).fill('word').join(' ') + '"';
}, () => assert.match(errorsOf(), /quotation over 25 words/)));

test('an 8-word overlap with a private reference', () => {
  const priv = path.join(dir, '.private', 'ref.txt');
  fs.mkdirSync(path.dirname(priv), { recursive: true });
  fs.writeFileSync(priv, 'Someone once wrote: the body is a fine tree with five branches; and so on.');
  try { assert.match(errorsOf(), /8-word overlap with a private reference/); }
  finally { fs.rmSync(path.dirname(priv), { recursive: true }); }
});

test('a stale approval after the source changes', () => {
  const marked = T('source/ed.txt');
  mutate(marked, s => s.replace('লুই ভণই গুরু পুচ্ছিঅ জাণ॥', 'লুই ভণই গুরু পুচ্ছিঅ জাণ॥\n@emend fx.01.2b জাণ => জাণু | test'), () => {
    segment('fixture');
    assert.match(errorsOf(), /approved text is stale/);
  });
  segment('fixture');
});

test('a raw source edited after import', () => {
  const raw = T('source/raw/ed-001.txt');
  mutate(raw, s => s + 'extra\n', () => assert.match(errorsOf(), /changed since import/));
});
