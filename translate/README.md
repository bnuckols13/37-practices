# Illuminated translation engine

Claude drafts, a human reviews. The output is an illuminated translation:
- key terms in the English link to a glossary (source form, attestation, definition, how the tradition reads the image);
- the traditional commentary sits beside each passage it explains;
- every published page says who reviewed it and when.

The first text is the **Charyapada** (Old Bengali siddha songs, with Munidatta's Sanskrit commentary). The same loop handles any text you give it.

The design and its reasons are in [`PLAN.md`](PLAN.md). This file covers how to run it.

- **Run it:** from the repo root, `node translate/cli.mjs <command> <text> [units]`, where units is `all`, `cp.01..cp.03`, `cp.01,cp.10` or `1,10,14`.
- **Setup:** once, `cd translate && npm ci`. The only dependency is `zod`, and the root site stays dependency-free.
- **Tests:** `cd translate && npm test`.

## Where things live

```
translate/
  PLAN.md  README.md  cli.mjs  config.json      config: reviewer name, session model label
  lib/  schemas/                                engine code; zod schemas are the single source of truth
  prompts/system.md  prompts/texts/<text>.md  prompts/tasks/*.md
  glossary/glossary.json                        the cumulative glossary (our own prose), shared across texts
  glossary/review/<text>.md                     glossary review sheets
  texts/<text>/text.json                        witnesses (with licence + usage), languages, commentary, catalogue
  texts/<text>/style.md                         your standing preferences; they ride in every pack
  texts/<text>/source/raw/                      imports kept byte-for-byte (sha256 in manifest.json)
  texts/<text>/source/<witness>.txt             working copy = raw text + @directive lines
  texts/<text>/units/                           segmented units with stable ids (generated, committed)
  texts/<text>/drafts/ commentary/              ingested drafts (with provenance)
  texts/<text>/review/                          review sheets you edit
  texts/<text>/approved/                        what you approved; the only thing render publishes
  texts/<text>/packs/ inbox/                    drafting packs and answers (gitignored)
  .private/  .cache/                            copyrighted references, 84000 data (gitignored, never in prompts)
../translations/                                generated pages (deployed); ../sitemap-translations.xml
```

`translate/` is excluded from deployment by `/.vercelignore`. Only `translations/` is public.

## The loop

Using Charyapada songs 1, 10 and 14 as the example:

```sh
# 1. Bring in the source: paste (stdin), a file, or fetch from Wikisource once the host is allowed
node translate/cli.mjs import charyapada --witness shastri1916 - < song10.txt
node translate/cli.mjs import charyapada --witness shastri1916 --fetch 10

# 2. Mark up the working copy: texts/charyapada/source/shastri1916.txt (directives below), then
node translate/cli.mjs segment charyapada
node translate/cli.mjs status charyapada

# 3. Seed the glossary, then review the proposals
node translate/cli.mjs terms charyapada 1,10,14         # writes packs; a subagent answers each
node translate/cli.mjs ingest charyapada 1,10,14 --task terms
node translate/cli.mjs review charyapada --glossary     # edit glossary/review/charyapada.md
node translate/cli.mjs accept charyapada --glossary

# 4. Draft, then weave the commentary (one song at a time, so each approval reaches the next pack)
node translate/cli.mjs draft charyapada 1
node translate/cli.mjs ingest charyapada 1
node translate/cli.mjs weave charyapada 1
node translate/cli.mjs ingest charyapada 1 --task weave
node translate/cli.mjs check charyapada

# 5. Review and accept
node translate/cli.mjs review charyapada 1              # edit texts/charyapada/review/cp.01.md
node translate/cli.mjs accept charyapada 1

# 6. Publish what is approved
node translate/cli.mjs render charyapada                # translations/charyapada/…
node translate/cli.mjs render charyapada --preview      # drafts too, into translate/.preview/ (never deployed)
```

**Session mode (today):**
- `draft`, `weave` and `terms` write a pack per unit (`packs/<task>/<unit>.md`) and print where the answer goes.
- In Claude Code, give each pack to a fresh subagent: "Read translate/texts/charyapada/packs/draft/cp.01.md and do what it says." The subagent writes JSON to `inbox/<task>/<unit>.json`.
- `ingest` then validates the answer against the schema and the unit, stamps its provenance and files it.
- A fresh subagent per pack keeps each drafting context clean.

**API and batch mode** arrive in milestone 2. They send the same packs to the Messages API, and the answers go through the same `ingest`.

**Redrafts:**
- When you mark a section `redraft` and leave a "Note to next draft", `accept` saves those notes to `feedback.json`.
- The next `draft` of that unit automatically becomes a redraft, carrying your notes and the previous draft.

## Source directives

Directives are whole lines starting with `@`. The raw import is never edited: `check` proves that the working copy minus its directives equals the raw text. Corrections go through `@emend`, which is recorded on the unit.

| Directive | Meaning |
|---|---|
| `@song N` / `@unit N [title]` | start (or continue) unit N |
| `@raga X`, `@poet ID`, `@title X` | unit metadata (`@poet` takes a glossary person id, e.g. `p-kanha`) |
| `@heading`, `@verse`, `@skip` | what the following lines are (`@skip` for page titles, footnotes, page numbers) |
| `@comm [K]` | a commentary segment about couplet K (bare = the whole song) |
| `@couplet N`, `@refrain`, `@bhanita` | number / flag the next couplet |
| `@lang CODE` | language of the following lines (commentary defaults to the text's commentary language) |
| `@lacuna [note]` | a gap in the witness |
| `@emend ID FROM => TO \| reason` | correct a line without touching the raw text |
| `@-- anything` | a comment |

**Segmentation rules:**
- **`caryagiti`:** a couplet closes at a line ending in ॥. A single line holding both halves is split at its first internal ।. ধ্রু marks the refrain. The last couplet is the bhaṇitā unless `@bhanita` says otherwise.
- **`lines`** (for any text): one line per text line, with blank lines separating stanzas.

## Review sheets

- **What you edit:** the text after the `**Label:**` markers:
  - `EN 1a`, `Title`, `Summary`, `Note N · kind · cites …`, `Translation`
  - the glossary fields
- **What's ignored:** quoted `>` lines are reference only.
- **Decisions:**
  - Units: `ok` or `redraft`.
  - Glossary entries: `approve`, `reject` or `defer`.
  - Blank means not yet decided.
- **Markup:** keep `[surface]{term-id}` around glossary terms.
- **When a song is approved:** only when every section is ok and every term it uses is approved.
- **Stale sheets:** `accept` refuses a sheet written for an older draft.
- **Hand-edited sheets:** `review` won't overwrite one unless you pass `--force`.

## Licensing rules the engine enforces

- **Witness usage.** Each witness in `text.json` has a `usage`:
  - `prompt+publish` may go into packs and onto pages.
  - `publish-only` may be cited but never sent to the drafter.
  - `reviewer-only` material (copyrighted translations such as Kværne 1977) lives in `translate/.private/`. It never goes in `source/`, never in a pack, never in git.
- **Overlap guard.** `check` flags any 8-word run shared between our English (or glossary definitions) and anything in `.private/` or `.cache/`.
- **84000.**
  - Their data can serve as a reviewer-side lookup (milestone 3).
  - Their terms forbid "remixing the glossary into another glossary" and publishing excerpts without permission, so our glossary is written from scratch.
  - Pages say "in the manner of the 84000 Reading Room; not affiliated".
- **Commentary rules** (the compendium's rules):
  - Notes reporting the commentator must cite the segment.
  - Quotations stay at 25 words or fewer.

## Still to decide before the first publish

- The licence for our translations (`publish.license` in `texts/charyapada/text.json`; `check` warns while it says TODO).
- The provenance wording on each page and the reviewer name in `config.json`.
- When to link Translations from the homepage nav.

## Milestones

1. **M1 (built):** the engine and the session loop, tested end to end on a fixture. Next: the pilot on songs 1, 10 and 14, which needs their Bengali text and Munidatta's comments. Paste them, or allow `bn.wikisource.org` in the environment's network settings and use `--fetch`.
2. **M2:**
   - all 50 songs
   - the Tibetan witness (Toh 2293) for songs 24, 25, 48 and the end of 23
   - API and batch drafting with prompt caching
3. **M3:**
   - any text, with generic segmenters
   - Tibetan to Wylie
   - 84000 translation memory and glossary as a reviewer-only lookup
