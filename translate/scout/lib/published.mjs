/**
 * What 84000 has published right now, from its Partner Pull API
 * (scholar.84000.co/api/publications, public, no key). The placeholder
 * snapshot in data-tei is older than this list, so a text counts as
 * published if either source says so. `since` narrows the pull to new
 * publications, which is how a weekly refresh stands in for the
 * registration-only publication.created webhook.
 */

import { normToh } from './catalog.mjs';

export const PUBLICATIONS = 'https://scholar.84000.co/api/publications';

export async function fetchPublished(net, { since } = {}) {
  const out = new Map();
  let total = null;
  for (let offset = 0; ; offset += 500) {
    const qs = new URLSearchParams({ limit: '500', offset: String(offset) });
    if (since) qs.set('since', since);
    const body = await net.get(`${PUBLICATIONS}?${qs}`, { ttl: 1 });
    if (!body?.data) break;
    total = body.pagination?.total ?? total;
    for (const p of body.data) {
      out.set(normToh(p.toh), {
        title: p.title,
        date: String(p.publication_date || '').slice(0, 10),
        pages: p.num_pages,
        section: p.canon_section,
        pdf: p.assets?.pdf || '',
      });
    }
    if (!body.pagination?.has_more) break;
  }
  return { published: out, total };
}
