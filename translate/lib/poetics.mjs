/**
 * Any English poem read on Morton's board, not only a song's English: the
 * page (space), lineation, syntax, rhythm and rhyme, each from cool
 * (variation) to hot (repetition, pattern), and the things a close reader
 * counts on the way: the rhyme scheme lettered against every earlier line
 * end, the form it makes, a radīf, a dúnadh, the turn, negation, words struck
 * again, pronouns, pentameter, hesitating line breaks, internal rhyme,
 * alliteration, parallel lines. The methods are in research/morton-in-depth.md
 * §5(i), research/shakespeare-sonnets.md §6(c), research/sufi-poets.md §5.2,
 * research/zen-mountain-poets.md §5.2 and research/bardic-tradition.md §7.2.
 *
 * Every function takes the poem as text, as poemLines() output, or as a list
 * of lines (strings, blank strings for stanza breaks, or { text }). Line
 * indices are 0-based; the facts count lines from 1, as a reader does. Every
 * figure is an estimate for the ear to check aloud, never a verdict.
 * Imports only ./english.mjs and ./board.mjs, so the Workshop can bundle it.
 */

import * as en from './english.mjs';
import { CHANNEL_NAMES, temperature, round, clamp, mean, spread, rhythmChannel, lineationChannel, syntaxChannel } from './board.mjs';

export const POEM_CHANNELS = ['space', 'lineation', 'syntax', 'rhythm', 'rhyme'];
export const POEM_CHANNEL_NAMES = { space: 'Space', ...CHANNEL_NAMES };

// ---------------------------------------------------------------- lines

/**
 * The poem as laid out: { lines: [{ text, stanza, indent }], stanzas: [line
 * counts] }. A blank line (or several) breaks a stanza; leading spaces are
 * kept as the indent (a tab counts four). With { title: true } the first line
 * is taken as the title and returned apart.
 */
export function poemLines(text, { title = false } = {}) {
  const raw = String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+$/, ''));
  let k = 0;
  while (k < raw.length && !raw[k].trim()) k++;
  let heading = '';
  if (title && k < raw.length) heading = raw[k++].trim();
  const lines = [], stanzas = [];
  let stanza = -1, gap = true;
  for (; k < raw.length; k++) {
    if (!raw[k].trim()) { gap = true; continue; }
    if (gap) { stanza++; stanzas.push(0); gap = false; }
    lines.push({ text: raw[k].trim(), stanza, indent: /^[ \t]*/.exec(raw[k])[0].replace(/\t/g, '    ').length });
    stanzas[stanza]++;
  }
  return title ? { title: heading, lines, stanzas } : { lines, stanzas };
}

// Any accepted input as poemLines() output.
function parsed(input) {
  if (typeof input === 'string') return poemLines(input);
  if (input && Array.isArray(input.lines)) return { stanzas: stanzasOf(input.lines), ...input };
  const lines = [];
  let stanza = 0, seen = false;
  for (const l of input || []) {
    const t = typeof l === 'string' ? l : String(l?.text ?? l?.en ?? '');
    if (!t.trim()) { if (seen) stanza++; seen = false; continue; }
    const indent = typeof l === 'string' ? /^[ \t]*/.exec(t)[0].replace(/\t/g, '    ').length : (l.indent || 0);
    lines.push({ text: t.trim(), stanza: typeof l === 'object' && Number.isInteger(l.stanza) ? l.stanza : stanza, indent });
    seen = true;
  }
  return { lines, stanzas: stanzasOf(lines) };
}
function stanzasOf(lines) {
  const out = [];
  let last = null;
  for (const l of lines) { if (l.stanza !== last) { out.push(0); last = l.stanza; } out[out.length - 1]++; }
  return out;
}
const textsOf = input => parsed(input).lines.map(l => l.text);

// Words a reader passes over, for struck words, alliteration and hesitations:
// the ear's light words plus the old second person and old verb endings.
const OLD_LIGHT = new Set('thy thine thou thee ye hath doth dost shalt wilt canst'.split(' '));
const light = w => en.isLight(w) || OLD_LIGHT.has(en.plainWord(w));

const lineNo = i => String(i + 1);
const and = xs => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const linesSaid = is => (is.length === 1 ? `line ${lineNo(is[0])}` : `lines ${and(is.map(lineNo))}`);
const lastWordOf = text => { const ws = en.wordsOf(text); return ws.length ? ws[ws.length - 1] : null; };
const cleanRaw = raw => String(raw).replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');

// ---------------------------------------------------------------- the page

/**
 * Morton's space fader, from poemLines() output: a page of even line widths,
 * even stanzas and dense ink runs hot (the prose block); a scatter of short,
 * uneven, indented lines runs cool. heat = 0.4·(1 − spread of line widths) +
 * 0.3·(stanzas all one size) + 0.3·(ink ÷ the block the poem fills).
 */
export function space(input) {
  const { lines, stanzas } = parsed(input);
  if (!lines.length) return { heat: 0, facts: ['no lines'] };
  const widths = lines.map(l => l.indent + l.text.length);
  const widest = Math.max(...widths);
  const rows = lines.length + stanzas.length - 1;
  const ink = lines.reduce((n, l) => n + l.text.replace(/\s/g, '').length, 0);
  const even = stanzas.length < 2 ? 1 : clamp(1 - spread(stanzas) * 2);
  const density = ink / (rows * widest);
  const heat = clamp(0.4 * clamp(1 - spread(widths)) + 0.3 * even + 0.3 * density);
  const indented = lines.filter(l => l.indent > 0).length;
  return {
    heat: round(heat),
    facts: [
      stanzas.length === 1 ? `${lines.length} lines in one block` : `${lines.length} lines in ${stanzas.length} stanzas of ${and(stanzas.map(String))} lines${new Set(stanzas).size === 1 ? ', all alike' : ''}`,
      `lines ${Math.min(...widths)} to ${widest} characters wide${indented ? `; ${indented} set in from the margin` : ''}`,
      `ink fills ${Math.round(density * 100)}% of the block the poem makes on the page (a prose block fills most of it; a scattered page, little)`,
    ],
  };
}

// ---------------------------------------------------------------- rhyme

// A vowel or off rhyme is heard only this many lines back (Morton's "sound
// memory": 1 in couplets, 2 in quatrains, 3 in an Italian octave). Absolute
// and perfect rhymes are heard across the whole poem.
const WEAK_REACH = 4;
const LETTER_KINDS = new Set(['absolute', 'perfect', 'vowel', 'off']);
const letterName = k => String.fromCharCode(65 + (k % 26)) + (k >= 26 ? String(Math.floor(k / 26)) : '');

// Syllables after the stressed vowel: a feminine ending has some (fire, as
// the dictionary has it, has none: see rhymeWords).
function falls(word) {
  const ph = en.phones(word).phones.filter((x, i, all) => !(x.p === 'ER' && x.s === 0 && all[i - 1]?.v && /^(AY|AW|OY|EY)$/.test(all[i - 1].p)));
  const vs = ph.map((x, i) => (x.v ? i : -1)).filter(i => i >= 0);
  if (!vs.length) return false;
  let k = vs.filter(i => ph[i].s === 1).pop();
  if (k === undefined) k = vs.at(-1);
  return vs.some(i => i > k);
}

// Two line ends for lettering: a feminine end chimes with a masculine one
// only on its stressed vowel, too little to share a letter (eyes / despising).
function endRhyme(a, b) {
  const r = en.rhymeWords(a, b);
  if (r.kind === 'vowel' && falls(a) !== falls(b)) return { ...r, kind: 'none' };
  return r;
}

