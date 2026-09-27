// Versions: poems made from a song in the Workshop, filed, checked, kept and rendered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratch, importAndMark, ingestAnswer, answer, read } from './helpers.mjs';

const dir = scratch();
const T = p => path.join(dir, 'texts', 'fixture', p);
const { segment } = await import('../lib/project.mjs');
const { writePacks } = await import('../lib/pack.mjs');
const { importVersions, keepVersion, listVersions, validateVersion, lenses } = await import('../lib/versions.mjs');
const { render } = await import('../lib/render/index.mjs');
const { check } = await import('../lib/check.mjs');

await importAndMark(dir);
segment('fixture');
writePacks('fixture', ['fx.01'], 'draft');
await ingestAnswer(dir, 'draft', 'fx.01', answer('draft-fx.01.json'));

const VERSION = {
  unit: 'fx.01', title: 'The Tree', lens: 'blake', latitude: 'close',
  board: { lineation: 0.9, syntax: 0.8, rhythm: 0.9, rhyme: 0.8 },
  voice: 'TEST FIXTURE. A plain teacher.', refrainCue: 'The body is a tree',
  lines: [
    { id: 'fx.01.1a', en: 'The body is a tree; its branches are five.' },
    { id: 'fx.01.1b', en: 'Time has come into the restless mind.' },
    { id: 'fx.01.2a', en: 'Make great bliss firm, and measure it well:' },
    { id: 'fx.01.2b', en: 'ask the guru and know. Lūyī says, tell.' },
  ],
  couplets: [
    { group: 'fx.01.1', kept: 'A vowel rhyme on five / mind.', letGo: '' },
    { group: 'fx.01.2', kept: 'Perfect rhyme on well / tell.', letGo: 'Tell is thin.' },
  ],
  added: [], note: '',
};
const v = patch => ({ ...structuredClone(VERSION), ...patch });

test('lenses: each has a board and a way of moving', () => {
  const ls = lenses();
  assert.ok(ls.length >= 6);
  for (const l of ls) {
    assert.ok(l.id && l.name && l.how && l.after, l.id);
    for (const c of ['lineation', 'syntax', 'rhythm', 'rhyme']) assert.ok(l.board[c] >= 0 && l.board[c] <= 1, `${l.id} ${c}`);
  }
});

test('import holds a version to the song\'s shape, its refrain and the glossary', () => {
  const bad = importVersions('fixture', [
    v({ lines: VERSION.lines.slice(1) }),
    v({ refrainCue: 'Time has come' }),
    v({ lens: 'milton' }),
    v({ lines: VERSION.lines.map((l, i) => (i ? l : { ...l, en: 'The body is a tree: the five aggregates;' })) }),
  ], { by: 'Tester' });
  assert.deepEqual(bad.map(r => r.ok), [false, false, false, false]);
  assert.match(bad[0].errors.join(), /lines must be fx\.01\.1a/);
  assert.match(bad[1].errors.join(), /is not the opening of the refrain/);
  assert.match(bad[2].errors.join(), /unknown lens "milton"/);
  assert.match(bad[3].errors.join(), /"aggregates" inside a line/);
  assert.match(importVersions('fixture', v(), {})[0].errors.join(), /who made it/);

  const [ok] = importVersions('fixture', v(), { by: 'Tester' });
  assert.ok(ok.ok, JSON.stringify(ok));
  assert.equal(ok.id, 'blake-the-tree');
  const [again] = importVersions('fixture', v({ made: '2030-01-01' }), { by: 'Tester' });
  assert.equal(again.id, 'blake-the-tree-2', 'a second version never overwrites the first');
  const filed = JSON.parse(read(T('versions/fx.01/blake-the-tree.json')));
  assert.equal(filed.status, 'draft');
  assert.equal(filed.by, 'Tester');
  assert.deepEqual(validateVersion('fixture', filed, { filed: true }).errors, []);
  assert.equal(listVersions('fixture', 'fx.01').length, 2);
});

test('a free version lists what it adds; a close one that adds is warned', () => {
  const { warnings } = validateVersion('fixture', v({ added: ['the river\'s cold'] }));
  assert.match(warnings.join(), /a close version lists additions/);
  assert.deepEqual(validateVersion('fixture', v({ latitude: 'free', added: ['the river\'s cold'] })).warnings, []);
});

test('keep: the Reading Room shows kept versions; preview shows drafts too; check finds broken ones', () => {
  render('fixture', { preview: true });
  const prev = read(path.join(dir, '.preview', 'translations', 'fixture', fs.readdirSync(path.join(dir, '.preview', 'translations', 'fixture')).find(f => /^0*1\.html$/.test(f))));
  assert.match(prev, /<section class="versions"/);
  assert.match(prev, /After William Blake/);
  assert.match(prev, /<span class="draft">draft<\/span>/);
  keepVersion('fixture', 'fx.01', 'blake-the-tree');
  assert.equal(JSON.parse(read(T('versions/fx.01/blake-the-tree.json'))).status, 'kept');
  keepVersion('fixture', 'fx.01', 'blake-the-tree', { undo: true });
  assert.equal(JSON.parse(read(T('versions/fx.01/blake-the-tree.json'))).status, 'draft');

  const p = T('versions/fx.01/blake-the-tree-2.json');
  const broken = JSON.parse(read(p));
  broken.lines[0].en = 'The body is a tree: the five aggregates;';
  fs.writeFileSync(p, JSON.stringify(broken));
  const { errors } = check('fixture');
  assert.ok(errors.some(e => /version blake-the-tree-2: fx\.01\.1a: "aggregates"/.test(e)), errors.join('\n'));
  assert.throws(() => keepVersion('fixture', 'fx.01', 'blake-the-tree-2'), /cannot be kept/);
});
