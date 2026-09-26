#!/usr/bin/env node
/**
 * Tell Bing (and the other IndexNow engines) that pages changed, so they recrawl
 * within minutes instead of weeks. Bing's index also feeds ChatGPT search and Copilot.
 *
 *   node build/indexnow.mjs              every URL in sitemap.xml
 *   node build/indexnow.mjs verses/12.html toolkit.html   just these pages
 *
 * Run it after a deploy is live, not before: the engines fetch the pages straight away.
 * The key is the <32 hex chars>.txt file at the site root; it must stay deployed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = '37practices.space';

const keyFile = fs.readdirSync(ROOT).find(f => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) { console.error('No IndexNow key file (<32 hex chars>.txt) at the site root.'); process.exit(1); }
const key = keyFile.slice(0, -4);

const args = process.argv.slice(2);
const urlList = args.length
  ? args.map(p => `https://${HOST}/${p.replace(/^\/+/, '')}`)
  : [...fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${keyFile}`, urlList })
});

// 200 and 202 both mean accepted; 403 means the key file isn't live yet.
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} URL(s)`);
if (res.status >= 400) process.exit(1);