const BLOCK_NAMES = { 2: 'couplet', 3: 'tercet', 4: 'quatrain', 6: 'sestet', 8: 'octave' };
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

function blockSizes(lines, form, n) {
  const st = stanzasOf(lines);
  if (st.length > 1) return st;
  if (n === 14) return form === 'petrarchan sonnet' ? [4, 4, 3, 3] : [4, 4, 4, 2];
  const step = { couplets: 2, ghazal: 2, 'terza rima': 3, quatrains: 4, 'ballad stanza': 4 }[form];
  if (!step || n <= step) return [n];
  const out = [];
  for (let k = 0; k < n; k += step) out.push(Math.min(step, n - k));
  return out;
}

function formOf(letters, lines) {
  const n = letters.length;
  const same = (a, b) => a >= 0 && b >= 0 && a < n && b < n && letters[a] === letters[b];
  const rhymed = letters.filter((x, i) => letters.some((y, j) => j !== i && y === x)).length / Math.max(1, n);
  if (n === 14) {
    if ([0, 4, 8].every(q => same(q, q + 2) && same(q + 1, q + 3) && !same(q, q + 1)) && same(12, 13)) return 'shakespearean sonnet';
    if (same(0, 3) && same(0, 4) && same(0, 7) && same(1, 2) && same(1, 5) && same(1, 6) && !same(0, 1)) return 'petrarchan sonnet';
    if (rhymed >= 0.5) return 'sonnet';
  }
  if (n === 4 && same(0, 1) && same(0, 3) && !same(0, 2)) return 'rubai';
  if (n >= 6 && n % 2 === 0 && same(0, 1)) {
    const closing = [], opening = [];
    for (let k = 3; k < n; k += 2) closing.push(same(k, 0));
    for (let k = 2; k < n; k += 2) opening.push(!same(k, 0));
    if (closing.every(Boolean) && opening.filter(Boolean).length >= opening.length * 0.75) return 'ghazal';
  }
  if (n >= 6) {
    const tercets = Math.floor(n / 3);
    let ok = true;
    for (let t = 0; t < tercets && ok; t++) {
      const a = 3 * t;
      if (!same(a, a + 2) || same(a, a + 1) || (t > 0 && !same(a, a - 2))) ok = false;
    }
    if (ok) return 'terza rima';
  }
  if (n >= 4 && n % 2 === 0) {
    let rhyming = 0, moving = 0;
    for (let k = 0; k < n; k += 2) { if (same(k, k + 1)) rhyming++; if (k > 0 && !same(k, k - 2)) moving++; }
    if (rhyming >= (n / 2) * 0.75 && moving >= (n / 2 - 1) * 0.5) return 'couplets';
  }
  const st = stanzasOf(lines);
  const quads = st.length > 1 ? (st.every(s => s === 4) ? st.map((_, k) => 4 * k) : []) : (n >= 8 && n % 4 === 0 ? Array.from({ length: n / 4 }, (_, k) => 4 * k) : []);
  if (quads.length) {
    const crossed = quads.filter(q => same(q + 1, q + 3)).length;
    const enclosed = quads.filter(q => same(q, q + 3) && same(q + 1, q + 2)).length;
    if (Math.max(crossed, enclosed) >= quads.length * 0.75) {
      if (crossed >= quads.length * 0.75) {
        const scans = lines.map(l => en.scan(l.text));
        const long = quads.flatMap(q => [q, q + 2]), short = quads.flatMap(q => [q + 1, q + 3]);
        const gap = f => mean(long.map(i => f(scans[i]))) - mean(short.map(i => f(scans[i])));
        if (gap(s => s.beats) >= 0.75 || gap(s => s.syllables) >= 1.5) return 'ballad stanza';
      }
      return 'quatrains';
    }
  }
  return 'free';
}

/**
 * The rhyme scheme, each line end lettered against every earlier end: an off
 * rhyme or hotter shares the letter. The ear hears the strong chimes first:
 * the same word or a perfect rhyme, at any distance. Then a line still alone
 * may be answered by a vowel or off rhyme from another line still alone,
 * within four lines and in its stanza (so "possessed" does not join "state"
 * and "fate" on its t, and "lie" waits for "by" rather than taking "fire").
 * Para and eye rhymes are marked but keep their own letter. Returns { letters ("ABAB CDCD EBEB FF", a
 * space at each stanza break, or between the blocks of a 14-line poem
 * printed as one), ends: [{ i, word, letter, kind, with, heat }] (kind and
 * with: the earlier end it answers; heat: its hottest chime with any line of
 * its letter), form, blocks: [{ from, to, heat }] }.
 */
export function rhymeScheme(input) {
  const { lines } = parsed(input);
  const words = lines.map(l => lastWordOf(l.text)?.w || '');
  const n = words.length;
  const chime = new Map();
  const rhyme = (i, j) => { const k = `${i},${j}`; if (!chime.has(k)) chime.set(k, endRhyme(words[i], words[j])); return chime.get(k); };
  const link = Array(n).fill(null);
  const root = i => { while (link[i]) i = link[i].j; return i; };
  const members = () => { const c = new Map(); for (let i = 0; i < n; i++) c.set(root(i), (c.get(root(i)) || 0) + 1); return c; };
  // First the rhymes heard at any distance: the same word, a perfect rhyme.
  for (let i = 0; i < n; i++) {
    for (let j = i - 1; j >= 0 && words[i]; j--) {
      if (!words[j]) continue;
      const r = rhyme(i, j);
      if (r.kind !== 'absolute' && r.kind !== 'perfect') continue;
      const heat = en.PLANETS[r.kind].heat;
      if (!link[i] || heat > link[i].heat) link[i] = { j, kind: r.kind, heat, feminine: r.feminine };
    }
  }
  // Then a line still alone may be answered by a weak chime (a vowel or off
  // rhyme) from another line still alone: within four lines, in its stanza.
  let count = members();
  for (let i = 0; i < n; i++) {
    if (count.get(root(i)) > 1 || !words[i]) continue;
    let best = null;
    for (let j = i - 1; j >= Math.max(0, i - WEAK_REACH); j--) {
      if (!words[j] || lines[j].stanza !== lines[i].stanza || count.get(root(j)) > 1) continue;
      const r = rhyme(i, j);
      if (!LETTER_KINDS.has(r.kind)) continue;
      const heat = en.PLANETS[r.kind].heat;
      if (!best || heat > best.heat) best = { j, kind: r.kind, heat, feminine: r.feminine };
    }
    if (best) { link[i] = best; count = members(); }
  }
  // Letters in order of first appearance; para and eye rhymes marked on lines left alone.
  const names = new Map();
  const letters = [], ends = [];
  for (let i = 0; i < n; i++) {
    const r0 = root(i);
    if (!names.has(r0)) names.set(r0, letterName(names.size));
    letters.push(names.get(r0));
    let mark = null;
    if (!link[i] && count.get(r0) === 1) {
      for (let j = i - 1; j >= Math.max(0, i - WEAK_REACH) && words[i]; j--) {
        const k = words[j] ? rhyme(i, j).kind : 'none';
        if (k === 'para' || k === 'eye') { mark = { j, kind: k }; break; }
      }
    }
    const l = link[i] || mark;
    ends.push({ i, word: words[i], letter: letters[i], kind: l ? l.kind : 'none', with: l ? l.j : null, feminine: !!link[i]?.feminine, heat: 0 });
  }
  // Each end's hottest chime with another line of its letter.
  ends.forEach(e => {
    for (const o of ends) {
      if (o.i === e.i || o.letter !== e.letter) continue;
      e.heat = Math.max(e.heat, en.PLANETS[endRhyme(e.word, o.word).kind].heat);
    }
  });
  const form = formOf(letters, lines);
  const sizes = blockSizes(lines, form, lines.length);
  const blocks = [];
  let at = 0;
  for (const size of sizes) {
    const from = at, to = at + size - 1;
    const inside = ends.slice(from, to + 1).map(e => {
      let h = 0;
      for (const o of ends.slice(from, to + 1)) if (o.i !== e.i && o.letter === e.letter) h = Math.max(h, en.PLANETS[endRhyme(e.word, o.word).kind].heat);
      return h;
    });
    blocks.push({ from, to, heat: round(mean(inside)) });
    at += size;
  }
  return { letters: blocks.map(b => letters.slice(b.from, b.to + 1).join('')).join(' '), ends, form, blocks };
}

