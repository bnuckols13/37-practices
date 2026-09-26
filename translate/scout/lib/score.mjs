/**
 * Ranking. An opportunity is a text that nobody is translating, that people
 * would read, and that this engine can do well. So the score is
 *
 *   100 × gap × effort × demand
 *
 * demand  a weighted mean of normalised signals (author and title readership
 *         on Wikipedia, how many Indian commentaries the Tengyur holds on the
 *         text, Reddit mentions when fetched, and fit with this project);
 * gap     1 when the text is open, lower when a free English translation
 *         probably exists or when 84000 is likely to reach it anyway;
 * effort  a discount for length, since a four-page praise ships this month
 *         and a four-hundred-page commentary does not.
 *
 * Weights, bands and fit tags live in scout/config.json. Every number that
 * moves a score is also written into the row's `why`, so a reader can see
 * why a text ranks where it does.
 */

export function availability(r, published, inWork) {
  if (r.toh.some(t => published.has(t)) || r.group === 'published') return 'published';
  if (['translated', 'in-translation', 'in-application'].includes(r.group) || r.toh.some(t => inWork.has(t))) return 'claimed';
  return 'open';
}

/** Commentary edges, in both directions, keyed by record index. */
export function graph(records) {
  const byToh = new Map();
  records.forEach((r, i) => r.toh.forEach(t => byToh.set(t, i)));
  const commentaries = records.map(() => new Set());
  const roots = records.map(() => new Set());
  records.forEach((r, i) => {
    for (const t of r.commentaryOf) {
      const j = byToh.get(t);
      if (j === undefined || j === i) continue;
      commentaries[j].add(i);
      roots[i].add(j);
    }
  });
  return { byToh, commentaries, roots };
}

const log1p10 = x => Math.log10(1 + Math.max(0, x || 0));

function percentile(values, p) {
  const v = values.filter(x => x > 0).sort((a, b) => a - b);
  if (!v.length) return 1;
  return v[Math.min(v.length - 1, Math.floor(p * v.length))];
}

const fmt = n => n >= 10000 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);

export function effortFactor(pages, bands) {
  for (const b of bands) if (pages <= b.maxPages) return b.factor;
  return bands[bands.length - 1].factor;
}

export function fitTags(r, fit) {
  const hay = [r.section.join(' / '), r.titles.en, r.titles.sa, r.titles.wylie].filter(Boolean).join(' | ');
  return fit.filter(f => new RegExp(f.match, 'i').test(hay));
}

/**
 * rows: [{ i, r, avail, author:{name,title,views,perText,texts,namesake}, title:{title,views,shared},
 *          reddit, elsewhere:[{source,url,note}], openLibrary }]
 */
export function score(rows, g, cfg) {
  const W = cfg.weights;
  const open = rows.filter(x => x.avail === 'open');
  const p95 = {
    author: percentile(open.map(x => x.author?.perText || 0), 0.95),
    title: percentile(open.map(x => x.title?.views || 0), 0.95),
    comm: percentile(open.map(x => g.commentaries[x.i].size), 0.99),
    reddit: percentile(open.map(x => x.reddit || 0), 0.95),
  };
  const norm = (x, top) => Math.min(1, log1p10(x) / log1p10(top));

  for (const x of rows) {
    const { r } = x;
    const why = [];
    const nComm = g.commentaries[x.i].size;
    const tags = fitTags(r, cfg.fit);
    const s = {
      author: norm(x.author?.perText || 0, p95.author),
      title: norm(x.title ? x.title.views / (x.title.shared || 1) : 0, p95.title),
      commentaries: nComm ? Math.min(1, Math.log2(1 + nComm) / Math.log2(1 + p95.comm)) : 0,
      fit: tags.length ? Math.max(...tags.map(t => t.weight)) : 0,
    };
    if (x.reddit != null) s.reddit = norm(x.reddit, p95.reddit);

    // Commentary on a text 84000 has already published: its readers are the audience.
    const publishedRoots = [...g.roots[x.i]].filter(j => rows[j].avail === 'published');
    if (publishedRoots.length) s.commentaries = Math.max(s.commentaries, cfg.companionBoost);

    const used = Object.keys(s);
    const demand = used.reduce((a, k) => a + W[k] * s[k], 0) / used.reduce((a, k) => a + W[k], 0);

    if (x.author) {
      why.push(`${x.author.name}: ${fmt(x.author.views)} Wikipedia views/yr (“${x.author.title}”)`
        + `${x.author.texts > 1 ? `, spread over ${x.author.texts} attributed texts` : ''}${x.author.namesake ? ', halved for a later namesake' : ''}`);
    }
    if (x.title) why.push(`Article “${x.title.title}”: ${fmt(x.title.views)} views/yr${x.title.shared > 1 ? `, shared by ${x.title.shared} texts` : ''}`);
    if (nComm) why.push(`${nComm} Indian commentar${nComm === 1 ? 'y' : 'ies'} on it in the Tengyur`);
    if (publishedRoots.length) why.push(`Comments on ${publishedRoots.map(j => rows[j].r.label).join(', ')}, which 84000 has published`);
    if (x.reddit != null) why.push(`${x.reddit} Reddit comments since 2021`);
    for (const t of tags) why.push(`Fit: ${t.tag}`);

    let gap = 1;
    const flags = [];
    for (const e of x.elsewhere || []) {
      if (e.source === 'Lotsawa House') { gap = Math.min(gap, cfg.gap.lotsawa); flags.push('Free English translation on Lotsawa House'); }
      else if (/^partial:/i.test(e.note)) { gap = Math.min(gap, cfg.gap.partial); flags.push(`Partly in English: ${e.note.replace(/^partial:\s*/i, '')}`); }
      else { gap = Math.min(gap, cfg.gap.known); flags.push(`In English: ${e.note}`); }
    }
    if (x.openLibrary?.english) { gap = Math.min(gap, cfg.gap.openLibrary); flags.push(`Possible English book (Open Library): ${x.openLibrary.sample[0]}`); }
    if (r.canon === 'kangyur' && x.avail === 'open') { gap = Math.min(gap, cfg.gap.kangyur); flags.push('Kangyur: 84000 means to finish the Kangyur; ask before starting'); }
    if (r.authorContested) flags.push('Attribution contested');

    const effort = effortFactor(r.pages || 999, cfg.effort);
    x.signals = s;
    x.demand = demand;
    x.gap = gap;
    x.effort = effort;
    x.score = x.avail === 'open' ? Math.round(1000 * gap * effort * demand) / 10 : 0;
    x.why = why;
    x.flags = flags;
    x.tags = tags.map(t => t.tag);
  }
  return rows;
}
