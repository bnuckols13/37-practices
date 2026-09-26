// The Studio's own code, in node: the pure review actions, the save queue
// against a fake database, and the build's page-contract checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { scratch, importAndMark, ingestAnswer, answer, read } from './helpers.mjs';

const M = await import('../studio/src/model.mjs');
const A = await import('../studio/src/store.mjs');
const { diffWords } = await import('../studio/src/diff.mjs');
const { createSync } = await import('../studio/src/sync.mjs');
const { createFakeDb } = await import('../studio/src/fake-db.mjs');
const { buildStudio, checkBuild } = await import('../lib/studio/build.mjs');

const dir = scratch();
await importAndMark(dir);
const { segment } = await import('../lib/project.mjs');
const { writePacks } = await import('../lib/pack.mjs');
segment('fixture');
writePacks('fixture', ['fx.01'], 'draft');
await ingestAnswer(dir, 'draft', 'fx.01', answer('draft-fx.01.json'));
writePacks('fixture', ['fx.01'], 'weave');
await ingestAnswer(dir, 'weave', 'fx.01', answer('weave-fx.01.json'));
const { unitDoc, textDocs, glossaryDoc } = await import('../lib/studio/docs.mjs');
const { importStudio } = await import('../lib/studio/import.mjs');
const glossary = await import('../lib/glossary.mjs');
const unit = unitDoc('fixture', 'fx.01');
const T = '2026-09-27T10:00:00Z';

test('editing an approved passage clears its approval; a note for the next draft does not', () => {
  let d = A.decide(null, unit, '1', 'ok', T);
  assert.equal(M.statusOf(unit.sections.find(s => s.part === '1'), d.sections['1']), 'approved');
  d = A.noteForNextDraft(d, unit, '1', 'keep it short', T);
  assert.equal(d.sections['1'].decision, 'ok');
  const r = A.edit(d, unit, '1', { en: { '1b': 'time has entered the restless mind.' } }, T);
  assert.ok(r.cleared);
  assert.equal(r.doc.sections['1'].decision, null);
  assert.equal(M.statusOf(unit.sections.find(s => s.part === '1'), r.doc.sections['1']), 'edited');
  const back = A.edit(r.doc, unit, '1', { en: { '1b': unit.sections.find(s => s.part === '1').lines[1].en } }, T).doc;
  assert.equal(M.edited(unit.sections.find(s => s.part === '1'), back.sections['1']), false, 'typing the draft back is not an edit');
});

test('progress, attention and carry-over', () => {
  let d = null;
  for (const p of ['head', 'h', '1']) d = A.decide(d, unit, p, 'ok', T);
  d = A.decide(d, unit, 'm1', 'redraft', T);
  assert.deepEqual(M.progress(unit, d), { ok: 3, redraft: 1, total: 5 });
  const attention = unit.sections.filter(s => M.needsAttention(s, d.sections[s.part], { termsOf: () => [], termDecided: () => true })).map(s => s.part);
  assert.deepEqual(attention, ['m1', '2']);
  const changed = structuredClone(unit);
  changed.draftSha = 'newdraft0000';
  changed.sections.find(s => s.part === '2').base = 'changed00000';
  const { doc, kept, reset } = M.carryOver(changed, { ...d, sections: { ...d.sections, 2: { base: unit.sections.find(s => s.part === '2').base, decision: 'ok' } } }, T);
  assert.deepEqual(kept.sort(), ['1', 'h', 'head', 'm1']);
  assert.deepEqual(Object.keys(reset), ['2']);
  assert.equal(doc.draftSha, 'newdraft0000');
});

test('glossary: editing a field after approving clears the approval; only edited fields travel', () => {
  const e = glossaryDoc('fixture', glossary.load().entries.find(x => x.id === 'taruvara'));
  let g = A.glossaryDecide(null, e, 'approve', T);
  const r = A.glossaryEdit(g, e, 'definition', 'The body pictured as a tree.', T);
  assert.ok(r.cleared);
  assert.deepEqual(r.doc.edited, ['definition']);
  assert.equal(A.glossaryValue(e, r.doc, 'definition'), 'The body pictured as a tree.');
  assert.equal(A.glossaryValue(e, r.doc, 'en'), 'tree');
  assert.equal(A.termDecided(e, r.doc), false);
  assert.equal(A.termDecided(e, A.glossaryDecide(r.doc, e, 'approve', T)), true);
});

test('round trip driven by the Studio actions: approve everything, edit 1b, send', () => {
  let d = null;
  d = A.edit(d, unit, '1', { en: { '1b': 'time has entered the restless mind.' } }, T).doc;
  for (const s of unit.sections.filter(M.reviewable)) d = A.decide(d, unit, s.part, 'ok', T);
  d = A.send(d, unit, T);
  const inbox = path.join(dir, '.studio', 'staging', 'inbox');
  fs.mkdirSync(path.join(inbox, 'decisions'), { recursive: true });
  fs.writeFileSync(path.join(inbox, 'decisions', 'fx.01.json'), JSON.stringify(d));
  fs.mkdirSync(path.join(inbox, 'glossaryDecisions'), { recursive: true });
  for (const doc of textDocs('fixture').filter(x => x.collection === 'glossary')) {
    fs.writeFileSync(path.join(inbox, 'glossaryDecisions', doc.id + '.json'), JSON.stringify(A.glossaryDecide(null, doc.data, 'approve', T)));
  }
  const r = importStudio('fixture', { target: 'staging', dry: true });
  assert.equal(r.units[0].result, 'approved', JSON.stringify(r.units[0]));
});

test('diff: word level', () => {
  assert.deepEqual(diffWords('into the restless mind', 'the restless mind now'),
    [{ op: 'del', text: 'into ' }, { op: 'eq', text: 'the restless mind' }, { op: 'ins', text: ' now' }]);
});

test('save queue: one write in flight per document, set first then update, coalesced edits', async () => {
  const fake = createFakeDb({}, { latency: 5 });
  const states = [];
  const sync = createSync(fake.db, { onCollection() {}, onUnit() {}, onSaveState: s => states.push(s), onFatal() {} });
  let d = null;
  for (let i = 0; i < 5; i++) {
    d = A.edit(d, unit, 'head', { title: 'Title ' + i }, T).doc;
    sync.save('decisions/fx.01', d, { immediate: true });
  }
  await new Promise(r => setTimeout(r, 120));
  assert.equal(fake.maxInflight, 1);
  assert.equal(fake.log[0].op, 'set');
  assert.ok(fake.log.slice(1).every(w => w.op === 'update'));
  assert.ok(fake.log.length < 5, `coalesced into ${fake.log.length} writes`);
  assert.equal(fake.docs.get('decisions/fx.01').sections.head.title, 'Title 4');
  assert.equal(states.at(-1), 'saved');
  assert.equal(sync.dirty('decisions/fx.01'), false);
  sync.stop();
});

test('build: one self-contained page that respects the Artifact page contract', () => {
  const r = buildStudio({ target: 'staging' });
  assert.deepEqual(checkBuild(r.html, r.js), []);
  new vm.Script(r.js);
  assert.match(r.html.slice(0, 200), /<title>Studio Practice Room<\/title>/);
  assert.ok(r.html.includes('@media (prefers-color-scheme: dark)') && r.html.includes(':root[data-theme="dark"]'));
  assert.ok(!r.js.includes('createFakeDb'), 'the fake database never ships');
  assert.deepEqual(checkBuild('<title>x</title><script>alert(1)</script>', 'alert(1)').length, 1);
  assert.match(checkBuild('<title>x</title><img src="https://example.com/a.png">', '').join(), /example\.com/);
});
