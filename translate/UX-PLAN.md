# Translation UX: the Studio and the Reading Room

## Context
Lena Rose (the reviewer) wants a solid **translating** and **reading** experience:
- built on good onboarding and information-architecture practice;
- inspired by how 84000's Reading Room looks;
- *not* generic "Claude slop".

The engine in `translate/` (milestone 1) works but has two gaps:
- **Reviewing:** it happens in markdown sheets, which is awkward when you follow the session in the Claude app and can't run the CLI.
- **Reading:** the published pages reuse the site's cream, Cormorant and maroon/saffron look. That look is itself a recognisable AI-default cluster, and the pages add pill badges everywhere.

**Decisions made with Lena:**
- Translating happens in a private **Studio** page on claude.ai (an Artifact with a shared database). Claude seeds drafts into it, Lena edits and decides there, and Claude pulls the decisions back into the repo.
- The Studio comes first; the **Reading Room** redesign of `translations/` follows.
- Both share one visual direction, "Reading Room": close to 84000's restraint, in our own palette.
- The Studio includes a "Why this rendering?" button that asks Claude about a line. It is viewer-paid, and the first use asks for consent.

**Research this rests on:**
- **84000's Reading Room source code** (`84000/exist-apps`, `84000/84000-apps` on GitHub):
  - Soft graphite text (`#484848`, never black) and navy links (`#155370`).
  - Brick margin numbers and note markers (`#bb514a`).
  - Glossary terms with a dotted navy underline; glossary and notes open in a right panel.
  - A framed title card, small-caps labels, and "·"-dotted title lines.
  - A three-panel layout: front matter, text, and a right panel for glossary and notes.
- **Reading UX:** NN/g on tables of contents, tooltips and onboarding; Sefaria's resource panel; SuttaCentral's display modes; Tufte and Gwern sidenotes.
- **Review UX:** memoQ, MateCat, Smartcat and Trados; SuttaCentral's Bilara; Google PAIR and Microsoft HAX on reviewing AI output.

These are what the Studio and the reading pages copy:
- **Studio (review):**
  - A keyboard-driven segment grid: Ctrl+Enter confirms and moves to the next segment.
  - A "needs attention" filter.
  - Specific flags instead of confidence numbers, each with its "why" collapsed.
  - A diff against the AI draft, and no bulk approve.
- **Reading pages:**
  - Glossary terms get a delayed hover preview, pin on click and are reachable by keyboard.
  - Commentary sits in the margin on wide screens and inline on narrow ones.
  - No modal tours: help is something the reader pulls up, and settings controls are labelled with their current state.

## Design direction: Reading Room
Every colour and type decision in both surfaces derives from one tokens module, `translate/lib/design/tokens.mjs`.

**Colour** (light / dark):

| Token | Light | Dark | Role |
|---|---|---|---|
| paper | `#FBFBF9` | `#15191C` | page ground |
| surface | `#F2F4F3` | `#1D2226` | rails, panels |
| ink | `#2E3336` | `#D9DEE1` | text |
| muted | `#6F777C` | `#8E979C` | secondary text |
| rule | `#D9DDDF` | `#2E353A` | hairlines |
| navy | `#1F4E6B` | `#8DB8D6` | links, glossary underline, focus |
| rubric | `#B4452F` | `#E0806A` | margin passage numbers, note markers, the rāga line |

Semantic states (ok, redraft, flag) take muted greens, ochre and brick, used only for status.

**Type:**
- **Gentium Book Plus** for text. It is built for scholarly diacritics (ā ī ū ṛ ṃ ḥ ñ ṅ ṭ ḍ ṇ ś ṣ). Around 20px, line-height 1.6, measure about 64ch.
- **Tiro Bangla** for Bengali. Tiro made it for the bilingual Murty Classical Library.
- **Source Sans 3** for controls and labels, with small caps and letter-spacing for eyebrows.
- Old-style figures in running text, tabular figures in the Studio's counts.

