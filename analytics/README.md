# Analytics & Search Console setup

How measurement works on 37practices.space, and the one-time setup in Google's tools.

## How it fits together

```
every page ── assets/analytics.js ──> Google Analytics 4 (G-RNEDTE01W6)
              (consent defaults, page context, events)
```

- **`assets/analytics.js`** runs first on every page. It sets Consent Mode v2 defaults
  (analytics off in the EEA/UK/Switzerland until the visitor accepts; ad signals off
  everywhere), loads Google Analytics (`gtag.js`) with the ID in `GA4_ID`, labels every
  event with the kind of page, shows the small consent notice to visitors whose browser
  time zone is in Europe, and provides `track()`.
- **Pages** call `track('event_name', {...})` for the actions worth counting (table below).
  Nothing else needs configuring: the events arrive in GA4 as they are.

Set `GA4_ID` to `''` to switch tracking off completely.

**Google Tag Manager is not used.** The site talks to GA4 directly, so there is nothing
to set up in Tag Manager. `gtm-container.json` is kept only in case the site ever moves
to Tag Manager; importing it while `gtag.js` is still loaded would count everything twice.

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

### 2. (Not needed) Google Tag Manager

Skip it. See above.

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
