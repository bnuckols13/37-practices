#!/usr/bin/env node
/**
 * Study the Verses — build script.
 *
 *   node build/build.mjs
 *
 * Syncs the compendium markdown out of Brian's working folder, parses it into
 * verse records, and writes a single self-contained study-the-verses.html, plus
 * one static page per verse in verses/ and the site's sitemap.xml.
 * Zero npm dependencies, by design: the deployed site stays static files.
 *
 * Override the source folder with COMPENDIUM_DIR=... if it ever moves.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CONTENT = path.join(ROOT, 'content');
const COMPENDIUM_DIR = process.env.COMPENDIUM_DIR
  || 'C:/Users/brian/Practice/37 Practices Group';

const SOURCES = JSON.parse(fs.readFileSync(path.join(HERE, 'sources.json'), 'utf8'));

const problems = [];
const warnings = [];
const fail = m => problems.push(m);
const warn = m => warnings.push(m);

/* ---------------------------------------------------------------- helpers */

function asciiName(file) {
  return file
    .replace(/\.md$/i, '')
    .toLowerCase()
    .replace(/[‒-―−]/g, '-')   // – — ― −
    .replace(/[()]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') + '.md';
}

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// inline markdown -> html: links, bold, italics. Deliberately small.
function inline(s) {
  return esc(s)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

// Split a section into **Label:** blocks. Handles "**HHDL (1974):**".
function splitLabeled(section) {
  const re = /^\*\*([^*\n]+?):\*\*[ \t]*/gm;
  const out = [];
  let m, prev = null;
  while ((m = re.exec(section))) {
    if (prev) prev.body = section.slice(prev.start, m.index).trim();
    const raw = m[1].trim();
    const pm = raw.match(/^(.+?)\s*\(([^)]*)\)$/);
    prev = {
      label: pm ? pm[1].trim() : raw,
      paren: pm ? pm[2].trim() : null,
      start: re.lastIndex
    };
    out.push(prev);
  }
  if (prev) prev.body = section.slice(prev.start).trim();
  return out;
}

// "> line\n>\n> line" -> ["stanza one", "stanza two"]
function parseQuote(body) {
  const stanzas = [[]];
  for (const line of body.split('\n')) {
    if (!line.startsWith('>')) continue;
    const t = line.replace(/^>[ \t]?/, '');
    if (!t.trim()) stanzas.push([]);
    else stanzas[stanzas.length - 1].push(t);
  }
  return stanzas.filter(s => s.length).map(s => s.join('\n'));
}

/* ------------------------------------------------------------------- sync */

function sync() {
  if (!fs.existsSync(COMPENDIUM_DIR)) {
    warn(`Source folder not found (${COMPENDIUM_DIR}); building from content/ as-is.`);
    return;
  }
  fs.mkdirSync(CONTENT, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(COMPENDIUM_DIR)) {
    if (!/^(COMPENDIUM|COMMENTARIES)/i.test(f) || !/\.md$/i.test(f)) continue;
    let dest = asciiName(f);
    if (/master-catalog/.test(dest)) dest = 'commentaries-catalog.md';
    fs.copyFileSync(path.join(COMPENDIUM_DIR, f), path.join(CONTENT, dest));
    n++;
  }
  console.log(`  synced ${n} markdown file(s) -> content/`);
}

/* ------------------------------------------------------------------ parse */

const TRANSLATOR_KEYS = { Garchen: 'garchen', Pearcey: 'pearcey', McLeod: 'mcleod' };

function parseFilled() {
  const verses = new Map();
  const files = fs.existsSync(CONTENT)
    ? fs.readdirSync(CONTENT).filter(f => /^compendium-/.test(f) && !/scaffold/.test(f))
    : [];
  if (!files.length) fail('No filled compendium files found in content/.');

  for (const file of files) {
    const text = fs.readFileSync(path.join(CONTENT, file), 'utf8').replace(/\r\n/g, '\n');
    const parts = text.split(/^(## .+)$/m);

    for (let i = 1; i < parts.length; i += 2) {
      const heading = parts[i].trim();
      const body = parts[i + 1] || '';

      let key = null;
      let topic = '';
      const vm = heading.match(/^## VERSE\s+(\d+)\s*[—–-]\s*(.+)$/);
      if (vm) { key = Number(vm[1]); topic = vm[2].trim(); }
      else if (/^## HOMAGE/i.test(heading)) { key = 'homage'; topic = 'Homage & statement of purpose'; }
      else if (/^## COLOPHON/i.test(heading)) {
        key = 'colophon';
        const cm = heading.match(/^## COLOPHON\s*[—–-]\s*(.+)$/i);
        topic = cm ? cm[1].trim() : 'Closing verses';
      }
      else continue;   // "## Numbering note", "## Quote caveat" -> not verses

      // The heading may carry a parenthetical, e.g.
      // "### Root text (Pearcey; McLeod's rendering at ...)"
      const rootSplit = body.split(/^### Root text([^\n]*)$/m);
      const rootHeadExtra = rootSplit.length > 1 ? rootSplit[1] : '';
      const rootRaw = rootSplit.length > 2 ? (rootSplit[2].split(/^### /m)[0] || '') : '';
      const commRaw = (body.split(/^### Commentaries[^\n]*$/m)[1] || '').split(/^### /m)[0] || '';

      // --- root text
      const rootText = [];
      for (const b of splitLabeled(rootRaw)) {
        const tk = TRANSLATOR_KEYS[b.label];
        if (!tk) { warn(`${heading}: unknown translator "${b.label}"`); continue; }
        if (!SOURCES.includeTranslations.includes(tk)) continue;
        const stanzas = parseQuote(b.body || '');
        if (!stanzas.length) fail(`${heading}: translator ${b.label} has no verse text.`);
        rootText.push({ key: tk, stanzas });
      }
      // A section may hold a bare blockquote with no "**Translator:**" label (the
      // colophon does). Attribute it from the heading, defaulting to Pearcey.
      if (!rootText.length) {
        const stanzas = parseQuote(rootRaw);
        if (stanzas.length) {
          let tk = 'pearcey';
          for (const name of Object.keys(TRANSLATOR_KEYS)) {
            if (new RegExp('\\b' + name + '\\b', 'i').test(rootHeadExtra)) {
              tk = TRANSLATOR_KEYS[name];
              break;
            }
          }
          if (SOURCES.includeTranslations.includes(tk)) rootText.push({ key: tk, stanzas });
        }
      }
      rootText.sort((a, b) =>
        SOURCES.includeTranslations.indexOf(a.key) - SOURCES.includeTranslations.indexOf(b.key));

      // --- commentaries
      const commentaries = [];
      let synthesis = null;
      let further = null;
      for (const b of splitLabeled(commRaw)) {
        const label = b.label;
        if (/^Across the commentaries$/i.test(label)) {
          synthesis = inline((b.body || '').trim());
          continue;
        }
        const meta = SOURCES.commentators[label];
        if (!meta) { warn(`${heading}: unknown commentator "${label}"`); continue; }

        const raw = (b.body || '').trim();
        const empty = !raw || /^\*?[….]+\*?$/.test(raw.replace(/\*/g, '').trim());

        // Purchased books are never reproduced — pointer only, regardless of content.
        if (meta.furtherReadingOnly) {
          further = { key: label, name: meta.name, note: meta.note };
          if (!empty) warn(`${heading}: ${label} has body text; suppressed (purchased book).`);
          continue;
        }
        if (empty) continue;
        commentaries.push({ key: label, html: inline(raw) });
      }
      commentaries.sort((a, b) =>
        SOURCES.commentaryOrder.indexOf(a.key) - SOURCES.commentaryOrder.indexOf(b.key));

      const rec = {
        n: key, topic,
        hasText: rootText.length > 0,
        filled: commentaries.length > 0,
        rootText, commentaries, synthesis, further
      };

      // A verse may legitimately appear in two files: one holding root text, a later
      // deep-fill holding commentaries. Merge rather than error, so the weekly process
      // can add commentaries on top without anyone editing the root-text file.
      if (verses.has(key)) {
        const ex = verses.get(key);
        const merged = {
          n: key,
          topic: (rec.filled ? rec.topic : ex.filled ? ex.topic : rec.topic || ex.topic),
          rootText: rec.rootText.length >= ex.rootText.length ? rec.rootText : ex.rootText,
          commentaries: rec.commentaries.length ? rec.commentaries : ex.commentaries,
          synthesis: rec.synthesis || ex.synthesis,
          further: rec.further || ex.further
        };
        merged.hasText = merged.rootText.length > 0;
        merged.filled = merged.commentaries.length > 0;
        verses.set(key, merged);
        warn(`Verse ${key} appears in more than one file — merged.`);
      } else {
        verses.set(key, rec);
      }
    }
  }
  return verses;
}

// Scaffold: topics live in block bullets, formats vary per block.
function parseScaffold() {
  const f = path.join(CONTENT, 'compendium-verses-8-37-scaffold.md');
  const topics = new Map();
  if (!fs.existsSync(f)) { warn('Scaffold file not found; stubs will have no topic.'); return topics; }
  const text = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  for (let line of text.split('\n')) {
    if (!/^\s*[-*]\s/.test(line)) continue;
    line = line.replace(/^\s*[-*]\s+/, '');
    if (/^\*\*/.test(line)) continue;                 // source-pointer lines
    for (let chunk of line.split(' · ')) {
      const m = chunk.trim().match(/^v(\d+)\s*(?:[—–-]\s*)?(.+)$/i);
      if (!m) continue;
      const n = Number(m[1]);
      let t = m[2].replace(/\*+/g, '').trim().replace(/[.;]+$/, '');
      if (t && !topics.has(n)) topics.set(n, t.charAt(0).toUpperCase() + t.slice(1));
    }
  }
  return topics;
}

/* ----------------------------------------------------------------- assemble */

function assemble() {
  const filled = parseFilled();
  const stubTopics = parseScaffold();
  const out = [];

  for (const block of SOURCES.blocks) {
    for (const v of block.verses) {
      const rec = filled.get(v);
      if (rec) {
        rec.block = block.slug;
        rec.blockTitle = block.title;
        out.push(rec);
      } else {
        out.push({
          n: v, topic: stubTopics.get(v) || '', filled: false, hasText: false,
          block: block.slug, blockTitle: block.title,
          rootText: [], commentaries: [], synthesis: null, further: null
        });
      }
    }
  }

  // --- assertions
  const nums = out.filter(v => typeof v.n === 'number').map(v => v.n);
  for (let i = 1; i <= 37; i++) {
    if (!nums.includes(i)) fail(`Verse ${i} missing from the block taxonomy.`);
  }
  if (!out.some(v => v.n === 'homage')) fail('Homage missing.');

  // Translations must appear in the configured order. Not every section carries all
  // three (the colophon has only Pearcey), so check relative order, not the first slot.
  for (const v of out.filter(v => v.hasText)) {
    const got = v.rootText.map(r => r.key);
    const want = SOURCES.includeTranslations.filter(k => got.includes(k));
    if (got.join(',') !== want.join(','))
      fail(`Verse ${v.n}: translations out of order (${got.join(',')}; expected ${want.join(',')}).`);
  }

  for (const v of out.filter(v => v.filled)) {
    if (!v.hasText) fail(`Verse ${v.n}: has commentaries but no root text.`);
    // Garchen Rinpoche leads wherever he comments. He has no colophon entry.
    if (v.commentaries.some(c => c.key === 'GR') && v.commentaries[0].key !== 'GR')
      fail(`Verse ${v.n}: Garchen Rinpoche is not first (got ${v.commentaries[0].key}).`);
    for (const c of v.commentaries) {
      const meta = SOURCES.commentators[c.key];
      if (!meta || !meta.url)
        fail(`Verse ${v.n}: commentator ${c.key} resolves to no source URL. An unlinked entry is a bug.`);
    }
    if (/Dilgo|Heart of Compassion/i.test(JSON.stringify(v.commentaries)))
      warn(`Verse ${v.n}: mentions Dilgo Khyentse inside a commentary entry — check it quotes no book text.`);
  }
  return out;
}

/* ------------------------------------------------------------------ render */

function render(verses) {
  const tplPath = path.join(HERE, 'template.html');
  let tpl = fs.readFileSync(tplPath, 'utf8');

  const payload = {
    verses,
    translations: SOURCES.translations,
    commentators: SOURCES.commentators,
    commentaryOrder: SOURCES.commentaryOrder,
    includeTranslations: SOURCES.includeTranslations,
    blocks: SOURCES.blocks,
    standingSources: SOURCES.standingSources
  };

  const built = new Date().toISOString().slice(0, 10);
  const filledCount = verses.filter(v => v.filled).length;
  const textCount = verses.filter(v => v.hasText).length;

  tpl = tpl
    .replace('/*{{VERSE_DATA}}*/', JSON.stringify(payload))
    .replace(/\{\{BUILD_DATE\}\}/g, built)
    .replace(/\{\{FILLED_COUNT\}\}/g, String(filledCount))
    .replace(/\{\{TEXT_COUNT\}\}/g, String(textCount))
    .replace(/\{\{TOTAL_COUNT\}\}/g, String(verses.length));

  const dest = path.join(ROOT, 'study-the-verses.html');
  fs.writeFileSync(dest, tpl, 'utf8');
  return { dest, filledCount, textCount, total: verses.length };
}

/* ------------------------------------------------------------- verse pages */
// One static, indexable page per verse, so search engines (and shared links) can
// reach each verse on its own URL. The markup mirrors verseHTML() in template.html,
// minus the interactive parts: change the two together.

const SITE = 'https://37practices.space';
const FONTS = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Cinzel:wght@400;600&family=Lato:wght@300;400;700&display=swap';
const STATIC_PAGES = ['', 'toolkit.html', 'study-the-verses.html', 'flyer.html'];
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

const isNum = v => typeof v.n === 'number';
const fileOf = v => String(v.n) + '.html';                  // 12 -> 12.html, homage -> homage.html
const labelOf = v => isNum(v) ? 'Verse ' + v.n : String(v.n).charAt(0).toUpperCase() + String(v.n).slice(1);
const headingOf = v => isNum(v) ? `${labelOf(v)}: ${v.topic || ''}`.replace(/: $/, '') : (v.topic || labelOf(v));
const words = n => NUMBER_WORDS[n] || String(n);
const plain = html => String(html).replace(/<[^>]+>/g, '')
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attr = s => esc(s).replace(/"/g, '&quot;');
const jsonLd = o => JSON.stringify(o).replace(/</g, '\\u003c');

function clip(s, max) {
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return s.slice(0, s.lastIndexOf(' ', max - 1)).replace(/[,;:.\s]+$/, '') + '…';
}

const SHORT_NAMES = { HHDL: 'the Dalai Lama' };

// "Verse 12: When robbed: dedicate everything. Commentary from seven teachers,
//  including Garchen Rinpoche and the Dalai Lama, and the root text in three translations."
function describeVerse(v) {
  const names = v.commentaries.map(c => SHORT_NAMES[c.key] || SOURCES.commentators[c.key].name);
  const head = headingOf(v) + '.';
  if (!v.hasText) return clip(`${head} From the 37 Practices of a Bodhisattva by Gyalse Tokme Zangpo.`, 160);
  const k = v.rootText.length;
  const text = `the root text in ${words(k)} translation${k > 1 ? 's' : ''}`;
  let who = '';
  if (names.length > 2) who = `Commentary from ${words(names.length)} teachers, including ${names[0]} and ${names[1]}`;
  else if (names.length) who = `Commentary from ${names.join(' and ')}`;
  const full = who ? `${head} ${who}, and ${text}.` : `${head} The 37 Practices of a Bodhisattva: ${text}.`;
  return full.length <= 160 ? full : clip(who ? `${head} ${who}.` : full, 160);
}

function transHTML(rt, isPrimary) {
  const meta = SOURCES.translations[rt.key];
  if (!meta) return '';
  const lic = meta.licenseUrl
    ? `<a href="${meta.licenseUrl}" target="_blank" rel="noopener">${meta.license}</a>`
    : meta.license;
  return `<div class="trans${isPrimary ? ' primary' : ''}">`
    + `<div class="who">${meta.label}</div>`
    + `<div class="sub">${meta.sublabel ? meta.sublabel + ' · ' : ''}${lic}`
    + (meta.url ? ` · <a href="${meta.url}" target="_blank" rel="noopener">source</a>` : '')
    + '</div>' + rt.stanzas.map(s => `<p>${s}</p>`).join('') + '</div>';
}

function commHTML(c) {
  const meta = SOURCES.commentators[c.key];
  if (!meta) return '';
  return '<div class="comm">'
    + `<div class="who"><span class="name">${meta.name}</span>`
    + (meta.lineage ? `<span class="lineage">${meta.lineage}</span>` : '')
    + (meta.url ? `<span class="src"><a href="${meta.url}" target="_blank" rel="noopener">source ↗</a></span>` : '')
    + '</div>'
    + (meta.urlNote ? `<div class="tnote">${meta.urlNote}</div>` : '')
    + `<p>${c.html}</p></div>`;
}

function verseBody(v) {
  const pos = isNum(v) ? `Verse ${v.n} of 37` : (v.n === 'homage' ? 'Opening' : 'Closing');
  const browser = `../study-the-verses.html#${isNum(v) ? 'v' + v.n : v.n}`;
  let h = `<div class="vhead"><div class="eyebrow">${v.blockTitle} <span class="pos">· ${pos}</span></div>`
    + `<h1>${headingOf(v)}</h1><div class="rule"></div>`
    + `<a class="share" href="${browser}" data-cta="verse_open_browser">Open in the study browser →</a></div>`;

  const links = SOURCES.standingSources.links
    .map(l => `<li><a href="${l.url}" target="_blank" rel="noopener">${l.label}</a></li>`).join('');

  if (!v.hasText) {
    return h + '<div class="stub"><div class="label">Not yet added</div>'
      + '<p>This verse hasn\'t been brought in yet. These sources carry it:</p>'
      + `<ul>${links}</ul></div>`;
  }

  h += '<div class="sec-label">Root text</div>' + transHTML(v.rootText[0], true);
  if (v.rootText.length > 1) {
    h += '<div class="sec-label">Other translations</div>'
      + v.rootText.slice(1).map(r => transHTML(r, false)).join('');
  }

  if (!v.filled) {
    return h + '<div class="stub"><div class="label">Commentaries coming</div>'
      + '<p>The verse itself is here. The commentaries are gathered block by block, ahead of '
      + 'the study group, so this one is still to come. Until then these carry it:</p>'
      + `<ul>${links}</ul></div>`;
  }

  h += '<div class="sec-label">The commentaries</div>' + v.commentaries.map(commHTML).join('');
  if (v.synthesis) {
    h += `<div class="synth"><div class="label">Across the commentaries</div><p>${v.synthesis}</p></div>`;
  }
  if (v.further) {
    h += `<div class="further"><div class="label">Further reading</div><p><strong>${v.further.name}</strong> — ${v.further.note || ''}</p></div>`;
  }
  return h;
}

function verseIndex(verses, current) {
  return SOURCES.blocks.map(b => {
    const items = b.verses.map(n => {
      const v = verses.find(x => String(x.n) === String(n));
      if (!v) return '';
      const cls = 'vlink' + (v.filled ? '' : (v.hasText ? ' textonly' : ' stub')) + (v === current ? ' current' : '');
      return `<a class="${cls}" href="${fileOf(v)}"${v === current ? ' aria-current="page"' : ''}>`
        + `<span class="num">${isNum(v) ? v.n : '—'}</span><span class="t">${v.topic || labelOf(v)}</span></a>`;
    }).join('\n');
    return `<div class="block-label">${b.title}</div>\n${items}`;
  }).join('\n');
}

const PAGE_CSS = `
.masthead .title{font-size:clamp(26px,4.4vw,38px);font-weight:300;margin:0 0 6px;line-height:1.15}
.masthead .title a{color:inherit;text-decoration:none}
.crumbs{font-family:'Lato',sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-top:16px;color:rgba(250,245,236,.55)}
.crumbs a{color:var(--saffron-light);text-decoration:none;margin-right:0}
.crumbs a:hover{color:#fff;text-decoration:underline}
.crumbs .sep{margin:0 8px;color:rgba(250,245,236,.4)}
.vhead h1{font-size:clamp(25px,3.6vw,36px);font-weight:300;color:var(--maroon);line-height:1.2;margin:0 0 13px}
.vhead .share{font-family:'Lato',sans-serif;font-size:10.5px;letter-spacing:1px;text-transform:uppercase;
  color:var(--saffron);text-decoration:none;border-bottom:1px dotted var(--saffron);margin:-12px 0 0;display:inline-block}
.vhead .share:hover{color:var(--maroon);border-bottom-color:var(--maroon)}
.hub-intro{font-size:18px;font-weight:300;color:var(--ink-soft);max-width:62ch;margin:26px 0 8px}
.hub nav{margin-top:30px}
.hub .vlink{font-size:17px;padding:7px 8px}
@media (max-width:900px){ .app .sidebar{order:2;border-bottom:0;border-top:1px solid var(--rule)} }
@media print{ .crumbs,.vhead .share{display:none!important} }
`;

function pageShell({ file, title, description, pageType, verseAttr, ld, crumbs, masthead, body, css }) {
  const url = `${SITE}/verses/${file}`;
  return `<!DOCTYPE html>
<html lang="en" data-page-type="${pageType}"${verseAttr ? ` data-verse="${verseAttr}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="../assets/analytics.js"></script>
<title>${attr(title)}</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="37 Practices of a Bodhisattva">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="37 Practices of a Bodhisattva — sangha study groups">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#4A0F0F">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="../assets/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
<script type="application/ld+json">${jsonLd(ld)}</script>
<link href="${FONTS}" rel="stylesheet">
<style>${css}${PAGE_CSS}</style>
</head>
<body>

<header class="masthead">
  <div class="eyebrow">37 Practices of a Bodhisattva</div>
  ${masthead}
  <nav class="crumbs" aria-label="Breadcrumb">${crumbs}</nav>
</header>

${body}

<section class="invite-band">
  <div class="eyebrow">Read them together</div>
  <h2>These verses open differently in company.</h2>
  <p>Start a small study group and read them with others; a few people and a regular meeting time are enough, and the toolkit walks you through starting one.</p>
  <a class="cta" href="../toolkit.html" data-cta="${pageType}_invite_band">Start a study group</a>
</section>

<footer class="foot">
  <p><strong>On sources.</strong> Commentary summaries and the “Across the commentaries” notes are original prose written for this study group. Short quotations are attributed and linked to their source. Root text translations are reproduced with attribution; see each verse for translator and licence. Dilgo Khyentse Rinpoche’s <em>The Heart of Compassion</em> and other published books appear as further-reading pointers only — no text is reproduced.</p>
  <p>Root text by Gyalse Tokme Zangpo (1295–1369). This is other people’s teaching, gathered — please follow the links and support the teachers and publishers who made it available. · <a href="../index.html">37 Practices Sangha Initiative</a> · <a href="../privacy.html">Privacy</a> · <a href="#" data-consent-open>Cookie choices</a></p>
</footer>
</body>
</html>
`;
}

function breadcrumbLd(id, trail) {
  return {
    '@type': 'BreadcrumbList', '@id': id + '#breadcrumb',
    itemListElement: trail.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item }))
  };
}

function renderVersePages(verses) {
  const tpl = fs.readFileSync(path.join(HERE, 'template.html'), 'utf8');
  const css = (tpl.match(/<style>([\s\S]*?)<\/style>/) || [])[1];
  if (!css) throw new Error('template.html has no <style> block to share with the verse pages.');

  const dir = path.join(ROOT, 'verses');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (/\.html$/.test(f)) fs.unlinkSync(path.join(dir, f));

  const hubUrl = `${SITE}/verses/index.html`;
  const book = { '@type': 'Book', name: 'The Thirty-Seven Practices of Bodhisattvas',
    author: { '@type': 'Person', name: 'Gyalse Tokme Zangpo' } };

  verses.forEach((v, i) => {
    const prev = verses[i - 1], next = verses[i + 1];
    const url = `${SITE}/verses/${fileOf(v)}`;
    const title = `${headingOf(v)} — 37 Practices of a Bodhisattva`;
    const description = describeVerse(v);
    const pager = (prev
      ? `<a href="${fileOf(prev)}"><span class="dir">← Previous</span><span class="t">${labelOf(prev)}${prev.topic ? ' · ' + prev.topic : ''}</span></a>`
      : '<a class="spacer"></a>')
      + (next
      ? `<a class="next" href="${fileOf(next)}"><span class="dir">Next →</span><span class="t">${labelOf(next)}${next.topic ? ' · ' + next.topic : ''}</span></a>`
      : '<a class="spacer"></a>');

    const html = pageShell({
      file: fileOf(v), title, description, pageType: 'verse', verseAttr: String(v.n),
      ld: { '@context': 'https://schema.org', '@graph': [
        { '@type': 'WebPage', '@id': url, url, name: title, description, inLanguage: 'en',
          isPartOf: { '@id': `${SITE}/#website` }, about: book, breadcrumb: { '@id': url + '#breadcrumb' } },
        breadcrumbLd(url, [['Home', `${SITE}/`], ['All verses', hubUrl], [labelOf(v), url]])
      ] },
      crumbs: `<a href="../index.html">Home</a><span class="sep">›</span><a href="index.html">All verses</a><span class="sep">›</span><span>${labelOf(v)}</span>`,
      masthead: '<div class="title"><a href="../study-the-verses.html">Study the Verses</a></div>',
      body: `<div class="app">
  <aside class="sidebar"><nav aria-label="All verses">
${verseIndex(verses, v)}
  </nav></aside>
  <main class="reader">
    <article>${verseBody(v)}</article>
    <nav class="pager" aria-label="Previous and next verse">${pager}</nav>
  </main>
</div>`,
      css
    });
    fs.writeFileSync(path.join(dir, fileOf(v)), html, 'utf8');
  });

  const hubTitle = 'The 37 Practices of a Bodhisattva, Verse by Verse';
  const hubDesc = 'All 37 verses of Gyalse Tokme Zangpo’s text, each with the root text in three translations and commentary from Garchen Rinpoche, the Dalai Lama and others.';
  fs.writeFileSync(path.join(dir, 'index.html'), pageShell({
    file: 'index.html', title: hubTitle, description: hubDesc, pageType: 'verse_index',
    ld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'CollectionPage', '@id': hubUrl, url: hubUrl, name: hubTitle, description: hubDesc,
        inLanguage: 'en', isPartOf: { '@id': `${SITE}/#website` }, about: book,
        breadcrumb: { '@id': hubUrl + '#breadcrumb' } },
      breadcrumbLd(hubUrl, [['Home', `${SITE}/`], ['All verses', hubUrl]])
    ] },
    crumbs: '<a href="../index.html">Home</a><span class="sep">›</span><span>All verses</span>',
    masthead: `<h1>${hubTitle}</h1>
  <p>The root text in three translations, and what the teachers say about each verse. Gathered for study; every entry links to its source.</p>`,
    body: `<main class="reader hub" style="margin:0 auto">
  <p class="hub-intro">Gyalse Tokme Zangpo wrote these thirty-seven verses in the fourteenth century. Each page below carries one verse with its commentaries. To read one teacher straight through, or compare them side by side, use <a href="../study-the-verses.html" data-cta="verse_index_study">the study browser</a>.</p>
  <nav aria-label="All verses">
${verseIndex(verses, null)}
  </nav>
</main>`,
    css
  }), 'utf8');

  // sitemap: no <lastmod>, since a date that changes on every build teaches crawlers to ignore it
  const urls = STATIC_PAGES.map(p => `${SITE}/${p}`)
    .concat(`${SITE}/verses/index.html`, verses.map(v => `${SITE}/verses/${fileOf(v)}`));
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n') + '\n</urlset>\n', 'utf8');

  return { pages: verses.length, urls: urls.length };
}

/* -------------------------------------------------------------------- main */

console.log('Study the Verses — build');
sync();
const verses = assemble();

if (problems.length) {
  console.error('\nBUILD FAILED\n');
  problems.forEach(p => console.error('  x ' + p));
  process.exit(1);
}

const { dest, filledCount, textCount, total } = render(verses);
const versePages = renderVersePages(verses);

// quote spot-check report — these came from web extraction
let quotes = 0;
for (const v of verses) {
  for (const c of v.commentaries) quotes += (c.html.match(/&quot;|"/g) || []).length / 2;
}

console.log(`  ${total} verses · ${textCount} with root text · ${filledCount} with commentaries`);
if (textCount > filledCount)
  console.log(`  ${textCount - filledCount} verse(s) have the text but await commentary deep-fill`);
console.log(`  translations: ${SOURCES.includeTranslations.join(' > ')}`);
console.log(`  ~${Math.round(quotes)} quoted passages — spot-check against sources before publishing`);
if (warnings.length) {
  console.log('\n  warnings:');
  warnings.forEach(w => console.log('    ! ' + w));
}
console.log(`\n  wrote ${path.relative(ROOT, dest)}`);
console.log(`  wrote verses/ (${versePages.pages} verse pages + index)`);
console.log(`  wrote sitemap.xml (${versePages.urls} URLs)`);
