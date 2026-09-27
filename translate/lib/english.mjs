/**
 * English as the ear takes it: syllables, stresses and rhyme, for the mixing
 * board (lib/reading.mjs) and the Workshop page. Pronunciations come from the
 * CMU Pronouncing Dictionary (ARPAbet phones, stress 0/1/2) once one is handed
 * to useDictionary(); a word it lacks (a name, a coinage, an IAST spelling) is
 * read from its spelling. Stress is relative, so this is an estimate a reader
 * checks aloud, never a verdict. No imports: the Workshop bundles this file.
 */

let DICT = null;
export function useDictionary(d) { DICT = d || null; }
export const hasDictionary = () => !!DICT;

// Words that sit unstressed unless a reader leans on them. "not", "no" and
// "now" are left out: they usually carry a beat.
const LIGHT = new Set(`a an the and but or nor so yet for of to in on at by with from into onto upon off out up as than that this these those
there then when while if though because since until unless where whose who whom which what whether is am are was were be been
have has had do does did shall should will would can could may might must i me my we us our you your he him his she her it its
they them their o oh 's 're 've 'll 'd 'm let's i'm i've i'll you'll it's she's he's that's there's`.split(/\s+/));

const VOWEL_PHONES = new Set(['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW']);

/** Lowercase, plain letters: "Ḍombī's" -> "dombi's". */
export const plainWord = w => String(w).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[’‘]/g, "'").replace(/[^a-z']/g, '').replace(/^'+|'+$/g, '');

export const wordsOf = line => String(line).replace(/\[([^\]]*)\]\{[^}]*\}/g, '$1').split(/[\s—–-]+/)
  .map(w => ({ raw: w, w: plainWord(w) })).filter(x => x.w);

