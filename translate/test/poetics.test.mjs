// Any English poem on Morton's board: the English ear's fixes, and every reading in lib/poetics.mjs.
// Public-domain texts only (Shakespeare, Blake) and lines made up for the tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dictionary } from '../lib/ear.mjs';
import * as en from '../lib/english.mjs';
import { syntaxChannel } from '../lib/board.mjs';
import * as po from '../lib/poetics.mjs';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'cli.mjs');

// Sonnet 29, the modern text of research/shakespeare-sonnets.md §1b.
const S29 = `When, in disgrace with fortune and men's eyes,
I all alone beweep my outcast state,
And trouble deaf heaven with my bootless cries,
And look upon myself and curse my fate,
Wishing me like to one more rich in hope,
Featured like him, like him with friends possessed,
Desiring this man's art and that man's scope,
With what I most enjoy contented least;
Yet in these thoughts myself almost despising,
Haply I think on thee, and then my state,
(Like to the lark at break of day arising
From sullen earth) sings hymns at heaven's gate;
   For thy sweet love remembered such wealth brings
   That then I scorn to change my state with kings.`;
const L29 = S29.split('\n');

const S116 = `Let me not to the marriage of true minds
Admit impediments. Love is not love
Which alters when it alteration finds,
Or bends with the remover to remove:
O no! it is an ever-fixed mark
That looks on tempests and is never shaken;
It is the star to every wandering bark,
Whose worth's unknown, although his height be taken.
Love's not Time's fool, though rosy lips and cheeks
Within his bending sickle's compass come;
Love alters not with his brief hours and weeks,
But bears it out even to the edge of doom.
   If this be error and upon me proved,
   I never writ, nor no man ever loved.`;

const S130 = `My mistress' eyes are nothing like the sun;
Coral is far more red than her lips' red;
If snow be white, why then her breasts are dun;
If hairs be wires, black wires grow on her head.
I have seen roses damasked, red and white,
But no such roses see I in her cheeks;
And in some perfumes is there more delight
Than in the breath that from my mistress reeks.
I love to hear her speak, yet well I know
That music hath a far more pleasing sound;
I grant I never saw a goddess go;
My mistress, when she walks, treads on the ground.
   And yet, by heaven, I think my love as rare
   As any she belied with false compare.`;

const TYGER = `Tyger Tyger, burning bright,
In the forests of the night;
What immortal hand or eye,
Could frame thy fearful symmetry?

In what distant deeps or skies.
Burnt the fire of thine eyes?
On what wings dare he aspire?
What the hand, dare seize the fire?

And what shoulder, & what art,
Could twist the sinews of thy heart?
And when thy heart began to beat,
What dread hand? & what dread feet?

What the hammer? what the chain,
In what furnace was thy brain?
What the anvil? what dread grasp,
Dare its deadly terrors clasp!

When the stars threw down their spears
And water'd heaven with their tears:
Did he smile his work to see?
Did he who made the Lamb make thee?

Tyger Tyger burning bright,
In the forests of the night:
What immortal hand or eye,
Dare frame thy fearful symmetry?`;

const LAMB = `Little Lamb who made thee
Dost thou know who made thee
Gave thee life & bid thee feed.
By the stream & o'er the mead;
Gave thee clothing of delight,
Softest clothing wooly bright;
Gave thee such a tender voice,
Making all the vales rejoice!
Little Lamb who made thee
Dost thou know who made thee

Little Lamb I'll tell thee,
Little Lamb I'll tell thee!
He is called by thy name,
For he calls himself a Lamb:
He is meek & he is mild,
He became a little child:
I a child & thou a lamb,
We are called by his name.
Little Lamb God bless thee.
Little Lamb God bless thee.`;

// Made for these tests.
const GHAZAL = `The moon is late tonight, say nothing;
the candle burns too bright, say nothing.
I asked the wind for word of you;
it turned and took its flight, say nothing.
My heart would write a letter home;
the ink is black as night, say nothing.`;

const RUBAI = `Beyond the gate there is a field of grain
where neither loss nor profit leaves a stain;
the traveller who reaches it lies down,
and neither name nor road is there, nor pain.`;

