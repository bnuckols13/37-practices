# Opportunity scout

84000 has published 612 translations. Its catalogue holds 3,926 more Kangyur and Tengyur texts as placeholders, most of them with nobody assigned. The scout reads that catalogue, drops what 84000 has published or taken on, checks what is already in English somewhere else, and ranks what is left by three questions: would people read it, did the tradition lean on it, and does it suit an illuminated translation with woven commentary?

```sh
node translate/scout/scout.mjs run               # refresh sources (cached a week), rank, write the report
node translate/scout/scout.mjs run --reddit      # also count Reddit mentions for the top 40 (slow: 5 to 10 minutes)
node translate/scout/scout.mjs run --offline     # rerank from the cache only
node translate/scout/scout.mjs watch             # what 84000 published this week, and whether it was on our list
node translate/scout/scout.mjs watch --since 2026-09-01
```

Outputs go to `translate/.cache/scout/out/` (gitignored): `opportunities.html` to read, `opportunities.csv` to sort, `opportunities.json` for `watch`. `--out DIR` copies them somewhere else. No dependencies; Node 22 and `git` on the path.

## Sources

| Source | What the scout takes | Access | Terms |
|---|---|---|---|
| `github.com/84000/data-tei` placeholders and sections | Titles (Tibetan, Wylie, Sanskrit, English), attributed author, Tibetan translators, English translator if assigned, Degé volume and folios, page count, section, `isCommentaryOf` links, 84000 status code | Sparse, blob-filtered git clone of about 20 MB into `.cache/scout/data-tei` | Catalogue metadata; 84000's Terms of Use license metadata CC BY, and the RDF export calls it CC0. Cite 84000. |
| `scholar.84000.co/api/publications` (Partner Pull API) | What is published now, with dates | Public, no key | Attribution |
| English Wikipedia API and Wikimedia pageviews | Whether an article exists for the author or the text, its short description and lead, and twelve months of views | Public, no key | CC BY-SA content; the scout stores counts only |
| Lotsawa House index pages | Toh numbers cited in the listings of free translations | Public HTML, 0.7 s between requests | Read only; links back |
| Open Library search | English editions under a text's core Sanskrit title (shortlist only) | Public, 1 s between requests | Read only |
| Arctic Shift (Reddit archive) | Comment counts since 2021 in r/TibetanBuddhism and r/vajrayana (with `--reddit`); r/Buddhism is too large for the archive's full-text search, which times out on it | Public, 2.5 s between requests | Counts only |

The placeholder snapshot is from February 2025. Anything 84000 has published since is corrected from the Pull API; anything it has *started* since is invisible, because no public endpoint reports status short of publication. Before committing to a long text, ask 84000 (tech@84000.co).

## How the score works

`score = 100 × gap × effort × demand`, with every input written into the row's "why" list in the report.

- **demand** is the weighted mean of signals scaled 0 to 1 on a log scale against the 95th percentile of open texts. Weights are in `config.json`.
  - *author*: the author's Wikipedia readership divided by the square root of the number of texts attributed to them, halved for a later namesake marked "(II)". Nāgārjuna has 155,000 views a year and 121 attributed Tengyur texts; the division stops his name from lifting a one-page ritual to the top.
  - *title*: readership of an article about the text itself, counted only when the article's lead names the attributed author (two different works share the title *Tattvasiddhi*).
  - *commentaries*: how many Indian commentaries on the text the Tengyur holds, from 84000's own links. A commentary on a text 84000 has published scores at least `companionBoost`, since that root's readers are its audience.
  - *fit*: genres this project does well, from regexes over the section path and titles (`config.json` → `fit`).
  - *reddit*: when fetched. An unmeasured signal leaves the mean rather than counting as zero.
- **gap** is 1 for an open text, cut when an English translation exists: checked by hand in `overrides.json` (0.25, or 0.6 for a citation marked `Partial:`), on Lotsawa House (0.3), a likely Open Library book (0.6). Open Kangyur texts get 0.75, since 84000 means to finish the Kangyur.
- **effort** discounts length, from 1.0 at six pages or fewer to 0.4 above 400.

## Correcting it

`overrides.json` is where a person fixes what the matching gets wrong:

- `authorWikipedia`: catalogue name → Wikipedia title, or `null` to withhold the signal. Deities and generic names are withheld; so are names whose article is about someone else (Jayasena matches a king of Ayodhya).
- `titleWikipedia`: Toh key → title or `null`.
- `translatedElsewhere`: Toh key → citation of an English translation. Every famous Indian treatise is "not started" at 84000, and most have been in English for decades; the entries there now cover the ones that reached the top of the first runs. Start a citation with `Partial:` when only part of the text is in English. Add to it whenever the report ranks a text you know is translated, and check collections the automatic checks miss: Sherburne's *Complete Works of Atīśa* (2000), Lindtner's *Nagarjuniana* (1982), Tola and Dragonetti.

## Tests

`translate/test/scout.test.mjs` runs with the engine's tests (`cd translate && npm test`): placeholder and section parsing on an invented fixture, Toh identifiers, spelling and core-title generation, the description and lead checks, availability, the commentary graph, effort bands, and the direction each input moves a score.
