#!/usr/bin/env node
/**
 * The site's public pages, and sitemap.xml built from them.
 *
 *   node build/sitemap.mjs     rewrite sitemap.xml from the pages in the repo
 *
 * A page is public unless it is 404.html or carries <meta name="robots" content="noindex">.
 * Its address is its <link rel="canonical">, so index.html is listed as the homepage.
 * Nothing to maintain: add or remove an .html page and the sitemap follows. The build
 * calls this after writing the verse pages, and so does the GitHub workflow on every push
 * to main, in case a page was added without running the build.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE = 'https://37practices.space';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['', 'verses'];

// Homepage first, then the other top-level pages, then the verse index and the verses
// in reading order (homage, 1–37, colophon).
function rank(file) {
  if (file === 'index.html') return [0, 0, ''];
  if (!file.startsWith('verses/')) return [1, 0, file];
  const name = file.slice('verses/'.length, -'.html'.length);
  if (name === 'index') return [2, -2, ''];
  if (name === 'homage') return [2, -1, ''];
  if (name === 'colophon') return [2, 999, ''];
  return [2, Number(name) || 500, name];
}
function byRank(a, b) {
  const x = rank(a.file), y = rank(b.file);
  return x[0] - y[0] || x[1] - y[1] || (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : 0);
}

/** Every public page as { file, url }, where file is relative to the site root. */
export function publicPages(root = ROOT) {
  const pages = [];
  for (const dir of DIRS) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs)) {
      if (!name.endsWith('.html') || name === '404.html') continue;
      const file = dir ? `${dir}/${name}` : name;
      const html = fs.readFileSync(path.join(root, file), 'utf8');
      if (/<meta\s+name=["']robots["'][^>]*noindex/i.test(html)) continue;
      const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
      pages.push({ file, url: canonical ? canonical[1] : `${SITE}/${file}` });
    }
  }
  return pages.sort(byRank);
}

/** Write sitemap.xml. No <lastmod>: a date that changes on every build teaches crawlers to ignore it. */
export function writeSitemap(root = ROOT) {
  const pages = publicPages(root);
  fs.writeFileSync(path.join(root, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + pages.map(p => `  <url><loc>${p.url}</loc></url>`).join('\n') + '\n</urlset>\n', 'utf8');
  return pages.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`wrote sitemap.xml (${writeSitemap()} URLs)`);
}