const TERZA = `I walked along the river in the rain
and watched the water carry off the light;
the willows bent above it in their pain.
The sparrows gathered, silent, out of sight,
and every stone was darker than the stone
that lay beside it waiting for the night.
I turned for home and found myself alone.`;

const BALLAD = `The miller walked the river road
and sang his morning song;
the water turned the wooden wheel
that rolled the day along.

The children ran to meet him there
beside the mossy stone;
he gave them bread and sent them back
and walked the road alone.`;

const PETRARCH = `The morning opens slowly on the bay,
the boats lie quiet where the water sleeps,
a heron stands above the shallow deeps,
and all the harbour waits for light of day.
The fishermen have nothing more to say;
the tide comes in along the stony steeps
and draws its silver back, and slowly creeps
across the sand where children used to play.
Then comes the sun, and every roof is bright,
and every window answers with a flame;
the gulls go up like paper into light,
the heron lifts, and no one calls its name,
the boats go out, and all the bay is white,
and nothing that was sleeping is the same.`;

const FREE = `A kettle on the stove
and the window open to the yard where
my neighbour, who has never spoken to me,
is carrying a ladder
toward the pear tree`;

const DRUM = `Beat the drum and beat the drum,
beat the drum and here we come;
beat the drum and beat the drum,
beat the drum and here we come.`;

// ---------------------------------------------------------------- the ear's fixes

test('ear: light words of two syllables keep both; upon, because carry the stress on the second, into and unto on neither', () => {
  assert.deepEqual(en.wordStress('upon'), [0, 1]);
  assert.deepEqual(en.wordStress('because'), [0, 1]);
  assert.deepEqual(en.wordStress('until'), [0, 1]);
  assert.deepEqual(en.wordStress('into'), [0, 0]);
  assert.deepEqual(en.wordStress('unto'), [0, 0]);
  assert.ok(en.isLight('upon') && en.isLight('beneath') && !en.isLight('state'));
  // Sonnet 29, line 4: nine syllables before, ten now
  assert.deepEqual([en.scan(L29[3]).syllables, en.scan(L29[3]).pattern], [10, 'x/x/x/x/x/']);
  assert.equal(en.syllableCount('I went into the house'), 6);
});

test('ear: an English word the dictionary lacks is read as English; IAST names still by the Sanskrit rule', () => {
  assert.deepEqual(en.wordStress('beweep'), [0, 1]);
  assert.deepEqual(en.wordStress('bootless'), [1, 0]);
  assert.deepEqual(en.wordStress("featur'd"), [1, 0]);
  assert.equal(en.phones('beweep').known, true, 'derived: be- + weep');
  assert.deepEqual([en.scan(L29[1]).syllables, en.scan(L29[1]).pattern], [10, 'x/x/x/x/x/']);
  assert.deepEqual(en.wordStress('Ḍombī'), [1, 0]);
  assert.deepEqual(en.wordStress('kāpālika'), [0, 1, 0, 0]);
  assert.deepEqual(en.wordStress('Kāṇha'), [1, 0]);
  // Without the dictionary (the Workshop before it loads), the spelling rules alone
  en.useDictionary(null);
  try {
    assert.deepEqual(en.wordStress('beweep'), [0, 1]);
    assert.deepEqual(en.wordStress('bootless'), [1, 0]);
    assert.deepEqual(en.wordStress('upon'), [0, 1]);
    assert.deepEqual(en.wordStress('Ḍombī'), [1, 0]);
    assert.deepEqual(en.wordStress('pulinda'), [0, 1, 0], 'no marks, but shaped like Sanskrit');
  } finally { en.useDictionary(dictionary); }
});

test('ear: elision only when asked; heaven as heav\'n, desiring as three, never spirit as sprite', () => {
  assert.equal(en.scan(L29[2]).syllables, 11);
  const e = en.scan(L29[2], { elide: true });
  assert.equal(e.syllables, 10);
  assert.deepEqual(e.elided, [{ word: 'heaven', as: "heav'n" }]);
  assert.equal(en.scan(L29[6], { elide: true }).syllables, 10);
  assert.deepEqual(en.elision('desiring').stress, [0, 1, 0]);
  assert.deepEqual(en.elision('every').stress, [1, 0]);
  assert.equal(en.elision('over').as, "o'er");
  assert.equal(en.elision('spirit'), null);
  assert.equal(en.elision('state'), null);
  // a number elides only that many, from the left
  assert.equal(en.scan('Even the heaven and every flower', { elide: 1 }).elided.length, 1);
  assert.equal(en.scan('Even the heaven and every flower', { elide: true }).elided.length, 4);
});

