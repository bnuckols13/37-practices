import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { transliterate } from '../lib/translit/index.mjs';
import * as markup from '../lib/markup.mjs';
import { selectUnits, passageNo } from '../lib/ids.mjs';
import { Draft, TermsResult } from '../schemas/draft.mjs';
import { Weave } from '../schemas/weave.mjs';
import { parseSymbolic, formatSymbolic, decision } from '../lib/review/sheet.mjs';

test('Bengali to IAST: golden words', () => {
  const cases = [
    ['নগর বাহিরি', 'oben', 'nagara bāhiri'],
    ['ডোম্বি', 'oben', 'ḍombi'],
    ['কুড়িআ', 'oben', 'kuṛiā'],
    ['মহাসুহ', 'oben', 'mahāsuha'],
    ['চঞ্চল', 'oben', 'cañcala'],
    ['হিয়া', 'oben', 'hiyā'],
    ['সংসার', 'san', 'saṃsāra'],
    ['ক্ষণ', 'san', 'kṣaṇa'],
    ['জ্ঞান', 'san', 'jñāna'],
    ['ভব', 'san', 'bhava'],
    ['নির্বাণ', 'san', 'nirvāṇa'],
    ['বোধিচিত্ত', 'san', 'bodhicitta'],
    ['বুদ্ধ', 'san', 'buddha'],
  ];
  for (const [src, lang, want] of cases) assert.equal(transliterate(src, { lang }), want, src);
});

test('Devanagari to IAST', () => {
  assert.equal(transliterate('उत्पत्तिक्रम', { lang: 'san' }), 'utpattikrama');
  assert.equal(transliterate('महासुख', { lang: 'san' }), 'mahāsukha');
});

test('translit overrides apply per word', () => {
  assert.equal(transliterate('তরুবর পঞ্চ', { lang: 'oben', overrides: { 'তরুবর': 'taruvara' } }), 'taruvara pañca');
});

test('a vowel sign with no consonant to carry it is left out and reported; a restoration keeps it', () => {
  const heard = [];
  const warn = m => heard.push(m);
  // cp.14.2b: the edition prints এ with a stray ে after it
  assert.equal(transliterate('সদ্গুরু পাঅপএে জাইব', { lang: 'oben', warn }), 'sadguru pāapae jāiba');
  assert.deepEqual(heard, ['stray vowel sign ে after এ in পাঅপএে, left out of the transliteration']);
  assert.equal(transliterate('अे', { lang: 'san', warn }), 'a');
  assert.equal(heard.length, 2);
  // cp.01.m3: Shastri restores the ending in brackets, parting ā from its consonant
  assert.equal(transliterate('ধীর্যস্য[াঃ] প্রসাদাৎ', { lang: 'san', warn }), 'dhīryasy[āḥ] prasādāt');
  assert.equal(heard.length, 2, 'a restoration is not a stray sign');
  assert.equal(transliterate('পাঅপএে', { lang: 'oben', overrides: { 'পাঅপএে': 'pāapae' }, warn }), 'pāapae');
  assert.equal(heard.length, 2, 'an override settles the word');
  assert.equal(transliterate('পাঅপএে', { lang: 'oben' }), 'pāapae', 'no listener, no leak');
});

test('markup: parse, strip, problems, render', () => {
  const s = 'Outside the town, [Ḍombī]{dombi}, is your [hut]{kudia}.';
  assert.deepEqual(markup.terms(s).map(t => t.id), ['dombi', 'kudia']);
  assert.equal(markup.strip(s), 'Outside the town, Ḍombī, is your hut.');
  assert.deepEqual(markup.problems(s), []);
  assert.ok(markup.problems('a [b]{Bad Id} c').length);
  assert.ok(markup.problems('a b]{x} c').length);
  const html = markup.render('a < [b]{x}', (surf, id) => `<i data-g="${id}">${surf}</i>`, t => t.replace(/</g, '&lt;'));
  assert.equal(html, 'a &lt; <i data-g="x">b</i>');
});

test('unit selection and passage numbers', () => {
  const all = ['cp.01', 'cp.02', 'cp.10', 'cp.14'];
  assert.deepEqual(selectUnits(all, '1,10,14'), ['cp.01', 'cp.10', 'cp.14']);
  assert.deepEqual(selectUnits(all, 'cp.01..cp.10'), ['cp.01', 'cp.02', 'cp.10']);
  assert.deepEqual(selectUnits(all), all);
  assert.throws(() => selectUnits(all, '3'));
  assert.equal(passageNo('cp.10.1a'), '10.1');
  assert.equal(passageNo('cp.10.1'), '10.1');
});

test('answer schemas export to JSON Schema without constraint keywords', () => {
  for (const schema of [Draft, Weave, TermsResult]) {
    const js = JSON.stringify(z.toJSONSchema(schema));
    for (const kw of ['minLength', 'maxLength', 'minimum', 'maximum', 'pattern', 'minItems', 'maxItems', '$ref']) {
      assert.ok(!js.includes(`"${kw}"`), `${kw} in schema`);
    }
  }
});

test('symbolic reading format round-trips', () => {
  const sym = { image: 'the outcaste woman', readings: [{ referent: 'selflessness', per: 'Munidatta', where: ['cp.10.m1'] }] };
  assert.deepEqual(parseSymbolic(formatSymbolic(sym)), sym);
  assert.deepEqual(parseSymbolic(''), { image: '', readings: [] });
  assert.throws(() => parseSymbolic('image → a referent with no attribution'));
});

test('decision words', () => {
  assert.equal(decision('OK'), 'ok');
  assert.equal(decision(''), 'pending');
  assert.equal(decision('redraft'), 'redraft');
  assert.equal(decision('maybe'), 'invalid');
  assert.equal(decision('yes', 'glossary'), 'approve');
  assert.equal(decision('defer', 'glossary'), 'defer');
});
