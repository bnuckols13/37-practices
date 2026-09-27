/**
 * Editorial words that appear in drafts, notes and questions, each with a plain
 * explanation, so the Studio can explain them where they stand ("Toh 2293",
 * "Wylie", "bhaṇitā"). Glossary terms of the text itself are not here: they
 * have entries of their own. Pure (no Node imports): the Studio bundles this file.
 */

// A whole word, by Unicode letters: \b does not see ā or Bengali script as word characters.
const word = src => new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${src})(?![\\p{L}\\p{M}\\p{N}])`, 'u');

export const JARGON = [
  { key: 'toh', term: 'Toh 2293', match: word(String.raw`Toh(?:oku|\.)?\s*2293|T[oō]hoku|Toh`),
    explain: 'The Tibetan translation of Munidatta’s commentary, numbered 2293 in the standard catalogue of the Degé Tengyur (the Tōhoku catalogue, 1934). It was made in Kathmandu by the Indian scholar Kīrticandra and the Tibetan translator Drakpa Gyaltsen, probably in the 13th or 14th century. It quotes each song line by line before explaining it, so it shows how the lines were read then, and it keeps songs 24, 25 and 48, which the Nepal manuscript has lost.' },
  { key: 'tengyur', term: 'Tengyur', match: word(String.raw`(?:Deg[ée]|Derge)\s+Tengyur|Tengyur`),
    explain: 'The Tibetan collection of translated Indian treatises and commentaries (the companion to the Kangyur, the Buddha’s words). The Degé edition was carved on woodblocks in eastern Tibet in the 1730s and 1740s. Our Tibetan text comes from its digital edition by Esukhia.' },
  { key: 'wylie', term: 'Wylie', match: word(String.raw`Wylie|EWTS`),
    explain: 'The usual way of writing Tibetan in Latin letters: it spells out the Tibetan letters, silent ones included, rather than the pronunciation. བླ་མ is bla ma; སྒྲ་གཅན is sgra gcan.' },
  { key: 'iast', term: 'IAST', match: word(String.raw`IAST`),
    explain: 'The standard way of writing Sanskrit and related languages in Latin letters, with marks for long vowels and for sounds English lacks: ā, ṭ, ṇ, ś, ṣ, ṛ, ṃ.' },
  { key: 'shastri', term: 'Shastri', match: word(String.raw`Shastri(?:'s|’s)?`),
    explain: 'Haraprasad Shastri, who found the palm-leaf manuscript of the songs with Munidatta’s commentary in the royal library of Nepal in 1907 and published it in 1916. Our Bengali and Sanskrit text is his edition; his bracketed letters are his restorations of damaged text.' },
  { key: 'nepal', term: 'Nepal manuscript', match: word(String.raw`Nepal(?:ese)? manuscript`),
    explain: 'The one surviving manuscript of the songs with Munidatta’s commentary, a palm-leaf book in the royal library in Kathmandu, which Shastri published in 1916. Some leaves are lost: songs 24, 25 and 48 and the end of 23 survive only in the Tibetan.' },
  { key: 'bhanita', term: 'bhaṇitā', match: word(String.raw`bha[ṇn]it[āa]`),
    explain: 'The couplet in which the poet names himself (“Lūyī says…”), usually the last of the song.' },
  { key: 'dhruva', term: 'dhruvapada', match: word(String.raw`dhruva(?:pada|padena)?|ধ্রু`),
    explain: 'The refrain, sung again after each couplet. In these songs it is usually the second couplet, and Munidatta leaves it out when he counts his “padas”. Shastri prints ধ্রু (dhru) as a cue to sing it again.' },
  { key: 'pada', term: 'pada', match: word(String.raw`padas?`),
    explain: 'Munidatta’s word for a couplet of the song. He counts them leaving out the refrain, so in most songs his “second pada” is couplet 3.' },
  { key: 'raga', term: 'rāga', match: word(String.raw`r[āa]gas?`),
    explain: 'The melody a song is sung to, named in its heading (Paṭamañjarī, Deśākha…).' },
  { key: 'folio', term: 'folio', match: word(String.raw`folios?`),
    explain: 'A leaf of the manuscript. Numbers in brackets in the Sanskrit, such as [16ka], mark where a new leaf begins; they are not part of the text.' },
  { key: 'emend', term: 'emendation', match: word(String.raw`emend(?:ation|ations|ed|s)?`),
    explain: 'A correction of the printed text where it is judged to be wrong, recorded with its reason; the printed reading is always kept alongside.' },
  { key: 'lemma', term: 'lemma', match: word(String.raw`lemmas?`),
    explain: 'The words of the song that a commentary quotes before explaining them (in the Tibetan, “… zhes bya ba la sogs pa ni”, “… and so on”). For a glossary form, the dictionary headword.' },
  { key: 'apabhramsa', term: 'Apabhraṃśa', match: word(String.raw`Apabhra[ṃm][śs]a`),
    explain: 'The late literary form of the Middle Indo-Aryan languages, from which Bengali, Hindi and their neighbours grew. The songs’ language stands between it and Old Bengali.' },
  { key: 'esukhia', term: 'Esukhia', match: word(String.raw`Esukhia`),
    explain: 'A Tibetan-text group based in Dharamsala whose digital edition of the Degé Tengyur (public domain) is our source for the Tibetan.' },
  { key: 'bdrc', term: 'BDRC', match: word(String.raw`BDRC`),
    explain: 'The Buddhist Digital Resource Center, the main library of digitised Tibetan texts; its search finds a Tibetan word across the literature.' },
];

/** The first place each editorial word stands in a text: [{ index, length, key, term, explain }], in order. */
export function findJargon(text) {
  const s = String(text || '');
  const out = [];
  for (const j of JARGON) {
    const m = j.match.exec(s);
    if (m && !out.some(o => m.index < o.index + o.length && o.index < m.index + m[0].length)) out.push({ index: m.index, length: m[0].length, ...j });
  }
  return out.sort((a, b) => a.index - b.index);
}

/** Explanations of the kinds of flag and note a drafter leaves. */
export const KINDS = {
  reading: 'The source text itself may be wrong or damaged here: a doubtful letter, word or line.',
  meaning: 'The words are clear but their sense is uncertain.',
  grammar: 'How the words fit together is uncertain.',
  term: 'How a glossary term is rendered here is in question.',
  witness: 'The witnesses differ here: the Nepal manuscript as Shastri prints it, and the Tibetan translation.',
  imagery: 'What the image is, literally.',
  philology: 'A hard word, a reading or an emendation.',
  doctrine: 'How the tradition reads the passage, attributed to whoever reads it so.',
  low: 'Worth knowing; no change is proposed.',
  medium: 'Worth a look before approving.',
  high: 'Check this before approving: the line may need to change.',
};