test('ear: this and that in antithesis are both stressed; then takes the stress where it opens a clause', () => {
  const s = en.scan(L29[6]);
  assert.deepEqual(s.words.filter(w => w.w === 'this' || w.w === 'that').map(w => w.stress), [[1], [1]]);
  assert.equal(en.scan(L29[6], { elide: true }).pattern, 'x/x/x/x/x/');
  assert.deepEqual(en.scan(L29[9]).words.find(w => w.w === 'then').stress, [1]);
  assert.equal(en.scan(L29[13]).pattern, 'x/x/x/x/x/');
  assert.deepEqual(en.scan('Then I went home').words[0].stress, [1]);
  // not a pair of pointers, and not a clause-opening then
  assert.deepEqual(en.scan('I know that this is true').words.filter(w => w.w === 'this' || w.w === 'that').map(w => w.stress), [[0], [0]]);
  assert.deepEqual(en.scan('If snow be white, why then her breasts are dun;').words.find(w => w.w === 'then').stress, [0]);
});

test('ear: syntax sees the held main clause; Sonnet 29 runs mild, Blake stays hot', () => {
  const s29 = syntaxChannel(L29);
  assert.ok(s29.heat >= 0.35 && s29.heat <= 0.45, `Sonnet 29 syntax ${s29.heat}`);
  assert.deepEqual(s29.held, [{ from: 0, to: 8 }], 'When at line 1, Yet at line 9');
  assert.equal(s29.suspended, 8);
  assert.ok(s29.facts.some(f => /held back 8 lines/.test(f)), s29.facts.join('\n'));
  const blank = t => t.split('\n').filter(l => l.trim());
  assert.ok(syntaxChannel(blank(TYGER)).heat >= 0.75, `Tyger ${syntaxChannel(blank(TYGER)).heat}`);
  assert.ok(syntaxChannel(blank(LAMB)).heat >= 0.75, `Lamb ${syntaxChannel(blank(LAMB)).heat}`);
  // a line opening on a participle hangs under; a comma is half a join
  assert.equal(en.syntaxOf(['Wishing me like to one more rich in hope,']).hypo, 1);
  assert.equal(en.syntaxOf(['Featured like him, like him with friends possessed,']).para, 1);
  assert.ok(en.isParticiple('Desiring') && en.isParticiple("Featur'd") && !en.isParticiple('morning') && !en.isParticiple('thing'));
  // a question's main clause ("Did he smile") ends the wait
  assert.equal(en.syntaxOf(['When the stars threw down their spears', "And water'd heaven with their tears:", 'Did he smile his work to see?']).suspended, 0);
});

test('ear: rhyme across the dictionary\'s fire and expire; feminine only when both run past the stress', () => {
  assert.equal(en.rhymeWords('fire', 'expire').kind, 'perfect');
  assert.equal(en.rhymeWords('fire', 'expire').feminine, false);
  assert.equal(en.rhymeWords('despising', 'arising').feminine, true);
  assert.equal(en.rhymeWords('temperate', 'date').feminine, false);
  assert.equal(en.rhymeWords('sleeps', 'deeps').kind, 'perfect', 'a derived plural keeps its voicing');
});

// ---------------------------------------------------------------- lines, page, scheme

test('poemLines: stanzas from blank lines, indents kept, a title only when asked', () => {
  const p = po.poemLines('Title\n\n  one\ntwo\n\n\n\tthree\n');
  assert.deepEqual(p.stanzas, [1, 2, 1]);
  assert.deepEqual(p.lines[1], { text: 'one', stanza: 1, indent: 2 });
  assert.equal(p.lines[3].indent, 4);
  const t = po.poemLines('Title\n\n  one\ntwo\n', { title: true });
  assert.equal(t.title, 'Title');
  assert.deepEqual(t.stanzas, [2]);
  assert.equal(po.poemLines(S29).lines[12].indent, 3);
});

