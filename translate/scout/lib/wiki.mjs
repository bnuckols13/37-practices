/**
 * English Wikipedia as a demand signal: does an article exist for the author
 * or the text, and how many people read it in the last twelve full months?
 * Names arrive in IAST (Śāntideva, Kṛṣṇa Paṇḍita); Wikipedia titles mostly
 * don't, so each name is tried in several spellings and Wikipedia's own
 * redirects do the matching. A match is kept only when the page's short
 * description reads like a person (for authors) or a work (for titles), so a
 * text called "Mahāmudrā" is not credited with the concept page's readers.
 */

const API = 'https://en.wikipedia.org/w/api.php';
const PV = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user';

const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');

/** IAST name → spellings Wikipedia is likely to use, most exact first. */
export function spellings(name) {
  const n = name.normalize('NFC').trim();
  const sh = n.replace(/[śṣ]/g, 'sh').replace(/[ŚṢ]/g, 'Sh').replace(/ṛ/g, 'ri').replace(/Ṛ/g, 'Ri');
  const ch = sh.replace(/c(?!h)/g, 'ch').replace(/C(?!h)/g, 'Ch');
  return [...new Set([n, strip(n), strip(sh), strip(ch)])].filter(Boolean);
}

/** Author field → candidate names: the whole name, then its long parts. */
export function authorCandidates(author) {
  const base = author.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\bthe (Elder|Younger|Great|Lesser)\b/gi, '').replace(/\s+/g, ' ').trim();
  const whole = spellings(base);
  const parts = base.includes(' ') ? base.split(' ').filter(w => w.length >= 5).flatMap(spellings) : [];
  return { whole, parts };
}

/**
 * Sanskrit title → the forms a reader would know it by. 84000 records the
 * full catalogue title ("Prajñānāmamūlamadhyamakakārikā", "the Mūlamadhyamaka-
 * kārikā called Wisdom"); Wikipedia and book titles use the core, so the
 * candidates also split on "nāma", drop honorific prefixes, and drop a
 * trailing "kārikā" (verses) from a title that is more than that word.
 */
const foldKey = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/** Genre words: a title that is only one of these names a kind of text, not a text. */
export const GENERIC = new Set([
  'stotra', 'stava', 'stuti', 'giti', 'gitika', 'samgiti', 'upadesa', 'prakarana', 'karika', 'vrtti', 'tika', 'panjika',
  'bhasya', 'sadhana', 'vidhi', 'tantra', 'sutra', 'sastra', 'dharani', 'mandala', 'krama', 'dohakosa', 'dohakosagiti',
  'vajragiti', 'caryagiti', 'bhavanakrama', 'mahamudra', 'abhiseka', 'homa', 'puja', 'avavada', 'lekha', 'parikatha',
  'pradipa', 'samgraha', 'mahamudropadesa', 'sadhanopayika', 'stotraraja',
]);
export const isGeneric = s => GENERIC.has(foldKey(s));

export function coreTitles(sa) {
  if (!sa) return [];
  const t = sa.replace(/­/g, '').replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();
  const out = [t];
  const split = t.split(/nāma(?=[a-zāīūṛṝḷṅñṭḍṇśṣṃḥ ]|$)/i).map(s => s.trim());
  if (split.length > 1) out.push(...split.filter(s => s.length >= 8 && !isGeneric(s)).sort((a, b) => b.length - a.length));
  for (const s of [...out]) {
    const bare = s.replace(/^(Ārya|Śrī|Bhagavat|Ācārya)[\s-]?/i, '');
    if (bare !== s && !isGeneric(bare)) out.push(bare);
    const k = s.replace(/kārikā$/i, '');
    if (k !== s && k.length >= 8 && !isGeneric(k)) out.push(k);
  }
  return [...new Set(out.map(s => s.charAt(0).toUpperCase() + s.slice(1)))];
}

/**
 * Candidates for a Wikipedia title match. An anonymous text has no author to
 * confirm the match against, so it is tried under its full title only.
 */
export function titleCandidates(sa, { wholeOnly = false } = {}) {
  const cores = coreTitles(sa);
  return [...new Set((wholeOnly ? cores.slice(0, 1) : cores).flatMap(spellings))].filter(c => c.length >= 8 && !isGeneric(c));
}

/** Does this text name the author? (fold diacritics; match the first five letters of a name part) */
export function mentionsAuthor(text, authors) {
  const f = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/sh/g, 's').replace(/ch/g, 'c').replace(/ri/g, 'r');
  const hay = f(text || '');
  return authors.some(a => a.replace(/\(.*?\)/g, '').split(/\s+/).filter(w => w.length >= 5)
    .some(w => hay.includes(f(w).slice(0, 5))));
}

const PERSON = /philosopher|monk|scholar|master|teacher|poet|siddha|yogi|saint|logician|writer|author|buddhist|king|emperor|physician|grammarian|dramatist|lama|abbot|mystic|tantric/i;
const STRONG_PERSON = /philosopher|monk|scholar|poet|siddha|logician|yogi|master|writer|author|teacher/i;
const NOT_PERSON = /deity|\bgod\b|goddess|bodhisattva|future buddha|language|people|region|city|river|concept|practice|school|text|sutra|tantra$|disambiguation/i;
const WORK = /text|sutra|sūtra|treatise|poem|poetry|scripture|work|song|commentary|book|verses|epistle|letter|hymn|stotra|collection|compendium|tantra|shastra|śāstra/i;
const NOT_WORK = /deity|concept|practice|school|philosopher|monk|scholar|person|region|city|disambiguation|term\b|genre|literary form|poetic form|tradition|movement/i;

