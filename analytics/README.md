# Analytics & Search Console setup

How measurement works on 37practices.space, and the one-time setup in Google's tools.

## How it fits together

```
every page ── assets/analytics.js ──> dataLayer ──> Google Tag Manager ──> Google Analytics 4
              (consent defaults,                     (container in
               page context, events)                  gtm-container.json)
```

- **`assets/analytics.js`** runs first on every page. It sets Consent Mode v2 defaults
  (analytics off in the EEA/UK/Switzerland until the visitor accepts; ad signals off
  everywhere), tells GTM which kind of page this is, loads GTM, shows the small consent
  notice to visitors whose browser time zone is in Europe, and provides `track()`.
- **Pages** call `track('event_name', {...})` for the actions worth counting (table below).
- **GTM** turns those events into GA4 events. The GA4 Measurement ID (`G-RNEDTE01W6`)
  lives only in GTM. The site code only needs the GTM container ID (`GTM-NTGV6HVQ`, set as
  `GTM_ID` near the top of `assets/analytics.js`).

Until a container version is **published** in GTM, `gtm.js` loads but does nothing, so
nothing is recorded yet. Set `GTM_ID` back to `'GTM-XXXXXXX'` to switch tracking off completely.

## One-time setup

### 1. Google Analytics 4 (done: `G-RNEDTE01W6`)

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

### 2. Google Tag Manager (container `GTM-NTGV6HVQ`)

1. Container created. Ignore the install-code popup: the site already loads GTM.
2. **Admin → Import Container** → choose `analytics/gtm-container.json` →
   workspace **Existing: Default Workspace** → **Merge** → *Rename conflicting tags, triggers and variables* → Confirm.
3. Check **Variables → GA4 Measurement ID** reads `G-RNEDTE01W6`.
4. Container ID already in `assets/analytics.js`, so nothing to paste.
5. **Preview** → enter `https://37practices.space` → click around (switch verses, open a
   toolkit tab) and confirm *Google tag - GA4* fires on load and *GA4 event - site events*
   fires on each action. In GA4, **Admin → DebugView** shows the same events live.
6. **Submit** → **Publish**.

What the import creates:

| Kind | Name | Details |
|---|---|---|
| Variable | GA4 Measurement ID | Constant `G-RNEDTE01W6` |
| Variables | DLV - *param* | One Data Layer Variable per parameter in the table below |
| Trigger | CE - site events | Custom Event, regex `^(generate_lead\|question_submitted\|form_start\|contact_email_click\|cta_click\|toolkit_tab_view\|verse_view\|search\|commentator_filter\|compare_translations\|copy_text\|print_verses)$` |
| Tag | Google tag - GA4 | Tag ID `{{GA4 Measurement ID}}`; config parameters `page_type`, `verse_number`; fires on *Initialization - All Pages* |
| Tag | GA4 event - site events | Event name `{{Event}}`; every parameter below mapped to its DLV; fires on *CE - site events* |

If the import is ever refused, build those five rows by hand. It takes about ten minutes.

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

**Rules for new events:** snake_case names; add any new parameter to `EVENT_KEYS` in
`assets/analytics.js` (so it's cleared between events), to the GTM event tag, and to the
trigger regex if it's a new event name. Never send names, email addresses or anything
typed into a form.

## Good to know

- Vercel preview deployments load GTM too. In GA4 reports, add a filter
  *Hostname = 37practices.space* to leave previews out.
- The consent notice appears only where the browser's time zone is in Europe. Consent Mode's
  own defaults use Google's IP-based region, so if the two disagree the result is still
  "no analytics cookies without a yes".
- Tag links you share with UTM parameters (see the strategy page), e.g.
  `https://37practices.space/verses/12.html?utm_source=gbi&utm_medium=email&utm_campaign=verse-of-the-week`.