test('space: a block runs hot, a scatter cool', () => {
  const block = po.space('word word word word word word\nword word word word word word\nword word word word word word');
  const scatter = po.space('a\n\n          scatter of\n    things\n\n\n                         blown');
  assert.ok(block.heat >= 0.85 && scatter.heat <= 0.35, `${block.heat} ${scatter.heat}`);
  assert.match(block.facts[0], /3 lines in one block/);
  assert.match(po.space(TYGER).facts[0], /6 stanzas of 4, 4, 4, 4, 4 and 4 lines, all alike/);
});

test('rhymeScheme: Sonnet 29 letters ABAB CDCD EBEB FF, state rhyming twice', () => {
  const s = po.rhymeScheme(S29);
  assert.equal(s.letters, 'ABAB CDCD EBEB FF');
  assert.equal(s.form, 'shakespearean sonnet');
  assert.deepEqual([s.ends[9].word, s.ends[9].kind, s.ends[9].with], ['state', 'absolute', 1]);
  assert.deepEqual([s.ends[11].word, s.ends[11].letter, s.ends[11].kind], ['gate', 'B', 'perfect']);
  assert.deepEqual([s.ends[7].word, s.ends[7].kind, s.ends[7].with], ['least', 'off', 5]);
  assert.equal(s.ends[10].feminine, true);
  assert.deepEqual(s.blocks.map(b => [b.from, b.to]), [[0, 3], [4, 7], [8, 11], [12, 13]]);
  assert.ok(s.blocks[1].heat < s.blocks[0].heat, 'the second quatrain cools on possessed / least');
  assert.equal(po.rhymeScheme(S130).letters, 'ABAB CDCD EFEF GG');
  assert.equal(po.rhymeScheme(S116).letters, 'ABAB CDCD EFEF GG');
});

test('rhymeScheme: the forms', () => {
  const form = t => { const s = po.rhymeScheme(t); return [s.letters, s.form]; };
  assert.deepEqual(form(PETRARCH), ['ABBA ABBA CDC DCD', 'petrarchan sonnet']);
  assert.deepEqual(form(GHAZAL), ['AA BA CA', 'ghazal']);
  assert.deepEqual(form(RUBAI), ['AABA', 'rubai']);
  assert.deepEqual(form(TERZA), ['ABA BCB C', 'terza rima']);
  assert.deepEqual(form(BALLAD), ['ABCB DEFE', 'ballad stanza']);
  assert.equal(po.rhymeScheme(TYGER).form, 'couplets');
  assert.equal(po.rhymeScheme(LAMB).form, 'couplets');
  assert.equal(po.rhymeScheme(FREE).form, 'free');
  // a list of lines works as well as the text, blank strings breaking stanzas
  assert.equal(po.rhymeScheme(BALLAD.split('\n')).letters, 'ABCB DEFE');
});

test('radif: the same words after a changing rhyme word, from the opening couplet on', () => {
  const r = po.radif(GHAZAL);
  assert.equal(r.phrase, 'say nothing');
  assert.deepEqual(r.lines, [0, 1, 3, 5]);
  assert.deepEqual(r.rhymes, ['tonight', 'bright', 'flight', 'night']);
  assert.equal(po.radif(S29), null);
  assert.equal(r.monorhyme, 1, 'the rhyme words before it all rhyme');
  // the same words with no word changing before them are a refrain, not a radīf
  assert.equal(po.radif(['say nothing now', 'say nothing now', 'we all', 'say nothing now']), null);
  // a changing word that does not rhyme still makes one, with a lower monorhyme
  assert.equal(po.radif(['I said it, say nothing', 'you said it, say nothing', 'we all', 'I said it, say nothing']).monorhyme, 0.5);
});

