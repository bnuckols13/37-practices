// The mixing board: the English ear, the source's rhyme and weight, and the two boards compared.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../lib/ear.mjs';
import * as en from '../lib/english.mjs';
import { sourceRhyme, morae, sourceBoard, englishBoard, compareBoards, temperature, markedWords, readingText } from '../lib/reading.mjs';

test('english: stresses are counted, not syllables, and stress is relative', () => {
  assert.equal(en.scan('Tyger Tyger, burning bright,').beats, 4);
  assert.equal(en.scan('Tyger Tyger, burning bright,').pattern, '/x/x/x/');
  // Morton's reading of Tintern Abbey: a spondee opens it, six stresses in all
  assert.equal(en.scan('Five years have passed; five summers, with the length').beats, 6);
  // three strong monosyllables in a row: the middle one falls
  assert.equal(en.scan("the road's come clear").pattern, 'x/x/');
  // a name the dictionary lacks is read from its spelling
  assert.deepEqual(en.wordStress('Ḍombī'), [1, 0]);
});

test('english: the solar system of rhyme', () => {
  const k = (a, b) => en.rhymeWords(a, b).kind;
  assert.equal(k('Ḍombī', 'Ḍombī'), 'absolute');
  assert.equal(k('bright', 'night'), 'perfect');
  assert.equal(k('sun', 'bundle'), 'vowel');
  assert.equal(k('love', 'move'), 'off');
  assert.equal(k('hall', 'hell'), 'para');
  assert.equal(k('clear', 'town'), 'none');
  assert.equal(en.rhymeWords('shaken', 'taken').feminine, true);
  assert.deepEqual(en.syntaxOf(['I went and I ate and I slept']), { para: 2, hypo: 0 });
  assert.deepEqual(en.syntaxOf(['when I went, because I was hungry']), { para: 1, hypo: 2 });
});

test('source: rhymes and mātrās from the transliteration', () => {
  assert.equal(sourceRhyme('parimāṇa', 'jāṇa'), 'perfect');
  assert.equal(sourceRhyme('sāṅga', 'lāga'), 'vowel');
  assert.equal(sourceRhyme('pulindā', 'chandā'), 'off');
  assert.equal(sourceRhyme('ḍombī', 'ḍombi'), 'absolute');
  // kāā tarubara pañca bi ḍāla: 2+2 + 1+1+1+1 + 2+1 + 1 + 2+1
  assert.equal(morae('kāā tarubara pañca bi ḍāla'), 15);
});

const UNIT = {
  id: 'fx.09', raga: 'test', poet: '', lines: [
    { id: 'fx.09.1a', group: 'fx.09.1', role: 'line', couplet: 1, src: 'ক', translit: 'nagara bāhire ḍombi kuṛiā' },
    { id: 'fx.09.1b', group: 'fx.09.1', role: 'line', couplet: 1, src: 'খ॥', translit: 'chaichoi jāi so bāhma nāṛiā|| dhru||' },
    { id: 'fx.09.2a', group: 'fx.09.2', role: 'line', couplet: 2, refrain: true, src: 'গ', translit: 'ālo ḍombi toe sama karibe sāṅga' },
    { id: 'fx.09.2b', group: 'fx.09.2', role: 'line', couplet: 2, refrain: true, src: 'ঘ॥', translit: 'nighiṇa kāhna kāpāli joi lāga|| dhru||' },
  ],
};

test('boards: the source runs hot in rhyme; a flat English runs cool, and the advice says so', () => {
  const src = sourceBoard(UNIT, { lines: [] });
  assert.equal(src.couplets[0].kind, 'perfect');
  assert.ok(src.channels.rhyme.heat >= 0.55, `rhyme heat ${src.channels.rhyme.heat}`);
  assert.equal(src.repeats.struck[0][0], 'ḍombi');
  const flat = englishBoard(UNIT, [
    { id: 'fx.09.1a', en: 'Outside the town, Ḍombī, is your hut.' },
    { id: 'fx.09.1b', en: 'Touching and touching, that brahmin goes by.' },
    { id: 'fx.09.2a', en: 'Hey Ḍombī, I will keep company with you;' },
    { id: 'fx.09.2b', en: 'Kāṇha the yogi, without disgust, clings close.' },
  ]);
  const sung = englishBoard(UNIT, [
    { id: 'fx.09.1a', en: 'Out past the town, Ḍombī, your hut;' },
    { id: 'fx.09.1b', en: 'the shaven brahmin brushes by and shuts.' },
    { id: 'fx.09.2a', en: 'Hey Ḍombī, I will lie with you,' },
    { id: 'fx.09.2b', en: 'Kāṇha the yogi, unafraid, holds true.' },
  ]);
  assert.equal(flat.couplets[0].kind, 'none');
  assert.equal(sung.couplets[1].kind, 'perfect');
  assert.ok(sung.channels.rhyme.heat > flat.channels.rhyme.heat);
  const adv = compareBoards(src, flat, { label: 'flat' });
  assert.ok(adv.some(a => a.startsWith('fx.09.1: the source chimes (perfect')), adv.join('\n'));
  assert.ok(!compareBoards(src, sung).some(a => a.startsWith('fx.09.2')));
  assert.equal(temperature(0.9), 'hot');
  assert.equal(temperature(0.1), 'cool');
});

test('reading text: five steps, in order', () => {
  const src = sourceBoard(UNIT, { lines: [] });
  const text = readingText(UNIT, src, [], { images: markedWords([{ id: 'fx.09.1a', en: 'the [town]{town}, your [hut]{hut}, the [town]{town}' }]) });
  const steps = ['STRUCTURE', 'TEXTURE', 'PERCEPTION', 'NARRATOR', 'NARRATIVE'].map(s => text.indexOf(s));
  assert.ok(steps.every((n, i) => n > 0 && (i === 0 || n > steps[i - 1])), text);
  assert.match(text, /town → hut/);
});
