# Illuminated Translation Engine: plan

> **Status (2026-09-26).** Milestone 1's engine is built and tested, and the pilot is under way: Charyapada songs 1, 10 and 14 are imported from Shastri's 1916 edition (Bengali Wikisource), drafted, woven with Munidatta's commentary, and seeded into the Charyapada Studio for Lena Rose's review, with 99 proposed glossary entries. How to run it is in `translate/README.md`.

## Context

Lena wants a translation system in the spirit of **84000's Reading Room**. It should produce *illuminated* English translations, which means two layers:
- **Glossary-linked terms:** key words in the English link to entries that give the source form, Sanskrit or Tibetan equivalents, a definition and a symbolic reading.
- **Commentary woven in:** each song or verse carries its traditional commentary.

Claude drafts; Lena reviews and approves. Approved term choices feed back into later drafts.

**Texts, in order:**
1. The **Charyapada** (Caryāgīti): Old Bengali / Apabhraṃśa siddha songs, with Munidatta's Sanskrit commentary.
2. **Any text Lena gives it.**

**Where it runs:**
- The code lives in this repo, next to `build/`.
- Drafting happens in this Claude Code session first; no API key is set today. API mode comes later.
- Finished pages publish at **37practices.space/translations/**.

The repo already works this way. `build/build.mjs` is a zero-dependency build that turns hand-edited markdown into static pages in the site's design, and it fails loudly on bad input. The engine follows the same approach: files in git, markdown for the human, strict validators, static output.

### Research findings that shape the design
- **Charyapada sources.**
  - The base text is Shastri's 1916 edition, which is public domain. Bengali Wikisource has a proofread transcription, one subpage per song (`হাজার_বছরের_পুরাণ_বাঙ্গালা_ভাষায়_বৌদ্ধগান_ও_দোহা_(১৯৫১)/চর্য্যাচর্য্যবিনিশ্চয়/N`), including Munidatta's commentary. Individual pages still need checking to confirm the commentary is on every one.
  - There is no free IAST e-text, so the engine transliterates Bengali script to IAST itself, from a lookup table.
  - Songs 24, 25 and 48, and the end of 23, survive only in the Tibetan Tengyur translation (Toh 2293, *spyod pa'i glu'i mdzod kyi 'grel pa*). Those get translated from the Tibetan and clearly labelled as the Tibetan witness.
  - There are 50 songs by 23–24 siddhas. Each has a rāga heading and about 5 couplets, and the poet names himself in the last couplet (the bhaṇitā). The symbolic "twilight language" is dense: Ḍombī, Śabarī, the boat, the body-tree, the three channels.
- **Copyright.** Every complete English translation (Kværne 1977, Mojumder 1967, Shahidullah 1940/66, Moudud 1992) is still in copyright. They never go into prompts, the repo, or pages. Lena can consult them privately; our English must be original.
- **84000.**
  - We copy their publication structure: summary, introduction, translation, notes, glossary, bibliography.
  - We copy their glossary-entry model: entry types term/person/place/text, and Sanskrit attestation codes AS/AO/AD/AA/RP/RS/SU.
  - Their Terms of Use (`raw.githubusercontent.com/84000/all-data/master/Terms_of_Use.md`) forbid "remixing the glossary into another glossary" and publishing excerpts without permission. So **our glossary is written from scratch**, and 84000 data is only a lookup shown to the reviewer (milestone 3).
  - Their AI policy says a human must be the primary agent. So every published song shows its provenance.
- **Network.** This environment blocks `bn.wikisource.org`, `archive.org` and `read.84000.co`. It allows `raw.githubusercontent.com`, npm and `api.anthropic.com`. So ingestion works from pasted or local text first. The Wikisource fetcher starts working once Lena allows that host.

## Design decisions
1. **New `translate/` folder with its own `package.json`.** Dependencies: `@anthropic-ai/sdk` and `zod`, pinned. The root stays free of `package.json`, so Vercel still serves plain static files.
2. **Add a root `.vercelignore` containing `translate/`.** Drafts, review sheets and packs are never served. Only the generated `translations/` folder is public.
3. **Inline term markup: `[Ḍombī]{dombi}`.**
   - The drafter writes it into the English, and Lena edits it in the sheet.
   - A link moves with its words, so there are no character offsets and no string search.
   - `render` turns the markup into links.
4. **Every witness has a `usage` in `text.json`: `prompt+publish | publish-only | reviewer-only`.** The pack builder refuses anything that isn't `prompt+publish`. This mirrors `furtherReadingOnly` in `build/sources.json`.
5. **Copyrighted references and 84000 caches live in gitignored `translate/.private/` and `translate/.cache/`.** `.gitignore` gets them, plus `node_modules/`, packs, the inbox and `.preview/`, before any such file exists.
6. **One file per song throughout: units, drafts, commentary, review, approved.** Diffs stay per song, and a session subagent reads one file at a time.
7. **Two drafting modes, sharing one pack builder and one zod schema.**
   - **Session:** the engine writes a pack file. A fresh subagent drafts JSON into `inbox/`, and `ingest` validates it.
   - **API:** the CLI calls Claude and pipes the result through the same `ingest`.
8. **Pipeline status comes from the files, with no state file.** Status reads which stage files exist and whether their recorded SHAs are still current.
9. **`build.mjs` is left untouched.**
   - `render` writes its own `sitemap-translations.xml`, and `robots.txt` gets a second `Sitemap:` line.
   - It reads the site CSS from `build/template.html` the same way `build.mjs:544-546` does.
   - The few tiny helpers (`esc`, `attr`, `jsonLd`) are copied, with a pointer to `build.mjs:45-55`. A shared `build/site-kit.mjs` can come later if duplication grows.
10. **Only approved songs are published.** Unreviewed songs appear in the sidebar as "in progress" stubs. `render --preview` writes everything, drafts included, to gitignored `.preview/` for local viewing.
11. **Source integrity.** Raw pastes are kept byte-for-byte in `source/raw/` with a `.sha256`. A marked-up copy adds light directives (`@song 10`, `@raga`, `@poet`, `@refrain`, `@comm`, `@lacuna`, `@emend`), so segmenting is deterministic. `check` proves that stripping the directives gives back the raw text.
12. **`texts/<slug>/style.md` holds Lena's standing preferences.** For example: "town, not city, for *nagara*" or "no 'O' vocative". It rides in the cached prompt prefix, so choices beyond the glossary also reach future drafts.

## Directory layout
```
.vercelignore                 NEW  translate/
.gitignore                    + translate/node_modules/ translate/.private/ translate/.cache/
                                translate/texts/*/packs/ translate/texts/*/inbox/ translate/.preview/
robots.txt                    + Sitemap: https://37practices.space/sitemap-translations.xml
translate/
  package.json package-lock.json README.md config.json   # config: reviewer, defaultModel
  cli.mjs                                                # node:util parseArgs → lib/commands
  lib/ io.mjs ids.mjs markup.mjs glossary.mjs pack.mjs api.mjs ingest.mjs check.mjs accept.mjs status.mjs
       segment/{caryagiti,lines,tibetan}.mjs  translit/{bengali,tibetan}.mjs
       review/{write,parse}.mjs  render/{shell,song,hub,glossary,assets}.mjs
       import/{file,wikisource}.mjs  refs/{tm84000,overlap}.mjs          # refs: M3
  schemas/ text.mjs unit.mjs glossary.mjs draft.mjs weave.mjs approved.mjs   # zod, single source of truth
  prompts/ system.md  texts/charyapada.md  tasks/{draft,redraft,weave,terms}.md  # front matter version: N
  glossary/ glossary.json  review/<slug>-<date>.md
  texts/charyapada/ text.json style.md translit.overrides.json
                    source/raw/*  source/shastri1916.txt  source/toh2293.txt
                    units/index.json units/cp.01.json …   drafts/ commentary/ review/ approved/
                    packs/ inbox/ (gitignored)   runs.jsonl
  test/ fixtures/ *.test.mjs                                               # node --test
translations/ index.html  charyapada/{index.html, 01.html … 50.html, glossary.html}   # GENERATED
sitemap-translations.xml                                                             # GENERATED
```

## Schemas
The examples below are illustrative. Readings still need checking against the edition.

**`text.json`**
- `slug`, `idPrefix: "cp"`, `title`.
- Languages: root `oben`, commentary `san`, witness `bod`, plus their HTML `lang` codes.
- `segmentation.rule: "caryagiti"`.
- `commentary: {id:"munidatta", witness:"shastri1916"}`.
- `exemplars: ["cp.01"]`, used as a style example in the cached prefix.
- `publish.dir`.
- `witnesses[]`, each with `{id, lang, script, citation, license, usage, units?}`:
  - `shastri1916`: public domain, `prompt+publish`.
  - `toh2293`: units cp.23–25 and cp.48, `prompt+publish`.
  - `kvaerne1977`: copyrighted, `reviewer-only`, path under `.private/`.

**Unit** (`units/cp.10.json`, owned by the engine and never echoed back by Claude)
```json
{ "id":"cp.10","n":10,"raga":"deśākha","poet":"p-kanha","sourceSha":"…",
  "lines":[{"id":"cp.10.1a","role":"line","couplet":1,"lang":"oben","witness":"shastri1916",
            "src":"নগর বাহিরি রে ডোম্বি তোহোরি কুড়িআ ।","translit":"nagara bāhiri re ḍombi tohori kuḍiā"}, …],
  "commentary":[{"id":"cp.10.m1","anchor":"cp.10.1","src":"…"}] }
```
- ID grammar: `cp.NN[.Na|.Nb|.h|.r|.mK]`.
- IDs are never renumbered. Retired IDs are tombstoned in `units/index.json`.
- `lang` and `witness` are set per line, so song 23 can mix Old Bengali and Tibetan lines.

**Glossary entry** (`glossary/glossary.json`, our own prose only)
- Fields: `id`, `type` (term|person|place|text), `status` (proposed|approved|rejected), `en`, `alt[]`, `variants[]`.
- `policy`: translate | keep-source | keep-source-first-gloss.
- `forms[]`: `{lang, script, translit|wylie, att, where}`.
- `match` holds the source surface forms and regexes.
- `definition` is ≤60 words.
- `symbolic: {image, readings:[{referent, per:"Munidatta", where:["cp.10.m1"]}]}`.
- `forbiddenInLine[]`: esoteric referents that must never replace the image in a verse line.
- `provenance`: who proposed and who approved it, with dates.

**Draft output**
- Scope: one zod schema, used by API `output_config.format`, the session pack and `ingest`.
- Shape: every field is required (`""` or `[]` instead of optional fields), with no recursion.
```js
Line  = { id, translit, gloss /* literal, " · "-separated */, en /* with [x]{id} markup */,
          terms:[{id, src}], flags:[{kind:'reading'|'meaning'|'grammar'|'term'|'witness', level, note}] }