test('dunadh: the poem closing on its first word, by grade', () => {
  assert.deepEqual(po.dunadh('Cold is the wind on the hill tonight,\nand the stars are cold.'), { grade: 'word', first: 'Cold', last: 'cold' });
  assert.deepEqual(po.dunadh('Mercy came down to the valley at dawn\nand all of the valley was merciful'), { grade: 'syllable', first: 'Mercy', last: 'merciful' });
  assert.deepEqual(po.dunadh('Bright was the morning over the sea\nand she came down to the shore a bride'), { grade: 'sound', first: 'Bright', last: 'bride' });
  assert.equal(po.dunadh(S29), null);
});

// ---------------------------------------------------------------- turn, negation, persons

test('turn: Sonnet 29 at Yet (Italian), 130 at And yet (English), a Petrarchan octave at Then', () => {
  const t29 = po.turn(S29);
  assert.deepEqual([t29.at, t29.word, t29.kind], [8, 'Yet', 'Italian']);
  assert.ok(t29.candidates[0].why.some(w => /opens on "Yet"/.test(w)));
  const t130 = po.turn(S130);
  assert.deepEqual([t130.at, t130.word, t130.kind], [12, 'And yet', 'English']);
  assert.deepEqual([po.turn(PETRARCH).at, po.turn(PETRARCH).kind], [8, 'Italian']);
  assert.equal(po.turn(FREE).kind, 'none');
  assert.equal(po.turn(FREE).at, null);
});

test('negation: Sonnet 116 by what love is not; 130 switches its images off; occupatio', () => {
  const n = po.negation(S116);
  const negators = n.words.filter(w => w.kind === 'negator');
  assert.ok(negators.length >= 9, `${negators.length} negators`);
  assert.deepEqual(n.words.filter(w => w.kind === 'privative').map(w => w.word), ['unknown']);
  assert.equal(n.count, negators.length + 1);
  assert.equal(n.perLine[13], 3, 'I never writ, nor no man ever loved');
  assert.ok(n.share > 0 && n.share < 1);
  assert.ok(po.negation(S130).scopes.some(s => s.words.includes('roses')), 'no such roses');
  const g = po.negation(GHAZAL);
  assert.equal(g.words.filter(w => w.kind === 'occupatio').length, 4);
  assert.equal(g.words.find(w => w.kind === 'occupatio').word, 'say nothing');
  assert.ok(po.isPrivative('immortal') && po.isPrivative('bootless') && !po.isPrivative('impediments') && !po.isPrivative('unless'));
});

test('pronouns: in Sonnet 29 "thee" arrives at line 10, by chance', () => {
  const p = po.pronouns(S29);
  assert.equal(p.arrivals.I, 1);
  assert.equal(p.arrivals.you, 9);
  assert.deepEqual(p.perLine[9], ['I', 'you']);
  assert.ok(p.shifts.some(s => s.at === 9 && s.to.includes('you')));
  assert.ok(p.facts.some(f => /arrives late, at line 10/.test(f)));
  assert.ok(!('you' in po.pronouns(S116).arrivals), '116 addresses no one');
});

// ---------------------------------------------------------------- the line in the mouth

test('pentameter: Sonnet 29 largely regular, inversions at 5, 6, 10 and 11, feminine endings at 9 and 11', () => {
  const m = po.pentameter(S29);
  assert.ok(m.share >= 0.85, `share ${m.share}`);
  // Lines 5, 10 and 11 (the research prototype), and 6, "FEA-tured", as the trained scansion has it (§2b)
  assert.deepEqual(m.trochees, [4, 5, 9, 10]);
  assert.deepEqual(m.feminine, [8, 10]);
  assert.deepEqual(m.lines[2].elided.map(e => e.as), ["heav'n"]);
  assert.equal(m.lines[6].elided.length, 1);
  assert.deepEqual([m.lines[11].elided.length, m.lines[11].syllables], [0, 10], "heaven's keeps two syllables at line 12");
  assert.ok(m.lines[0].substitutions.some(s => s.kind === 'spondee' && s.foot === 5), "men's eyes");
  assert.ok(po.pentameter(TYGER).share < 0.2, 'the Tyger is not pentameter');
});

test('hesitations: a line running on from a light word', () => {
  assert.deepEqual(po.hesitations(FREE), [1]);
  assert.deepEqual(po.hesitations(['I stood beside the', 'river, and the light', 'fell on the water']), [0]);
  assert.deepEqual(po.hesitations(BALLAD), [], '"there" closes its phrase');
  assert.deepEqual(po.hesitations(S29), []);
});

