// Studio sync: export -> (decisions made in the Studio) -> import gives the same record as the sheet path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratch, importAndMark, ingestAnswer, answer, decideAll, read } from './helpers.mjs';

const { segment } = await import('../lib/project.mjs');
const { writePacks } = await import('../lib/pack.mjs');
const { writeSheet } = await import('../lib/review/write.mjs');
const { acceptSheet } = await import('../lib/accept.mjs');
const { textDocs, unitDoc, entrySha } = await import('../lib/studio/docs.mjs');
const { writeOutbox, markSeeded, studioDir, BATCH_SIZE } = await import('../lib/studio/outbox.mjs');
const { importStudio } = await import('../lib/studio/import.mjs');
const glossary = await import('../lib/glossary.mjs');
const { Decision } = await import('../schemas/studio.mjs');

async function draftedHome() {
  const dir = scratch();
  await importAndMark(dir);
  segment('fixture');
  writePacks('fixture', ['fx.01'], 'draft');
  await ingestAnswer(dir, 'draft', 'fx.01', answer('draft-fx.01.json'));
  writePacks('fixture', ['fx.01'], 'weave');
  await ingestAnswer(dir, 'weave', 'fx.01', answer('weave-fx.01.json'));
  return dir;
}

/** What the Studio page writes when the reviewer approves every section and edits 1b. */
function studioDecision(doc, { edit = true, ready = true, skip = [] } = {}) {
  const sections = {};
  for (const s of doc.sections) {
    if (s.kind === 'lacuna' || skip.includes(s.part)) continue;
    sections[s.part] = { base: s.base, decision: 'ok' };
    if (edit && s.part === '1') sections[s.part].en = { '1b': 'time has entered the restless mind.' };
  }
  return { v: 1, unit: doc.id, draftSha: doc.draftSha, weaveSha: doc.weaveSha, updatedAt: '2026-09-27T10:00:00Z',
    ready, readyAt: ready ? '2026-09-27T10:00:00Z' : null, answers: [], sections };
}