export const looksLikePerson = d => PERSON.test(d) && !(NOT_PERSON.test(d) && !STRONG_PERSON.test(d));
export const looksLikeWork = d => WORK.test(d) && !NOT_WORK.test(d);

function lastYear() {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth() + 1, 1));
  const f = d => d.toISOString().slice(0, 10).replace(/-/g, '') + '00';
  return { start: f(start), end: f(end), label: `${start.toISOString().slice(0, 7)} to ${end.toISOString().slice(0, 7)}` };
}

export function makeWiki(net) {
  const pages = new Map();
  const viewsCache = new Map();
  const window = lastYear();

  async function resolve(cands) {
    const todo = [...new Set(cands)].filter(c => c && !pages.has(c) && c.length < 180 && !/[|#<>[\]{}]/.test(c));
    for (let i = 0; i < todo.length; i += 40) {
      const batch = todo.slice(i, i + 40);
      const qs = new URLSearchParams({
        action: 'query', format: 'json', formatversion: '2', redirects: '1',
        prop: 'pageprops|description', ppprop: 'disambiguation', titles: batch.join('|'),
      });
      const q = (await net.get(`${API}?${qs}`, { ttl: 30, pauseMs: 400 }))?.query || {};
      const norm = new Map((q.normalized || []).map(x => [x.from, x.to]));
      const red = new Map((q.redirects || []).map(x => [x.from, x.to]));
      const byTitle = new Map((q.pages || []).map(p => [p.title, p]));
      for (const c of batch) {
        const n = norm.get(c) || c;
        const p = byTitle.get(red.get(n) || n);
        pages.set(c, p && !p.missing && !p.invalid
          ? { title: p.title, description: p.description || '', disambig: Boolean(p.pageprops?.disambiguation) }
          : null);
      }
    }
  }

  const pick = (cands, ok) => {
    for (const [k, c] of cands.entries()) {
      const p = pages.get(c);
      if (p && !p.disambig && ok(p, k)) return { ...p, via: c };
    }
    return null;
  };

  async function lead(title) {
    const qs = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'extracts', exintro: '1', explaintext: '1', redirects: '1', titles: title });
    return (await net.get(`${API}?${qs}`, { ttl: 30, pauseMs: 400 }))?.query?.pages?.[0]?.extract || '';
  }

  async function views(title) {
    if (viewsCache.has(title)) return viewsCache.get(title);
    const url = `${PV}/${encodeURIComponent(title.replace(/ /g, '_'))}/monthly/${window.start}/${window.end}`;
    const body = await net.get(url, { ttl: 30, pauseMs: 150 });
    const v = (body?.items || []).reduce((s, i) => s + i.views, 0);
    viewsCache.set(title, v);
    return v;
  }

  /**
   * authorPages(names, overrides) → Map(name → {title, views, description, via})
   * titlePages([{key, sa, en, authors}], overrides, avoid) → Map(key → {…same})
   * An override maps a name or Toh key to a Wikipedia title, or to null for "no signal".
   */
  async function authorPages(names, overrides = {}) {
    const cand = new Map(names.map(n => [n, authorCandidates(n)]));
    await resolve([...cand.values()].flatMap(c => [...c.whole, ...c.parts]).concat(Object.values(overrides).filter(Boolean)));
    const out = new Map();
    for (const [name, c] of cand) {
      if (name in overrides) {
        const t = overrides[name];
        if (t) out.set(name, { title: t, description: pages.get(t)?.description || '', via: 'override', views: await views(t) });
        continue;
      }
      // A whole-name match may lack a description only when it came from the
      // IAST or plain spelling; the sh/ch respellings reach unrelated pages
      // through stray redirects ("Matricheta"). A part match must look like a person.
      const hit = pick(c.whole, (p, k) => p.description ? looksLikePerson(p.description) : k <= 1)
        || pick(c.parts, p => looksLikePerson(p.description));
      if (hit) out.set(name, { ...hit, views: await views(hit.title) });
    }
    return out;
  }

  async function titlePages(texts, overrides = {}, avoid = new Set()) {
    const cand = new Map(texts.map(t => [t.key, [
      ...titleCandidates(t.sa, { wholeOnly: !t.authors?.length }),
      ...(t.en && t.en.split(' ').length <= 6 && t.authors?.length ? [t.en] : []),
    ]]));
    await resolve([...cand.values()].flat().concat(Object.values(overrides).filter(Boolean)));
    const out = new Map();
    for (const [key, c] of cand) {
      if (key in overrides) {
        const t = overrides[key];
        if (t) out.set(key, { title: t, description: pages.get(t)?.description || '', via: 'override', views: await views(t) });
        continue;
      }
      const hit = pick(c, p => !avoid.has(p.title) && looksLikeWork(p.description));
      if (!hit) continue;
      // Two texts can share a name (the Tengyur's Tattvasiddhi and Harivarman's
      // are different works). For an attributed text, the article's lead must
      // name the author before its readers count.
      const t = texts.find(x => x.key === key);
      if (t.authors?.length && !mentionsAuthor(await lead(hit.title), t.authors)) continue;
      out.set(key, { ...hit, views: await views(hit.title) });
    }
    return out;
  }

  return { authorPages, titlePages, window };
}
