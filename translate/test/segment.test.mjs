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

test('caryagiti: Wikisource layout, with a blank line between half-lines', () => {
  const [u] = run('@song 4\nক খ\n\nগ ঘ॥\n\nচ ছ\n\nজ ঝ॥ ধ্রু॥\n');
  assert.deepEqual(u.lines.map(l => [l.id, l.src]), [['fx.04.1a', 'ক খ'], ['fx.04.1b', 'গ ঘ॥'], ['fx.04.2a', 'চ ছ'], ['fx.04.2b', 'জ ঝ॥ ধ্রু॥']]);
});

test('caryagiti: an explicit @refrain overrides the ধ্রু cues on later couplets', () => {
  // Shastri prints ধ্রু after every couplet that follows the refrain.
  const src = '@song 5\nক খ॥\n@refrain\nগ ঘ\nঙ চ॥ ধ্রু॥\nছ জ\nঝ ঞ॥ ধ্রু॥\n';
  const [u] = run(src);
  const flagged = [...new Set(u.lines.filter(l => l.refrain).map(l => l.couplet))];
  assert.deepEqual(flagged, [2]);
  assert.ok(u.lines.every(l => !('dhru' in l)), 'no internal flags leak into the unit');
  const [v] = run(src.replace('@refrain\n', ''));
  assert.deepEqual([...new Set(v.lines.filter(l => l.refrain).map(l => l.couplet))], [2, 3], 'without @refrain, ধ্রু marks decide');
});