Draft = { unit, title, summary, lines:[Line] /* ids = unit ids, same order */,
          notes:[{anchor, kind:'philology'|'imagery'|'doctrine'|'witness', text, cites:[]}],
          termsOmitted:[{id, line, reason}], proposals:[GlossaryProposal], questions:[] }
```
**Weave** (`commentary/cp.10.json`)
- Each Munidatta segment carries:
  - `translit`
  - a full `translation` with markup
  - a woven `note` (≤60 words, "Munidatta reads…")
  - `equations[]`: his "X iti Y" glosses, which become grounded symbolic readings on acceptance
  - `citations[]`
  - `flags`

**Approved record** (`approved/cp.10.json`)
- Contents: the draft, the commentary, and `provenance`.
- Draft provenance: mode, model, date, packSha, prompt versions, glossarySha, sourceSha. For API runs, the model is the one `response.model` reports actually served the request.
- Review provenance: `{by:"Lena Rose", date, sheetSha, draftSha, decisions:{"cp.10.1":"edited"}}`.

## Review sheet (`review/cp.10.md`, one per song, commentary interleaved)
- **What `accept` reads:** only `**Label:**` lines.
- **What it ignores:** everything in `>` blockquotes, which is reference material that gets regenerated.
- **How sections are keyed:** by the ID at the end of each heading.

```markdown
<!-- translate:sheet text=charyapada unit=cp.10 draft=9c1e3f2a sheet=5b77d0e1 -->
# Song 10 · Kāṇha · rāga Deśākha
## 10.1 · cp.10.1
> নগর বাহিরি রে ডোম্বি তোহোরি কুড়িআ ।   nagara bāhiri re ḍombi tohori kuḍiā
> *city · outside · O · Ḍombī · your · hut*
**EN a:** Outside the town, [Ḍombī]{dombi}, stands your hut;
**EN b:** …
**Note 1 (imagery):** …
> FLAG b · meaning · medium: *choi choi*: "brushing past" or "touching again and again"? I chose…
**Decision:** ok            (ok | redraft | blank = pending)
**Note to next draft:**
## Munidatta on 10.1 · cp.10.m1
> …IAST…
**Translation:** …   **Note:** Munidatta reads … [Ḍombī]{dombi} as [nairātmā]{nairatma}.   **Decision:** ok
## Glossary · new or changed terms
### dombi · proposed
**EN:** Ḍombī   **Policy:** keep-source   **Definition:** …   **Symbolic:** nairātmā (Munidatta, cp.10.m1)
**Decision:** approve       (approve | reject | defer)
```

**How the parser behaves** (it reuses the `splitLabeled` idea from `build.mjs:57`):
- **Tolerant of:** CRLF line endings, curly quotes and decision synonyms.
- **Edits:** an `ok` on changed English is recorded as `edited`.
- **Stale sheets:** `accept` refuses if the sheet's `draft=` SHA is out of date.
- **Overwrites:** `review` won't overwrite a hand-edited sheet without `--force`.
- **When a song counts as approved:** every line and segment is `ok`, and every term it uses is approved.

## Prompts and caching
- **`prompts/system.md`** (stable):
  - **Role:** Claude drafts; a named human decides.
  - **Principles adapted from 84000:** accuracy first, then readability. Keep line-for-line correspondence. Plain modern English, with no padding or brackets inside lines.
  - **Twilight language:** translate the image literally, so the boat stays a boat and Ḍombī stays Ḍombī. Esoteric readings go only in attributed notes ("Munidatta reads…" with `cites`), never stated as the meaning.
  - **Divergence:** when song and commentary disagree, flag it rather than harmonise.
  - **Bhaṇitā:** keep the poet's self-naming.
  - **Glossary:** use approved renderings. If Claude disagrees, it complies and asks a question. New terms go in `proposals`.
  - **Uncertainty:** flag it, never choose silently.
  - **Published translations:** never reproduce or imitate them, including remembered phrasing.
- **`prompts/texts/charyapada.md`:**
  - song form
  - Old Bengali cues and script ambiguities (ব b/v, য y/j, ড় ṛ)
  - Munidatta's "X iti Y" method
  - rules for songs that exist only in Tibetan
- **Tasks:** `draft`, `redraft` (adds the prior draft and Lena's notes), `weave`, `terms` (symbolic readings only when attested with a segment ID).
- **Cache layout:**

| Block | Contents | Cache |
|---|---|---|
| system | system.md | breakpoint 1 |
| user[0] | text brief + style.md + text-scoped glossary (sorted, compact) + exemplar song | breakpoint 2 |
| user[1] | task instructions | breakpoint 3 |
| user[2] | unit JSON + that song's Munidatta segments + detected term hits + feedback | none |

- **Session mode:** `pack` writes these same blocks to `packs/draft/cp.10.md`. It adds the JSON Schema taken from the zod schema and the instruction "write `inbox/draft/cp.10.json`, then run `ingest`". Each pack is drafted in a fresh subagent so the context stays clean.
- **API mode** (M2):
  - **Call:** `client.beta.messages.parse` with `model: "claude-opus-5"`, `thinking: {type:"adaptive"}`, `output_config: {effort:"high", format: zodOutputFormat(Draft)}` and `max_tokens: 16000`.
  - **Refusal fallbacks:** `betas: ["server-side-fallback-2026-07-01"]` with `fallbacks: "default"`.
  - **Stop reasons:** check `stop_reason` for `refusal` and `max_tokens` first.
  - **Logging:** log `usage.cache_read_input_tokens` to `runs.jsonl`.
- **Batch mode** (M2):
  - **Call:** `client.messages.batches.create`, with no fallbacks (Batches rejects them). Custom IDs look like `cp-10-draft`.
  - **Results:** they arrive in any order, so they're keyed by ID.
  - **Retries:** refused items are re-run synchronously.

## CLI: `node translate/cli.mjs <cmd> <slug> [cp.01..cp.03|all] [flags]`
| Command | Does |
|---|---|
| `new --lang oben --rule caryagiti --title …` | Creates the `text.json` skeleton and `style.md` |
| `import --witness shastri1916 <file\|-\|wikisource:N>` | Takes a paste, a file or a Wikisource page, and writes `source/raw/` with its `.sha256` |
| `segment` | Runs the segmenter, then transliterates; writes `units/*.json` and reports any ID changes |
| `terms` | Builds a pack of frequency-ranked candidate terms, then a glossary review sheet |
| `pack --task draft\|redraft\|weave\|terms` | Writes deterministic packs and prints their paths |
| `draft [--api] [--batch]` / `weave` | Session mode: prints instructions. API mode: calls Claude and runs `ingest` |
| `ingest [--task] [--model]` | Validates `inbox/` output into `drafts/` or `commentary/` and stamps provenance |
| `check [--strict]` | Runs every validator below; exits 1 on errors |
| `review [--force]` / `accept [--dry]` | Writes the sheet / parses it into `approved/`, `glossary.json` and feedback |
| `render [--preview]` | Writes `translations/<slug>/…` and `sitemap-translations.xml` |
| `status`, `glossary show\|lint\|rename`, `collect <batchId>` | Housekeeping |

## Page anatomy (`translations/charyapada/10.html`)
- **Page shell:**
  - The site CSS is taken from `template.html`. A small illumination stylesheet and the popover JS are inlined, with no dependencies. Noto Serif Bengali/Tibetan fonts load only where needed.
  - `data-page-type="translation"` means the existing `assets/analytics.js` tracks the pages.
- **Masthead:** eyebrow "Illuminated Translations", crumbs Home › Translations › Charyapada › Song 10.
- **Sidebar:** songs 1–50 with poet names. Songs that survive only in Tibetan are marked, and so are songs still in progress.
- **Song head:**
  - "Song 10 of 50 · rāga Deśākha", the title, and a poet chip that opens the person popover.
  - A witness badge ("Old Bengali · Nepal MS, Shastri 1916" or "From the Tibetan; the original is lost").
  - A **provenance badge**: "Drafted with Claude; reviewed and approved by Lena Rose, <date> (2 of 11 lines edited)".
- **Toggles:** Source · Transliteration · Literal gloss · Commentary. Commentary is on by default.
- **Couplets:**
  - Each is a `<section id="c1">` with the passage number 10.1 and English lines carrying glossary links.
  - The Bengali source (`lang="bn"`), IAST and gloss are revealed by the toggles.
  - The refrain and the bhaṇitā are marked.
- **Woven commentary:** `<aside class="muni">` holds the note, with a `<details>` for Munidatta's full comment in translation and IAST.
- **Glossary popover:**
  - Contents: headword, forms with attestation badges, definition, symbolic reading with its source segment, and where the term occurs.
  - Keyboard: Enter opens it, Esc closes it.
  - Without JS it degrades to a link to `glossary.html#g-dombi`.
- **After the song:** endnotes, "Terms in this song", a prev/next pager, and a footer. The footer covers sources and licences, the AI-provenance statement, and "in the manner of the 84000 Reading Room; not affiliated".
- **Other pages:**
  - `glossary.html`: A–Z, type filters, an attestation legend, and where each term appears.
  - `index.html` hub: the reviewed introduction and a 50-row table (number, poet, rāga, witness, status).
  - `translations/index.html`: a list of texts.
  - Print CSS expands everything.

## `check` (E = error, W = warning; `--strict` promotes warnings)
1. **Source integrity (E):** stripping directives gives back the raw paste, and the SHAs match.
2. **Licensing (E):** every witness has a licence and a usage, and no pack contains a non-`prompt+publish` witness.
3. **IDs (E):** unique and grammatical, and none disappears unless tombstoned.
4. **Drafts (E):**
   - pass zod
   - line IDs equal the unit's, in the same order
   - `sourceSha` is current
5. **Markup (E):**
   - balanced
   - every ID exists and isn't rejected
   - approved songs use only approved entries
6. **Terms:**
   - every glossary match in a source line is either marked in the English or listed in `termsOmitted` (W)
   - the marked surface equals the approved `en` or one of its variants (E once approved)
7. **Twilight guard (E):** a `forbiddenInLine` word appears inside a verse line.
8. **Attribution (E):** a note that mentions Munidatta has no `cites`, or cites an unknown segment. A quote from a secondary source runs over 25 words (the compendium rule).
9. **Copyright guard (E):** any 8-word overlap between our English or glossary definitions and anything in `.private/` or `.cache/`.
10. **Provenance (E):** every approved song records a reviewer, dates, draftSha and model. A sheet's draft SHA must match before `accept`.
11. **Output (E):**
    - no `]{` left in `translations/`
    - every link resolves to an inlined entry
    - `lang` attributes are on script spans
    - text is NFC
12. **Determinism (W):** rebuilding a pack gives the same SHA.
13. **Translit (W):** Claude's IAST differs from the machine IAST beyond b/v, y/j and ṛ/ḍ.

## Milestones
**M1: skeleton plus a pilot on songs 1, 10 and 14, session mode, pasted text.** These three cover the body-tree, Ḍombī's hut, and the boat on the Gaṅgā–Yamunā.
1. **Scaffolding:** `.vercelignore` and `.gitignore` entries; `translate/package.json`, schemas, `io/ids/markup`, the `caryagiti` segmenter, the Bengali→IAST table, `new/import/segment/status`, and unit tests.
2. **Seed glossary:** about 30 core entries via `terms` → glossary sheet → Lena approves. Core set: ḍombī, śabarī, boat, tree, mouse, gaṅgā/yamunā, lalanā, rasanā, avadhūtī, sahaja, mahāsukha, nairātmā, citta, plus the pilot poets.
3. **Full loop, one song at a time:** song 1 goes `pack → subagent draft → ingest → weave → check → review → (Lena edits) → accept`. Then song 10, then song 14, so we can see earlier approvals and `style.md` reaching later packs.
4. **Publish:** `render` the three songs, the hub, the glossary and `translations/index.html`. Add `robots.txt` line 2. The link from the homepage nav is added only when Lena says so.
- **Lena supplies:** the Bengali text of songs 1, 10 and 14 plus Munidatta's comments, pasted from Wikisource or the 1916 PDF. Or Lena allows `bn.wikisource.org` and `import wikisource:N` fetches them.
- **Exit criteria:** 3 songs approved, `check --strict` clean, the review sheet round-trips losslessly, and the feedback loop is shown working.

**M2: all 50 songs, plus API and batch mode.**
- Import the rest of the songs.
- Tibetan text of Toh 2293 for 23b, 24, 25 and 48, with Wylie translit and lines marked `witness: toh2293`. The source still needs finding: OpenPecha or Esukhia Derge Tengyur etexts on GitHub (licence to check), or a paste.
- `draft --api` with caching and fallbacks; `--batch` and `collect` for the bulk run.
- Person entries for all the siddhas.
- `glossary rename` rewrites markup across approved songs, and `check` re-validates.
- A reviewed introduction for the hub.

**M3: any text.**
- `new --lang bod|san|oben|pli` with generic segmenters (lines, stanzas, numbered verses, Tibetan shad) and Devanagari→IAST.
- 84000 translation memory (TMX) and glossary from `raw.githubusercontent.com/84000/…` go into `.cache/`, with fuzzy per-unit lookups written only to `.private/ref/` for the reviewer.
- 84000 data stays out of prompts by default; `--ref-in-prompt` is opt-in, with the overlap guard mandatory. 84000 wording never enters our glossary.
- Suggested pilot: the Tibetan root text of the 37 Practices itself.

## Verification
1. `cd translate && npm ci && npm test` (`node --test`):
   - markup parse/strip/render
   - golden transliteration words
   - segmenter fixtures for songs 1, 10 and 14 giving the expected IDs
   - review-sheet round-trip, both unedited (equals the draft) and an edited fixture (expected decisions)
   - the zod→JSON Schema output has no unsupported keywords
2. **Negative fixtures that must fail `check`:**
   - a missing line
   - an unknown term ID
   - a `forbiddenInLine` violation
   - an 8-word overlap with a fake private reference
   - a stale SHA
   - an uncited Munidatta note
3. **Determinism and strictness:** `pack` twice gives the same SHA, and `check charyapada --strict` exits 0.
4. **The existing build is unaffected:** `node build/build.mjs` still runs, and `git diff` shows no changes to `verses/`, `study-the-verses.html` or `sitemap.xml`.
5. **Local serving:** serve with `python3 -m http.server`, open `/translations/charyapada/10.html` and check:
   - popovers open with Enter and close with Esc
   - glossary links work without JS
   - toggles and print expansion work
   - the provenance badge is present
   - Bengali renders correctly
6. **Vercel preview** (after push):
   - `/translations/charyapada/` loads
   - `/translate/README.md` returns 404
   - `robots.txt` lists both sitemaps
7. **M2 API checks:**
   - `draft --api cp.01 --dry-run` prints the request
   - the second real call shows `cache_read_input_tokens > 0`
   - a mocked refusal records the model that actually served the request

## Risks and decisions to watch
- **Copyright leakage.**
  - Never paste Kværne or similar into the drafting session.
  - The overlap guard catches verbatim runs only, so Lena's review is the real control.
  - The ignore files land before any reference file exists.
- **Source quality.**
  - OCR and transcription errors, and Shastri's known misreadings. Later editions' readings stay reviewer-only until their copyright status is clear.
  - Wikisource's 1951 transcription may carry CC BY-SA attribution duties, which should be credited in the footer.
- **Invented Munidatta attributions** are guarded by `cites` plus the source segment shown beside each note in the sheet.
- **Songs from the Tibetan** are translations of a translation, and the Toh 2293 e-text source is still unresolved.
- **Session and API drafts may differ.** Mitigated by a subagent per pack, identical validation, and `mode` recorded in provenance.
- **To confirm against the pinned SDK at M2:**
  - `beta.messages.parse` with the zod helper plus fallbacks
  - the Batches `custom_id` character set
  - on a `max_tokens` stop, retry with streaming
- **Glossary churn** invalidates approved songs and the prompt cache. `check` re-validates and `rename` is atomic.
- **Lena's decisions, before first publish:**
  - ~~the licence for our translations~~ decided: CC0 1.0
  - the exact provenance wording
  - when to link Translations from the homepage
- **Out of scope, noted:** `build.mjs:144` sweeps the `---` separator into each synthesis, so a stray `---` shows on 38 verse pages.