// Pseudo-phones from spelling, good enough to compare two unknown words.
function spellPhones(w) {
  const out = [];
  const re = /([aeiouy]+)|([^aeiouy']+)/g;
  let m, first = true;
  while ((m = re.exec(w))) {
    if (m[1]) { out.push({ p: m[1].toUpperCase(), v: true, s: first ? 1 : 0 }); first = false; }
    else for (const c of m[2]) out.push({ p: c.toUpperCase(), v: false });
  }
  if (out.length > 1 && out[out.length - 1].v && out[out.length - 1].p === 'E' && out.filter(x => x.v).length > 1) out.pop();
  return out;
}

const parse = entry => entry.split(' ').map(x => {
  const m = /^([A-Z]+)([012])?$/.exec(x);
  return { p: m[1], v: VOWEL_PHONES.has(m[1]), s: m[2] ? Number(m[2]) : null };
});
const P = s => parse(s);

// A word the dictionary lacks may be a known word with a prefix or an ending (unmaking, oars').
function derive(w) {
  const d = x => DICT && DICT[x];
  if (w.endsWith("'s") && d(w.slice(0, -2))) return [...P(d(w.slice(0, -2))), ...P('Z')];
  if (w.endsWith("s'") && d(w.slice(0, -1))) return P(d(w.slice(0, -1)));
  for (const [pre, ph] of [['un', 'AH0 N'], ['re', 'R IY0'], ['in', 'IH0 N']]) {
    if (w.startsWith(pre) && w.length > pre.length + 2) {
      const rest = d(w.slice(pre.length)) || (w.length > pre.length + 3 && derive(w.slice(pre.length)));
      if (rest) return [...P(ph), ...(typeof rest === 'string' ? P(rest) : rest)];
    }
  }
  for (const [suf, ph] of [['ing', 'IH0 NG'], ['ed', 'D'], ['es', 'Z'], ['s', 'Z'], ['ly', 'L IY0'], ['er', 'ER0']]) {
    if (!w.endsWith(suf) || w.length < suf.length + 3) continue;
    const stem = w.slice(0, -suf.length);
    const base = d(stem) || d(stem + 'e') || (stem.length > 3 && stem.at(-1) === stem.at(-2) && d(stem.slice(0, -1)));
    if (base) return [...P(base), ...P(ph)];
  }
  return null;
}

/** Phones of one word: [{p, v (vowel), s (stress 0|1|2)}], and whether they came from the dictionary. */
export function phones(word) {
  const w = plainWord(word);
  if (!w) return { phones: [], known: false };
  const hit = DICT && DICT[w];
  if (hit) return { phones: P(hit), known: true };
  const derived = DICT && derive(w);
  if (derived) return { phones: derived, known: true };
  return { phones: spellPhones(w), known: false };
}

/**
 * Stress of a word the dictionary lacks: most are names and terms in IAST
 * (Ḍombī, samādhi, kāpālika), so the Sanskrit rule a reader would use: the
 * next-to-last syllable when it is heavy (a long vowel, or closed by a
 * consonant), else the one before it.
 */
function guessStress(raw) {
  const w = String(raw).normalize('NFC').toLowerCase().replace(/[^a-zāīūēōṛṝḷṅñṭḍṇśṣḥṃ']/g, '');
  const sy = [];
  // y is a consonant in IAST (Yamunā, Lūyī); only a word with no other vowel sounds it.
  const re = /[aeiouāīūēōṛ]/.test(w) ? /([^aeiouāīūēōṛ]*)(ai|au|[aeiouāīūēōṛ])/g : /([^aeiouy]*)([aeiouy])/g;
  let m, last = 0;
  while ((m = re.exec(w))) { sy.push({ onset: m[1], v: m[2] }); last = re.lastIndex; }
  if (!sy.length) return [1];
  const coda = w.slice(last);
  if (sy.length > 1 && sy.at(-1).v === 'e' && !coda && !/[āīū]/.test(w)) sy.pop();
  const n = sy.length;
  if (n === 1) return [1];
  if (n === 2) return [1, 0];
  const heavy = i => /[āīūēōeo]|ai|au/.test(sy[i].v) || (sy[i + 1] && sy[i + 1].onset.replace(/h/g, '').length >= 2) || (i === n - 1 && coda);
  const k = heavy(n - 2) ? n - 2 : n - 3;
  return sy.map((_, i) => (i === k ? 1 : 0));
}

/**
 * Stress per syllable of one word: 1 strong, 0 weak. A light monosyllable is
 * weak; any other monosyllable is strong; a longer word keeps its primary
 * stress (and a secondary stress two syllables away from it).
 */
export function wordStress(word) {
  const w = plainWord(word);
  if (!w) return [];
  if (LIGHT.has(w)) return [0];
  const { phones: ph, known } = phones(w);
  if (!known) return guessStress(word);
  const vs = ph.filter(x => x.v);
  if (vs.length <= 1) return [LIGHT.has(w) ? 0 : 1];
  const s = vs.map(x => (x.s === 1 ? 1 : 0));
  vs.forEach((x, i) => { if (x.s === 2 && !s[i - 1] && !s[i + 1]) s[i] = 1; });
  if (!s.includes(1)) s[0] = 1;
  return s;
}

export function syllableCount(line) {
  return wordsOf(line).reduce((n, { w }) => n + wordStress(w).length, 0);
}

/** The line scanned: words with their stress marks, the beat count, and the pattern as x and /. */
// A light word that ends a line carries the voice ("what do they DO", "clings to YOU").
const PROMOTE = new Set('do does did is are was were be been have has had will would can could may might must shall should you me him her them us it this that these those there here then so too up out off in on through'.split(' '));

export function scan(line) {
  const words = wordsOf(line).map(({ raw, w }) => ({ raw, w, stress: wordStress(raw) }));
  const tail = words.at(-1);
  if (tail && tail.stress.length === 1 && !tail.stress[0] && PROMOTE.has(tail.w)) tail.stress = [1];
  // Stress is relative: in a run of three or more strong monosyllables the
  // voice lets the middle ones fall ("the ROAD's come CLEAR"). Two stay two: a spondee.
  let run = [];
  const settle = () => { for (let i = 1; i < run.length - 1; i += 2) run[i].stress = [0]; run = []; };
  for (const x of words) {
    if (x.stress.length === 1 && x.stress[0] === 1) run.push(x);
    else { if (run.length >= 3) settle(); run = []; }
  }
  if (run.length >= 3) settle();
  const flat = words.flatMap(x => x.stress);
  return { words, beats: flat.filter(Boolean).length, syllables: flat.length, pattern: flat.map(s => (s ? '/' : 'x')).join('') };
}

// Morton's solar system of rhyme, hottest at the centre.
export const PLANETS = {
  absolute: { heat: 1.0, says: 'the same word again (absolute rhyme, the sun: a mantra)' },
  perfect: { heat: 0.8, says: 'perfect rhyme (same vowel, same sounds after it)' },
  vowel: { heat: 0.6, says: 'vowel rhyme (the same vowel, other consonants)' },
  off: { heat: 0.4, says: 'off rhyme (the consonants match, the vowel shifts)' },
  eye: { heat: 0.3, says: 'eye rhyme (spelled alike, sounded apart)' },
  para: { heat: 0.2, says: 'para rhyme (the whole consonant frame kept, the vowel changed: cold, uncanny)' },
  alliteration: { heat: 0.1, says: 'no rhyme, but the words begin alike (alliteration)' },
  none: { heat: 0, says: 'no rhyme' },
};

const lastWord = line => { const ws = wordsOf(line); return ws.length ? ws[ws.length - 1].w : ''; };
const consonants = ps => ps.filter(x => !x.v).map(x => x.p).join(' ');

function tailOf(ph) {
  const vIdx = ph.map((x, i) => (x.v ? i : -1)).filter(i => i >= 0);
  if (!vIdx.length) return { start: ph.length, vowel: '', coda: consonants(ph), onset: consonants(ph) };
  let k = vIdx.filter(i => ph[i].s === 1).pop();
  if (k === undefined) k = vIdx[vIdx.length - 1];
  return {
    start: k,
    vowel: ph[k].p,
    after: ph.slice(k).map(x => x.p).join(' '),
    coda: consonants(ph.slice(k + 1)),
    onset: consonants(ph.slice(0, k)),
    afterVowels: ph.slice(k + 1).filter(x => x.v).map(x => x.p).join(' '),
  };
}

/** How two words sound together: a planet name from PLANETS, and whether the rhyme is feminine (runs past the stress). */
export function rhymeWords(a, b) {
  const wa = plainWord(a), wb = plainWord(b);
  if (!wa || !wb) return { kind: 'none', feminine: false };
  if (wa === wb) return { kind: 'absolute', feminine: false };
  const pa = phones(wa).phones, pb = phones(wb).phones;
  const ta = tailOf(pa), tb = tailOf(pb);
  const feminine = !!(ta.afterVowels || tb.afterVowels);
  if (ta.after && ta.after === tb.after) return { kind: ta.onset === tb.onset ? 'absolute' : 'perfect', feminine };
  if (ta.vowel && ta.vowel === tb.vowel && ta.afterVowels === tb.afterVowels) return { kind: 'vowel', feminine };
  if (ta.coda && ta.coda === tb.coda) return { kind: ta.onset && ta.onset === tb.onset ? 'para' : 'off', feminine };
  const lastC = ps => [...ps].reverse().find(x => !x.v)?.p;
  if (ta.coda && tb.coda && lastC(pa) === lastC(pb) && !pa[pa.length - 1].v && !pb[pb.length - 1].v) return { kind: 'off', feminine };
  if (ta.vowel && ta.vowel === tb.vowel) return { kind: 'vowel', feminine };
  if (wa.length > 2 && wb.length > 2 && wa.slice(-3) === wb.slice(-3)) return { kind: 'eye', feminine };
  const first = ps => ps.find(x => !x.v)?.p;
  if (first(pa) && first(pa) === first(pb) && !pa[0].v && !pb[0].v) return { kind: 'alliteration', feminine: false };
  return { kind: 'none', feminine: false };
}

/** The rhyme between the last words of two lines. */
export function rhymeLines(a, b) {
  const x = lastWord(a), y = lastWord(b);
  return { ...rhymeWords(x, y), a: x, b: y };
}

const COORD = new Set(['and', 'but', 'or', 'nor', 'so', 'yet', 'then']);
const SUBORD = new Set(['when', 'while', 'because', 'though', 'although', 'if', 'unless', 'until', 'since', 'whose', 'which', 'who', 'whom', 'where', 'whether', 'till', 'lest', 'whoever', 'wherever', 'whenever']);

/**
 * Syntax, Morton's way: phrases laid side by side (parataxis: and, and, a
 * comma, a colon) run hot; phrases hung one under another (hypotaxis: when,
 * because, which) run cool. Counts over any number of lines.
 */
export function syntaxOf(lines) {
  let para = 0, hypo = 0;
  for (const line of lines) {
    const ws = wordsOf(line).map(x => x.w);
    for (const w of ws) { if (COORD.has(w)) para++; if (SUBORD.has(w)) hypo++; }
    para += (String(line).match(/[;:,—–]/g) || []).length;
  }
  return { para, hypo };
}

export const endStopped = line => /[.,;:!?—–)”’"']\s*$/.test(String(line).replace(/\[([^\]]*)\]\{[^}]*\}/g, '$1'));
