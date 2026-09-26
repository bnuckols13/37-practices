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

## The Studio (review in claude.ai)

The Studio is a private claude.ai page with its own database. It lets you review without the CLI:
- Songs show the Bengali, IAST and a literal gloss beside editable English.
- Glossary terms can be decided from the side panel.
- Keyboard shortcuts cover the whole review.

Its targets and URLs are listed in `translate/studio.json`:
- `staging` holds the practice song.
- `prod` holds the Charyapada, and gets published once real songs are drafted.

**The loop (Claude runs these):**

```sh
node translate/cli.mjs studio build --target prod        # translate/.studio/prod/studio.html
#   Artifact publish that file (first time: capabilities db (owner-only rules), user, sample)
node translate/cli.mjs studio export charyapada          # only what changed since the last seed
#   ArtifactData batch for each printed batch file (writes = its "writes")
node translate/cli.mjs studio seeded charyapada
```

**When you say "Pull my Studio decisions":**

```sh
#   ArtifactData list decisions        (out_dir: translate/.studio/prod/inbox)
#   ArtifactData list glossaryDecisions (same out_dir)
node translate/cli.mjs studio import charyapada --dry    # read the report first
node translate/cli.mjs studio import charyapada          # approved/, glossary, feedback, receipts
#   ArtifactData batch for the receipts and refreshed docs it prints, then: studio seeded
```

**Rules the import enforces:**
- A Studio review goes through the same acceptance path as a markdown sheet, so the approved record is identical either way.
- A decision made on an older draft is refused as stale; the Studio then offers "Start review of the new draft", which keeps unchanged passages.
- One review channel per song: a hand-edited sheet blocks a Studio import unless you pass `--force`.

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

## What `render` publishes (the Reading Room)

`render` writes, for each text, into `translations/<text>/`:

| File | What it is |
|---|---|
| `index.html` | Title page: the title in its own script, witnesses, imprint, a worked "How to read this edition" passage, and every song with its state |
| `NN.html` | One page per approved song: contents rail, the English with rubricated passage numbers, Munidatta beside the couplet he reads, notes and terms |
| `glossary.html` | A–Z, type filter and filter box; each entry with source forms, attestation codes, readings and where it appears |
| `about.html` | How the edition is made, sources, conventions, licence |
| `search.json` | The index behind the `/` search dialog (plain text only; `check` refuses markup in it) |

It also writes `translations/assets/reader.css` and `reader.js`, shared by every page and linked with `?v=<content sha>`, the self-hosted fonts in `translations/assets/fonts/`, `translations/index.html` and `sitemap-translations.xml`.

- **Look:** set like a printed edition.
  - One book face throughout: a subset of Gentium Book Plus with its real small capitals, plus Tiro Bangla for Bengali. Both are self-hosted, so the pages make no requests to Google (see `assets/fonts/README.md`).
  - Structure comes from space, italic and small capitals.
  - Passage numbers are red in the margin, the ॥ mark separates couplets, and each song ends with a colophon saying where it was translated from and who reviewed it.
  - Colours come from `lib/design/tokens.mjs`, the same tokens the Studio uses. Light and dark follow the device, or the reader's choice under Display.
- **House rules**, enforced by a unit test on the stylesheet and by the browser check: no sans-serif, no uppercase transforms, no shadows, no gradients, no rounded boxes.
- **Without JavaScript:** everything still works. Terms link to the glossary page, passage numbers are anchors, and commentary sits in the margin.
- **With JavaScript, the script adds:**
  - glossary previews on hover and a pinned panel on click;
  - Display settings, remembered per browser. The text can be English only, English with the source beside it in facing columns, or Study (source, transliteration and a word-by-word gloss beside the English). Commentary can sit in the margin, under each couplet or be hidden.
  - a Copy link / Cite menu on each passage number;
  - search.
- **Browser check:** `node test/ui/reader.shot.mjs <outdir>` approves the practice song, renders it, checks the reader in Chromium at desktop and phone widths in light and dark, and saves screenshots. It is opt-in and needs Playwright.

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
