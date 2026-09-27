# Hearing the Verses — working files

The poetic layer of the site: carrying the sound, images and feeling of the verses into
English, alongside the scholarly layer (translations and commentaries).

- `../hearing-the-verses.html` is the **draft page**. It is hand-made, not generated, and marked
  `noindex` (so it stays out of `sitemap.xml`) and linked from nowhere yet. It holds the approach,
  the precedents it rests on, nine sample verses in five layers, and a chant sheet for groups.
- `tibetan-root-text.json` is the **Tibetan root text**: all 44 sections (homage, statement of purpose,
  37 verses, closing verses), each with Tibetan, Wylie, phonetics, syllable counts, variant readings,
  key images and sound notes. The base text is Lotsawa House, compared line by line with the
  StudyBuddhism, Esukhia and 2013 Bhutanese editions; where Lotsawa House stood alone against all
  three, the others are followed, and every such change is listed under `variants`. The Tibetan is
  public domain; the phonetics and notes are our own.
- `research-precedents.md` is the **research brief** behind the page: how translators of the Psalms,
  Chinese and Navajo poetry, and Tibetan liturgy have carried sound across. Quotes are marked ✔ (read
  at source), ◐ (seen only in a search snippet) or UNVERIFIED.

## Before anything here goes public

1. A reader of Tibetan checks the word-by-word glosses and the sounded versions.
2. A study group chants the nine sample verses for a few weeks; lines that don't work get rewritten.
3. Then extend to every verse, and move the verse data into `build/` so each verse page gets a
   "Hear it" layer the same way it gets its translations.
