/**
 * HTTP for the scout: one User-Agent, a per-host pause, retries, and a disk
 * cache keyed by URL so a rerun (or --offline) never refetches what it has.
 * Every source the scout reads is public and unauthenticated; nothing here
 * sends a key or a cookie.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const UA = 'illuminated-translation-scout/0.1 (+https://37practices.space)';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const lastHit = new Map();
const penalty = new Map();

export function makeNet({ cacheDir, offline = false, ttlDays = 7, log = () => {} }) {
  const dir = path.join(cacheDir, 'http');
  fs.mkdirSync(dir, { recursive: true });
  const stats = { fetched: 0, cached: 0, missed: 0, failed: 0 };

  const fileFor = url => path.join(dir, crypto.createHash('sha256').update(url).digest('hex').slice(0, 32) + '.json');

  async function get(url, { json = true, pauseMs = 250, retries = 4, ttl = ttlDays, init = {} } = {}) {
    const f = fileFor(url);
    if (fs.existsSync(f)) {
      const hit = JSON.parse(fs.readFileSync(f, 'utf8'));
      const age = (Date.now() - Date.parse(hit.fetched)) / 86400e3;
      if (offline || age < ttl) { stats.cached++; return hit.body; }
    }
    if (offline) { stats.missed++; return null; }

    const host = new URL(url).host;
    for (let attempt = 1; attempt <= retries; attempt++) {
      const wait = (lastHit.get(host) || 0) + pauseMs + (penalty.get(host) || 0) - Date.now();
      if (wait > 0) await sleep(wait);
      lastHit.set(host, Date.now());
      try {
        const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers || {}) } });
        if (res.status === 429) {
          // Rate limited: honour Retry-After, and add half a second to every
          // later request to this host, up to five, for the rest of the run.
          const after = Number(res.headers.get('retry-after')) || 5 * attempt;
          penalty.set(host, Math.min(5000, (penalty.get(host) || 0) + 500));
          lastHit.set(host, Date.now() + after * 1000);
          throw new Error('HTTP 429');
        }
        if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
        if (!res.ok) { stats.failed++; log(`  ${res.status} ${url}`); return null; }
        const body = json ? await res.json() : await res.text();
        // Arctic Shift reports overload in a 200 body; treat it as retryable.
        if (json && body && body.error && /timeout|slow down/i.test(body.error)) throw new Error(body.error);
        fs.writeFileSync(f, JSON.stringify({ url, fetched: new Date().toISOString(), body }));
        stats.fetched++;
        return body;
      } catch (e) {
        if (attempt === retries) { stats.failed++; log(`  gave up on ${url}: ${e.message}`); return null; }
        await sleep(pauseMs * 4 * attempt);
      }
    }
    return null;
  }

  return { get, stats };
}