**Rules against the generic look:**
- No cards-in-cards, no pill badges for metadata, no uniform rounded corners, no gradients, no emoji or ✨.
- Hairline rules and margin structure instead of boxes; a left-aligned, asymmetric grid.
- The one bold move is rubrication: passage numbers set in brick in the margin, as a manuscript marks sections in red.
- Glossary terms: body colour, dotted navy underline.
- The subject-specific details carry the character, as real content: rāga headings, the bhaṇitā mark, the Bengali title চর্যাপদ, and manuscript and Tengyur witness lines ("· Nepal manuscript · Toh 2293 ·").

## S — The Studio (first)

**Where it lives:**
- Browser source in `translate/studio/`: `body.html`, `styles/*.css`, and `src/*.mjs` (vanilla JS, no framework).
  - `store.mjs` holds pure state and actions; `sync.mjs` is the db adapter and save queue; `diff.mjs` does a word-level diff; `why.mjs` wraps `sample`; `views/*` render the UI.
  - `fake-db.mjs` stands in for the db in tests and screenshots.
- `studio build` bundles it into one publishable body file, `translate/.studio/studio.html` (gitignored). The bundler is tiny and enforces a constrained import syntax, checked by a test. It inlines `lib/markup.mjs` so the editor validates markup with the same code as accept.
- `translate/studio.json` records **two** artifacts: `staging` (seeded from the fixture) and `prod` (charyapada), each with url, build sha, contract and publish date.

**Capabilities:** `{db: {rules: owner/admin only}, user: {}, sample: {}}`.
- Edit controls are gated on `user.canEdit()`.
- **`db` null:** the page shows a state card, "Open this Studio in the Claude app, signed in as its owner", plus the checklist. Nothing is ever baked into the HTML.
- **`sample` null:** the "Why?" button is hidden.
- Access check on day 1: Lena must be the owner, which is the case when it's published from this session.

**Database.** Claude writes `meta`, `units`, `glossary` and `receipts` with ArtifactData, pinning with `if_version`. The page writes only `decisions` and `glossaryDecisions`. Every doc carries `v:1`.

| Collection | Contents |
|---|---|
| `meta/text-<slug>` | The rail index: songs `[{id, n, title, poet, stage, draftSha, sections, approved}]`, total, lost, reviewer, style notes, checklist with prompts. Written **last** in every seed, as the commit marker. |
| `units/<cp.10>` | Sections in sheet order, keyed by id part (`head`, `h`, `1`, `m1`). Each carries `base` (a hash of its draft content, for carry-over), its lines (src, IAST, gloss, en, flags, term hits), notes, and for commentary rows the translation, note, equations and citations. Plus `draftSha`/`weaveSha`, title, summary, questions. Budget: well under 200 KiB; export fails above that. |
| `glossary/<id>` | One doc per entry, with `entrySha` hashing only the reviewer-editable fields and status, so adding source forms doesn't make decisions stale. |
| `decisions/<cp.10>` | Written by the page: `{draftSha, weaveSha, updatedAt, ready, readyAt, progress, answers, sections: {<part>: {base, decision, title/summary \| en{part} \| translation/note, notes[], next}}}`. |
| `glossaryDecisions/<id>` | Written by the page: `{entrySha, decision, fields, edited[]}`. |
| `receipts/<cp.10>`, `receipts/glossary` | Written by Claude after import: `{decisionUpdatedAt, result, pending, redraft, unapproved, problems}`. The page shows "Claude has this ✓" or "Changed since Claude read it". |