/**
 * A radīf (sufi-poets.md §5.2): the same end word or words after a changing
 * rhyme word, in both lines of the opening couplet and then at the close of
 * couplets, three times or more (at least three in four of those lines).
 * Returns null or { phrase, lines, rhymes (the rhyme word before it, the
 * qāfiya), share (of the couplet-closing lines that carry it), monorhyme (the
 * part of the rhyme words that rhyme with the first) }.
 */
export function radif(input) {
  const texts = textsOf(input);
  if (texts.length < 4) return null;
  const toks = texts.map(t => en.wordsOf(t).map(x => x.w));
  const slots = [0];
  for (let i = 1; i < texts.length; i += 2) slots.push(i);
  for (let k = 4; k >= 1; k--) {
    const key = i => (toks[i].length > k ? toks[i].slice(-k).join(' ') : null);
    const phrase = key(0);
    if (!phrase || key(1) !== phrase) continue;
    const hits = slots.filter(i => key(i) === phrase).length;
    if (hits < 3 || hits < slots.length * 0.75) continue;
    const lines = texts.map((_, i) => i).filter(i => key(i) === phrase);
    const rhymes = lines.map(i => toks[i][toks[i].length - k - 1]);
    if (new Set(rhymes).size < 2) continue;
    const chimes = rhymes.slice(1).filter(w => ['absolute', 'perfect', 'vowel'].includes(en.rhymeWords(rhymes[0], w).kind)).length;
    return { phrase, lines, rhymes, share: round(hits / slots.length), monorhyme: round(chimes / (rhymes.length - 1)) };
  }
  return null;
}

// Phones of a word, as a string of names without stress marks.
const phoneNames = w => en.phones(w).phones.map(x => x.p);
const lemma = w => en.plainWord(w).replace(/'s$|s'$|'st$/, '');

/**
 * The dúnadh (bardic-tradition.md §7.2): the poem closes on its first word,
 * or its first stressed word. grade 'word' when the last word repeats it
 * whole; 'syllable' when the last word holds its stressed syllable; 'sound'
 * when the two only begin alike (onset and vowel). null when the circle is
 * open. Returns { grade, first, last }.
 */
export function dunadh(input) {
  const all = textsOf(input).flatMap(t => en.wordsOf(t));
  if (all.length < 4) return null;
  const last = all.at(-1);
  const firsts = [all[0], all.find(x => !light(x.w))].filter(Boolean);
  for (const grade of ['word', 'syllable', 'sound']) {
    for (const f of firsts) {
      if (f === last) continue;
      if (circle(f.w, last.w) === grade) return { grade, first: cleanRaw(f.raw), last: cleanRaw(last.raw) };
    }
  }
  return null;
}

function circle(a, b) {
  const A = lemma(a), B = lemma(b);
  if (!A || !B) return null;
  if (A === B || (A.length >= 4 && B.startsWith(A))) return 'word';
  const pa = en.phones(A).phones, pb = phoneNames(B);
  const vs = pa.map((x, i) => (x.v ? i : -1)).filter(i => i >= 0);
  if (!vs.length) return null;
  let k = vs.find(i => pa[i].s === 1);
  if (k === undefined) k = vs[0];
  let from = k, to = k + 1;
  while (from > 0 && !pa[from - 1].v) from--;
  while (to < pa.length && !pa[to].v) to++;
  const syl = pa.slice(from, to).map(x => x.p).join(' ');
  if (` ${pb.join(' ')} `.includes(` ${syl} `) && syl.split(' ').length >= 2) return 'syllable';
  const head = ps => { const i = ps.findIndex(x => VOWEL.test(x)); return i > 0 ? ps.slice(0, i + 1).join(' ') : null; };
  if (head(pa.map(x => x.p)) && head(pa.map(x => x.p)) === head(pb)) return 'sound';
  return null;
}
const VOWEL = /^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW|[AEIOUY]+)$/;

// ---------------------------------------------------------------- the turn, negation, persons

const NEGATORS = new Set("not no nor never none nothing nobody nowhere neither naught nought nay cannot without ne'er".split(' '));
const isNegator = w => NEGATORS.has(w) || /n't$/.test(w);
const NOT_PRIVATIVE = new Set(`under until unless unto uncle union unit unite universe university unique uniform unison
impediment impediments important importance imagine image imitate impose impulse import improve impress
increase income include indeed index inform inside instead intend interest into invest industry inner inn insist
inspire instant infant influence invent invite involve irony island`.split(/\s+/));
const PRIVATIVE_BASES = new Set('human humane firm just sane pure secure active famous mortal finite nocent numerable'.split(' '));
const ADJ_ENDING = /(able|ible|al|ent|ant|ive|ite|ate|ous|ect|ure|ine|ile|ict|ful|id|ane|ar|ary|ed|ing|ly)$/;
const known = w => (en.hasDictionary() ? en.phones(w).known : w.length >= 4);

