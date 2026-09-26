/**
 * The scout's outputs: a self-contained HTML report for reading, a CSV for
 * sorting in a spreadsheet, and the JSON the `watch` command reads back.
 */

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = n => n >= 10000 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n ?? 0);

const STATUS = {
  '0': 'not started', '1': 'published', '1.a': 'published', '2': 'awaiting final proofing', '2.a': 'markup in process',
  '2.b': 'awaiting markup', '2.c': "awaiting editor's OK", '2.d': 'copyedited, preparing markup', '2.e': 'being copyedited',
  '2.f': 'reviewed, awaiting copyedit', '2.g': 'in editorial review', '2.h': 'translated, awaiting review',
  '3': 'current translation project', '4': 'application pending',
};

const csvCell = v => {
  const s = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(rows) {
  const cols = ['rank', 'score', 'avail', 'status', 'label', 'en', 'sa', 'wylie', 'authors', 'pages', 'section', 'commentaries', 'tags', 'why', 'flags'];
  const lines = [cols.join(',')];
  rows.forEach((r, k) => lines.push([
    k + 1, r.score, r.avail, STATUS[r.status] || r.status, r.label, r.titles.en, r.titles.sa, r.titles.wylie, r.authors, r.pages,
    r.section.slice(-1)[0], r.commentaries.length, r.tags, r.why, r.flags,
  ].map(csvCell).join(',')));
  return lines.join('\n') + '\n';
}

const tohHref = r => `https://84000.co/translation/${r.toh[0]}`;

function titleCell(r) {
  return `<div class="en">${esc(r.titles.en || r.titles.wylie || r.label)}</div>`
    + (r.titles.sa ? `<div class="sa">${esc(r.titles.sa)}</div>` : '')
    + (r.titles.bo ? `<div class="bo" lang="bo">${esc(r.titles.bo)}</div>` : '');
}

function row(r, rank, { showScore = true, extra = '' } = {}) {
  const flags = r.flags.length ? `<ul class="flags">${r.flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '';
  const why = r.why.length ? `<ul class="why">${r.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '<span class="muted">no demand signal found</span>';
  return `<tr data-q="${esc([r.label, r.titles.en, r.titles.sa, r.titles.wylie, r.authors.join(' '), r.tags.join(' '), r.section.join(' ')].join(' ').toLowerCase())}">
    <td class="num">${rank}</td>
    ${showScore ? `<td class="score"><b>${r.score.toFixed(1)}</b><span class="bar"><i style="width:${Math.min(100, r.score)}%"></i></span></td>` : ''}
    <td class="toh"><a href="${tohHref(r)}">${esc(r.label)}</a><div class="muted">${esc(r.canon === 'tengyur' ? 'Tengyur' : 'Kangyur')} · ${r.pages ?? '?'} pp.</div><div class="muted small">${esc(r.section.slice(-1)[0] || '')}</div></td>
    <td class="title">${titleCell(r)}</td>
    <td class="author">${esc(r.authors.join(', ') || 'unattributed')}</td>
    <td class="why-cell">${why}${flags}${extra}</td>
  </tr>`;
}

function table(rows, opts = {}) {
  if (!rows.length) return '<p class="muted">None in this run.</p>';
  return `<div class="tw"><table><thead><tr><th>#</th>${opts.showScore === false ? '' : '<th>Score</th>'}<th>Text</th><th>Title</th><th>Author</th><th>Why it ranks here</th></tr></thead><tbody>
    ${rows.map((r, k) => row(r, k + 1, { showScore: opts.showScore !== false, extra: opts.extra ? opts.extra(r) : '' })).join('')}
  </tbody></table></div>`;
}

export function renderReport(rows, meta) {
  const cfg = meta.cfg.report;
  const open = rows.filter(r => r.avail === 'open');
  const claimed = rows.filter(r => r.avail === 'claimed');
  const published = rows.filter(r => r.avail === 'published');
  const by = (list, canon) => list.filter(r => r.canon === canon).length;
  const openPages = open.reduce((s, r) => s + (r.pages || 0), 0);
  const byDemand = list => list.slice().sort((a, b) => b.demand - a.demand);

  const top = open.slice(0, cfg.top);
  const quick = open.filter(r => (r.pages || 999) <= cfg.quickWinPages).slice(0, cfg.listSize);
  const onPublished = open.filter(r => r.roots.some(x => x.avail === 'published')).slice(0, cfg.listSize);
  const withComm = open.filter(r => r.commentaries.length).slice(0, cfg.listSize);
  const songs = open.filter(r => r.tags.includes('siddha songs and dohās')).slice(0, cfg.listSize);
  const inHand = byDemand(claimed).filter(r => r.demand > 0).slice(0, cfg.listSize);
  const elsewhere = byDemand(open.filter(r => r.elsewhere.length || r.openLibrary?.english)).slice(0, cfg.listSize);
  const cp = ['toh2293', 'toh2263'].map(t => rows.find(r => r.toh.includes(t))).filter(Boolean);
  const rankOf = r => open.indexOf(r) + 1;

  const W = meta.cfg.weights;
  const date = meta.generated.slice(0, 10);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Untranslated Canon Scout</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Tibetan&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
<style>
:root { --bg:#fbfaf7; --fg:#1f1d1a; --muted:#6b665d; --line:#e4e0d8; --accent:#8a3b12; --bar:#c9a27a; --chip:#f1ece3; --flag:#8a1c1c; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#16140f; --fg:#ece7dd; --muted:#a39d91; --line:#2f2b24; --accent:#e59a6a; --bar:#8a6a4a; --chip:#231f18; --flag:#f08a8a; } }
:root[data-theme="dark"] { --bg:#16140f; --fg:#ece7dd; --muted:#a39d91; --line:#2f2b24; --accent:#e59a6a; --bar:#8a6a4a; --chip:#231f18; --flag:#f08a8a; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.55 "Source Serif 4", Georgia, serif; }
main { max-width:1180px; margin:0 auto; padding:32px 16px 80px; }
h1 { font-size:2rem; line-height:1.2; margin:0 0 6px; }
h2 { font-size:1.35rem; margin:44px 0 6px; padding-top:12px; border-top:1px solid var(--line); }
p.lede { font-size:1.05rem; max-width:60rem; }
.muted { color:var(--muted); } .small { font-size:.82rem; }
a { color:var(--accent); }
nav.toc { display:flex; flex-wrap:wrap; gap:6px 14px; margin:14px 0 8px; font-size:.92rem; }
.cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:10px; margin:18px 0; }
.card { border:1px solid var(--line); border-radius:8px; padding:12px 14px; }
.card b { display:block; font-size:1.6rem; font-variant-numeric:tabular-nums; }
.tw { overflow-x:auto; border:1px solid var(--line); border-radius:8px; }
table { border-collapse:collapse; width:100%; min-width:860px; font-size:.92rem; }
th, td { text-align:left; vertical-align:top; padding:9px 10px; border-bottom:1px solid var(--line); }
th { font-weight:600; font-size:.8rem; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); background:var(--chip); }
td.num { color:var(--muted); font-variant-numeric:tabular-nums; width:2.2rem; }
td.score { width:6.5rem; font-variant-numeric:tabular-nums; }
.bar { display:block; height:5px; background:var(--chip); border-radius:3px; margin-top:4px; }
.bar i { display:block; height:5px; background:var(--bar); border-radius:3px; }
td.toh { width:9.5rem; } td.title { width:30%; } td.author { width:11%; }
.en { font-weight:600; } .sa { font-style:italic; } .bo { font-family:"Noto Serif Tibetan", serif; font-size:.95rem; color:var(--muted); }
ul.why, ul.flags { margin:0; padding-left:1.05rem; } ul.flags li { color:var(--flag); }
.callout { border-left:3px solid var(--accent); padding:10px 14px; background:var(--chip); border-radius:0 8px 8px 0; }
input[type=search] { width:100%; max-width:420px; padding:8px 10px; font:inherit; border:1px solid var(--line); border-radius:6px; background:var(--bg); color:var(--fg); margin:8px 0 12px; }
footer { margin-top:48px; font-size:.85rem; color:var(--muted); }
</style>
</head>
<body><main>
<p class="muted small">Generated ${esc(date)} · 84000 catalogue snapshot ${esc(meta.snapshot.date.slice(0, 10))} · ${meta.publishedTotal} texts live in the Reading Room · Wikipedia views ${esc(meta.wikiWindow)}</p>
<h1>Untranslated Canon Scout</h1>
<p class="lede">Of the ${rows.length.toLocaleString()} Kangyur and Tengyur texts that 84000 held as placeholders in its ${esc(meta.snapshot.date.slice(0, 10))} catalogue, ${open.length.toLocaleString()} had no translator at 84000 and have not been published since. ${by(open, 'tengyur').toLocaleString()} of those are in the Tengyur, together about ${openPages.toLocaleString()} Degé pages. This report ranks them by who would read them, how far the tradition leaned on them, and how well they suit an illuminated translation with commentary.</p>
<nav class="toc">
  <a href="#top">Top ${cfg.top}</a><a href="#quick">Quick wins</a><a href="#companions">Commentaries on published texts</a><a href="#pairs">Root texts with commentaries</a><a href="#songs">Near the Charyapada</a><a href="#inhand">84000 has these</a><a href="#elsewhere">In English elsewhere</a><a href="#all">Search all</a><a href="#method">Method</a>
</nav>
<div class="cards">
  <div class="card"><b>${by(open, 'tengyur').toLocaleString()}</b>Tengyur texts open</div>
  <div class="card"><b>${by(open, 'kangyur')}</b>Kangyur texts open</div>
  <div class="card"><b>${claimed.length}</b>in 84000's pipeline (translated, in translation, or applied for)</div>
  <div class="card"><b>${published.length}</b>placeholders since published</div>
</div>

${cp.length ? `<div class="callout"><b>Where the Charyapada sits.</b> ${cp.map(r => `${esc(r.label)} (${esc(r.titles.sa || r.titles.en)}) is ${r.avail === 'open' ? `open, ranked #${rankOf(r)} of ${open.length}` : esc(r.avail)}, ${r.pages} pp.${r.commentaries.length ? `, with ${r.commentaries.length} Tengyur commentar${r.commentaries.length === 1 ? 'y' : 'ies'}` : ''}`).join('; ')}. Toh 2293 is Munidatta's commentary with the songs embedded, the Tibetan witness the engine needs for songs 24, 25, 48 and the end of 23. 84000's catalogue links it to Toh 2263, Saraha's King Dohā, as its root; Munidatta comments on the Caryāgīti songs rather than on that dohā, so the link is worth raising with 84000.</div>` : ''}

<h2 id="top">Top ${cfg.top} opportunities</h2>
<p class="muted">Open texts ranked by score (0 to 100). Every figure that moved a score is listed beside it; red lines are reasons for caution.</p>
${table(top)}

<h2 id="quick">Quick wins: ${cfg.quickWinPages} pages or fewer</h2>
<p class="muted">Short texts with a reader already waiting. Each could move through the engine in a single review cycle.</p>
${table(quick)}

<h2 id="companions">Commentaries on texts 84000 has published</h2>
<p class="muted">84000 publishes the root text; the Indian commentary on it stays untranslated. Readers of the published root are the ready audience, and the engine's woven-commentary page fits them exactly.</p>
${table(onPublished, { extra: r => `<div class="muted small">Root: ${r.roots.map(x => esc(x.label) + ' (' + esc(x.avail) + ')').join(', ')}</div>` })}

<h2 id="pairs">Root texts with their own commentaries in the Tengyur</h2>
<p class="muted">Charyapada-shaped projects: a root and the Indian commentary on it, both in the canon, both untranslated.</p>
${table(withComm, { extra: r => `<div class="muted small">Commentaries: ${esc(r.commentaries.slice(0, 6).join(', '))}${r.commentaries.length > 6 ? '…' : ''}</div>` })}

<h2 id="songs">Near the Charyapada: siddha songs and dohās</h2>
<p class="muted">Open texts tagged as songs, dohās or vajragīti: the Charyapada's own genre and the engine's first competence.</p>
${table(songs)}

<h2 id="inhand">84000 already has these in hand</h2>
<p class="muted">High-demand texts that 84000 has translated, is translating, or has an application for, as of the ${esc(meta.snapshot.date.slice(0, 10))} snapshot. Starting one would duplicate work; linking to theirs when it publishes serves readers better.</p>
${table(inHand, { showScore: false, extra: r => `<div class="muted small">84000 status ${esc(r.status)}: ${esc(STATUS[r.status] || '')}${r.translatorsEng.length ? ` · translator: ${esc(r.translatorsEng.join(', '))}` : ''}</div>` })}

<h2 id="elsewhere">Probably already in English elsewhere</h2>
<p class="muted">High-demand open texts with a translation on Lotsawa House or a likely English book. Their scores are cut; check before ruling them out, since a partial or out-of-print translation can still leave room.</p>
${table(elsewhere, { extra: r => r.elsewhere.some(e => e.url) ? `<div class="small">${r.elsewhere.filter(e => e.url).slice(0, 2).map(e => `<a href="${esc(e.url)}">${esc(e.url.replace('https://www.', ''))}</a>`).join('<br>')}</div>` : '' })}

<h2 id="all">Search the whole ranked list</h2>
<input type="search" id="q" placeholder="Filter by title, author, Toh, tag or section" aria-label="Filter the ranked list">
<div id="all-table">${table(open.slice(0, 600))}</div>
<p class="muted small">Showing the top 600 of ${open.length} open texts; the CSV beside this file has every text, including those 84000 holds.</p>

<h2 id="method">Method</h2>
<p><b>Score</b> = 100 × gap × effort × demand. <b>Demand</b> is a weighted mean of signals, each scaled 0 to 1 on a log scale against the 95th percentile of open texts: author readership on English Wikipedia divided by the square root of the number of texts attributed to that author, so that one famous name does not lift a hundred minor works (weight ${W.author}), readership of an article about the text itself, counted only when the article's lead names the author (${W.title}), the number of Indian commentaries on it in the Tengyur (${W.commentaries}; a commentary on a text 84000 has published scores at least ${meta.cfg.companionBoost} here), fit with this project's genres (${W.fit}), and Reddit comment counts in practice subreddits (${W.reddit}; ${meta.reddit ? 'fetched for the top of the shortlist' : 'not fetched in this run; rerun with --reddit'}). Signals that were not measured drop out of the mean rather than counting as zero.</p>
<p><b>Gap</b> is 1 for an open text, ${meta.cfg.gap.known} when a published English translation has been checked by hand (${meta.checkedByHand} texts in overrides.json), ${meta.cfg.gap.partial} when only part of it is in English, ${meta.cfg.gap.lotsawa} when Lotsawa House has a translation, ${meta.cfg.gap.openLibrary} when Open Library shows a likely English book, and ${meta.cfg.gap.kangyur} for open Kangyur texts, which 84000 intends to finish. <b>Effort</b> discounts length, from 1.0 at six pages or fewer down to ${meta.cfg.effort[meta.cfg.effort.length - 1].factor} for the longest works.</p>
<p><b>What the numbers cannot see.</b> Wikipedia readership measures English-speaking curiosity, which favours famous names over important texts; a Tibetan monastic curriculum would rank some of these differently. Author matching runs through Wikipedia redirects and short descriptions, and a name shared by two people (the two Sarahas, the two Amoghavajras) credits both with one article's readers. The 84000 status is a February 2025 snapshot corrected only for what has since been published, so a text marked open may have gained a translator since. 84000 now drafts with its own AI pipeline, and its pace may rise. Ask 84000 before committing to a long text.</p>
<p><b>Collections the checks cannot see.</b> A book that translates many short texts under one title escapes the Open Library check. Two to test by hand before starting anything by these authors: Richard Sherburne's <i>The Complete Works of Atīśa</i> (2000), which translates twenty-five of Atiśa's texts, and the Nāgārjuna collections of Lindtner (<i>Nagarjuniana</i>, 1982) and of Tola and Dragonetti. Record what you find in overrides.json and rerun.</p>
<footer>Sources: 84000 TEI catalogue (github.com/84000/data-tei), 84000 Partner Pull API (scholar.84000.co), English Wikipedia and Wikimedia pageviews, Lotsawa House, Open Library${meta.reddit ? ', Arctic Shift (Reddit)' : ''}. 84000 catalogue data is used under 84000's terms with attribution; titles and Toh numbers are bibliographic facts. HTTP this run: ${meta.net.fetched} fetched, ${meta.net.cached} from cache, ${meta.net.failed} failed.</footer>
</main>
<script>
const q = document.getElementById('q');
const rows = [...document.querySelectorAll('#all-table tbody tr')];
q.addEventListener('input', () => { const v = q.value.trim().toLowerCase(); for (const tr of rows) tr.hidden = v && !tr.dataset.q.includes(v); });
</script>
</body></html>
`;
}
