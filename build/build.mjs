#!/usr/bin/env node
/**
 * Study the Verses — build script.
 *
 *   node build/build.mjs
 *
 * Syncs the compendium markdown out of Brian's working folder, parses it into
 * verse records, and writes a single self-contained study-the-verses.html.
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