test('internal rhyme, aicill and alliteration', () => {
  const i29 = po.internalRhyme(S29);
  assert.ok(i29.pairs.some(p => p.a.word === 'sings' && p.b.word === 'brings'), JSON.stringify(i29.pairs));
  assert.ok(i29.density > 0 && i29.assonance > 0);
  assert.match(i29.facts[0], /sings \(line 12\) with brings \(line 13\)/);
  const a = po.aicill('The wind blew cold across the hill\nuntil the mill stood dark and still.');
  assert.deepEqual(a.pairs, [{ i: 0, end: 'hill', answer: 'mill', kind: 'perfect' }]);
  assert.equal(a.share, 1);
  assert.deepEqual(po.aicill(S29).pairs.map(p => [p.end, p.answer, p.kind]), [['scope', 'most', 'vowel'], ['state', 'break', 'vowel']]);
  const al = po.alliteration(TYGER);
  assert.ok(al.pairs.some(p => p.a === 'burning' && p.b === 'bright'));
  assert.ok(al.pairs.some(p => p.a === 'frame' && p.b === 'fearful'), 'thy passed over');
  assert.ok(!al.pairs.some(p => p.a === p.b), 'Tyger Tyger is repetition, not alliteration');
  assert.ok(al.share > 0 && al.density > 0);
});

test('parallelism: lines and half-lines that run alike', () => {
  assert.ok(po.parallelism('The mountain keeps the snow', 'The river keeps the rain') >= 0.8);
  assert.ok(po.parallelism('Little Lamb who made thee', 'Dost thou know who made thee') >= 0.8);
  assert.ok(po.parallelism('The body is a fine tree with five branches', 'Death has entered the restless mind') <= 0.35);
  const pairs = po.parallelPairs('The mountain keeps the snow, the river keeps the rain\nand nothing else');
  const halves = pairs.find(p => p.kind === 'halves');
  assert.deepEqual([halves.i, halves.a, halves.b], [0, 'The mountain keeps the snow', 'the river keeps the rain']);
  assert.ok(halves.score >= 0.8);
  assert.ok(pairs.some(p => p.kind === 'lines' && p.i === 0));
});

// ---------------------------------------------------------------- the board

test('poemBoard: Sonnet 29 is a Baked Alaska, hot sound round a cool sentence', () => {
  const b = po.poemBoard(S29);
  assert.deepEqual(Object.keys(b.channels), po.POEM_CHANNELS);
  for (const c of po.POEM_CHANNELS) assert.ok(b.channels[c].heat >= 0 && b.channels[c].heat <= 1 && b.channels[c].facts.length, c);
  assert.ok(b.channels.syntax.heat < 0.5 && b.channels.rhyme.heat >= 0.8 && b.channels.rhythm.heat >= 0.75 && b.channels.lineation.heat >= 0.75, JSON.stringify(Object.fromEntries(po.POEM_CHANNELS.map(c => [c, b.channels[c].heat]))));
  assert.ok(b.channels.rhyme.facts.includes('Lines 2 and 10 end on the same word, state: absolute rhyme joining the first quatrain to the third'), b.channels.rhyme.facts.join('\n'));
  assert.ok(b.channels.rhyme.facts.some(f => /possessed \/ least: only off rhyme/.test(f)));
  assert.deepEqual(b.struck.find(s => s.word === 'state'), { word: 'state', count: 3, lines: [1, 9, 13] });
  assert.deepEqual(b.struck.find(s => s.word === 'like'), { word: 'like', count: 4, lines: [4, 5, 5, 10] });
  assert.deepEqual(b.struck.find(s => s.word === 'heaven').lines, [2, 11], "heaven's folded into heaven");
  assert.ok(b.struck.some(s => s.word === 'then'), 'then is kept: it turns');
  assert.equal(b.scheme.letters, 'ABAB CDCD EBEB FF');
  assert.equal(b.turn.at, 8);
  assert.equal(b.whelm, null, 'a cool channel keeps the hot ones in conversation');
  assert.equal(b.lines.length, 14);
  assert.deepEqual(b.stanzas, [14]);
  assert.equal(po.POEM_CHANNEL_NAMES.space, 'Space');
});

