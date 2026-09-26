import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Text } from '../schemas/text.mjs';
import { segment } from '../lib/segment/index.mjs';
import { fixture, FIX, read } from './helpers.mjs';
import path from 'node:path';

const text = Text.parse(JSON.parse(read(path.join(FIX, 'fixture', 'text.json'))));
const ed = text.witnesses[0];
const run = (content, t = text) => segment(t, [{ witness: ed, path: 'src.txt', content }]);

test('caryagiti: fixture songs get stable ids, refrain and bhaṇitā', () => {
  const units = run(fixture('marked-directives.txt'));
  assert.deepEqual(units.map(u => u.id), ['fx.01', 'fx.02']);
  const u = units[0];
  assert.deepEqual(u.lines.map(l => l.id), ['fx.01.h1', 'fx.01.1a', 'fx.01.1b', 'fx.01.2a', 'fx.01.2b']);
  assert.equal(u.raga, 'paṭamañjarī');
  assert.equal(u.poet, 'p-luyi');
  assert.ok(u.lines.find(l => l.id === 'fx.01.1a').refrain, 'ধ্রু marks the refrain');
  assert.ok(u.lines.find(l => l.id === 'fx.01.2b').bhanita, 'last couplet is the bhaṇitā');
  assert.ok(!u.lines.find(l => l.id === 'fx.01.1a').bhanita);
  assert.equal(u.commentary.length, 1);
  assert.equal(u.commentary[0].anchor, 'fx.01.1');
  assert.equal(u.commentary[0].lang, 'san', 'commentary defaults to the commentary language');
  assert.match(u.commentary[0].translit, /pañcaskandhāḥ/);
  assert.equal(units[1].lines.filter(l => l.role === 'line').length, 2);
});

test('caryagiti: one-line couplets split at the first internal daṇḍa; two-line couplets close at ॥', () => {
  const [u] = run('@song 3\nক খ। গ ঘ॥\nচ ছ।\nজ ঝ॥\n');
  assert.deepEqual(u.lines.map(l => [l.id, l.src]), [
    ['fx.03.1a', 'ক খ।'], ['fx.03.1b', 'গ ঘ॥'], ['fx.03.2a', 'চ ছ।'], ['fx.03.2b', 'জ ঝ॥'],
  ]);
});

test('directives: @couplet, @bhanita, @lacuna, @skip, @emend', () => {
  const [u] = run([
    '@skip', 'page title', '@song 4', '@couplet 3', 'ক খ। গ ঘ॥', '@lacuna folio missing', '@bhanita', 'চ ছ। জ ঝ॥', 'ট ঠ। ড ঢ॥',
    '@emend fx.04.3a খ => খা | reading of the facsimile',
  ].join('\n'));
  assert.deepEqual(u.lines.map(l => l.id), ['fx.04.3a', 'fx.04.3b', 'fx.04.x1', 'fx.04.4a', 'fx.04.4b', 'fx.04.5a', 'fx.04.5b']);
  assert.equal(u.lines[0].src, 'ক খা।');
  assert.deepEqual(u.lines[0].emended, [{ from: 'খ', to: 'খা', reason: 'reading of the facsimile' }]);
  assert.equal(u.lines[2].role, 'lacuna');
  assert.ok(u.lines[3].bhanita && !u.lines[5].bhanita, 'explicit @bhanita wins over "last couplet"');
});

test('directives: errors name the file and line', () => {
  assert.throws(() => run('ক খ। গ ঘ॥'), /src.txt:1: text before any unit/);
  assert.throws(() => run('@song 1\n@frobnicate\n'), /src.txt:2: unknown directive @frobnicate/);
  assert.throws(() => run('@song 1\nক খ। গ ঘ॥\n@emend fx.01.1a নেই => আছে'), /not found in fx.01.1a/);
});

test('sourceSha ignores transliteration but not text', () => {
  const a = run(fixture('marked-directives.txt'))[0];
  const b = segment(text, [{ witness: ed, path: 'x', content: fixture('marked-directives.txt') }], { 'তরুবর': 'taruvara' })[0];
  assert.notEqual(a.lines[1].translit, b.lines[1].translit);
  assert.equal(a.sourceSha, b.sourceSha);
  const c = run(fixture('marked-directives.txt').replace('পঞ্চ বি ডাল', 'পঞ্চ ডাল'))[0];
  assert.notEqual(a.sourceSha, c.sourceSha);
});

test('lines rule: stanzas, headings and commentary for any text', () => {
  const t = Text.parse({ ...JSON.parse(read(path.join(FIX, 'fixture', 'text.json'))), segmentation: { rule: 'lines' } });
  const [u] = run('@heading\nA title\n@verse\nline one\nline two\n\nline three\n@comm s2\nabout stanza two', t);
  assert.deepEqual(u.lines.map(l => [l.id, l.group]), [
    ['fx.01.h1', 'fx.01.h'], ['fx.01.1', 'fx.01.s1'], ['fx.01.2', 'fx.01.s1'], ['fx.01.3', 'fx.01.s2'],
  ]);
  assert.equal(u.commentary[0].anchor, 'fx.01.s2');
});