**Write discipline:**
- One save queue per doc, at most one write in flight. The first write is `set`; after that, `update` sends whole section objects (no dotted keys, no nested deletes).
- Text edits are debounced 700ms; decision clicks are sent immediately. Pending saves flush on hide.
- Unconfirmed edits are mirrored to localStorage and offered back as "Restore unsaved changes from this device".
- Subscriptions: `meta/text-<slug>`, `glossary`, `decisions`, `glossaryDecisions` and `receipts`, plus only the current `units/<id>`, swapped when the song changes.
- An incoming snapshot never overwrites a section being edited. Instead Lena sees "Changed on another device: keep mine / take theirs".
- **Editing an approved section clears its approval**, as in memoQ and MateCat: an approval covers exactly the text that was approved.
- **After a re-seed with a new draft**, a banner offers "Start review of new draft". Sections whose `base` is unchanged keep their decisions and edits; changed ones reset, with the earlier version shown.

**Sending to Claude:** the page can't wake Claude. "Send to Claude" sets `ready` and shows a copyable prompt ("Pull my Studio decisions for the Charyapada"). An experimental, off-by-default S2 option would fire a session Routine through the `mcp` capability instead.

**UX:**
- **Left rail:**
  - A first-run checklist that disappears when done: source loaded → glossary seeded → style notes → first song reviewed. Steps that need Claude show a copyable prompt, e.g. "Ask Claude: seed the Studio with song 10".
  - Songs, each with status: ✓ approved, "4 of 12" in progress, untouched.
  - Glossary, with a count of terms to decide.
- **Centre, the segment grid for one song:**
  - Each couplet row shows a reference column (Bengali, then IAST, then the literal gloss) beside the English lines. Glossary terms are underlined, and flags show under the line with their "why" collapsed.
  - Editing: click or `E` opens a textarea showing the `[surface]{id}` markup, with a term picker on `Ctrl+G`.
  - Section status: Draft (Claude) / Edited / Approved / Redraft requested.
  - Munidatta's segments sit between couplets, with an editable translation and woven note.
  - "Show changes vs Claude's draft" is a word-level diff toggle.
  - A "needs attention" filter.
- **Right panel tabs:**
  - Glossary: this song's terms, each with approve / reject / defer and editable fields.
  - Questions from the drafter.
  - Song notes.
- **Keyboard:** `Ctrl+Enter` approve and go to next; `Ctrl+Shift+Enter` approve and go to next flagged; `E` edit; `R` redraft with a note; `J`/`K` move; `?` shortcut sheet. No bulk approve.
- **"Why this rendering?":** `sample()` gets the line's source, gloss, draft, flags, the glossary entries in play and Lena's question.
  - It's labelled "Claude's explanation, written now". It's a fresh call, not the drafter's reasoning.
  - The answer is shown with `textContent`, never saved as a decision, and has a Stop button.
- **Status:** never shown by colour alone ("Draft (Claude)", "Edited", "✓ Approved", "↺ Redraft requested"). A live region announces moves.
- **Keyboard:** single-key shortcuts work only while a section has focus. Every action also has a button, for phones.
- **Phone layout:** the song picker sits in a sticky top bar, a sticky bottom action bar (Approve / Edit / Redraft) respects the safe-area inset, and the right panel becomes a full-height sheet. Dark mode comes from the tokens.

**Sync commands (Claude-side):**
- **`studio build [--target staging|prod]`:** reports size (budget 150 KB) and sha.
- **`studio export <text> [units|--all]`:**
  - Writes `translate/.studio/out/<collection>/<id>.json` plus `batch-NNN.json` files: ArtifactData entries of at most 50, using `file_path`. `lib/studio/batches.mjs` is the only place that knows the ArtifactData field names.
  - Only docs whose hash changed against `.studio/seeded.json` go out. Order: glossary, units, receipts, meta last.
- **`studio seeded`:** records the hashes once every batch has succeeded.
- **`studio import <text> [--dry] [units] [--force]`** runs after Claude pulls `decisions` and `glossaryDecisions` with ArtifactData `list` (`out_dir: translate/.studio/inbox`). It:
  1. validates every doc with zod (db content is untrusted);
  2. applies glossary decisions;
  3. accepts each `ready` unit through the shared path, dated `readyAt`;
  4. writes committed audit files `review/<id>.studio.json`;
  5. writes receipts plus refreshed docs to push back.
  - It refuses a unit whose markdown sheet is hand-edited unless `--force`: one review channel per unit.

