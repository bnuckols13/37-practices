# Handoff — 37practices.space

A briefing for the next agent (or person) picking up this repo. Read this first, then
`README.md`, `build/README.md` and `analytics/README.md`, which hold the details.

*Written 2026-11-06. State at that time: `main` = `c3a9d82`, working tree clean.*

## What this is

A static website for the **37 Practices of a Bodhisattva Sangha Study Group Initiative**:
peer-led study groups on Gyalse Tokme Zangpo's 14th-century text, connected to
**Olga Kornyushyna** (a Ukrainian student of Garchen Rinpoche whose wartime commentary is
being brought into English). The site owner's working name on the site is **Lena**; the
contact email `brianjnuckols@gmail.com` is real and intentional (forms post to it).

- **Live:** https://37practices.space — Vercel deploys `main` automatically, a minute or two after a push.
- **Old address:** `bnuckols13.github.io/37-practices` only redirects; the `gh-pages` branch holds those redirects and nothing else.
- **No framework, no npm dependencies.** Plain HTML/CSS/JS plus a Node (22) build script.

## Map of the repo

| Path | What it is | Hand-edit? |
|---|---|---|
| `index.html` | Homepage: initiative, 10-week format, monthly Q&A with Olga, her book | yes |
| `toolkit.html` | Facilitator toolkit (v2.3): 5 tabs, prayers, curriculum, Olga's closing practices, group-registration and submit-a-question forms (Formsubmit.co AJAX) | yes |
| `flyer.html` | One-page shareable flyer | yes |
| `privacy.html`, `404.html` | Privacy page, branded 404 | yes |
| `study-the-verses.html` | Interactive per-verse commentary browser | **no — generated** |
| `verses/*.html` | One static page per verse + `homage`, `colophon`, `index` | **no — generated** |
| `sitemap.xml`, `llms.txt` | Sitemap, AI-tool site map | **no — generated** |
| `build/build.mjs` | The generator (parse markdown → all generated files) | yes |
| `build/template.html` | Template for `study-the-verses.html`; verse pages copy its CSS and `verseHTML()` markup — change both together | yes |
| `build/sources.json` | Translators/commentators, order, attribution URLs, `includeTranslations` | yes |
| `build/sitemap.mjs`, `build/indexnow.mjs` | Sitemap writer; IndexNow (Bing) pinger | yes |
| `content/*.md` | Compendium markdown (source of truth for verse content in the repo) | yes, or via sync |
| `assets/analytics.js` | Consent Mode v2 + GTM loader + `track()` | yes |
| `analytics/` | GTM container JSON + setup guide | yes |
| `.github/workflows/search-engines.yml` | On push to `main`: refresh sitemap, wait for deploy, ping IndexNow | yes |
| `5b8fddc5f145cca1dddf87629ac409e6.txt` | IndexNow key file — don't delete or rename | no |

## How to rebuild

```bash
node build/build.mjs
```

The build first tries to sync markdown from the owner's local folder
(`C:/Users/brian/Practice/37 Practices Group`, override with `COMPENDIUM_DIR`). In a cloud
container that folder doesn't exist, so it warns and **builds from `content/` as-is** —
that's fine. Edit `content/*.md` directly when working here.

The build **refuses to run** if Garchen isn't the leading translation, Garchen Rinpoche
isn't the first commentator on a filled verse, a commentary has no source URL, or a verse
is missing. Those are deliberate guards — don't weaken them.

## History — what's been done (oldest first)

1. **Apr 2026 — launch.** Initial site on GitHub Pages; 10-week study format; flyer page.
2. **Jun–Jul 2026 — facilitator toolkit.** v2 page, Olga's June 9 edits, tabbed nav + Q&A form (v2.2), Olga's three closing practices from her book (v2.3).
3. **Jul 21–22 2026 — Study the Verses.** Built the compendium browser from the markdown: all 39 records (homage, 1–37, colophon), 3 translations (Garchen Institute, Pearcey, McLeod), 7 commentators (Garchen Rinpoche, Dalai Lama, Berzin, Khenpo Tsultrim Gyamtso, Khenpo Sodargye, Thubten Chodron, McLeod). Verified 204 quotes against sources and fixed 8 misquotes.
4. **Jul 2026 — content changes.** Removed all fundraising content; Q&A cadence → **monthly** everywhere; added group-registration form; visible contact name Brian → **Lena**; reading lists point to the compendium; "start a study group" CTA band; Olga named in the hero.
5. **Sep 26 2026 — analytics, SEO, AEO.** (Moved to Vercel at `37practices.space` around here.)
   - SEO: meta descriptions, canonicals, OG/Twitter cards + share image, favicons, JSON-LD, robots.txt, Search Console verification tag, privacy page, 404.
   - One indexable page per verse, `verses/index.html` with an "About the text" FAQ, sitemap.
   - AEO: AI crawlers explicitly allowed in `robots.txt`, `llms.txt`, entity `sameAs` links (Wikidata, Treasury of Lives, Encyclopedia of Buddhism), citations on verse pages.
   - Analytics: went GTM → direct GA4 → back to **GTM**. Current: `MODE = 'gtm'`, container `GTM-NTGV6HVQ` (imported and published), GA4 `G-RNEDTE01W6` inside it. Events listed in `analytics/README.md`.
   - Automation: `search-engines.yml` workflow + `indexnow.mjs` + `sitemap.mjs`.

## Rules that must hold

- **Licensing:** Pearcey is CC BY-NC (attribute). Garchen booklet and McLeod have no explicit licence (published by owner's decision; ask GBI before wider reprinting). **Dilgo Khyentse / purchased books are never reproduced** — pointer only. Summaries are original prose. To pull a translation fast, remove it from `includeTranslations` in `build/sources.json` and rebuild.
- **Quotes** ≤25 words, attributed, linked, spot-checked before publishing new ones. Every commentary entry links its source.
- The "Across the commentaries" synthesis maps convergence/divergence and asks a question; it never picks a winner.
- **Analytics:** never send names, emails or form contents. New event params go in `EVENT_KEYS` in `analytics.js`, the GTM event tag, and (new event names) the trigger regex.
- Don't run GTM and direct gtag at the same time.

## Open items / possible next work

- **DKR notes slot** per verse (from *The Heart of Compassion*) — only the owner can fill these; they're reading notes, never book text.
- **Thubten Chodron entries for vv8–37** are pointers; could be expanded into summaries from the 2005 Winter Retreat transcripts (thubtenchodron.org).
- **Google-side setup to confirm** (can't be verified from the repo): GA4 enhanced-measurement settings, custom dimensions, key events, Search Console property + sitemap submission, GA4↔Search Console link, Bing Webmaster import, the AI-assistants channel group. Checklist in `analytics/README.md`.
- **Link rot:** if a source dies, try the Wayback Machine, then `content/commentaries-catalog.md` for alternates.
- `content/compendium-process.md` still mentions a "HANDOFF — Compendium to GitHub.md" in the owner's local folder; that handoff is done — this file supersedes it for repo work.

## Working conventions

- Small, clear commits with a descriptive body; push to `main` (or the assigned branch) and Vercel deploys.
- After changing compendium content or the template, run the build and commit the generated files with it.
- Verify visually with Playwright/Chromium if changing layout (pages are static; open them with `file://` or a simple static server).
