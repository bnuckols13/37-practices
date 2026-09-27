/**
 * render: approved units -> the Reading Room under translations/<text>/
 * (title page, song pages, glossary, about, search.json), the shared
 * translations/assets/reader.{css,js}, translations/index.html and
 * sitemap-translations.xml. Only approved units are published; --preview
 * renders drafts too, into translate/.preview/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { paths, readJSON, writeText, readText, exists, home, siteRoot, nfc, fail, sha256, short, config, ENGINE } from '../io.mjs';
import { loadText, unitsIndex, loadUnit, allTexts } from '../text.mjs';
import { load, byId } from '../glossary.mjs';
import { songPage, titlePage, glossaryPage, aboutPage, textsIndexPage } from './pages.mjs';
import { makeCtx, searchIndex, fileOf } from './ctx.mjs';
import { READER_CSS } from './css.mjs';
import { READER_JS } from './client.mjs';
import { site } from './shell.mjs';

/** The sung version beside a record: approved if current; the draft only in preview. */
function sungOf(P, u, preview) {
  const a = readJSON(P.approvedSung(u.id), null);
  if (a && a.sourceSha === u.sourceSha) return { ...a, status: 'approved' };
  if (!preview) return null;
  const s = readJSON(P.sung(u.id), null);
  return s && s.provenance.sourceSha === u.sourceSha ? { ...s, status: 'draft' } : null;
}

function records(slug, units, preview) {
  const P = paths(slug);
  const out = new Map();
  for (const u of units) {
    const sung = sungOf(P, u, preview);
    const a = readJSON(P.approvedFile(u.id), null);
    if (a && a.sourceSha === u.sourceSha) { out.set(u.id, { ...a, status: 'approved', sung }); continue; }
    if (a && !preview) fail(`${u.id}: the approved text is stale (the source changed after approval); redraft and review before rendering`);
    if (!preview) continue;
    const d = readJSON(P.draft(u.id), null);
    if (!d) continue;
    const w = readJSON(P.weave(u.id), null);
    out.set(u.id, {
      unit: u.id, n: u.n, title: d.title, summary: d.summary, status: 'draft', provenance: { draft: d.provenance }, sung,
      lines: d.lines.map(l => ({ id: l.id, en: l.en, gloss: l.gloss, translit: l.translit })),
      notes: d.notes,
      commentary: u.commentary.map(s => {
        const ws = w?.segments.find(x => x.id === s.id);
        return { id: s.id, anchor: s.anchor, translit: ws?.translit || s.translit, translation: ws?.translation || '', note: ws?.note || '', citations: ws?.citations || [] };
      }).filter(c => c.translation || c.note),
    });
  }
  return out;
}

const FONTS = path.join(ENGINE, 'assets', 'fonts');
const write = (files, p, html) => { writeText(p, nfc(html)); files.push(p); };

export function render(slug, { preview = false } = {}) {
  const text = loadText(slug);
  const idx = unitsIndex(slug);
  const units = idx.units.map(u => loadUnit(slug, u.id));
  const recs = records(slug, units, preview);
  const entries = byId(load());
  const root = preview ? path.join(home(), '.preview') : siteRoot();
  const outDir = path.join(root, text.publish.dir);
  const files = [];

  if (!recs.size && !preview) return { files, note: 'nothing approved yet: accept a reviewed sheet first (or use --preview to see drafts)' };

  // Shared assets, cache-busted by content: every page links reader.css?v=<sha>.
  const v = short(sha256(READER_CSS + READER_JS));
  const assetDir = path.join(root, 'translations', 'assets');
  write(files, path.join(assetDir, 'reader.css'), READER_CSS);
  write(files, path.join(assetDir, 'reader.js'), READER_JS);
  // Self-hosted type (see translate/assets/fonts/README.md), with its licence.
  fs.mkdirSync(path.join(assetDir, 'fonts'), { recursive: true });
  for (const f of fs.readdirSync(FONTS).filter(f => /\.woff2$|^OFL\.txt$/.test(f))) {
    fs.copyFileSync(path.join(FONTS, f), path.join(assetDir, 'fonts', f));
    files.push(path.join(assetDir, 'fonts', f));
  }

  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (/\.html$|^search\.json$/.test(f)) fs.unlinkSync(path.join(outDir, f));

  const ctx = makeCtx({ text, units, records: recs, entries, preview });
  const ordered = [...recs.values()].sort((a, b) => a.n - b.n);
  ordered.forEach((r, i) => write(files, path.join(outDir, fileOf(text, r.n)), songPage(ctx, r, ordered[i - 1], ordered[i + 1], v)));
  write(files, path.join(outDir, 'index.html'), titlePage(ctx, v));
  write(files, path.join(outDir, 'glossary.html'), glossaryPage(ctx, v));
  write(files, path.join(outDir, 'about.html'), aboutPage(ctx, v));
  write(files, path.join(outDir, 'search.json'), JSON.stringify(searchIndex(ctx)) + '\n');

  // Texts index: every text with something published (just this one in preview).
  const list = (preview ? [slug] : allTexts()).map(s => {
    const t = loadText(s);
    const ids = unitsIndex(s).units;
    const published = ids.filter(u => exists(paths(s).approvedFile(u.id))).length;
    return { text: t, published: preview ? recs.size : published, total: t.catalog.total || ids.length,
      imprint: t.publish.imprint || `Translated by ${config().reviewer || 'the reviewer'} with Claude` };
  }).filter(x => x.published);
  write(files, path.join(root, 'translations', 'index.html'), textsIndexPage(list, v));

  if (!preview) {
    const urls = [];
    const walk = dir => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (f.name.endsWith('.html')) urls.push(`${site()}/${path.relative(root, p).split(path.sep).join('/')}`);
      }
    };
    walk(path.join(root, 'translations'));
    const sm = path.join(root, 'sitemap-translations.xml');
    writeText(sm, '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n') + '\n</urlset>\n');
    files.push(sm);
    const robots = path.join(root, 'robots.txt');
    const line = `Sitemap: ${site()}/sitemap-translations.xml`;
    if (exists(robots) && !readText(robots).includes(line)) {
      writeText(robots, readText(robots).replace(/\n*$/, '\n') + line + '\n');
      files.push(robots);
    }
  }
  return { files, note: preview ? `preview: open ${path.join(outDir, 'index.html')}` : '' };
}
