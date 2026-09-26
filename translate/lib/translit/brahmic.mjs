/**
 * Table-driven Brahmic -> IAST. Consonants carry an inherent "a" unless a
 * virama or vowel sign follows. The output is the *machine* transliteration:
 * Bengali script does not distinguish b/v, so Sanskrit words need the
 * b-list below and per-word overrides; the drafter and reviewer correct the rest.
 */

// Bengali ------------------------------------------------------------------
const BENG = {
  vowels: {
    'অ': 'a', 'আ': 'ā', 'ই': 'i', 'ঈ': 'ī', 'উ': 'u', 'ঊ': 'ū', 'ঋ': 'ṛ', 'ৠ': 'ṝ',
    'ঌ': 'ḷ', 'ৡ': 'ḹ', 'এ': 'e', 'ঐ': 'ai', 'ও': 'o', 'ঔ': 'au',
  },
  signs: {
    'া': 'ā', 'ি': 'i', 'ী': 'ī', 'ু': 'u', 'ূ': 'ū', 'ৃ': 'ṛ', 'ৄ': 'ṝ', 'ৢ': 'ḷ', 'ৣ': 'ḹ',
    'ে': 'e', 'ৈ': 'ai', 'ো': 'o', 'ৌ': 'au',
  },
  consonants: {
    'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ṅ',
    'চ': 'c', 'ছ': 'ch', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'ñ',
    'ট': 'ṭ', 'ঠ': 'ṭh', 'ড': 'ḍ', 'ঢ': 'ḍh', 'ণ': 'ṇ',
    'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'প': 'p', 'ফ': 'ph', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
    'য': 'y', 'র': 'r', 'ল': 'l', 'শ': 'ś', 'ষ': 'ṣ', 'স': 's', 'হ': 'h',
    'ৰ': 'r', 'ৱ': 'w',
  },
  // consonant + nukta (NFC decomposes the precomposed ড় ঢ় য়)
  nukta: { 'ড': 'ṛ', 'ঢ': 'ṛh', 'য': 'y' },
  precomposed: { 'ড়': 'ṛ', 'ঢ়': 'ṛh', 'য়': 'y' },
  other: {
    'ং': 'ṃ', 'ঃ': 'ḥ', 'ঁ': 'm̐', 'ৎ': 't', 'ঽ': "'", '।': '|', '॥': '||',
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  },
  virama: '্', nuktaMark: '়', lengthMark: 'ৗ',
};

// Devanagari (for Sanskrit and other texts given in nāgarī) ------------------
const DEVA = {
  vowels: {
    'अ': 'a', 'आ': 'ā', 'इ': 'i', 'ई': 'ī', 'उ': 'u', 'ऊ': 'ū', 'ऋ': 'ṛ', 'ॠ': 'ṝ',
    'ऌ': 'ḷ', 'ॡ': 'ḹ', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
  },
  signs: {
    'ा': 'ā', 'ि': 'i', 'ी': 'ī', 'ु': 'u', 'ू': 'ū', 'ृ': 'ṛ', 'ॄ': 'ṝ', 'ॢ': 'ḷ', 'ॣ': 'ḹ',
    'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  },
  consonants: {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ṅ',
    'च': 'c', 'छ': 'ch', 'ज': 'j', 'झ': 'jh', 'ञ': 'ñ',
    'ट': 'ṭ', 'ठ': 'ṭh', 'ड': 'ḍ', 'ढ': 'ḍh', 'ण': 'ṇ',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'ś', 'ष': 'ṣ', 'स': 's', 'ह': 'h', 'ळ': 'ḷ',
  },
  nukta: { 'ड': 'ṛ', 'ढ': 'ṛh' },
  precomposed: { 'ड़': 'ṛ', 'ढ़': 'ṛh' },
  other: {
    'ं': 'ṃ', 'ः': 'ḥ', 'ँ': 'm̐', 'ऽ': "'", '।': '|', '॥': '||', 'ॐ': 'oṃ',
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  },
  virama: '्', nuktaMark: '़', lengthMark: '',
};

export const TABLES = { Beng: BENG, Deva: DEVA };

// Sanskrit written in Bengali script: ব is v unless the word is a known b-word.
const SAN_B_PREFIXES = ['buddh', 'bodh', 'brahm', 'bāhy', 'bīj', 'bindu', 'bandh', 'bahu', 'bāl',
  'bāhu', 'bimb', 'bāṇ', 'bādh', 'bṛh', 'budh', 'bubhukṣ', 'bhik'];

function core(src, T) {
  const s = src.normalize('NFC').replace(/[‌‍]/g, '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (T.precomposed[ch] || T.consonants[ch]) {
      let c = T.precomposed[ch] || T.consonants[ch];
      if (s[i + 1] === T.nuktaMark && T.nukta[ch]) { c = T.nukta[ch]; i++; }
      out += c;
      const nx = s[i + 1];
      if (nx === T.virama) { i++; continue; }
      if (T.signs[nx]) {
        out += T.signs[nx]; i++;
        if (T.lengthMark && s[i + 1] === T.lengthMark) i++;
        continue;
      }
      out += 'a';
    } else if (T.vowels[ch]) out += T.vowels[ch];
    else if (T.other[ch] !== undefined) out += T.other[ch];
    else if (ch === T.nuktaMark || ch === T.virama || ch === T.lengthMark) { /* stray mark */ }
    else out += ch;
  }
  return out;
}

function sanskritB2V(word) {
  const lower = word.toLowerCase();
  if (SAN_B_PREFIXES.some(p => lower.startsWith(p))) return word;
  return word.replace(/b(?!h)/g, 'v');
}

/**
 * @param {string} src     text in Bengali or Devanagari script
 * @param {object} o       { script: 'Beng'|'Deva', lang, overrides: { word: iast } }
 */
export function brahmicToIAST(src, { script = 'Beng', lang = '', overrides = {} } = {}) {
  const T = TABLES[script];
  if (!T) return '';
  return src.normalize('NFC').split(/(\s+)/).map(tok => {
    if (/^\s+$/.test(tok) || !tok) return tok;
    const bare = tok.replace(/[।॥,;:.!?()'"“”‘’]+$/u, '');
    const tail = tok.slice(bare.length);
    if (overrides[bare]) return overrides[bare] + core(tail, T);
    let t = core(bare, T);
    if (script === 'Beng' && lang === 'san') t = sanskritB2V(t);
    return t + core(tail, T);
  }).join('');
}