test('@emend can remove a word and leaves no stray spaces', () => {
  const [u] = run('@song 6\nনাম।  ক খ\nগ ঘ॥\n@emend fx.06.1a নাম। => | an attribution, not verse\n');
  assert.equal(u.lines[0].src, 'ক খ');
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

// A Tibetan translation marked as a parallel witness.
const tt = text;
const tib = tt.witnesses.find(w => w.id === 'tib');
const both = (bo, t = tt) => segment(t, [
  { witness: ed, path: 'ed.txt', content: fixture('marked-directives.txt') },
  { witness: tib, path: 'tib.txt', content: bo },
]);

test('parallel: Tibetan lines attach to the reading text ids, in Wylie', () => {
  const units = both('@-- a note\n@parallel\n@song 1\n@heading\nཔ་ཊ་མཉྫ་རི\n@verse\n།ལུས་ལྗོན་ཤིང་།\n།ག་ཡོ་བའི་སེམས།\n།བརྟན་པར་མཛོད་ཅིག\n@comm 1\n།ལུས་ཞེས་བྱ་བ་ལ་སོགས་པ་ནི།\nཕུང་པོ་ལྔའོ།\n@song 2\n@couplet 1\n@verse\n།གྲོང་ཁྱེར།\n');
  const [u, v] = units;
  assert.deepEqual(Object.keys(u.parallels.tib.lines), ['fx.01.h1', 'fx.01.1a', 'fx.01.1b', 'fx.01.2a']);
  assert.equal(u.parallels.tib.lang, 'bod');
  assert.deepEqual(u.parallels.tib.lines['fx.01.1a'], { src: '།ལུས་ལྗོན་ཤིང་།', translit: "/lus ljon shing /" });
  assert.equal(u.parallels.tib.commentary['fx.01.m1'].src, '།ལུས་ཞེས་བྱ་བ་ལ་སོགས་པ་ནི། ཕུང་པོ་ལྔའོ།', 'comment lines rejoin with a space');
  assert.deepEqual(u.witnesses, ['ed'], 'a parallel is not a reading witness');
  assert.ok(u.lines.every(l => l.witness === 'ed'));
  assert.deepEqual(Object.keys(v.parallels.tib.lines), ['fx.02.1a']);
  assert.match(units.warnings.join('\n'), /fx\.01: no tib parallel for fx\.01\.2b/);
});

test('parallel: the Tibetan never makes a draft stale, but has its own sha', () => {
  const plain = run(fixture('marked-directives.txt'))[0];
  const a = both('@parallel\n@song 1\n@verse\n།ལུས།\n')[0];
  const b = both('@parallel\n@song 1\n@verse\n།ལུས་ཤིང་།\n')[0];
  assert.equal(a.sourceSha, plain.sourceSha);
  assert.equal(a.sourceSha, b.sourceSha);
  assert.ok(a.parallelSha && a.parallelSha !== b.parallelSha);
  assert.equal(plain.parallels, undefined);
});

test('parallel: @primary makes the Tibetan the reading text for a lost song and a lost ending', () => {
  const units = both([
    '@parallel',
    '@song 1', '@verse', '།ཀ།', '།ཁ།', '།ག།', '།ང།', '@primary', '@bhanita', '།ཅ།', '།ཆ།',
    '@parallel', '@comm 1', '།ཀ་ཞེས།', '@primary', '@comm 3', '།ཅ་ཞེས།',
    '@song 3', '@primary', '@raga dhanasī', '@poet p-dombi', '@heading', '།རཱ་ག།', '@verse', '།ཏ།', '།ཐ།', '@refrain', '།ད།', '།ན།', '།པ།', '།ཕ།',
    '@comm', '།ངོ་སྤྲོད།', '@comm 1', '།ཏ་ཞེས།',
  ].join('\n'));
  const u = units[0], lost = units.find(x => x.id === 'fx.03');
  assert.deepEqual(u.lines.filter(l => l.witness === 'tib').map(l => [l.id, l.src, l.lang]), [['fx.01.3a', '།ཅ།', 'bod'], ['fx.01.3b', '།ཆ།', 'bod']]);
  assert.ok(u.lines.find(l => l.id === 'fx.01.3a').bhanita && !u.lines.find(l => l.id === 'fx.01.2b').bhanita);
  assert.deepEqual(u.witnesses, ['ed', 'tib']);
  assert.equal(u.commentary.at(-1).anchor, 'fx.01.3');
  assert.equal(u.commentary.at(-1).translit, '/ca zhes/');
  assert.deepEqual(Object.keys(u.parallels.tib.lines), ['fx.01.1a', 'fx.01.1b', 'fx.01.2a', 'fx.01.2b']);
  assert.deepEqual(Object.keys(u.parallels.tib.commentary), ['fx.01.m1']);
  assert.deepEqual(lost.witnesses, ['tib']);
  assert.equal(lost.raga, 'dhanasī');
  assert.deepEqual(lost.lines.map(l => l.id), ['fx.03.h1', 'fx.03.1a', 'fx.03.1b', 'fx.03.2a', 'fx.03.2b', 'fx.03.3a', 'fx.03.3b']);
  assert.ok(lost.lines.find(l => l.id === 'fx.03.2a').refrain);
  assert.ok(lost.lines.find(l => l.id === 'fx.03.3b').bhanita, 'the last couplet is the bhaṇitā, as for any song');
  assert.equal(lost.lines[1].translit, '/ta/');
  assert.deepEqual(lost.commentary.map(s => [s.id, s.anchor, s.lang]), [['fx.03.m1', 'fx.03', 'bod'], ['fx.03.m2', 'fx.03.1', 'bod']]);
  assert.equal(lost.parallels, undefined);
  assert.deepEqual(units.warnings, ['fx.01: no tib parallel for fx.01.h1'], 'primary lines need no parallel; only the heading is unmatched');
});

test('parallel: mismatches are errors that say what to do', () => {
  assert.throws(() => both('@parallel\n@song 1\n@verse\nཀ\nཁ\nག\nང\nཅ\n'), /tib.txt:8: fx\.01 has 4 verse line\(s\).*put @primary before them/);
  assert.throws(() => both('@parallel\n@song 9\n@verse\nཀ\n'), /tib.txt:2: the reading text has no unit 9.*@primary/);
  assert.throws(() => both('@parallel\n@song 1\n@comm 2\nཀ\n'), /tib.txt:3: fx\.01 has no commentary segment on couplet 2/);
  assert.throws(() => both('@parallel\n@song 1\n@refrain\n'), /@refrain marks the reading text/);
  assert.throws(() => both('@parallel\n@song 1\n@couplet 7\n@verse\nཀ\n'), /no couplet 7/);
});

test('tengyur import: folio lines joined, a line per pāda, sentence and lemma, notes resolved to the Degé reading', async () => {
  const { normalizeTengyur, extractText } = await import('../lib/import/tengyur.mjs');
  const vol = '\uFEFF[158a.7]…{D2292}ཨ།\n[158b]{D2293}༄༅། །ཀ་ཁ། །ག་ང་བ། །ཅ་ཆ་\n[158b.2]ཇ་ཉག །ཏ་ཐ། དེ་ཞེས་བྱ་བ་ལ་སོགས་པ་ནི་ན་(པ,ཕ)། {ཡིན,ཡིན}། [ཞ]#{D2294}ཟ།';
  assert.equal(normalizeTengyur(extractText(vol, '2293')), [
    '༄༅།', '།ཀ་ཁ།', '།ག་ང་བ།', '།ཅ་ཆ་ཇ་ཉག', '།ཏ་ཐ།', 'དེ་ཞེས་བྱ་བ་ལ་སོགས་པ་ནི་ན་པ། ཡིན། ཞ', '',
  ].join('\n'));
});

test('Tibetan forms match whole syllables, with particles written onto the last one', async () => {
  const { tibetanIndex } = await import('../lib/translit/tibetan.mjs');
  assert.equal(tibetanIndex('།གཡོ་བའི་སེམས་ལ་སྒྲ་གཅན་རབ་ཏུ་འཇུག', 'སྒྲ་གཅན'), 16);
  assert.equal(tibetanIndex('གཅིག་ཉིད་པད་འདབ', 'པད'), 9, 'pad as a syllable');
  assert.equal(tibetanIndex('སྤྲུལ་པའི་འཁོར་ལོར་པདྨ', 'པད'), -1, 'not inside pad+ma');
  assert.equal(tibetanIndex('བདག་མེད་མས་', 'བདག་མེད་མ'), 0, 'with the -s particle');
  assert.equal(tibetanIndex('བདག་མེད་མར་', 'བདག་མེད་མ་'), 0, 'a trailing tsheg in the form is ignored');
  assert.equal(tibetanIndex('ཀྱེའི་གཡུང་མོ', 'གཡུ'), -1, 'not part of a syllable (g.yu in g.yung)');
});

test('glossary matching: the longest term wins, compounds still count, positions are kept', async () => {
  const { matchSource } = await import('../lib/glossary.mjs');
  const { Entry } = await import('../schemas/glossary.mjs');
  const e = (id, san) => Entry.parse({ id, type: 'term', status: 'proposed', en: id, match: { san } });
  const es = [e('citta', ['চিত্ত']), e('bodhicitta', ['বোধিচিত্ত']), e('moon', ['চন্দ্র']), e('abhasa', ['াভাস'])];
  const ids = s => matchSource(es, s, 'san').map(h => h.id);
  assert.deepEqual(ids('বোধিচিত্তং'), ['bodhicitta'], 'citta inside bodhicitta is bodhicitta');
  assert.deepEqual(ids('বোধিচিত্তং চিত্তবটুক'), ['citta', 'bodhicitta'], 'citta elsewhere in the string still counts');
  assert.deepEqual(ids('তনুতরচিত্তাঙ্কুরক'), ['citta'], 'inside a compound no entry covers');
  assert.deepEqual(ids('চন্দ্রাভাস'), ['moon', 'abhasa'], 'side by side in a compound, both count');
  const [h] = matchSource(es, 'বোধিচিত্তং চিত্তবটুক', 'san');
  assert.equal(h.at, 'বোধিচিত্তং '.length, 'the hit points at the occurrence that counts');
  const { kwic } = await import('../lib/concord.mjs');
  assert.equal(kwic('বোধিচিত্তং চিত্তবটুক', 'bodhicittaṃ cittavaṭuka', h.form, h.at).tlHit, 'cittavaṭuka');
});

test('parallel: @split divides a line between two comments; extra heading lines join the heading', () => {
  const [u] = both('@parallel\n@song 1\n@heading\n།པ་ཊ།\n།ལཱུ་ཡི་པའི་ཞབས་ཀྱིའོ།\n@comm 1\n@split ལུས་ཞེས\n།གསུངས་ཏེ། ལུས་ཞེས་བྱ་བ་ལ་སོགས་པ་ནི་ཕུང་པོའོ།\n@skip\n');
  assert.equal(u.parallels.tib.lines['fx.01.h1'].src, '།པ་ཊ། །ལཱུ་ཡི་པའི་ཞབས་ཀྱིའོ།', 'the poet line joins the rāga');
  assert.equal(u.parallels.tib.commentary['fx.01.m1'].src, '།གསུངས་ཏེ།', 'the rest was skipped');
  const [v] = both('@parallel\n@song 1\n@comm 1\n@split ཀ\n།ངོ། ཀ་ཁ།\n@verse\nག\n');
  assert.equal(v.parallels.tib.commentary['fx.01.m1'].src, '།ངོ།');
  assert.deepEqual([v.parallels.tib.lines['fx.01.1a'].src, v.parallels.tib.lines['fx.01.1b'].src], ['ཀ་ཁ།', 'ག'], 'the rest starts the next block');
  assert.throws(() => both('@parallel\n@song 1\n@comm 1\n@split ཀ\n།ངོ། ཀ་ཁ།\nག\n'), /the rest of the split line needs a directive/);
  assert.throws(() => both('@parallel\n@song 1\n@comm 1\n@split ཆ\n།ངོ། ཀ་ཁ།\n@comm 1\n'), /is not inside the next line/);
});
