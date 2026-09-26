/**
 * How often people who practise ask about a text or its author, from Reddit
 * comment counts via Arctic Shift (arctic-shift.photon-reddit.com, public,
 * no key). It throttles hard and times out on busy terms, so it runs only on
 * the shortlist, only with --reddit, and retries a timed-out query. A term
 * counts only when every subreddit in config.json answered; a partial sum
 * would undercount exactly the names people discuss most.
 */

import { spellings } from './wiki.mjs';

const AS = 'https://arctic-shift.photon-reddit.com/api/comments/search/aggregate';

const fold = s => s.normalize('NFD').replace(/[̀-ͯ­]/g, '');

/**
 * The ASCII spellings a reader would type, most familiar name first:
 * ("Atiśa", "Atīśa Dīpaṃkaraśrījñāna") → Atisa, Atisha. Multi-word catalogue
 * names are skipped; nobody types "Dipamkarasrijnana".
 */
export function typedSpellings(...names) {
  const out = names.filter(Boolean).map(n => n.replace(/\s*\(.*?\)/g, '').trim())
    .filter(n => !/\s/.test(n)).flatMap(spellings).map(fold);
  return [...new Set(out)].filter(t => t.length >= 5).slice(0, 3);
}

export function makeReddit(net, { subreddits, after = '2021-01-01' }) {
  const before = new Date().toISOString().slice(0, 10);
  const memo = new Map();

  async function count(term) {
    const t = fold(term || '').trim();
    if (t.length < 5) return null;
    if (memo.has(t)) return memo.get(t);
    let total = 0;
    for (const sub of subreddits) {
      const qs = new URLSearchParams({ subreddit: sub, body: `"${t}"`, aggregate: 'created_utc', frequency: 'year', after, before });
      const body = await net.get(`${AS}?${qs}`, { ttl: 60, pauseMs: 2500, retries: 6 });
      if (!body?.data) { memo.set(t, null); return null; }
      total += body.data.reduce((s, r) => s + Number(r.count || 0), 0);
    }
    memo.set(t, total);
    return total;
  }

  /** Sum over spellings; null if any spelling could not be measured. */
  return async function mentions(terms) {
    let total = 0;
    for (const t of [].concat(terms)) {
      const n = await count(t);
      if (n == null) return null;
      total += n;
    }
    return total;
  };
}
