#!/usr/bin/env node
/**
 * Tell Bing (and the other IndexNow engines) that pages changed, so they recrawl
 * within minutes instead of weeks. Bing's index also feeds ChatGPT search and Copilot.
 *
 *   node build/indexnow.mjs                      every public page
 *   node build/indexnow.mjs verses/12.html ...   just these pages (non-public ones are skipped)
 *   node build/indexnow.mjs --wait ...           first wait until the live site serves these
 *                                                files as they are in the repo (up to 10 min)
 *   node build/indexnow.mjs --dry-run ...        print what would be sent, send nothing
 *
 * The GitHub workflow .github/workflows/search-engines.yml runs this with --wait on every
 * push to main, so nobody has to remember. The key is the <32 hex chars>.txt file at the
 * site root; it must stay deployed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicPages } from './sitemap.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = '37practices.space';
const WAIT_MS = 10 * 60 * 1000;
const POLL_MS = 20 * 1000;

const keyFile = fs.readdirSync(ROOT).find(f => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) { console.error('No IndexNow key file (<32 hex chars>.txt) at the site root.'); process.exit(1); }
const key = keyFile.slice(0, -4);

const flags = process.argv.slice(2).filter(a => a.startsWith('--'));
const files = process.argv.slice(2).filter(a => !a.startsWith('--')).map(f => f.replace(/^\.?\/+/, ''));
const wait = flags.includes('--wait');
const dryRun = flags.includes('--dry-run');

const pages = publicPages(ROOT);
const targets = files.length ? pages.filter(p => files.includes(p.file)) : pages;
if (!targets.length) { console.log('IndexNow: no public pages among', files.join(' ') || '(none)', '— nothing to send.'); process.exit(0); }

// Wait for the deploy: the live copy of each (up to five) changed page must match the repo.
if (wait && !dryRun) {
  const sample = targets.slice(0, 5);
  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    const pending = [];
    for (const p of sample) {
      try {
        const res = await fetch(p.url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
        const live = res.ok ? await res.text() : '';
        if (live.trim() !== fs.readFileSync(path.join(ROOT, p.file), 'utf8').trim()) pending.push(p.url);
      } catch (e) { pending.push(p.url); }
    }
    if (!pending.length) { console.log('Deploy is live.'); break; }
    if (Date.now() > deadline) { console.warn(`Still not live after 10 minutes (${pending.join(', ')}); sending anyway.`); break; }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
}

const urlList = targets.map(p => p.url);
if (dryRun) { console.log(`IndexNow (dry run): would send ${urlList.length} URL(s):\n  ${urlList.join('\n  ')}`); process.exit(0); }

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${keyFile}`, urlList })
});

// 200 and 202 both mean accepted; 403 means the key file isn't live yet.
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} URL(s)`);
if (res.status >= 400) process.exit(1);
