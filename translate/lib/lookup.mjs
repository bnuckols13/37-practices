/**
 * Reference look-ups for glossary forms: links out to the standard
 * dictionaries and corpora for each language, built from a form's
 * transliteration. Nothing is fetched or copied; the reviewer follows the link.
 * Pure (no Node imports): the Studio bundles this file.
 *
 * Every URL pattern here was checked against the live site:
 *   Cologne getword (MW, Edgerton BHS) takes a headword in SLP1.
 *   DSAL's Turner (CDIAL) search takes IAST and searches the whole dictionary,
 *   where Old Bengali (OB.) forms are cited.
 *   84000's glossary search redirects to scholar.84000.co.
 *   BDRC's library takes q/lg/t as its own search page does.
 */

const IAST_SLP1 = [
  ['kh', 'K'], ['gh', 'G'], ['ch', 'C'], ['jh', 'J'], ['ṭh', 'W'], ['ḍh', 'Q'], ['th', 'T'], ['dh', 'D'], ['ph', 'P'], ['bh', 'B'],
  ['ai', 'E'], ['au', 'O'], ['ā', 'A'], ['ī', 'I'], ['ū', 'U'], ['ṛ', 'f'], ['ṝ', 'F'], ['ḷ', 'x'], ['ḹ', 'X'],
  ['ṃ', 'M'], ['ṁ', 'M'], ['ḥ', 'H'], ['ṅ', 'N'], ['ñ', 'Y'], ['ṭ', 'w'], ['ḍ', 'q'], ['ṇ', 'R'], ['ś', 'S'], ['ṣ', 'z'],
];

/** IAST to SLP1, the key Cologne's dictionaries are indexed by. */
export function toSlp1(iast) {
  let s = String(iast || '').normalize('NFC').toLowerCase(), out = '';
  outer: while (s) {
    for (const [a, b] of IAST_SLP1) if (s.startsWith(a)) { out += b; s = s.slice(a.length); continue outer; }
    out += s[0]; s = s.slice(1);
  }
  return out;
}

/**
 * A dictionary headword for a transliterated form: an explicit lemma if the
 * glossary gives one, else the form with sentence punctuation, a final visarga
 * or anusvāra, and a final case ending m taken off. A heuristic: inflected
 * forms deeper than that need a lemma in the glossary.
 */
export function headword(form) {
  if (form.lemma) return form.lemma.normalize('NFC');
  const raw = String(form.translit || form.wylie || '').normalize('NFC').trim().toLowerCase();
  // Tibetan words are several syllables separated by spaces; keep them whole.
  if (form.lang === 'bod') return raw.replace(/[/|]+$/u, '').trim();
  let w = raw.split(/\s+/)[0] || '';
  w = w.replace(/[|।॥.,;:!?'"“”‘’()[\]]+/g, '');
  w = w.replace(/(?:ḥ|ṃ|ṁ|m̐|m)$/u, '');
  return w;
}

const q = encodeURIComponent;
export const SOURCES = [
  { id: 'mw', label: 'Monier-Williams', langs: ['san'], href: f => `https://www.sanskrit-lexicon.uni-koeln.de/scans/csl-apidev/getword.php?dict=mw&key=${q(toSlp1(headword(f)))}&input=slp1&output=iast` },
  { id: 'bhs', label: 'Edgerton (Buddhist Hybrid Sanskrit)', langs: ['san'], href: f => `https://www.sanskrit-lexicon.uni-koeln.de/scans/csl-apidev/getword.php?dict=bhs&key=${q(toSlp1(headword(f)))}&input=slp1&output=iast` },
  { id: 'cdial', label: 'Turner (Indo-Aryan)', langs: ['oben', 'pra'], href: f => `https://dsal.uchicago.edu/cgi-bin/app/soas_query.py?qs=${q(headword(f))}&matchtype=default` },
  { id: '84000', label: '84000 glossary', langs: ['bod', 'san'], href: f => `https://read.84000.co/glossary/search.html?search=${q(headword(f))}` },
  { id: 'bdrc', label: 'BDRC texts', langs: ['bod'], href: f => `https://library.bdrc.io/search?q=${q('"' + headword(f) + '"')}&lg=bo-x-ewts&t=Etext` },
];

/**
 * For one glossary entry: one row per language, looked up by the headword a form
 * gives as its lemma, else by the shortest (least inflected) form.
 */
export function lookups(entry) {
  const byLang = new Map();
  for (const f of entry.forms || []) {
    const key = headword(f);
    if (!key) continue;
    const cur = byLang.get(f.lang);
    const rank = x => [x.lemma ? 0 : 1, headword(x).length];
    if (!cur || rank(f)[0] < rank(cur)[0] || (rank(f)[0] === rank(cur)[0] && rank(f)[1] < rank(cur)[1])) byLang.set(f.lang, f);
  }
  const out = [];
  for (const [lang, f] of byLang) {
    const links = SOURCES.filter(s => s.langs.includes(lang)).map(s => ({ id: s.id, label: s.label, href: s.href(f) }));
    if (links.length) out.push({ lang, form: headword(f), links });
  }
  return out;
}
