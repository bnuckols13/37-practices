#!/usr/bin/env node
/**
 * Opportunity scout: which texts of the Tibetan canon is nobody translating,
 * and which of those would people read?
 *
 *   node translate/scout/scout.mjs [run] [--offline] [--reddit] [--shortlist 150] [--out DIR]
 *   node translate/scout/scout.mjs watch [--since YYYY-MM-DD]
 *
 * run    refresh every source (cached for a week), rank, and write
 *        opportunities.{html,json,csv} to translate/.cache/scout/out/
 * watch  list what 84000 has published since a date and say whether any of it
 *        was on the last ranked list, so a collision is noticed within a week.
 *        This stands in for the partner webhook, which needs registration.
 *
 * Sources and their terms are described in translate/scout/README.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { makeNet } from './lib/net.mjs';
import { ensureDataTei, readCatalog } from './lib/catalog.mjs';
import { fetchPublished } from './lib/published.mjs';
import { makeWiki } from './lib/wiki.mjs';
import { fetchLotsawa, openLibrary } from './lib/elsewhere.mjs';
import { makeReddit, typedSpellings } from './lib/reddit.mjs';
import { availability, graph, score } from './lib/score.mjs';
import { renderReport, toCSV } from './lib/report.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.resolve(process.env.SCOUT_CACHE || path.join(HERE, '..', '.cache', 'scout'));
const readJSON = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const log = s => console.log(s);

const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    offline: { type: 'boolean' }, reddit: { type: 'boolean' }, shortlist: { type: 'string' },
    out: { type: 'string' }, since: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  },
});
const cmd = positionals[0] || 'run';

async function run() {
  const cfg = readJSON(path.join(HERE, 'config.json'));
  const ov = readJSON(path.join(HERE, 'overrides.json'));
  const net = makeNet({ cacheDir: CACHE, offline: o.offline, log });
  const outDir = path.join(CACHE, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  log('1/6 catalogue (84000/data-tei placeholders)');
  const cat = readCatalog(ensureDataTei(CACHE, { offline: o.offline, log }));
  log(`    ${cat.records.length} texts, snapshot ${cat.snapshot.date.slice(0, 10)}`);

  log('2/6 published now (scholar.84000.co Pull API)');
  const { published, total } = await fetchPublished(net);
  log(`    ${published.size} published (API total ${total})`);

  const rows = cat.records.map((r, i) => ({ i, r, avail: availability(r, published, cat.inWork) }));
  const g = graph(cat.records);

  log('3/6 Wikipedia readership (authors, then titles)');
  const wiki = makeWiki(net);
  const names = [...new Set(rows.flatMap(x => x.r.authors))];
  const authors = await wiki.authorPages(names, ov.authorWikipedia || {});
  // A famous name spreads its readers over everything attributed to it:
  // Nāgārjuna's article does not make each of his 121 Tengyur texts famous.
  // "(II)" marks a later namesake, who gets half the credit.
  const nTexts = new Map();
  for (const x of rows) for (const n of x.r.authors) nTexts.set(n, (nTexts.get(n) || 0) + 1);
  for (const x of rows) {
    const best = x.r.authors.filter(n => authors.has(n)).map(n => {
      const a = authors.get(n), namesake = /\(.*\)/.test(n);
      return { name: n, ...a, texts: nTexts.get(n), namesake, perText: a.views / Math.sqrt(nTexts.get(n)) * (namesake ? 0.5 : 1) };
    }).sort((a, b) => b.perText - a.perText)[0];
    if (best) x.author = best;
  }
  const avoid = new Set([...authors.values()].map(a => a.title));
  const titles = await wiki.titlePages(rows.map(x => ({ key: x.r.toh[0], sa: x.r.titles.sa, en: x.r.titles.en, authors: x.r.authors })), ov.titleWikipedia || {}, avoid);
  const shared = new Map();
  for (const t of titles.values()) shared.set(t.title, (shared.get(t.title) || 0) + 1);
  for (const x of rows) {
    const t = titles.get(x.r.toh[0]);
    if (t) x.title = { ...t, shared: shared.get(t.title) };
  }
  log(`    ${authors.size}/${names.length} authors and ${titles.size} titles matched (${wiki.window.label})`);

  log('4/6 already in English elsewhere (Lotsawa House)');
  const lh = await fetchLotsawa(net, { log });
  const checked = ov.translatedElsewhere || {};
  for (const x of rows) {
    const hits = x.r.toh.flatMap(t => lh.byToh.get(t) || []);
    for (const t of x.r.toh) if (checked[t]) hits.push({ source: 'checked by hand', url: '', note: checked[t] });
    if (hits.length) x.elsewhere = hits;
  }
  log(`    ${lh.byToh.size} Toh numbers with a Lotsawa House translation, ${Object.keys(checked).length} checked by hand`);

  score(rows, g, cfg);
  const n = Number(o.shortlist || cfg.shortlist);
  const shortlist = rows.filter(x => x.avail === 'open').sort((a, b) => b.score - a.score).slice(0, n);

  log(`5/6 shortlist of ${shortlist.length}: Open Library${o.reddit ? ' and Reddit' : ''}`);
  const isCommentary = x => g.roots[x.i].size > 0 || /(vṛtti|ṭīkā|pañjikā|bhāṣya|vyākhyā|vivṛti)$/i.test(x.r.titles.sa || '');
  for (const x of shortlist) x.openLibrary = await openLibrary(net, x.r.titles.sa, { isCommentary: isCommentary(x), author: x.r.authors[0] || '' });
  if (o.reddit) {
    const mentions = makeReddit(net, cfg.reddit);
    for (const x of shortlist.slice(0, cfg.reddit.top)) {
      const t = await mentions(x.r.titles.sa);
      // Authors under the spellings people type, from the catalogue name and the Wikipedia title.
      const a = x.author ? await mentions(typedSpellings(x.author.title, x.author.name)) : null;
      if (t != null && (a != null || !x.author)) x.reddit = t + Math.round(0.3 * (a || 0));
    }
  }
  score(rows, g, cfg);

  log('6/6 report');
  const meta = {
    generated: new Date().toISOString(),
    snapshot: cat.snapshot,
    publishedTotal: total,
    wikiWindow: wiki.window.label,
    lotsawaToh: lh.byToh.size,
    checkedByHand: Object.keys(checked).length,
    reddit: Boolean(o.reddit),
    net: net.stats,
    cfg,
  };
  const ranked = rows.slice().sort((a, b) => b.score - a.score || b.demand - a.demand);
  const plain = ranked.map(x => ({
    toh: x.r.toh, label: x.r.label, canon: x.r.canon, file: x.r.file, avail: x.avail, status: x.r.status,
    score: x.score, demand: Math.round(1000 * x.demand) / 1000, gap: x.gap, effort: x.effort,
    titles: x.r.titles, authors: x.r.authors, pages: x.r.pages, folios: x.r.folios, volumes: x.r.volumes,
    section: x.r.section, translatorsEng: x.r.translatorsEng,
    commentaries: [...g.commentaries[x.i]].map(j => rows[j].r.label),
    roots: [...g.roots[x.i]].map(j => ({ label: rows[j].r.label, avail: rows[j].avail })),
    author: x.author || null, wikipedia: x.title || null, elsewhere: x.elsewhere || [], openLibrary: x.openLibrary || null,
    reddit: x.reddit ?? null, tags: x.tags, why: x.why, flags: x.flags,
  }));
  fs.writeFileSync(path.join(outDir, 'opportunities.json'), JSON.stringify({ meta, rows: plain }, null, 1));
  fs.writeFileSync(path.join(outDir, 'opportunities.csv'), toCSV(plain));
  fs.writeFileSync(path.join(outDir, 'opportunities.html'), renderReport(plain, meta));
  if (o.out) {
    fs.mkdirSync(o.out, { recursive: true });
    for (const f of ['opportunities.html', 'opportunities.json', 'opportunities.csv']) fs.copyFileSync(path.join(outDir, f), path.join(o.out, f));
  }
  log(`    wrote ${path.relative(process.cwd(), outDir)}/opportunities.{html,json,csv}${o.out ? ` and copied to ${o.out}` : ''}`);
  log(`    http: ${JSON.stringify(net.stats)}`);
}

async function watch() {
  const net = makeNet({ cacheDir: CACHE, offline: o.offline, log });
  const since = o.since || new Date(Date.now() - 7 * 86400e3).toISOString().slice(0, 10);
  const { published } = await fetchPublished(net, { since });
  const lastPath = path.join(CACHE, 'out', 'opportunities.json');
  const last = fs.existsSync(lastPath) ? readJSON(lastPath).rows.filter(r => r.avail === 'open').slice(0, 300) : [];
  const onList = new Map(last.flatMap((r, k) => r.toh.map(t => [t, k + 1])));
  log(`84000 publications since ${since}: ${published.size}`);
  for (const [toh, p] of published) {
    const rank = onList.get(toh);
    log(`  ${p.date}  ${toh.padEnd(10)} ${p.title}${rank ? `   <- was #${rank} on our list; rerun the scout` : ''}`);
  }
}

const HELP = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*?/, '').replace(/^ \* ?/gm, '');
try {
  if (o.help || cmd === 'help') console.log(HELP);
  else if (cmd === 'run') await run();
  else if (cmd === 'watch') await watch();
  else { console.error(`unknown command "${cmd}"\n${HELP}`); process.exitCode = 1; }
} catch (e) {
  console.error(`scout: ${e.message}`);
  process.exitCode = 1;
}