/** A word that carries its own "not": un-known, im-mortal, boot-less. */
export function isPrivative(word) {
  const w = en.plainWord(word).replace(/'s$/, '');
  if (!w || NOT_PRIVATIVE.has(w) || /^under/.test(w)) return false;
  if (/^un/.test(w) && w.length >= 5 && known(w.slice(2))) return true;
  if (/^non/.test(w) && w.length >= 6 && known(w.slice(3))) return true;
  const m = /^(in|im|il|ir)(.{4,})$/.exec(w);
  if (m) {
    const fits = { im: /^[pbm]/, il: /^l/, ir: /^r/, in: /^[^pbmlr]/ }[m[1]].test(m[2]);
    if (fits && known(m[2]) && (ADJ_ENDING.test(m[2]) || PRIVATIVE_BASES.has(m[2]))) return true;
  }
  const less = /^(.{3,})less(ly|ness)?$/.exec(w);
  return !!(less && known(less[1]));
}

const REFUSING = /^(not|never|nothing|naught|nought|cannot|ne'er)$|n't$/;
const SILENCING = new Set(['nothing', 'not', 'naught', 'nought', 'no']);
const SPEECH = /^(say|says|said|saying|tell|tells|told|telling|speak|speaks|spoke|spoken|speaking|name|names|named|naming|mention|mentioned|utter|uttered|sing|sang|sung)$/;

/**
 * Negation (morton-in-depth.md §5(i)5): negators (not, no, nor, never,
 * nothing, without, -n't), privatives (un-, in-/im-, -less on a known word)
 * and occupatio (saying by refusing to say: "not … say", "nothing to say",
 * "say nothing").
 * Returns { count (negators and privatives), share of all words, perLine,
 * words: [{ i, word, kind: 'negator' | 'privative' | 'occupatio' }], scopes:
 * [{ i, negator, words }] (what a negator switches off, to the next stop),
 * facts }.
 */
export function negation(input) {
  const texts = textsOf(input);
  const words = [], scopes = [];
  const perLine = texts.map(() => 0);
  let total = 0;
  texts.forEach((t, i) => {
    const ws = en.wordsOf(t);
    total += ws.length;
    ws.forEach((x, k) => {
      if (isNegator(x.w)) {
        words.push({ i, word: x.w, kind: 'negator' }); perLine[i]++;
        const off = [];
        for (let j = k + 1; j < ws.length; j++) {
          if (isNegator(ws[j].w)) break;
          if (!light(ws[j].w)) off.push(ws[j].w);
          if (/[,;:.!?—–)]$/.test(ws[j].raw)) break;
        }
        if (/[,;:.!?—–)]$/.test(x.raw)) off.length = 0;
        if (off.length) scopes.push({ i, negator: x.w, words: off });
        // Occupatio: "I will not say", "never told", "nothing to say", or "say nothing".
        const ahead = REFUSING.test(x.w) ? ws.findIndex((y, j) => j > k && j <= k + 3 && SPEECH.test(y.w)) : -1;
        const behind = SILENCING.has(x.w) && k > 0 && SPEECH.test(ws[k - 1].w) ? k - 1 : -1;
        if (ahead >= 0) words.push({ i, word: `${x.w} … ${ws[ahead].w}`, kind: 'occupatio' });
        else if (behind >= 0) words.push({ i, word: `${ws[behind].w} ${x.w}`, kind: 'occupatio' });
      } else if (isPrivative(x.w)) { words.push({ i, word: x.w, kind: 'privative' }); perLine[i]++; }
    });
  });
  const count = words.filter(w => w.kind !== 'occupatio').length;
  const negators = words.filter(w => w.kind === 'negator'), privatives = words.filter(w => w.kind === 'privative');
  const facts = [];
  if (!count) facts.push('no negation: every image is switched on');
  else {
    const counted = (xs, one, what) => (xs.length ? `${xs.length} ${one}${xs.length === 1 ? '' : 's'} (${what(xs)})` : `no ${one}s`);
    const tally = xs => { const c = new Map(); for (const w of xs) c.set(w.word, (c.get(w.word) || 0) + 1); return and([...c].map(([w, k]) => (k > 1 ? `${w} ×${k}` : w))); };
    facts.push(`${counted(negators, 'negator', tally)} and ${counted(privatives, 'privative', tally)} (words that carry their own "not") in ${texts.length} lines`);
    if (scopes.length) facts.push(`images switched on only to be switched off: ${scopes.slice(0, 5).map(s => `${s.negator} ${s.words.join(' ')} (line ${lineNo(s.i)})`).join('; ')}`);
  }
  const occ = words.filter(w => w.kind === 'occupatio');
  if (occ.length) facts.push(`saying by refusing to say (occupatio): ${occ.map(w => `"${w.word}" (line ${lineNo(w.i)})`).join(', ')}`);
  return { count, share: round(total ? count / total : 0), perLine, words, scopes, facts };
}

