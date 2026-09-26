/**
 * Is it already in English somewhere else? 84000's status only says whether
 * 84000 has done a text; most of the famous Indian treatises are "not
 * started" there and have had English translations for decades. Three checks:
 *
 * Lotsawa House publishes free translations and usually names the Toh
 * number in each listing's blurb, so its Indian-masters and
 * Words-of-the-Buddha index pages give a list of Toh numbers already
 * translated there.
 *
 * Open Library's search is a rougher check for books: English-language
 * editions found under the text's core Sanskrit title. It runs only on the
 * shortlist, and a hit is reported for a human to confirm.
 *
 * overrides.json `translatedElsewhere` holds what a person has checked.
 */

import { coreTitles, isGeneric } from './wiki.mjs';

const LH = 'https://www.lotsawahouse.org';
const OL = 'https://openlibrary.org/search.json';

const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export async function fetchLotsawa(net, { log = () => {} } = {}) {
  const index = await net.get(`${LH}/indian-masters/`, { json: false, ttl: 30, pauseMs: 700 });
  if (!index) { log('  Lotsawa House unreachable; skipping'); return { byToh: new Map(), masters: [] }; }
  const slugs = [...new Set([...index.matchAll(/href="\/indian-masters\/([a-z0-9-]+)\/"/g)].map(m => m[1]))];
  const lists = [...slugs.map(s => `/indian-masters/${s}/`), '/words-of-the-buddha/'];

  const byToh = new Map();
  const masters = [];
  for (const list of lists) {
    const html = await net.get(LH + list, { json: false, ttl: 30, pauseMs: 700 });
    if (!html) continue;
    const scope = list.split('/')[1];
    const entry = new RegExp(`href="(/${scope}/(?:[a-z0-9-]+/)?[a-z0-9-]+)"`, 'g');
    const hits = [...html.matchAll(entry)].filter(m => m[1] !== list.replace(/\/$/, ''));
    let n = 0;
    for (let i = 0; i < hits.length; i++) {
      const chunk = text(html.slice(hits[i].index, hits[i + 1]?.index ?? hits[i].index + 3000));
      const tohs = [...chunk.matchAll(/Toh\.?\s*(\d+[a-z]?)/gi)].map(m => 'toh' + m[1].toLowerCase());
      for (const t of new Set(tohs)) {
        if (!byToh.has(t)) byToh.set(t, []);
        byToh.get(t).push({ source: 'Lotsawa House', url: LH + hits[i][1], note: chunk.slice(0, 160) });
        n++;
      }
    }
    if (scope === 'indian-masters') masters.push({ slug: list.split('/')[2], url: LH + list, tohLinks: n });
  }
  return { byToh, masters };
}

const fold = s => s.normalize('NFD').replace(/[̀-ͯ­]/g, '').toLowerCase();

/**
 * English editions on Open Library under the text's core title. A query that
 * matches hundreds of records is a common word, not a title, and is ignored.
 * A commentary's title contains its root's name, so a commentary is searched
 * only under its full title, and only an edition whose own title carries that
 * title counts.
 */
export async function openLibrary(net, sa, { isCommentary = false, author = '' } = {}) {
  const all = coreTitles(sa);
  const who = fold(author.replace(/\s*\(.*\)/, '')).split(/\s+/)[0] || '';
  // A genre word ("dohakoṣa", "bhāvanākrama") finds other people's books;
  // search it with the author's name, or not at all.
  const cores = (isCommentary ? all.slice(0, 1) : all)
    .map(c => isGeneric(c) ? (who ? `${fold(c)} ${who}` : '') : fold(c))
    .filter(c => c.length >= 8).slice(0, 3);
  for (const q of cores) {
    const qs = new URLSearchParams({ q, fields: 'title,subtitle,language,first_publish_year', limit: '30' });
    const body = await net.get(`${OL}?${qs}`, { ttl: 60, pauseMs: 1000 });
    if (!body?.docs || !body.numFound || body.numFound > 300) continue;
    let eng = body.docs.filter(d => (d.language || []).includes('eng'));
    if (isCommentary) eng = eng.filter(d => fold(`${d.title} ${d.subtitle || ''}`).replace(/\s+/g, '').includes(q.split(' ')[0]));
    if (eng.length) return { query: q, found: body.numFound, english: eng.length, sample: eng.slice(0, 3).map(d => `${d.title} (${d.first_publish_year || 'n.d.'})`) };
  }
  return { query: cores[0] || '', found: 0, english: 0, sample: [] };
}