**First publish:**
1. `studio build --target staging`.
2. Artifact publish with the capabilities above, `icon`, and a description.
3. Record the URL in `studio.json`.
4. `studio export fixture --all`, then the ArtifactData batches, then `studio seeded`.
5. Verify with `get meta/text-fixture`.

Later republishes omit `capabilities` and `icon`, and the database survives them. The prod Studio is published once charyapada has units.

**The shared review model and accept refactor:**
- `lib/review/model.mjs` `reviewModel(slug, id)` returns ordered sections, each with kind, key, part, labels and ref, plus the terms to decide.
  - `sheetBody` becomes a formatter over it, byte-identical to today's output (golden test).
  - `studio export` builds unit docs from the same model.
- `lib/accept.mjs`:
  - `acceptSections(slug, id, {sections, reviewed:{draftSha, weaveSha}, reviewSha, via, date}, {dry, g})` is the core.
  - `acceptSheet` becomes parse → header check → `acceptSections`.
  - `sectionsFromDecision(model, doc)` and `glossarySections(gdocs, g)` map Studio docs onto the same sheet labels, including only the glossary fields that were actually edited.
  - Provenance gains `review.via: "sheet" | "studio"`.
- **Fixes the Studio would otherwise expose:**
  - A redraft requested only on a commentary row routes to a **weave** pack that carries the note. Today any redraft becomes a full-song redraft, and the weave pack ignores feedback.
  - `applyGlossary` doesn't re-stamp approval dates when an entry is already in the target status.
  - The review date is when Lena decided, not the import date.

## R — The Reading Room (second)
Rewrite `lib/render/` on the tokens module and stop borrowing `build/template.html` CSS:
- **Files:** `ctx.mjs`, `shell.mjs`, `css.mjs`, `client.js`, and one module per page.
- **Shared assets:** `translations/assets/reader.css` and `reader.js`, cache-busted with `?v=sha12`.
- **Before first paint:** a tiny inline head script applies the theme, display and commentary settings from localStorage.
- **Kept:** analytics.js, the consent link, canonical/OG/JSON-LD, `sitemap-translations.xml`, the no-JS glossary links (`a.gl[data-g]` + `#gloss-data`, so `check` keeps working), and publishing only approved units.
- **Layout:** each couplet is a `section.passage` grid row, so Munidatta's `aside.sidenote` lines up with its couplet without JS.

**Pages:**
- **Title page** (`index.html`):
  - A framed title block: চর্যাপদ in Tiro Bangla, the English title, alt titles in italic, witnesses on a "·"-dotted line.
  - Imprint: "Translated by Lena Rose with Claude", status "7 of 50 songs published".
  - Summary, contents (Summary · Introduction · Songs · Glossary · About this edition), and a worked sample couplet with its features labelled (the onboarding).
- **Song page:**
  - Three columns: contents rail (songs with first line and poet), a 64ch text column with brick passage numbers in the left margin, and the margin column holding Munidatta aligned to each couplet.
  - The margin number opens a small menu: Copy link · Cite.
  - Glossary terms show a hover preview after 400ms; a click pins the entry in the right panel, Esc closes, and without JS it links to the glossary page.
  - A settings control labelled with its state, "Display: English · Commentary in margin", remembered in localStorage. It offers English / English + Bengali / Interlinear, and commentary margin / inline / hidden.
  - A one-time, dismissible hint by the first glossary term.
  - Below 1100px commentary folds under its couplet; on phones the contents rail becomes a "Contents" button.