const PERSONS = {
  I: 'i me my mine myself', you: 'you your yours yourself yourselves thou thee thy thine thyself ye',
  'he/she': 'he him his himself she her hers herself', we: 'we us our ours ourselves', 'it/they': 'it its itself they them their theirs themselves',
};
const PERSON_OF = new Map(Object.entries(PERSONS).flatMap(([p, ws]) => ws.split(' ').map(w => [w, p])));
PERSON_OF.set("let's", 'we');
const personOf = w => PERSON_OF.get(w) || PERSON_OF.get(w.replace(/'(ll|m|ve|d|re|s)$/, '')) || null;

/**
 * Who speaks and to whom, line by line (morton-in-depth.md §2, lyric as "the
 * genre of the other mind"): perLine [[persons]] from I, you (and thou), he
 * or she, we, it or they; shifts [{ at, from, to }] where the set changes;
 * arrivals { person: first line }.
 */
export function pronouns(input) {
  const texts = textsOf(input);
  const order = Object.keys(PERSONS);
  const perLine = texts.map(t => { const s = new Set(en.wordsOf(t).map(x => personOf(x.w)).filter(Boolean)); return order.filter(p => s.has(p)); });
  const shifts = [], arrivals = {};
  let prev = null;
  perLine.forEach((ps, i) => {
    for (const p of ps) if (!(p in arrivals)) arrivals[p] = i;
    if (!ps.length) return;
    if (prev && prev.join() !== ps.join()) shifts.push({ at: i, from: prev, to: ps });
    prev = ps;
  });
  const facts = [];
  const said = { I: '"I"', you: '"you" (or thou)', 'he/she': 'a he or she', we: '"we"', 'it/they': '"it" or "they"' };
  const firsts = order.filter(p => p in arrivals).map(p => `${said[p]} at line ${lineNo(arrivals[p])}`);
  facts.push(firsts.length ? `first appear: ${firsts.join('; ')}` : 'no pronouns: no one says I, and no one is called you');
  if ('you' in arrivals && arrivals.you >= texts.length / 2) facts.push(`the one addressed arrives late, at line ${lineNo(arrivals.you)} of ${texts.length}`);
  if (!('you' in arrivals) && 'I' in arrivals) facts.push('no one is addressed: a voice overheard');
  return { perLine, shifts, arrivals, facts };
}

const TURN_OPENERS = [['and yet', 3], ['but yet', 3], ['and still', 3], ['but', 2], ['yet', 2], ['so', 2], ['then', 2], ['now', 2], ['thus', 2], ['still', 2], ['o', 2], ['oh', 2], ['this', 1]];

/**
 * The turn (morton-in-depth.md §5(i)3): each line is scored as the first
 * line after a turn: +3 if it opens on "and yet", +2 on but, yet, so, then,
 * now, thus, still or O, +1 on "this"; +1 where a block of the scheme begins
 * (8 and 12 in a sonnet; a stanza; a closing couplet); +1 where negation
 * thickens or thins across it; +1 where the persons change. The best line
 * is the turn if it scores 2 with a turning word, or 3 without. Returns { at (the
 * first line after the turn), word, kind: 'Italian' (a sonnet's line 9, or
 * that proportion) | 'English' (the closing couplet) | 'early' | 'late' |
 * 'none', score, candidates }.
 */
export function turn(input) {
  const p = parsed(input);
  const texts = p.lines.map(l => l.text);
  const n = texts.length;
  const none = { at: null, word: null, kind: 'none', score: 0, candidates: [] };
  if (n < 3) return none;
  const neg = negation(p).perLine, persons = pronouns(p).perLine;
  const letters = rhymeScheme(p).ends.map(e => e.letter);
  const starts = new Set();
  if (n === 14) { starts.add(8); starts.add(12); } else {
    p.lines.forEach((l, i) => { if (i && l.stanza !== p.lines[i - 1].stanza) starts.add(i); });
    if (n >= 4 && letters[n - 1] === letters[n - 2] && letters[n - 2] !== letters[n - 3]) starts.add(n - 2);
  }
  const candidates = [];
  for (let k = 1; k < n; k++) {
    const ws = en.wordsOf(texts[k]);
    const two = ws.slice(0, 2).map(x => x.w).join(' ');
    const hit = TURN_OPENERS.find(([w]) => (w.includes(' ') ? two === w : ws[0]?.w === w));
    let score = 0;
    const why = [];
    if (hit) { score += hit[1]; why.push(`opens on "${ws.slice(0, hit[0].split(' ').length).map(x => cleanRaw(x.raw)).join(' ')}"`); }
    if (starts.has(k)) { score += 1; why.push('a block of the scheme begins'); }
    const before = mean(neg.slice(Math.max(0, k - 4), k)), after = mean(neg.slice(k, k + 4));
    if (Math.abs(before - after) >= 0.5) { score += 1; why.push(after > before ? 'negation thickens' : 'negation thins'); }
    const pb = new Set(persons.slice(Math.max(0, k - 2), k).flat()), pa = new Set(persons.slice(k, k + 2).flat());
    if ((pb.size || pa.size) && [...pb].sort().join() !== [...pa].sort().join()) { score += 1; why.push(`the persons change (${[...pb].join(', ') || 'none'} → ${[...pa].join(', ') || 'none'})`); }
    if (score) candidates.push({ at: k, word: hit ? ws.slice(0, hit[0].split(' ').length).map(x => cleanRaw(x.raw)).join(' ') : null, score, why });
  }
  candidates.sort((a, b) => b.score - a.score || (b.word ? 1 : 0) - (a.word ? 1 : 0) || a.at - b.at);
  // A turn needs a word that turns, or three signs at one place.
  const best = candidates[0];
  if (!best || best.score < 2 || (!best.word && best.score < 3)) return { ...none, candidates: candidates.slice(0, 3) };
  const italian = n === 14 ? 8 : n >= 10 ? Math.round((n * 4) / 7) : -1;
  const english = n >= 6 && letters[n - 1] === letters[n - 2] ? n - 2 : n === 14 ? 12 : -1;
  const kind = best.at === italian ? 'Italian' : best.at === english ? 'English' : best.at < n / 2 ? 'early' : 'late';
  return { at: best.at, word: best.word, kind, score: best.score, candidates: candidates.slice(0, 3) };
}

// ---------------------------------------------------------------- the line in the mouth

/**
 * Iambic pentameter, line by line (morton-in-depth.md §5(i)10): each line
 * scanned as spoken, then, if it runs over ten syllables without a feminine
 * ending, again with verse elision (heav'n, desiring as three). Per line {
 * i, beats, syllables, elided, pattern, feet, substitutions: [{ foot, kind:
 * 'trochee' | 'spondee' | 'pyrrhic' | 'feminine ending' }], feminine, regular
 * }; regular means ten syllables (eleven with a feminine ending), four to six
 * beats, and no more liberty than an opening inversion plus a little (a
 * trochee elsewhere costs 1, a spondee or pyrrhic half; 2 at most). share is
 * the part of the lines that are regular; trochees lists the lines opening
 * on an inversion, feminine the lines with a feminine ending.
 */
export function pentameter(input) {
  const lines = textsOf(input).map((t, i) => meterLine(t, i));
  return {
    lines,
    share: round(lines.filter(l => l.regular).length / Math.max(1, lines.length)),
    trochees: lines.filter(l => l.substitutions.some(s => s.kind === 'trochee' && s.foot === 1)).map(l => l.i),
    feminine: lines.filter(l => l.feminine).map(l => l.i),
  };
}

const fitsTen = s => s.syllables === 10 || (s.syllables === 11 && s.pattern.endsWith('x'));

function meterLine(text, i) {
  let s = en.scan(text);
  if (!fitsTen(s) && s.syllables > 10) {
    for (let k = 1; k <= 3; k++) {
      const e = en.scan(text, { elide: k });
      if (e.elided.length < k) break;
      if (fitsTen(e)) { s = e; break; }
    }
  }
  const fits = fitsTen(s);
  const feminine = s.syllables === 11 && s.pattern.endsWith('x');
  const feet = [], substitutions = [];
  let cost = 0;
  if (fits) {
    for (let k = 0; k < 10; k += 2) feet.push(s.pattern.slice(k, k + 2));
    feet.forEach((f, k) => {
      if (f === '/x') { substitutions.push({ foot: k + 1, kind: 'trochee' }); if (k) cost += 1; }
      else if (f === '//') { substitutions.push({ foot: k + 1, kind: 'spondee' }); cost += 0.5; }
      else if (f === 'xx') { substitutions.push({ foot: k + 1, kind: 'pyrrhic' }); cost += 0.5; }
    });
    if (feminine) substitutions.push({ foot: 6, kind: 'feminine ending' });
  }
  const regular = fits && s.beats >= 4 && s.beats <= 6 && cost <= 2;
  return { i, beats: s.beats, syllables: s.syllables, elided: s.elided, pattern: s.pattern, feet, substitutions, feminine, regular };
}

// Light words that close a phrase well enough (there, then, up, me, it):
// a line may end on them without hanging.
const CLOSERS = new Set('there here then so too yet up out off down me him them us it you thee this these those do does did is are was were be been'.split(' '));

/**
 * Enjambment that hesitates (morton-in-depth.md §5(i)8): lines that run on
 * (not end-stopped) from a light word that cannot close a phrase (the, of,
 * my, and, where), so the voice hangs over the gap. Returns their indices.
 */
export function hesitations(input) {
  return textsOf(input).map((t, i) => ({ t, i })).filter(({ t }) => {
    const last = lastWordOf(t);
    return last && !en.endStopped(t) && light(last.w) && !CLOSERS.has(last.w);
  }).map(x => x.i);
}

// Stressed content words of a line, with their place.
function stressedWords(texts) {
  return texts.map((t, i) => {
    const ws = en.wordsOf(t);
    return ws.map((x, k) => ({ i, k, w: x.w, end: k === ws.length - 1 })).filter(x => !light(x.w) && en.wordStress(x.w).includes(1));
  });
}

// The stressed vowel of a word.
function stressedVowel(w) {
  const ph = en.phones(w).phones.filter(x => x.v);
  return (ph.find(x => x.s === 1) || ph[0])?.p || '';
}

/**
 * Internal rhyme (morton-in-depth.md §5(i)11; bardic-tradition.md §7.2):
 * perfect rhymes between stressed words inside a line and across adjacent
 * lines, leaving out end against end (that is the scheme) and a word against
 * itself (that is repetition). Returns { pairs: [{ a: { i, word }, b: { i,
 * word }, kind }], density (pairs a line), assonance (the share of stressed
 * vowels that recur in their line), facts }.
 */
export function internalRhyme(input) {
  const texts = textsOf(input);
  const words = stressedWords(texts);
  const pairs = [];
  const test = (a, b) => {
    if ((a.end && b.end) || a.w === b.w || lemma(a.w) === lemma(b.w)) return;
    if (en.rhymeWords(a.w, b.w).kind === 'perfect') pairs.push({ a: { i: a.i, word: a.w }, b: { i: b.i, word: b.w }, kind: 'perfect' });
  };
  words.forEach((ws, i) => {
    for (let x = 0; x < ws.length; x++) for (let y = x + 1; y < ws.length; y++) test(ws[x], ws[y]);
    for (const a of ws) for (const b of words[i + 1] || []) test(a, b);
  });
  const assonance = mean(words.filter(ws => ws.length > 1).map(ws => {
    const vs = ws.map(x => stressedVowel(x.w));
    return vs.filter(v => vs.filter(u => u === v).length > 1).length / vs.length;
  }));
  const facts = [pairs.length
    ? `${pairs.length} internal rhyme${pairs.length === 1 ? '' : 's'}: ${pairs.slice(0, 4).map(p => `${p.a.word} (line ${lineNo(p.a.i)}) with ${p.b.word} (line ${lineNo(p.b.i)})`).join('; ')}`
    : 'no internal rhyme between stressed words',
  `${Math.round(assonance * 100)}% of the stressed vowels in a line come back in the same line (assonance)`];
  return { pairs, density: round(pairs.length / Math.max(1, texts.length)), assonance: round(assonance), facts };
}

/**
 * Aicill (bardic-tradition.md §3.4, §7.2): a line's last word answered by a
 * rhyme inside the next line, not at its end ("hill" / "until the mill
 * stood still"). Checked for each pair of neighbouring lines in a stanza;
 * rhyme here is perfect, or a vowel rhyme of the same shape. Returns {
 * pairs: [{ i, end, answer, kind }], share (of the pairs checked), facts }.
 */
export function aicill(input) {
  const { lines } = parsed(input);
  const pairs = [];
  let checked = 0;
  lines.forEach((l, i) => {
    const next = lines[i + 1];
    const end = lastWordOf(l.text);
    if (!next || next.stanza !== l.stanza || !end) return;
    checked++;
    let best = null;
    for (const x of en.wordsOf(next.text).slice(0, -1)) {
      if (light(x.w) || lemma(x.w) === lemma(end.w)) continue;
      const k = en.rhymeWords(end.w, x.w).kind;
      if (k === 'perfect' && (!best || best.kind !== 'perfect')) best = { i, end: end.w, answer: x.w, kind: k };
      else if (k === 'vowel' && !best && falls(end.w) === falls(x.w)) best = { i, end: end.w, answer: x.w, kind: k };
    }
    if (best) pairs.push(best);
  });
  return {
    pairs, share: round(checked ? pairs.length / checked : 0),
    facts: [pairs.length
      ? `${pairs.length} line end${pairs.length === 1 ? ' is' : 's are'} answered inside the next line (aicill): ${pairs.slice(0, 4).map(p => `${p.end} → ${p.answer} (lines ${lineNo(p.i)}–${lineNo(p.i + 1)})`).join(', ')}`
      : 'no line end is answered inside the next line (aicill)'],
  };
}

// The sound a word begins with, for alliteration: any vowel goes with any
// vowel; s with a stop (sp, st, sk) only with itself.
function onsetOf(w) {
  const ph = en.phones(w).phones;
  if (!ph.length) return '';
  if (ph[0].v) return 'a vowel';
  if (ph[0].p === 'S' && ph[1] && /^(P|T|K)$/.test(ph[1].p)) return 'S' + ph[1].p;
  return ph[0].p;
}

/**
 * Alliteration (bardic-tradition.md §7.2, the Irish uaim): neighbouring
 * stressed words in a line (only light words between them) that begin with
 * the same sound. Returns { pairs: [{ i, a, b, sound }], share (lines with
 * at least one pair), density (pairs a line), facts }.
 */
export function alliteration(input) {
  const texts = textsOf(input);
  const pairs = [];
  texts.forEach((t, i) => {
    const content = en.wordsOf(t).filter(x => !light(x.w));
    for (let k = 1; k < content.length; k++) {
      const a = content[k - 1].w, b = content[k].w;
      if (a === b) continue;
      const s = onsetOf(a);
      if (s && s === onsetOf(b)) pairs.push({ i, a, b, sound: s });
    }
  });
  const lines = new Set(pairs.map(p => p.i)).size;
  const share = lines / Math.max(1, texts.length);
  return {
    pairs, share: round(share), density: round(pairs.length / Math.max(1, texts.length)),
    facts: [pairs.length
      ? `${lines} of ${texts.length} lines alliterate: ${pairs.slice(0, 4).map(p => `${p.a} ${p.b} (line ${lineNo(p.i)})`).join(', ')}`
      : 'no alliteration between neighbouring stressed words'],
  };
}

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/**
 * How parallel two lines (or half-lines) run, 0..1 (morton-in-depth.md
 * §5(i)7): 0.4 for the same stress shape (1 − edit distance of the scan
 * patterns ÷ the longer), 0.3 for the words they share, 0.3 when they open or
 * close on the same word.
 */
export function parallelism(a, b) {
  const sa = en.scan(a), sb = en.scan(b);
  const longer = Math.max(sa.pattern.length, sb.pattern.length);
  const shape = longer ? 1 - editDistance(sa.pattern, sb.pattern) / longer : 0;
  const wa = sa.words.map(x => x.w), wb = sb.words.map(x => x.w);
  const A = new Set(wa), B = new Set(wb);
  const shared = A.size + B.size ? (2 * [...A].filter(w => B.has(w)).length) / (A.size + B.size) : 0;
  const frame = wa.length && wb.length && (wa[0] === wb[0] || wa.at(-1) === wb.at(-1)) ? 1 : 0;
  return round(0.4 * shape + 0.3 * shared + 0.3 * frame);
}

/**
 * Parallelism across a poem: each pair of neighbouring lines in a stanza
 * ({ kind: 'lines', i, a, b, score }, i the first line), and each line with
 * a break near its middle (a comma, semicolon, colon, dash or |) split into
 * two half-lines ({ kind: 'halves', i, a, b, score }).
 */
export function parallelPairs(input) {
  const { lines } = parsed(input);
  const out = [];
  lines.forEach((l, i) => {
    const next = lines[i + 1];
    if (next && next.stanza === l.stanza) out.push({ kind: 'lines', i, a: l.text, b: next.text, score: parallelism(l.text, next.text) });
    const breaks = [...l.text.matchAll(/[,;:|—–]/g)].map(m => m.index).filter(k => k > 0 && k < l.text.length - 2);
    if (!breaks.length) return;
    const mid = breaks.sort((x, y) => Math.abs(x - l.text.length / 2) - Math.abs(y - l.text.length / 2))[0];
    const a = l.text.slice(0, mid).trim(), b = l.text.slice(mid + 1).trim();
    if (en.wordsOf(a).length >= 2 && en.wordsOf(b).length >= 2) out.push({ kind: 'halves', i, a, b, score: parallelism(a, b) });
  });
  return out;
}

// ---------------------------------------------------------------- the board

// Words struck again (shakespeare-sonnets.md §6c.5): 's and 'st folded in,
// light words left out, but "then" kept (it turns).
function struckWords(texts) {
  const at = new Map();
  let tokens = 0;
  texts.forEach((t, i) => en.wordsOf(t).forEach(x => {
    const w = lemma(x.w);
    if (!w || (light(w) && w !== 'then')) return;
    tokens++;
    if (!at.has(w)) at.set(w, []);
    at.get(w).push(i);
  }));
  const struck = [...at].filter(([, is]) => is.length > 1).map(([word, lines]) => ({ word, count: lines.length, lines }))
    .sort((a, b) => b.count - a.count || a.lines[0] - b.lines[0]);
  return { struck, share: tokens ? struck.reduce((n, s) => n + s.count, 0) / tokens : 0 };
}

const FORM_SAYS = {
  'shakespearean sonnet': 'a Shakespearean sonnet (three quatrains rhymed across, and a couplet)',
  'petrarchan sonnet': 'a Petrarchan sonnet (an octave on two rhymes, abba abba, then a sestet)',
  sonnet: 'a sonnet (fourteen rhymed lines)',
  couplets: 'rhymed couplets',
  ghazal: 'a ghazal (the opening couplet rhymes, then every couplet closes on that rhyme)',
  rubai: 'a rubāʿī (four lines rhymed aaba)',
  quatrains: 'rhymed quatrains',
  'ballad stanza': 'the ballad stanza (four beats and three, rhymed on the short lines)',
  'terza rima': 'terza rima (aba bcb cdc: each tercet hands its middle rhyme on)',
  free: 'no fixed form of rhyme',
};

function blockName(scheme, i) {
  const k = scheme.blocks.findIndex(b => i >= b.from && i <= b.to);
  if (k < 0) return 'the poem';
  const b = scheme.blocks[k], size = b.to - b.from + 1;
  const same = scheme.blocks.filter(x => x.to - x.from + 1 === size);
  const nth = same.indexOf(b);
  const name = BLOCK_NAMES[size] || 'stanza';
  return same.length > 1 ? `the ${ORDINAL[nth] || `${nth + 1}th`} ${name}` : `the ${name}`;
}

function rhymeChannel(scheme, rad, strike, n) {
  const planet = mean(scheme.ends.map(e => e.heat));
  const sounds = new Set(scheme.ends.map(e => e.letter)).size;
  const perSound = n / Math.max(1, sounds);
  const absolute = scheme.ends.filter(e => e.kind === 'absolute' && e.with !== null);
  const heat = clamp(0.8 * planet + 0.15 * clamp((perSound - 1) / 3) + Math.min(0.15, strike.share)
    + Math.min(0.1, 0.05 * absolute.length) + (rad ? 0.1 * rad.share : 0));
  const facts = [`rhyme scheme ${scheme.letters}: ${FORM_SAYS[scheme.form]}`,
    `${n} lines on ${sounds} rhyme sound${sounds === 1 ? '' : 's'} (${perSound.toFixed(1)} lines a sound: the more lines a sound holds, the hotter)`];
  for (const e of absolute) {
    const a = blockName(scheme, e.with), b = blockName(scheme, e.i);
    const noun = a.split(' ').at(-1);
    const to = b.endsWith(` ${noun}`) ? b.slice(0, -noun.length - 1) : b;
    facts.push(`Lines ${lineNo(e.with)} and ${lineNo(e.i)} end on the same word, ${e.word}: absolute rhyme ${a === b ? `inside ${a}` : `joining ${a} to ${to}`}`);
  }
  for (const e of scheme.ends.filter(x => x.with !== null && ['vowel', 'off', 'para', 'eye'].includes(x.kind))) {
    facts.push(`Lines ${lineNo(e.with)} and ${lineNo(e.i)}, ${scheme.ends[e.with].word} / ${e.word}: only ${en.PLANETS[e.kind].says}`);
  }
  const fem = scheme.ends.filter(e => e.with !== null && e.feminine && e.kind === 'perfect');
  if (fem.length) facts.push(`feminine rhyme, falling after the stress: ${fem.map(e => `${scheme.ends[e.with].word} / ${e.word} (lines ${lineNo(e.with)} and ${lineNo(e.i)})`).join('; ')}`);
  if (scheme.blocks.length > 1) {
    const avg = mean(scheme.blocks.map(b => b.heat));
    for (const b of scheme.blocks) if (b.heat < avg - 0.15) facts.push(`${blockName(scheme, b.from).replace(/^t/, 'T')} cools (${b.heat} against ${round(avg)} for the poem)`);
  }
  if (rad) facts.push(`every couplet closes on the same words, "${rad.phrase}" (a radīf): absolute rhyme after a changing rhyme word (${and(rad.rhymes)})`);
  facts.push(strike.struck.length ? `words struck again: ${strike.struck.slice(0, 5).map(s => `${s.word} ×${s.count} (${linesSaid([...new Set(s.lines)])})`).join(', ')}` : 'no word struck again');
  return { heat: round(heat), facts };
}

/**
 * The whole reading of an English poem: { channels: { space, lineation,
 * syntax, rhythm, rhyme } each { heat 0..1, facts }, scheme, radif, dunadh,
 * turn, negation, struck: [{ word, count, lines }], pronouns, pentameter,
 * hesitations, internal, aicill, alliteration, parallel (neighbouring lines
 * or half-lines at 0.6 or more), whelm: 'may overwhelm' |
 * 'may underwhelm' | null, lines, stanzas }. Lineation, syntax and rhythm are
 * measured as englishBoard measures them; rhyme comes from the scheme (how
 * many lines each sound holds, how hot each chime is, absolute rhyme, a
 * radīf, words struck again), not from a song's couplets.
 */
export function poemBoard(text, { title = false } = {}) {
  const p = typeof text === 'string' ? poemLines(text, { title }) : parsed(text);
  const texts = p.lines.map(l => l.text);
  const n = texts.length;
  const scans = texts.map(t => en.scan(t));
  const scheme = rhymeScheme(p);
  const rad = radif(p);
  const strike = struckWords(texts);
  const hes = hesitations(p);
  const meter = pentameter(p);

  const rhythm = rhythmChannel(scans);
  if (meter.share >= 0.5) rhythm.facts.push(`${Math.round(meter.share * n)} of ${n} lines are iambic pentameter (five beats, weak then strong, with the usual liberties)`);
  const lineation = lineationChannel(texts, scans, rhythm.onGroove);
  const lineationHeat = clamp(lineation.heat - Math.min(0.15, 0.03 * hes.length));
  if (hes.length) lineation.facts.push(`${linesSaid(hes)} run on from a light word, and the voice hangs over the gap (a hesitation cools the lineation)`);
  const syntax = syntaxChannel(texts);
  const channels = {
    space: space(p),
    lineation: { heat: round(lineationHeat), facts: lineation.facts },
    syntax: { heat: syntax.heat, facts: syntax.facts },
    rhythm: { heat: rhythm.heat, facts: rhythm.facts },
    rhyme: rhymeChannel(scheme, rad, strike, n),
  };
  // Morton's whelm check (morton-in-depth.md §5(i)14), made for four channels:
  // four at 0.85 or more may overwhelm, unless another runs cool, for a cool
  // channel against hot ones is a conversation (Sonnet 29's Baked Alaska).
  const hot = POEM_CHANNELS.filter(c => channels[c].heat >= 0.85).length;
  const cool = POEM_CHANNELS.some(c => channels[c].heat < 0.55);
  const whelm = hot >= 4 && !cool ? 'may overwhelm' : POEM_CHANNELS.every(c => channels[c].heat <= 0.25) ? 'may underwhelm' : null;
  return {
    ...(p.title !== undefined ? { title: p.title } : {}),
    channels,
    scheme,
    radif: rad,
    dunadh: dunadh(p),
    turn: turn(p),
    negation: negation(p),
    struck: strike.struck,
    pronouns: pronouns(p),
    pentameter: meter,
    hesitations: hes,
    internal: internalRhyme(p),
    aicill: aicill(p),
    alliteration: alliteration(p),
    parallel: parallelPairs(p).filter(x => x.score >= 0.6),
    whelm,
    lines: p.lines,
    stanzas: p.stanzas,
  };
}

// How to move a channel, for the lens advice.
const MOVES = {
  space: { cooler: 'break the block: vary the line widths, set lines in, let the stanzas differ', hotter: 'even the lines and the stanzas into a block' },
  lineation: { cooler: 'run lines on, and let their lengths vary', hotter: 'end-stop the lines and even their lengths' },
  syntax: { cooler: 'hang clauses under one another (when, which, a participle) and hold the main verb back', hotter: 'lay phrases side by side: and, and, a comma, a colon' },
  rhythm: { cooler: 'let the beat count vary and break the alternation of weak and strong', hotter: 'keep one beat count and alternate weak and strong' },
  rhyme: { cooler: 'loosen the chimes toward off or para rhyme, or leave lines unrhymed', hotter: 'close lines on perfect rhymes, hold a sound longer, strike a key word again' },
};

/**
 * Where a poem runs 0.25 or more hotter or cooler than a lens, on each
 * channel the lens sets. lens: a lens from prompts/lenses.json ({ name,
 * board }), its board ({ channel: heat }), or another board ({ channels }).
 * Plain advice lines, never a verdict.
 */
export function compareToLens(board, lens, { label } = {}) {
  const sets = lens?.channels ? Object.fromEntries(Object.entries(lens.channels).map(([k, v]) => [k, v.heat])) : lens?.board || lens || {};
  const name = label || (lens?.name ? `the ${lens.name} lens` : 'the lens');
  const out = [];
  for (const ch of POEM_CHANNELS) {
    const want = sets[ch];
    if (typeof want !== 'number' || !board.channels[ch]) continue;
    const got = board.channels[ch].heat;
    if (Math.abs(got - want) < 0.25) continue;
    const dir = got > want ? 'cooler' : 'hotter';
    out.push(`${POEM_CHANNEL_NAMES[ch]}: the poem runs ${temperature(got)} (${got}), ${name} ${temperature(want)} (${want}); to run ${dir}, ${MOVES[ch][dir]}`);
  }
  return out;
}

// ---------------------------------------------------------------- as text

const bar = h => '▮'.repeat(Math.round(h * 5)).padEnd(5, '▯');

/**
 * The reading as plain text, in Morton's five steps (structure, texture,
 * perception, narrator, narrative), for the command line. With { lens } the
 * lens's board and the advice against it follow.
 */
export function poemText(board, { lens = null } = {}) {
  const out = [];
  const head = (k, t) => out.push('', `${k} ${t}`);
  const row = ch => {
    const c = board.channels[ch];
    const want = lens?.board?.[ch];
    out.push(`  ${POEM_CHANNEL_NAMES[ch].padEnd(10)} ${temperature(c.heat).padEnd(5)} ${bar(c.heat)} ${c.heat.toFixed(2)}${typeof want === 'number' ? `   (${lens.name}: ${temperature(want)} ${want})` : ''}`);
    for (const f of c.facts) out.push(`${''.padEnd(14)}${f}`);
  };
  const n = board.lines.length;
  out.push(`${board.title ? board.title + ': ' : ''}${n} lines, ${FORM_SAYS[board.scheme.form]} (hot = repetition and pattern, cool = variation)`);
  head(1, 'STRUCTURE: the architecture before the meaning');
  row('space'); row('lineation'); row('syntax');
  head(2, 'TEXTURE: the poem in the mouth (rhythm is line, rhyme is colour)');
  row('rhythm');
  const m = board.pentameter;
  out.push(`${''.padEnd(14)}pentameter: ${Math.round(m.share * n)} of ${n} lines regular${m.trochees.length ? `; opening inversions (a trochee first) at ${and(m.trochees.map(lineNo))}` : ''}${m.feminine.length ? `; feminine endings at ${and(m.feminine.map(lineNo))}` : ''}`);
  const elided = m.lines.filter(l => l.elided.length);
  if (elided.length) out.push(`${''.padEnd(14)}said short for the metre: ${elided.map(l => `${l.elided.map(e => e.as).join(', ')} (line ${lineNo(l.i)})`).join('; ')}`);
  m.lines.forEach(l => out.push(`${''.padEnd(16)}${lineNo(l.i).padStart(2)} ${l.pattern.padEnd(13)} ${String(l.beats)} beats${l.substitutions.length ? '  ' + l.substitutions.map(s => (s.kind === 'feminine ending' ? s.kind : `${s.kind} ${s.foot}`)).join(', ') : ''}`));
  row('rhyme');
  out.push(`${''.padEnd(14)}${board.scheme.blocks.length > 1 ? `heat by block: ${board.scheme.blocks.map(b => `${b.from + 1}–${b.to + 1} ${b.heat}`).join(', ')}` : ''}`.trimEnd());
  out.push(`${''.padEnd(14)}radīf: ${board.radif ? `"${board.radif.phrase}" on lines ${and(board.radif.lines.map(lineNo))}` : 'none'}; dúnadh (the poem closing on its first word): ${board.dunadh ? `${board.dunadh.first} … ${board.dunadh.last} (${board.dunadh.grade})` : 'none, the circle stays open'}`);
  for (const f of [...board.internal.facts, ...(board.aicill?.facts || []), ...board.alliteration.facts]) out.push(`${''.padEnd(14)}${f}`);
  if (board.parallel.length) out.push(`${''.padEnd(14)}parallel: ${board.parallel.slice(0, 4).map(x => `${x.kind === 'lines' ? `lines ${lineNo(x.i)}–${lineNo(x.i + 1)}` : `the halves of line ${lineNo(x.i)}`} (${x.score})`).join(', ')}`);
  head(3, 'PERCEPTION: what it makes you see, in order (read it; only negation is measured)');
  for (const f of board.negation.facts) out.push(`  ${f}`);
  out.push('  Ask: what does the poem force you to see first, and last? What is switched on only to be switched off?');
  head(4, 'NARRATOR: who speaks, to whom');
  for (const f of board.pronouns.facts) out.push(`  ${f}`);
  if (board.pronouns.shifts.length) out.push(`  the persons shift at ${and(board.pronouns.shifts.map(s => `line ${lineNo(s.at)} (${s.from.join(', ')} → ${s.to.join(', ')})`))}`);
  head(5, 'NARRATIVE: how it moves, and where it turns');
  const t = board.turn;
  out.push(t.kind === 'none' ? '  no clear turn: no line opens on but, yet or so where the poem shifts'
    : `  the turn: line ${lineNo(t.at)}${t.word ? `, on "${t.word}"` : ''} (${t.kind}${t.kind === 'Italian' ? ': the octave gives way to the sestet' : t.kind === 'English' ? ': the closing couplet' : ''}); ${t.candidates[0].why.join(', ')}`);
  for (const c of t.kind === 'none' ? [] : t.candidates.slice(1).filter(c => c.score >= 2)) out.push(`  also: line ${lineNo(c.at)}${c.word ? ` ("${c.word}")` : ''}, ${c.why.join(', ')}`);
  out.push('  Ask: where does the poem go from A to not-A? What does it say no to?');
  out.push('', `Whelm: ${board.whelm || 'neither: the channels talk to each other'}`);
  if (lens) {
    const adv = compareToLens(board, lens);
    out.push('', `Against the ${lens.name} lens (${lens.after || lens.id}):`);
    out.push(adv.length ? adv.map(a => '  ~ ' + a).join('\n') : '  within a quarter of the lens on every channel it sets');
  }
  return out.join('\n');
}
