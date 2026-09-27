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
const LIGHT = new Set(`a an the and but or nor so yet for of to in on at by with from off out up as than that this these those
there then when while if though since where whose who whom which what is am are was were be been
have has had do does did shall should will would can could may might must i me my we us our you your he him his she her it its
they them their o oh 's 're 've 'll 'd 'm let's i'm i've i'll you'll it's she's he's that's there's`.split(/\s+/));

// Light words of two syllables keep both. Those that end on a stress (upon,
// about) carry it there, as the dictionary has them; into, onto, unto and
// whether stay unstressed throughout.
const LIGHT_POLY = {
  into: [0, 0], onto: [0, 0], unto: [0, 0], whether: [0, 0],
  upon: [0, 1], about: [0, 1], above: [0, 1], among: [0, 1], amongst: [0, 1], again: [0, 1], against: [0, 1],
  within: [0, 1], without: [0, 1], before: [0, 1], beneath: [0, 1], between: [0, 1], beyond: [0, 1],
  until: [0, 1], unless: [0, 1], because: [0, 1], across: [0, 1], along: [0, 1], around: [0, 1],
  behind: [0, 1], below: [0, 1], beside: [0, 1], toward: [0, 1], towards: [0, 1], amid: [0, 1], amidst: [0, 1],
};

/** A function word: one the voice passes over unless it leans on it (the, of, upon, into). */
export const isLight = word => { const w = plainWord(word); return LIGHT.has(w) || Object.hasOwn(LIGHT_POLY, w); };

const VOWEL_PHONES = new Set(['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW']);

/** Lowercase, plain letters: "Ḍombī's" -> "dombi's". */
export const plainWord = w => String(w).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[’‘]/g, "'").replace(/[^a-z']/g, '').replace(/^'+|'+$/g, '');

// "&" is said "and" (Blake writes it so).
export const wordsOf = line => String(line).replace(/\[([^\]]*)\]\{[^}]*\}/g, '$1').replace(/&/g, ' and ').split(/[\s—–-]+/)
  .map(w => ({ raw: w, w: plainWord(w) })).filter(x => x.w);

