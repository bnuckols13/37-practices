# The Tibetan translation as a parallel witness (proposal)

> **Status:** proposed. Nothing here is built yet.

## Why

The Tibetan translation of Munidatta's commentary (Degé Tengyur, Toh 2293; translated by Kīrticandra and Yarlung Lotsāwa Drakpa Gyaltsen) quotes each song before commenting on it. That makes it two things:

1. **The only witness** for songs 24, 25 and 48 and the end of 23, which the Nepal manuscript lacks.
2. **An early reading of every line.** It shows, line by line, how translators in the 13th–14th century understood each word. This is the historical lexicon a translator wants beside the concordance.

## The one idea: attach the Tibetan to the ids we already have

Everything in the engine is keyed by stable ids: `cp.10.1a` is song 10, couplet 1, first half-line, and `cp.10.m3` is Munidatta's third segment on song 10. The Tibetan is marked with the same directives as the Bengali, so the segmenter assigns it the same ids. It then hangs off the existing units as a parallel, not as a second copy of the text.

```
texts/charyapada/source/toh2293.txt        raw e-text + directives (@parallel, @song 10, @verse, @comm 3 …)
        │ segment
        ▼
units/cp.10.json
  lines:      cp.10.1a  (Bengali, the reading text)
  parallels:
    toh2293:
      lines:      cp.10.1a → { src: <Tibetan>, translit: <Wylie> }
      commentary: cp.10.m3 → { src, translit }
```

- **`@parallel`** at the head of the Tibetan file tells the segmenter to attach lines to ids that already exist, not to create new ones. Songs 24, 25 and 48 have no Bengali, so for them the Tibetan becomes the reading text, as the engine already expects.
- **A separate `parallelSha`**, so importing or correcting the Tibetan never makes an approved song stale. Drafting packs do include it, so drafters see the Tibetan beside the Bengali.
- **Wylie** comes from a small Unicode-Tibetan to EWTS transliterator (`lib/translit/tibetan.mjs`), tested like the Bengali one.

## Where it shows, and how it stays quiet

- **Studio grid:** one toolbar toggle, "Show Tibetan", like "Show changes". When it's on, each couplet's reference column gains a Tibetan row (script, then Wylie) under the Bengali, IAST and gloss. When it's off, nothing changes.
- **Concordance:** a verse line that has a Tibetan parallel shows it under the English. The opened term card gains one line: "Tibetan: ljon shing, 3 of 3". That line records which Tibetan word the translators used for this term across the songs, which is exactly the "how is this word used" view.
- **Glossary:** once you confirm a Tibetan equivalent, it joins the entry as a form attested in another source (AO). The 84000 and BDRC look-ups then appear on it automatically.
- **Reading Room:** the Study view can show the Tibetan as a further row, and the glossary page lists the Tibetan form.

## Matching words, not just lines

Lines align by structure. Matching a term to the particular Tibetan word that renders it is a judgement call, so it goes through the same loop as everything else:
1. A drafting pass ("terms-bo") proposes, for each glossary term in an aligned line, the Tibetan word that renders it, citing the line.
2. You confirm or reject each proposal in the Studio, like any glossary decision.

## Steps

1. **Choose the e-text** (BDRC's e-texts or OpenPecha's Degé Tengyur), check its licence, and allow that one host in the network settings.
2. **Tibetan to Wylie** module, with tests.
3. **Import and mark** Toh 2293 for songs 1, 10 and 14, with `@parallel`.
4. **`parallels` in units:** packs, the Studio toggle, and the concordance row.
5. **The "terms-bo" pass** and Tibetan forms in the glossary.
6. **Songs 24, 25, 48 and the end of 23** from the Tibetan as the reading text.

## Decisions for Lena

- **Which e-text source to use** (licence and quality).
- **Script and Wylie:** Tibetan script above Wylie is proposed.
- **Pilot first?** Whether to try it on songs 1, 10 and 14 before going further.
