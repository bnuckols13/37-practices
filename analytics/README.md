# Analytics & Search Console setup

How measurement works on 37practices.space, and the one-time setup in Google's tools.

## How it fits together

```
every page ── assets/analytics.js ──┬─ MODE 'gtag' ──> Google Analytics 4 (G-RNEDTE01W6)
              (consent defaults,    └─ MODE 'gtm'  ──> Tag Manager (GTM-NTGV6HVQ) ──> GA4
               page context, events)                   + any other tags added later
```

- **`assets/analytics.js`** runs first on every page. It sets Consent Mode v2 defaults
  (analytics off in the EEA/UK/Switzerland until the visitor accepts; ad signals off
  everywhere), labels every event with the kind of page, shows the small consent notice
  to visitors whose browser time zone is in Europe, provides `track()`, and loads Google's
  code according to `MODE`:
  - `'gtag'` (now): GA4 directly through `gtag.js`. Nothing to configure anywhere.
  - `'gtm'` (the target): Google Tag Manager, with GA4 set up inside the container from
    `gtm-container.json`. Tag Manager is then where any future tag goes (heatmaps,
    conversion pixels, ...) without touching the site's code.
- **Pages** call `track('event_name', {...})` for the actions worth counting (table
  below). The same calls work in both modes.

Never run both: switch `MODE` only after the Tag Manager container is **published**
(step 2 below). Until then, Tag Manager would have no GA4 tag and nothing would be recorded.

## One-time setup

### 1. Google Analytics 4 (`G-RNEDTE01W6`)

In **Admin → Data streams → (the web stream) → Enhanced measurement ⚙**:

| Setting | Set to | Why |
|---|---|---|
| Page views → *Page changes based on browser history events* | **Off** | Toolkit tabs and verse switches change the URL hash; the site sends its own `toolkit_tab_view` and `verse_view` instead, so leaving this on double-counts. |
| Scrolls, Outbound clicks, File downloads | On | Outbound clicks show which teachers' sources people follow. |
| Site search | **Off** | The verse search sends its own `search` event. |
| Form interactions | **Off** | It misfires on the AJAX forms; the site sends `form_start` and the submit events itself. |

Then:

- **Admin → Data collection and modification → Data retention** → 14 months.
- **Admin → Data collection** → leave **Google signals off** (the privacy page says there's no ad use).
- **Admin → Events** → once each has fired at least once, mark as **key events**:
  `generate_lead`, `question_submitted`, `contact_email_click`.
- **Admin → Custom definitions → Create custom dimension** (scope: *Event*), one per
  parameter: `page_type`, `verse_number`, `verse_topic`, `block`, `search_term`,
  `commentator`, `translation`, `tab_id`, `cta_id`, `form_id`, `lead_type`, `meeting_format`.
  Name each the same as its parameter. Dimensions only collect data from the day they're created, so do this early.
- To check it works: open the site, then **Reports → Realtime** in GA4. You should appear
  within a minute.

### 2. Google Tag Manager (container `GTM-NTGV6HVQ`)

1. [tagmanager.google.com](https://tagmanager.google.com) → open the `37practices.space` container.
2. **Admin** (top) → **Import Container** → choose `analytics/gtm-container.json` →
   workspace **Existing: Default Workspace** → **Merge** → *Rename conflicting tags,
   triggers and variables* → **Confirm**.
3. **Submit** (top right) → version name `GA4 setup` → **Publish**.
4. Set `MODE = 'gtm'` near the top of `assets/analytics.js`, commit and deploy.
5. Check: open the site and watch **GA4 → Reports → Realtime**, or use **Preview** in Tag Manager.

What the import creates:

| Kind | Name | Details |
|---|---|---|
| Variable | GA4 Measurement ID | Constant `G-RNEDTE01W6` |
| Variables | DLV - *param* | One Data Layer Variable per parameter in the events table |
| Trigger | CE - site events | Custom Event, regex `^(generate_lead\|question_submitted\|form_start\|contact_email_click\|cta_click\|toolkit_tab_view\|verse_view\|search\|commentator_filter\|compare_translations\|copy_text\|print_verses)$` |
| Tag | Google tag - GA4 | Tag ID `{{GA4 Measurement ID}}`; config parameters `page_type`, `verse_number`; fires on *Initialization - All Pages* |
| Tag | GA4 event - site events | Event name `{{Event}}`; every parameter mapped to its DLV; fires on *CE - site events* |

If the import is ever refused, build those five rows by hand in about ten minutes.
In `'gtm'` mode, add any new event parameter to `EVENT_KEYS` in `assets/analytics.js`, to
the GA4 event tag, and (for a new event name) to the trigger regex.

### 3. Google Search Console

1. [search.google.com/search-console](https://search.google.com/search-console) → **Add property** → **Domain** → `37practices.space`.
2. Add the TXT record it shows where the domain's DNS lives. On Vercel that's
   **Domains → 37practices.space → DNS Records → Add** (type TXT, name blank or `@`). With
   another registrar, use their DNS settings instead. Then **Verify**.
   The TXT value is `google-site-verification=ezWgUvxa-FU7xQjHe1WnRZTnd4M-5d5g7dY5NQrmUxI`.
   *Without DNS access:* the homepage also carries that token as a
   `google-site-verification` meta tag, so a **URL prefix** property for
   `https://37practices.space/` can verify with the *HTML tag* method once this is live.
3. **Sitemaps** → submit `sitemap.xml`.
4. In GA4: **Admin → Product links → Search Console links → Link**.
5. Optional: [Bing Webmaster Tools](https://www.bing.com/webmasters) → *Import from Google Search Console*. That also covers DuckDuckGo.

## Events

| Event | Fired when | Parameters | Key event |
|---|---|---|---|
| `generate_lead` | Group registration form sent successfully (toolkit) | `form_id`, `lead_type` = `group_registration`, `meeting_format` | yes |
| `question_submitted` | Q&A question form sent successfully (toolkit) | `form_id` | yes |
| `contact_email_click` | Any `mailto:` link clicked | `link_url` | yes |
| `form_start` | First focus inside either toolkit form | `form_id` | |
| `cta_click` | Any element with `data-cta` clicked | `cta_id`, `link_url` | |
| `toolkit_tab_view` | A toolkit tab chosen | `tab_id` | |
| `verse_view` | A verse opened in Study the Verses (including the first one) | `verse_id`, `verse_number`, `verse_topic`, `block` | |
| `search` | Verse search, 1.5 s after typing stops, 3+ characters | `search_term`, `results` | |
| `commentator_filter` | A commentator chip, *Show all* or *Only Garchen Rinpoche* | `commentator`, `state` | |
| `compare_translations` | *Compare other translations* opened | `verse_id` | |
| `copy_text` | A translation's *Copy* button | `translation`, `verse_id` | |
| `print_verses` | *Print all* (or the browser's print) in Study the Verses | none | |

Every page also sends `page_type` (`home`, `toolkit`, `study`, `verse`, `verse_index`,
`flyer`, `privacy`, `404`) and, on verse pages, `verse_number`.

**Rules for new events:** snake_case names, and register any new parameter as a custom
dimension in GA4 if you want to report on it. Never send names, email addresses or
anything typed into a form (the verse search terms are the one exception, by design).

## AI search (AEO)

- **AI assistant traffic.** GA4's default *AI Assistant* channel (added May 2026) covers
  ChatGPT, Gemini and Claude but not Perplexity. For one complete view, create
  **Admin → Data display → Channel groups → Create new channel group**, add a channel
  *AI assistants* above *Referral* with condition *Source matches regex*
  `(chatgpt|openai|perplexity|gemini|bard|copilot|claude|anthropic|deepseek|mistral|you\.com|phind|meta\.ai)`,
  and save.
- **Crawler access.** `robots.txt` explicitly allows the AI search crawlers (OAI-SearchBot,
  Claude-SearchBot, PerplexityBot and others) and the training crawlers. In Vercel, check
  **Firewall → Bot management** doesn't block AI bots.
- **IndexNow.** After each deploy, `node build/indexnow.mjs` pings Bing, whose index also
  feeds ChatGPT search and Copilot. The key file is the 32-character `.txt` at the root.
- **Bing Webmaster Tools** also reports how often Copilot cites the site (*AI Performance*).

## Good to know

- Vercel preview deployments send analytics too. In GA4 reports, add a filter
  *Hostname = 37practices.space* to leave previews out.
- The consent notice appears only where the browser's time zone is in Europe. Consent Mode's
  own defaults use Google's IP-based region, so if the two disagree the result is still
  "no analytics cookies without a yes".
- Tag links you share with UTM parameters (see the strategy page), e.g.
  `https://37practices.space/verses/12.html?utm_source=gbi&utm_medium=email&utm_campaign=verse-of-the-week`.