// Spelled in IAST (Ḍombī, Kāṇha), or shaped like a Sanskrit word even without
// its marks (Luyi, pulinda): read by the Sanskrit rule. Anything else the
// dictionary lacks (beweep, bootless) is read as English.
const IAST_MARKS = /[āīūṛṝḷṅñṭḍṇśṣḥṃēō]/;
const ENGLISH_SHAPE = /ee|oo|ea|oa|ou|ow|ie|ei|ay|ey|oy|igh|ck|wh|tch|ght|qu|x|w/;
const readsAsSanskrit = raw => {
  const nfc = String(raw).normalize('NFC').toLowerCase();
  if (IAST_MARKS.test(nfc)) return true;
  const w = plainWord(raw).replace(/'s$/, '');
  return /[aiuo]$/.test(w) && !ENGLISH_SHAPE.test(w);
};

// English syllables from spelling: vowel groups (y after a consonant is a
// vowel), a silent final e (but "-le" after a consonant sounds), a silent -es
// or -ed unless a hiss or a t/d comes before it. Returns [start, end] letter spans.
function englishSpans(w) {
  const s = w.replace(/[^a-z]/g, '');
  const isV = c => 'aeiou'.includes(c);
  const spans = [];
  for (let i = 0; i < s.length;) {
    if (isV(s[i]) || (s[i] === 'y' && i > 0 && !isV(s[i - 1]))) {
      let j = i + 1;
      while (j < s.length && isV(s[j])) j++;
      spans.push([i, j]); i = j;
    } else i++;
  }
  if (spans.length > 1) {
    const tail = s.slice(spans.at(-1)[0]);
    if (tail === 'e' && !/[^aeiou]le$/.test(s)) spans.pop();
    else if (tail === 'es' && !/(s|z|x|ch|sh|c|g)es$/.test(s)) spans.pop();
    else if (tail === 'ed' && !/[td]ed$/.test(s)) spans.pop();
  }
  return { s, spans: spans.length ? spans : [[0, s.length]] };
}

// Prefixes a speaker passes over: the stress falls on the syllable after them.
const UNSTRESSED_PREFIX = /^(a[^aeiou]|be[^aeiou]|de[^aeiou]|re[^aeiou]|un|in|con|com|ex|dis|mis)/;

/** Stress of an English word the dictionary lacks: the first syllable, or the second after an unstressed prefix (beweep). */
function englishStress(w) {
  const n = englishSpans(w).spans.length;
  if (n === 1) return [1];
  const k = UNSTRESSED_PREFIX.test(w) ? 1 : 0;
  return Array.from({ length: n }, (_, i) => (i === k ? 1 : 0));
}

// Pseudo-phones from spelling, good enough to compare two unknown words.
function spellPhones(w, raw = w) {
  if (!readsAsSanskrit(raw)) {
    const { s, spans } = englishSpans(w);
    const stress = englishStress(w);
    const out = [];
    let at = 0;
    spans.forEach(([a, b], k) => {
      for (const c of s.slice(at, a)) out.push({ p: c.toUpperCase(), v: false });
      out.push({ p: s.slice(a, b).toUpperCase(), v: true, s: stress[k] });
      at = b;
    });
    for (const c of s.slice(at)) if (!'aeiou'.includes(c)) out.push({ p: c.toUpperCase(), v: false });
    return out;
  }
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

// Verse spellings that drop a syllable on the page (heav'n, o'er).
const CONTRACTED = {
  "heav'n": 'HH EH1 V N', "heav'ns": 'HH EH1 V N Z', "e'en": 'IY1 N', "e'er": 'EH1 R', "o'er": 'OW1 R', "ne'er": 'N EH1 R',
  "ev'ry": 'EH1 V R IY0', "pow'r": 'P AW1 R', "flow'r": 'F L AW1 R', "tow'r": 'T AW1 R', "whate'er": 'W AH0 T EH1 R', "where'er": 'W EH0 R EH1 R',
};

const PREFIXES = [['un', 'AH0 N'], ['re', 'R IY0'], ['in', 'IH0 N'], ['be', 'B IH0'], ['dis', 'D IH0 S'], ['mis', 'M IH0 S'], ['a', 'AH0']];
const SUFFIXES = [["'st", 'S T'], ["'d", 'D'], ['less', 'L AH0 S'], ['ness', 'N AH0 S'], ['ment', 'M AH0 N T'], ['ful', 'F AH0 L'],
  ['ing', 'IH0 NG'], ['est', 'AH0 S T'], ['eth', 'AH0 TH'], ['ed', 'D'], ['es', 'Z'], ['s', 'Z'], ['ly', 'L IY0'], ['er', 'ER0']];
const lastPhone = e => e.split(' ').at(-1).replace(/\d/, '');

// A word the dictionary lacks may be a known word with a prefix or an ending
// (unmaking, oars', beweep, bootless, featur'd).
function derive(w, depth = 0) {
  const d = x => DICT && DICT[x];
  if (CONTRACTED[w]) return P(CONTRACTED[w]);
  if (w.endsWith("'s") && d(w.slice(0, -2))) {
    const base = d(w.slice(0, -2)), end = lastPhone(base);
    return [...P(base), ...P(/^(S|Z|SH|ZH|CH|JH)$/.test(end) ? 'IH0 Z' : /^(P|T|K|F|TH)$/.test(end) ? 'S' : 'Z')];
  }
  if (w.endsWith("s'") && d(w.slice(0, -1))) return P(d(w.slice(0, -1)));
  for (const [pre, ph] of PREFIXES) {
    if (w.startsWith(pre) && w.length > pre.length + 2) {
      const rest = d(w.slice(pre.length)) || (w.length > pre.length + 3 && depth < 2 && derive(w.slice(pre.length), depth + 1));
      if (rest) return [...P(ph), ...(typeof rest === 'string' ? P(rest) : rest)];
    }
  }
  for (const [suf, ph] of SUFFIXES) {
    if (!w.endsWith(suf) || w.length < suf.length + 3) continue;
    const stem = w.slice(0, -suf.length);
    const base = d(stem) || d(stem + 'e') || (/i$/.test(stem) && d(stem.slice(0, -1) + 'y'))
      || (stem.length > 3 && stem.at(-1) === stem.at(-2) && d(stem.slice(0, -1)))
      || (depth < 2 && stem.length > 3 && derive(stem, depth + 1));
    if (!base) continue;
    const b = typeof base === 'string' ? base : base.map(x => x.p + (x.s === null ? '' : x.s)).join(' ');
    let tail = ph;
    const end = lastPhone(b), voiceless = /^(P|T|K|F|TH|S|SH|CH)$/.test(end);
    if (suf === 'ed') tail = /^[TD]$/.test(end) ? 'IH0 D' : voiceless ? 'T' : 'D';
    if (suf === 'es' || suf === 's') tail = /^(S|Z|SH|ZH|CH|JH)$/.test(end) ? 'IH0 Z' : voiceless ? 'S' : 'Z';
    return [...P(b), ...P(tail)];
  }
  return null;
}

/** Phones of one word: [{p, v (vowel), s (stress 0|1|2)}], and whether they came from the dictionary. */
export function phones(word) {
  const w = plainWord(word);
  if (!w) return { phones: [], known: false };
  const hit = DICT && DICT[w];
  if (hit) return { phones: P(hit), known: true };
  const derived = CONTRACTED[w] ? P(CONTRACTED[w]) : DICT && derive(w);
  if (derived) return { phones: derived, known: true };
  return { phones: spellPhones(w, word), known: false };
}

/**
 * Stress of a word in IAST (Ḍombī, samādhi, kāpālika), by the Sanskrit rule a
 * reader would use: the next-to-last syllable when it is heavy (a long vowel,
 * or closed by a consonant), else the one before it.
 */
function sanskritStress(raw) {
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

/** Stress of a word the dictionary lacks: the Sanskrit rule for a name or term, the English one for an English word. */
const guessStress = raw => (readsAsSanskrit(raw) ? sanskritStress(raw) : englishStress(plainWord(raw)));

/**
 * Stress per syllable of one word: 1 strong, 0 weak. A light monosyllable is
 * weak; any other monosyllable is strong; a longer word keeps its primary
 * stress (and a secondary stress two syllables away from it).
 */
export function wordStress(word) {
  const w = plainWord(word);
  if (!w) return [];
  if (Object.hasOwn(LIGHT_POLY, w)) return [...LIGHT_POLY[w]];
  if (LIGHT.has(w)) return [0];
  const { phones: ph, known } = phones(word);
  if (!known) return guessStress(word);
  const vs = ph.filter(x => x.v);
  if (vs.length <= 1) return [1];
  const s = vs.map(x => (x.s === 1 ? 1 : 0));
  vs.forEach((x, i) => { if (x.s === 2 && !s[i - 1] && !s[i + 1]) s[i] = 1; });
  if (!s.includes(1)) s[0] = 1;
  return s;
}

export function syllableCount(line) {
  return wordsOf(line).reduce((n, { w }) => n + wordStress(w).length, 0);
}

// Verse elision: the syllable a line may lose when the metre asks for it.
// heaven -> heav'n, even -> e'en, over -> o'er, every -> ev'ry, flower -> flow'r;
// desiring and wandering lose the r-syllable. spirit -> sprite is not allowed.
const ELIDE = {
  heaven: "heav'n", heavens: "heav'ns", "heaven's": "heav'n's", even: "e'en", ever: "e'er", never: "ne'er", over: "o'er",
  every: "ev'ry", flower: "flow'r", flowers: "flow'rs", power: "pow'r", powers: "pow'rs", tower: "tow'r", towers: "tow'rs",
  hour: 'hour (one syllable)', hours: 'hours (one syllable)', fire: 'fire (one syllable)', fires: 'fires (one syllable)',
};

/** The shortened stress of an elidable word, and how it is said; null if the word does not elide. */
export function elision(word) {
  const w = plainWord(word);
  const full = wordStress(w);
  if (Object.hasOwn(ELIDE, w) && full.length > 1) {
    // Drop the weak syllable after the stress (heav-en, ev-er-y -> ev-ry).
    const k = full.indexOf(1);
    const out = full.filter((_, i) => i !== k + 1);
    return { stress: out.length ? out : [1], as: ELIDE[w] };
  }
  // -ering, -iring: the r-syllable before -ing goes (de-sir-ing, wan-dring).
  const ph = phones(w).phones;
  const vs = ph.filter(x => x.v);
  if (/(er|ir|ur)ing$/.test(w) && vs.length >= 3 && vs.at(-2).p === 'ER' && vs.at(-2).s === 0 && full.length === vs.length) {
    return { stress: full.filter((_, i) => i !== full.length - 2), as: `${w} (${full.length - 1} syllables)` };
  }
  return null;
}

// A light word that ends a line carries the voice ("what do they DO", "clings to YOU").
const PROMOTE = new Set('do does did is are was were be been have has had will would can could may might must shall should you me him her them us it this that these those there here then so too up out off in on through'.split(' '));
// After these, "then" opens a clause and takes the stress ("and THEN my state").
const CLAUSE_LEAD = new Set(['and', 'but', 'or', 'nor', 'that', 'so', 'yet']);
const STOP_AFTER = /[,;:.!?—–(]$/;
const NEAR = new Set(['this', 'these']), FAR = new Set(['that', 'those']);

/**
 * The line scanned: words with their stress marks, the beat count, and the
 * pattern as x and /. Options: { elide: true } says every elidable word the
 * short way (heav'n, o'er); a number elides only that many, from the left.
 * The default is unelided.
 */
export function scan(line, { elide = false } = {}) {
  let budget = elide === true ? Infinity : Math.max(0, Number(elide) || 0);
  const elided = [];
  const words = wordsOf(line).map(({ raw, w }) => {
    let stress = wordStress(raw);
    if (budget > 0) {
      const e = elision(w);
      if (e) { stress = e.stress; budget--; elided.push({ word: w, as: e.as }); }
    }
    return { raw, w, stress };
  });
  // Antithesis: "this man's art and that man's scope" leans on both pointers.
  const pointer = (k, set) => set.has(words[k].w) && words[k + 1] && !STOP_AFTER.test(words[k].raw) && !isLight(words[k + 1].w);
  const thisAt = words.findIndex((_, k) => pointer(k, NEAR));
  const thatAt = words.findIndex((_, k) => pointer(k, FAR));
  if (thisAt >= 0 && thatAt >= 0) { words[thisAt].stress = [1]; words[thatAt].stress = [1]; }
  // "then" that opens a clause is the turn in time: stressed.
  words.forEach((x, k) => {
    if (x.w !== 'then') return;
    const prev = words[k - 1];
    if (!prev || STOP_AFTER.test(prev.raw) || CLAUSE_LEAD.has(prev.w)) x.stress = [1];
  });
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
  return { words, beats: flat.filter(Boolean).length, syllables: flat.length, pattern: flat.map(s => (s ? '/' : 'x')).join(''), elided };
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

// The dictionary hears "fire" as two syllables and "expire" as one: for rhyme,
// a diphthong before an unstressed ER is one syllable closed by R.
const R_DIPHTHONG = new Set(['AY', 'AW', 'OY', 'EY']);
function rhymePhones(ph) {
  const out = [];
  for (const x of ph) {
    const prev = out[out.length - 1];
    if (x.v && x.p === 'ER' && x.s === 0 && prev && prev.v && R_DIPHTHONG.has(prev.p)) out.push({ p: 'R', v: false, s: null });
    else out.push(x);
  }
  return out;
}

/**
 * How two words sound together: a planet name from PLANETS, and whether the
 * rhyme is feminine (both words run on past the stress, as shaken / taken).
 */
export function rhymeWords(a, b) {
  const wa = plainWord(a), wb = plainWord(b);
  if (!wa || !wb) return { kind: 'none', feminine: false };
  if (wa === wb) return { kind: 'absolute', feminine: false };
  const pa = rhymePhones(phones(wa).phones), pb = rhymePhones(phones(wb).phones);
  const ta = tailOf(pa), tb = tailOf(pb);
  const feminine = !!(ta.afterVowels && tb.afterVowels);
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

const COORD = new Set(['and', 'but', 'or', 'nor']);
// These join side by side only where they open a clause ("Yet in these thoughts"; not "so long").
const COORD_AT_CLAUSE = new Set(['so', 'yet', 'then']);
const SUBORD = new Set(['when', 'while', 'because', 'though', 'although', 'if', 'unless', 'until', 'since', 'whose', 'which', 'who', 'whom', 'where', 'whether', 'till', 'lest', 'whoever', 'wherever', 'whenever']);
// A sentence that opens on one of these hangs its first clause under a main clause still to come.
const OPENERS = new Set([...SUBORD, 'as', 'whereas', 'before', 'after', 'once', 'whilst']);
const SUBJECTS = new Set(['i', 'we', 'you', 'thou', 'ye', 'he', 'she', 'they', 'it']);
// Where the held main clause arrives: a line opening on one of these (Sonnet 29's "Yet", "Haply").
const MAIN_TURN = new Set(['yet', 'then', 'so', 'haply', 'thus', 'still']);
const NOT_PARTICIPLES = new Set(`morning evening nothing something anything everything during darling wedding ceiling pudding
farthing shilling sterling lightning king thing ring sing spring string wing bring sting swing cling fling hundred kindred naked
sacred wicked wretched rugged ragged crooked beloved red bed shed need feed seed deed breed speed bleed indeed`.split(/\s+/));
const IRREGULAR_PARTICIPLES = new Set('broken fallen forgotten forsaken given driven hidden shaken taken stricken sunk lost gone born borne torn worn sworn spent bent rent bound slain sprung'.split(' '));

/** A present or past participle, as a line may open on one ("Wishing", "Featured", "Desiring"). */
export function isParticiple(word) {
  const w = plainWord(word);
  if (!w || NOT_PARTICIPLES.has(w)) return false;
  if (IRREGULAR_PARTICIPLES.has(w)) return true;
  const known = x => (DICT ? !!DICT[x] : x.length >= 3);
  const m = /^(.{3,}?)(ing|ed|'d)$/.exec(w);
  if (!m) return false;
  const stem = m[1];
  return known(stem) || known(stem + 'e') || (stem.at(-1) === stem.at(-2) && known(stem.slice(0, -1))) || (/i$/.test(stem) && known(stem.slice(0, -1) + 'y'));
}

const bare = line => String(line).replace(/\[([^\]]*)\]\{[^}]*\}/g, '$1');
const endsSentence = line => /[.!?][)"”’'\]]*\s*$/.test(bare(line).trim());
// The first words of a line, lowercased, past any opening bracket or quote.
const openingWords = line => wordsOf(line).map(x => x.w);
const AUX = new Set('do does did dost doth shall should will would can could may might must is are was were have has had hath'.split(' '));
// A clause with its own subject: "I think", "Haply I think", or a question's "Did he smile".
const opensOnSubject = ws => SUBJECTS.has(ws[0]) || ((/ly$/.test(ws[0] || '') || AUX.has(ws[0])) && SUBJECTS.has(ws[1]));
// A line said again (a refrain) adds repetition, not new syntax.
const lineKey = line => wordsOf(line).map(x => x.w).join(' ');

/**
 * Syntax, Morton's way: phrases laid side by side (parataxis: and, and, a
 * comma, a colon) run hot; phrases hung one under another (hypotaxis: when,
 * because, which) run cool. Counts over any number of lines:
 *   para: and / but / or / nor, and so / yet / then where they open a clause,
 *     each 1; a colon or dash 1; a comma or semicolon half (a comma right
 *     before a joining word is part of that join);
 *   hypo: each subordinating word, a line that opens on a participle
 *     ("Wishing", "Featured") or on "as" or a conjunction "that", an opening
 *     bracket (an aside), and one for every line a sentence holds its main
 *     clause back when a subordinate clause opens it and the main clause comes
 *     three or more lines later (Sonnet 29: "When" at line 1, "Yet" at line 9;
 *     the main clause is the first later line opening on Yet / Then / So /
 *     Haply, or on a subject and its verb, else the sentence's last line);
 *   a line said again word for word (a refrain) is counted once;
 *   suspended: how many lines were held that way (they are not side by side);
 *   held: [{ from, to }] the line spans (0-based, to = the main clause's line).
 */
export function syntaxOf(lines) {
  let para = 0, hypo = 0;
  const texts = lines.map(l => bare(l));
  const said = new Set();
  texts.forEach(line => {
    const key = lineKey(line);
    if (said.has(key)) return;
    said.add(key);
    const ws = wordsOf(line);
    ws.forEach((x, k) => {
      const prev = ws[k - 1];
      const atClause = !prev || STOP_AFTER.test(prev.raw);
      if (COORD.has(x.w)) para++;
      else if (COORD_AT_CLAUSE.has(x.w) && atClause && !(prev && COORD.has(prev.w))) para++;
      if (SUBORD.has(x.w)) hypo++;
    });
    const marks = line.replace(/,(?=\s*(?:(?:and|but|or|nor)\b|&))/gi, '');
    para += (marks.match(/[:—–]/g) || []).length + 0.5 * (marks.match(/[,;]/g) || []).length;
    const first = ws[0]?.w || '';
    if (isParticiple(first) || first === 'as' || (first === 'that' && ws[1] && isLight(ws[1].w))) hypo++;
    hypo += (line.match(/\(/g) || []).length;
  });
  // A sentence that opens hung under, its main clause held back.
  let suspended = 0;
  const held = [];
  for (let i = 0; i < texts.length; i++) {
    if (i > 0 && !endsSentence(texts[i - 1])) continue;
    const ws = openingWords(texts[i]);
    if (!ws.length || !(OPENERS.has(ws[0]) || isParticiple(ws[0]))) continue;
    // The subordinate clause's own subject may come in its first line or the next ("When … / I all alone beweep").
    let ownSubject = ws.slice(1).some(w => SUBJECTS.has(w));
    let main = texts.length - 1;
    for (let j = i + 1; j < texts.length; j++) {
      // The sentence ended without a main clause found before: its last line holds it.
      if (endsSentence(texts[j - 1])) { main = j - 1; break; }
      const next = openingWords(texts[j]);
      if (MAIN_TURN.has(next[0])) { main = j; break; }
      if (opensOnSubject(next)) {
        if (!ownSubject) { ownSubject = true; continue; }
        main = j; break;
      }
    }
    if (main - i >= 3) { suspended += main - i; hypo += main - i; held.push({ from: i, to: main }); }
  }
  return { para, hypo, suspended, held };
}

export const endStopped = line => /[.,;:!?—–)”’"']\s*$/.test(String(line).replace(/\[([^\]]*)\]\{[^}]*\}/g, '$1'));
