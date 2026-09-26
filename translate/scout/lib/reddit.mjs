/**
 * How often people who practise ask about a text or its author, from Reddit
 * comment counts via Arctic Shift (arctic-shift.photon-reddit.com, public,
 * no key). It throttles hard, so it runs only on the shortlist and only
 * with --reddit. Counts are comments containing the term since 2021 across
 * the practice subreddits in config.json.
 */

const AS = 'https://arctic-shift.photon-reddit.com/api/comments/search/aggregate';

const fold = s => s.normalize('NFD').replace(/[̀-ͯ­]/g, '');

export function makeReddit(net, { subreddits, after = '2021-01-01' }) {
  const before = new Date().toISOString().slice(0, 10);
  const memo = new Map();
  return async function mentions(term) {
    const t = fold(term || '').trim();
    if (t.length < 5) return null;
    if (memo.has(t)) return memo.get(t);
    let total = 0, ok = false;
    for (const sub of subreddits) {
      const qs = new URLSearchParams({ subreddit: sub, body: `"${t}"`, aggregate: 'created_utc', frequency: 'year', after, before });
      const body = await net.get(`${AS}?${qs}`, { ttl: 60, pauseMs: 2500, retries: 4 });
      if (!body?.data) continue;
      ok = true;
      total += body.data.reduce((s, r) => s + Number(r.count || 0), 0);
    }
    const v = ok ? total : null;
    memo.set(t, v);
    return v;
  };
}
