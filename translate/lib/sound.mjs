/**
 * The sound of a unit, read off its transliteration: for each couplet, the
 * word each half-line ends on, whether the two ends rhyme, and roughly how
 * many syllables each half has; plus the refrain, the poet's self-naming and
 * the rāga. It is a listening aid for the `sing` drafter and for readers of
 * the sung version, not a metrical analysis: syllables are counted
 * Sanskrit-style (every written vowel sounds) and rhyme is judged on spelling.
 */

import { partOf } from './ids.mjs';

// Longest first, so "ai" is one nucleus and "ā" is not read as "a".
const VOWELS = ['ai', 'au', 'ā', 'ī', 'ū', 'ṝ', 'ḹ', 'a', 'i', 'u', 'e', 'o', 'ḷ'];
const NASAL = /m̐|ṃ|̐|́/g;

/** Drop the refrain cue, danda marks and punctuation Shastri's text carries at a line end. */
export function cleanLine(translit) {
  return String(translit || '').normalize('NFC')
    .replace(/\|+\s*dhru\s*\|*/gi, ' ').replace(/[|।॥,;:.!?"“”‘’()]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Split a transliterated word into syllables: onset + vowel, with any coda that ends the word. */
export function syllables(word) {
  const w = String(word).normalize('NFC').replace(/-/g, '');
  const out = [];
  let onset = '';
  for (let i = 0; i < w.length;) {
    const v = VOWELS.find(x => w.startsWith(x, i));
    if (v) {
      let j = i + v.length;
      // a nasal mark belongs to its vowel
      while (j < w.length && /[̐́ṃ]/.test(w[j])) j++;
      if (w.startsWith('m̐', j)) j += 'm̐'.length;
      out.push(onset + w.slice(i, j));
      onset = '';
      i = j;
    } else {
      onset += w[i];
      i++;
    }
  }
  if (onset) {
    if (out.length) out[out.length - 1] += onset;    // a closing consonant: the coda of the last syllable
    else out.push(onset);
  }
  return out;
}

export const countSyllables = line => cleanLine(line).split(' ').filter(Boolean)
  .reduce((n, w) => n + syllables(w).filter(s => VOWELS.some(v => s.includes(v))).length, 0);

// Spellings that sound alike, or that the script does not keep apart (b/v, y/j, ṛ/ḍ, ṇ/n, ś/ṣ/s),
// dental against retroflex, which an ear hears as a rhyme, and vowel length, which Bengali
// speech does not keep apart (bāndhī rhymes with sāndhi).
const fold = s => String(s).normalize('NFC').replace(NASAL, '')
  .replace(/v/g, 'b').replace(/y/g, 'j').replace(/ḍ/g, 'ṛ').replace(/ṇ/g, 'n').replace(/[śṣ]/g, 's')
  .replace(/ṭ/g, 't').replace(/ā/g, 'a').replace(/ī/g, 'i').replace(/ū/g, 'u')
  .replace(/([bcdghjklmnprstṅñṛ])\1/g, '$1');   // a doubled consonant sounds like one at a rhyme (eṭṭā, caṅgatā)

const vowelOf = syl => VOWELS.find(v => syl.includes(v)) || '';

/** The part of a line's last word a rhyme is heard in: the last syllable, and the vowel before it. */
export function lineEnd(translit) {
  const words = cleanLine(translit).split(' ').filter(Boolean);
  const word = words[words.length - 1] || '';
  const syl = syllables(word);
  const last = syl[syl.length - 1] || '';
  const prev = syl[syl.length - 2] || '';
  // What a reader sees highlighted: the last two syllables (or the whole word when shorter).
  const sound = syl.slice(-2).join('');
  return { word, syllables: syl, last, prevVowel: vowelOf(prev), sound };
}

/**
 * full: the last syllables match and so do the vowels before them.
 * near: the last syllables match, or the last two vowels do (sāṅga / lāga).
 * Most words end in -a, so a lone matching last vowel is not counted.
 */
export function rhymeOf(a, b) {
  // Judge on the folded word, so kariai and mariāi fall into the same syllables.
  const end = t => lineEnd(fold(lineEnd(t).word));
  const x = end(a), y = end(b);
  if (!x.last || !y.last) return 'none';
  const lastMatch = x.last === y.last;
  if (lastMatch && (!x.prevVowel || !y.prevVowel || x.prevVowel === y.prevVowel)) return 'full';
  if (lastMatch || (vowelOf(x.last) === vowelOf(y.last) && x.prevVowel && x.prevVowel === y.prevVowel)) return 'near';
  return 'none';
}

/** The sound profile of one unit. */
export function soundProfile(unit) {
  const couplets = [];
  const byGroup = new Map();
  for (const l of unit.lines) {
    if (l.role !== 'line') continue;
    const c = byGroup.get(l.group) || byGroup.set(l.group, { group: l.group, lines: [] }).get(l.group);
    c.lines.push(l);
  }
  for (const c of byGroup.values()) {
    const [a, b] = c.lines;
    const halves = c.lines.map(l => ({ id: l.id, syllables: countSyllables(l.translit), end: lineEnd(l.translit) }));
    couplets.push({
      group: c.group, part: partOf(c.group),
      refrain: !!c.lines[0].refrain, bhanita: !!c.lines[0].bhanita,
      halves, rhyme: a && b ? rhymeOf(a.translit, b.translit) : 'none',
    });
  }
  const refrain = couplets.find(c => c.refrain);
  return {
    unit: unit.id, raga: unit.raga || '', poet: unit.poet || '',
    refrain: refrain ? refrain.group : '',
    bhanita: couplets.find(c => c.bhanita)?.group || '',
    couplets,
    rhymed: couplets.filter(c => c.rhyme !== 'none').length,
  };
}

/** The profile as the plain text a drafting pack carries. */
export function profileText(p) {
  const out = [];
  out.push(`Rāga: ${p.raga || '(not named)'} · poet: ${p.poet || '(unnamed)'} · refrain: ${p.refrain || '(none marked)'} · poet names himself in: ${p.bhanita || '(not marked)'}`);
  out.push(`${p.rhymed} of ${p.couplets.length} couplets end in a rhyme or a near rhyme.`);
  for (const c of p.couplets) {
    const tags = [c.refrain && 'refrain', c.bhanita && 'self-naming'].filter(Boolean);
    const ends = c.halves.map(h => `${h.end.word} (~${h.syllables} syll.)`).join(' / ');
    out.push(`- ${c.group}${tags.length ? ' [' + tags.join(', ') + ']' : ''}: ${ends} → ${c.rhyme === 'none' ? 'no' : c.rhyme} rhyme`
      + (c.rhyme !== 'none' ? ` on "-${c.halves.map(h => h.end.sound).join('" / "-')}"` : ''));
  }
  return out.join('\n');
}

/** A rough English syllable count: vowel groups, less a silent final e. Good enough to say "long". */
export function englishSyllables(s) {
  return String(s).toLowerCase().replace(/[^a-zāīūēō' -]/g, ' ').split(/\s+/).filter(Boolean).reduce((n, w) => {
    const bare = w.replace(/'/g, '');
    let k = (bare.match(/[aeiouyāīūēō]+/g) || []).length;
    if (k > 1 && /[^aeiou]e$/.test(bare) && !/le$/.test(bare)) k--;
    return n + Math.max(1, k);
  }, 0);
}

export const SUNG_LINE_MAX = 13;

/**
 * Advice on a sung version, never a refusal: lines that are the accurate
 * English unchanged, and lines long for singing. The reviewer weighs them.
 */
export function songAdvice(sungLines, accurateLines, strip = s => s) {
  const plain = s => strip(s).toLowerCase().replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim();
  const acc = new Map(accurateLines.map(l => [l.id, plain(l.en)]));
  const out = [];
  for (const l of sungLines) {
    if (acc.get(l.id) && plain(l.en) === acc.get(l.id)) out.push(`${l.id}: sung exactly as the accurate English; sing it, or say in kept why it stands`);
    const n = englishSyllables(strip(l.en));
    if (n > SUNG_LINE_MAX) out.push(`${l.id}: about ${n} syllables, long for a sung line (aim for four beats, about ${SUNG_LINE_MAX} syllables at most)`);
  }
  return out;
}