function putInbox(dir, collection, id, data) {
  const p = path.join(dir, '.studio', 'staging', 'inbox', collection, id + '.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data));
}

const approveAllGlossary = dir => {
  for (const e of glossary.load().entries) {
    putInbox(dir, 'glossaryDecisions', e.id, { v: 1, id: e.id, entrySha: entrySha(e), updatedAt: '2026-09-27T09:00:00Z', decision: 'approve', fields: {}, edited: [] });
  }
};

test('export: every doc fits the budget, the index is written last, batches hold at most 50 writes', async () => {
  const dir = await draftedHome();
  const docs = textDocs('fixture');
  assert.deepEqual(docs.map(d => d.collection), ['glossary', 'glossary', 'glossary', 'units', 'meta']);
  const unit = docs.find(d => d.collection === 'units').data;
  assert.deepEqual(unit.sections.map(s => s.part), ['head', 'h', '1', 'm1', '2']);
  assert.equal(unit.sections.find(s => s.part === 'm1').anchorPart, '1');
  const r = writeOutbox('staging', docs);
  assert.equal(r.count, docs.length);
  for (const b of r.batches) {
    const { writes } = JSON.parse(read(b));
    assert.ok(writes.length <= BATCH_SIZE);
    for (const w of writes) {
      assert.equal(w.op, 'set');
      assert.match(w.collection, /^(glossary|units|meta)$/);
      assert.ok(fs.existsSync(w.file_path));
    }
  }
  markSeeded('staging');
  assert.equal(writeOutbox('staging', textDocs('fixture')).count, 0, 'nothing changed, nothing to write');
  const meta = docs.at(-1).data;
  assert.equal(meta.songs[0].stage, 'in review');
  assert.ok(meta.checklist.find(c => c.id === 'draft').done);
});

test('round trip: a Studio review gives the same approved record as the sheet review', async () => {
  // Sheet path
  const a = await draftedHome();
  writeSheet('fixture', 'fx.01');
  const sheet = path.join(a, 'texts', 'fixture', 'review', 'fx.01.md');
  decideAll(sheet);
  fs.writeFileSync(sheet, read(sheet).replace('into the restless mind, time has entered.', 'time has entered the restless mind.'));
  const viaSheet = acceptSheet('fixture', 'fx.01', { dry: true }).record;

  // Studio path
  const b = await draftedHome();
  const doc = unitDoc('fixture', 'fx.01');
  const decision = studioDecision(doc);
  assert.ok(Decision.safeParse(decision).success);
  putInbox(b, 'decisions', 'fx.01', decision);
  approveAllGlossary(b);
  const r = importStudio('fixture', { target: 'staging' });
  assert.equal(r.units[0].result, 'approved', JSON.stringify(r.units[0]));
  const viaStudio = JSON.parse(read(path.join(b, 'texts', 'fixture', 'approved', 'fx.01.json')));

  const strip = x => { const c = structuredClone(x); for (const k of ['sheetSha', 'via', 'date']) delete c.provenance.review[k]; delete c.provenance.draft.date; if (c.provenance.weave) delete c.provenance.weave.date; return c; };
  assert.deepEqual(strip(viaStudio), strip(viaSheet));
  assert.equal(viaStudio.provenance.review.via, 'studio');
  assert.equal(viaStudio.provenance.review.date, '2026-09-27');
  assert.ok(fs.existsSync(path.join(b, 'texts', 'fixture', 'review', 'fx.01.studio.json')), 'audit copy kept');
  assert.ok(r.outbox.count > 0, 'receipts and updated docs queued for the Studio');
  const receipt = JSON.parse(read(path.join(studioDir('staging'), 'out', 'receipts', 'fx.01.json')));
  assert.equal(receipt.result, 'approved');
  assert.equal(receipt.decisionUpdatedAt, decision.updatedAt);

  // Importing the same decisions again changes nothing.
  const again = importStudio('fixture', { target: 'staging' });
  assert.equal(again.units[0].result, 'already imported');
  assert.equal(glossary.load().entries.find(e => e.id === 'taruvara').provenance.approved.date, '2026-09-27');
});

test('import: partial, unsent and stale decisions are reported, not approved', async () => {
  const dir = await draftedHome();
  const doc = unitDoc('fixture', 'fx.01');
  approveAllGlossary(dir);

  putInbox(dir, 'decisions', 'fx.01', studioDecision(doc, { ready: false }));
  assert.equal(importStudio('fixture', { target: 'staging', dry: true }).units[0].result, 'not sent');

  putInbox(dir, 'decisions', 'fx.01', studioDecision(doc, { skip: ['2'] }));
  const partial = importStudio('fixture', { target: 'staging', dry: true }).units[0];
  assert.equal(partial.result, 'not approved');
  assert.deepEqual(partial.pending, ['fx.01.2']);

  putInbox(dir, 'decisions', 'fx.01', { ...studioDecision(doc), draftSha: 'deadbeef0000' });
  const stale = importStudio('fixture', { target: 'staging', dry: true }).units[0];
  assert.equal(stale.result, 'stale');
});

test('import: a glossary decision made against an older entry is skipped', async () => {
  const dir = await draftedHome();
  putInbox(dir, 'glossaryDecisions', 'taruvara', { v: 1, id: 'taruvara', entrySha: 'old000000000', updatedAt: '2026-09-27T09:00:00Z', decision: 'approve', fields: {}, edited: [] });
  const r = importStudio('fixture', { target: 'staging', dry: true });
  assert.match(r.glossary.skipped.join(), /changed after you edited it/);
});

test('import: edited glossary fields apply; untouched fields stay', async () => {
  const dir = await draftedHome();
  const e = glossary.load().entries.find(x => x.id === 'taruvara');
  putInbox(dir, 'glossaryDecisions', 'taruvara', { v: 1, id: 'taruvara', entrySha: entrySha(e), updatedAt: '2026-09-27T09:00:00Z',
    decision: 'approve', fields: { definition: 'The body pictured as a tree.', en: 'IGNORED' }, edited: ['definition'] });
  importStudio('fixture', { target: 'staging' });
  const after = glossary.load().entries.find(x => x.id === 'taruvara');
  assert.equal(after.definition, 'The body pictured as a tree.');
  assert.equal(after.en, 'tree', 'a field not listed in edited is not applied');
  assert.equal(after.status, 'approved');
});

test('import: untrusted docs that do not match the schema are rejected with a reason', async () => {
  const dir = await draftedHome();
  putInbox(dir, 'decisions', 'fx.01', { v: 1, unit: 'fx.01', sections: 'not an object' });
  const r = importStudio('fixture', { target: 'staging', dry: true });
  assert.match(r.problems.join(), /decisions\/fx\.01/);
});