- **Glossary page:** A–Z jump, type filter, a live filter box, and per entry: forms with attestation, definition, reading with its source passage, and "Appears in" grouped by song with counts.
- **About this edition:** the process (Claude drafts, Lena reviews every line), sources, licences and witness notes.
- **Search:** a small `search-index.json` over published lines, notes, commentary and glossary, with a "Search this text" box in the rail.
- **Theme and print:** dark mode through the tokens. Print shows everything inline and turns popovers into notes.
- **check:** update the output validations to the new markup.

## Milestones
1. **S1, Studio MVP:**
   - `reviewModel`, `acceptSections` and the three fixes above.
   - Studio schemas (`schemas/studio.mjs`), tokens, build, export, import.
   - UI: rail, grid (read, edit, flags, decisions, commentary rows), Glossary and Questions tabs, autosave, Send to Claude, core keys, and the absent/read-only states.
   - Publish the staging Studio seeded with the fixture.
   - Exit: fx.01 reviewed in the Studio and pulled back; its approved record matches the sheet path's.
2. **S2, Studio polish:**
   - Diff against Claude's draft, "Why this rendering?", the needs-attention filter.
   - Checklist with copyable prompts, redraft carry-over, receipt and staleness banners.
   - localStorage restore, reopening approved songs, shortcut sheet.
   - Publish the prod Studio once charyapada has units.
3. **R1, Reading Room:**
   - Shared tokens, shell and CSS; the title page; the song page with sidenotes and rubricated passage numbers.
   - The glossary panel with hover preview and pinning; the settings control; the passage menu (Copy link · Cite).
   - Glossary page, dark mode, print, updated `check` selectors.
4. **R2:** `search.json` with a `/` search dialog, About this edition, the one-time glossary hint, a restyled texts index, citation formats.

## Verification
- **Refactor:** the 36 existing tests pass unchanged, and a golden test shows `sheetBody(fx.01)` is byte-identical before and after.
- **Round trip:** in scratch home A, the sheet path (approve all, edit 1b). In scratch home B, export, then build decisions with the Studio's own `store.mjs` actions, then import. The approved records must be equal apart from `review.{sheetSha, via, date}`.
- **Import:**
  - Stale decisions are refused; carry-over keeps only sections whose base is unchanged.
  - Partial decisions list what's pending; a redraft on m1 produces a weave pack with the note.
  - Re-importing the same docs changes nothing.
  - A stale `entrySha` is skipped.
- **Export:** docs validate, batches hold at most 50 writes, paths match the grammar, the largest doc is under 200 KiB.
- **Sync against `fake-db`:** writes coalesce, never two in flight per doc, `set` then `update`, one subscription per path.
- **Build:** has `<title>`/`<style>`, the script parses, no `alert`/`confirm`/`print`, only allowlisted hosts, within the size budget, all three theme blocks present.
- **UI:** one Playwright pass on the built Studio with a fake `window.claude` at 390px and 1280px, light and dark, asserting no horizontal scroll. Drive Ctrl+Enter through fx.01, dump the fake db, and check `import --dry` comes back approved.
- **After publishing:** one ArtifactData `list` per collection and one real round trip.
- **Reading Room:**
  - Outline snapshots of the song, title, glossary and about pages; negative `check` fixtures.
  - Playwright screenshots (desktop, phone, dark) with popover and keyboard checks.
  - `check --strict` clean, `node build/build.mjs` output unchanged, all tests green.

## Risks
- **Store semantics I inferred** (nested update merge, the `out_dir` file shape, `list` paging): verify each once with ArtifactData before building the UI.
- **Two devices:** last writer wins per section. The "changed on another device" notice covers it; there's no presence indicator.
- **Re-ingesting identical content changes `draftSha`:** carry-over softens this, but import stays strict.
- **Keyboard inside the Claude app's frame** needs focus first, so there's always a button too.
- **Copyright:** the db never holds `.private` material, and `check`'s overlap guard still runs on anything pasted from a "why" answer.
- **84000:** inspiration only. No copied CSS, marks or imagery, and "not affiliated" stays in the footer.
