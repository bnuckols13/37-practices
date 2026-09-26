// The shared review model: sheet output is stable, and the fixes the Studio depends on hold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratch, importAndMark, ingestAnswer, answer, fixture, read } from './helpers.mjs';

const dir = scratch();
const T = p => path.join(dir, 'texts', 'fixture', p);
const { segment } = await import('../lib/project.mjs');
const { writePacks } = await import('../lib/pack.mjs');
const { sheetBody } = await import('../lib/review/write.mjs');
const { reviewModel } = await import('../lib/review/model.mjs');
const { parseSheet } = await import('../lib/review/parse.mjs');
const { applyGlossary } = await import('../lib/accept.mjs');
const glossary = await import('../lib/glossary.mjs');

await importAndMark(dir);
segment('fixture');
writePacks('fixture', ['fx.01'], 'draft');
await ingestAnswer(dir, 'draft', 'fx.01', answer('draft-fx.01.json'));
writePacks('fixture', ['fx.01'], 'weave');
await ingestAnswer(dir, 'weave', 'fx.01', answer('weave-fx.01.json'));

test('the sheet is byte-identical to the golden copy (dates normalized)', () => {
  assert.equal(sheetBody('fixture', 'fx.01').replace(/\d{4}-\d{2}-\d{2}/g, 'DATE'), fixture('golden/sheet-fx.01.md'));
});

test('an unedited sheet parses to exactly the model labels', () => {
  const m = reviewModel('fixture', 'fx.01');
  const parsed = parseSheet('<!-- translate:sheet text=fixture unit=fx.01 draft=x weave=y sheet=z -->\n' + sheetBody('fixture', 'fx.01'));
  for (const sec of m.sections.filter(s => s.kind !== 'lacuna')) {
    const p = parsed.sections.find(s => s.level === 2 && s.key === sec.key);
    assert.ok(p, `section ${sec.key} on the sheet`);
    assert.deepEqual(p.labels, sec.labels, sec.key);
  }
});

test('sections carry a base hash that changes only with their own content', () => {
  const m1 = reviewModel('fixture', 'fx.01');
  const d = JSON.parse(read(T('drafts/fx.01.json')));
  d.lines.find(l => l.id === 'fx.01.2a').en = 'Make [great bliss]{mahasukha} steady:';
  fs.writeFileSync(T('drafts/fx.01.json'), JSON.stringify(d));
  const m2 = reviewModel('fixture', 'fx.01');
  const base = (m, key) => m.sections.find(s => s.key === key).base;
  assert.equal(base(m1, 'fx.01.1'), base(m2, 'fx.01.1'));
  assert.notEqual(base(m1, 'fx.01.2'), base(m2, 'fx.01.2'));
});

test('a redraft asked only on a commentary row becomes a weave pack that carries the note', () => {
  fs.writeFileSync(T('feedback.json'), JSON.stringify({ 'fx.01': { redraft: ['fx.01.m1'], notes: { 'fx.01.m1': 'Keep the iti gloss literal' } } }));
  const [p] = writePacks('fixture', ['fx.01'], 'draft');
  assert.equal(p.task, 'weave');
  assert.match(read(p.md), /Keep the iti gloss literal/);
  fs.writeFileSync(T('feedback.json'), JSON.stringify({ 'fx.01': { redraft: ['fx.01.m1', 'fx.01.2'], notes: {} } }));
  assert.equal(writePacks('fixture', ['fx.01'], 'draft')[0].task, 'redraft');
  fs.writeFileSync(T('feedback.json'), '{}');
});

test('re-applying a glossary decision does not re-date the entry', () => {
  const g = glossary.load();
  const sec = [{ level: 3, key: 'taruvara', labels: { Decision: 'approve' } }];
  applyGlossary(g, sec, 'Lena Rose', '2026-09-01');
  const r = applyGlossary(g, sec, 'Lena Rose', '2026-09-30');
  assert.deepEqual(r.approved, [], 'nothing newly approved');
  assert.equal(g.entries.find(e => e.id === 'taruvara').provenance.approved.date, '2026-09-01');
});
