# Study the Verses — build

`study-the-verses.html` is **generated**. Don't hand-edit it; your changes will be
overwritten on the next build. Edit the compendium markdown or `build/template.html` instead.

## Weekly loop

1. Deep-fill the next block in `~/Practice/37 Practices Group/` per `COMPENDIUM PROCESS.md`
   (three translations per verse, **Garchen first**).
2. From the repo root:
   ```
   node build/build.mjs
   ```
3. Commit and push. GitHub Pages picks it up in a minute or two.

That's it. The build syncs the markdown out of the working folder itself — no copying by hand.

## What the build does

- **Syncs** `COMPENDIUM — *.md` and the master catalog into `content/`, renaming to ASCII
  (`compendium-homage-verses-1-7.md`) so filenames never cause CI or URL trouble.
- **Parses** each `## VERSE N — topic` block into a record: root text per translator,
  commentary entries per teacher, and the "Across the commentaries" synthesis.
- **Orders** translations and commentators from `sources.json`, so Garchen leads the root
  text and Garchen Rinpoche leads the commentaries no matter what order the markdown is in.
- **Attaches attribution** from `sources.json`. GR, HHDL, KTGR and KS entries carry no inline
  link in the markdown; the renderer supplies each teacher's name and source URL.
- **Merges** a verse that appears in more than one file. This is the important one: verses
  8–37 currently live in `COMPENDIUM — Verses 8–37 (root text).md` with their three
  translations and no commentaries. When a block gets deep-filled into its own file, the
  build merges the two — richer root text wins, the deep-fill's commentaries and topic win.
  **You never have to edit or prune the root-text file.** The build warns when it merges.
- **Fills gaps** from the scaffold, so any verse not yet brought in still renders with
  working URLs.
- **Renders** one self-contained HTML file with the data inlined. No runtime fetch, no npm
  dependencies, no framework.

## It refuses to build if

- a verse is missing from the block taxonomy, or the homage is absent
- a verse has commentaries but no root text
- **Garchen Rinpoche is not first** in a filled verse's commentaries
- **Garchen is not the leading translation** on any verse that has root text
- any commentary entry resolves to no source URL — an unlinked entry is a bug

It also prints a quote count each run. Those quotes came from web extraction, so spot-check
them against their sources before publishing anything new.

## Changing what gets published

`build/sources.json` → `includeTranslations`. Removing `"mcleod"` from that array and
rebuilding pulls the McLeod translation off the site completely. Same for `"garchen"`.
This is the lever if a licence question ever needs answering in a hurry.

## Licensing, in short

| Source | Status |
|---|---|
| Pearcey (Lotsawa House) | CC BY-NC 4.0 — publishable with attribution |
| Garchen Institute booklet | No explicit licence stated. Ask GBI before wider reprinting. |
| Ken McLeod (Unfettered Mind) | Freely posted, no explicit licence. Published by Brian's decision. |
| Dilgo Khyentse, purchased books | **Never reproduced.** Further-reading pointer only — the build strips any body text. |
| Summaries and syntheses | Original prose written for this project. Publishable. |

## Config

Source folder defaults to `C:/Users/brian/Practice/37 Practices Group`. If it moves:

```
COMPENDIUM_DIR="/some/other/path" node build/build.mjs
```