test('poemBoard: Blake runs hot, a drum chant may overwhelm, a radīf heats the rhyme', () => {
  const t = po.poemBoard(TYGER);
  assert.ok(t.channels.syntax.heat >= 0.75 && t.channels.rhyme.heat >= 0.8, JSON.stringify(t.channels));
  assert.equal(po.poemBoard(DRUM).whelm, 'may overwhelm');
  const g = po.poemBoard(GHAZAL);
  assert.equal(g.radif.phrase, 'say nothing');
  assert.ok(g.channels.rhyme.facts.some(f => /radīf/.test(f)));
  assert.ok(g.channels.rhyme.heat >= 0.85);
  const f = po.poemBoard(FREE);
  assert.ok(f.channels.rhyme.heat < 0.4 && f.channels.lineation.heat < 0.5, JSON.stringify(f.channels));
  assert.ok(f.channels.lineation.facts.some(x => /hangs over the gap/.test(x)));
  assert.equal(po.poemBoard('Title\n\nOne line here\nand another', { title: true }).title, 'Title');
});

test('compareToLens: advice only where the poem runs a quarter hotter or cooler than the lens', () => {
  const b = po.poemBoard(S29);
  const blake = { id: 'blake', name: 'Blake', board: { lineation: 0.9, syntax: 0.85, rhythm: 0.9, rhyme: 0.85 } };
  const adv = po.compareToLens(b, blake);
  assert.equal(adv.length, 1, adv.join('\n'));
  assert.match(adv[0], /^Syntax: the poem runs mild \(0\.44\), the Blake lens hot \(0\.85\); to run hotter, lay phrases side by side/);
  const sonnet = { lineation: 0.8, syntax: 0.35, rhythm: 0.85, rhyme: 0.85 };
  assert.deepEqual(po.compareToLens(b, sonnet), []);
  // another board works as the measure too, and space counts where it is set
  const other = po.compareToLens(b, po.poemBoard(po.poemLines('a\n\n          scatter of\n    things\n\n\n                         blown')), { label: 'the scatter' });
  assert.ok(other.some(a => a.startsWith('Space: the poem runs hot') && /the scatter cool/.test(a) && /to run cooler/.test(a)), other.join('\n'));
});

test('poemText: the five steps in order, the scheme, the turn and the lens', () => {
  const text = po.poemText(po.poemBoard(S29), { lens: { id: 'blake', name: 'Blake', after: 'after Blake', board: { syntax: 0.85 } } });
  const steps = ['STRUCTURE', 'TEXTURE', 'PERCEPTION', 'NARRATOR', 'NARRATIVE'].map(s => text.indexOf(s));
  assert.ok(steps.every((n, i) => n > 0 && (i === 0 || n > steps[i - 1])), text);
  for (const want of ['ABAB CDCD EBEB FF', 'the turn: line 9, on "Yet" (Italian', 'feminine endings at 9 and 11', "heav'n (line 3)", 'Against the Blake lens', 'Whelm:']) assert.ok(text.includes(want), want);
});

test('cli: poem reads a file, with a lens, as text or JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poem-'));
  const file = path.join(dir, 's29.txt');
  fs.writeFileSync(file, 'Sonnet 29\n\n' + S29 + '\n');
  const run = (...args) => spawnSync(process.execPath, [CLI, 'poem', ...args], { encoding: 'utf8' });
  const text = run(file, '--titled', '--lens', 'blake');
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /^Sonnet 29: 14 lines, a Shakespearean sonnet/);
  assert.match(text.stdout, /Against the Blake lens/);
  const json = JSON.parse(run(file, '--titled', '--json', '--lens', 'blake').stdout);
  assert.equal(json.scheme.letters, 'ABAB CDCD EBEB FF');
  assert.equal(json.lens.id, 'blake');
  assert.ok(json.advice.some(a => a.startsWith('Syntax')));
  const bad = run(file, '--lens', 'no-such-lens');
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown lens "no-such-lens"/);
  assert.match(run(path.join(dir, 'missing.txt')).stderr, /no such file/);
});
