/**
 * The Reading Room pages, set like a printed edition: song pages, the title
 * page, the glossary, About this edition, and the texts index. One book face
 * throughout; structure comes from space, italic, small capitals and red
 * passage numbers, not from boxes, badges or labels.
 */

import { passageNo, unitId } from '../ids.mjs';
import * as markup from '../markup.mjs';
import { esc, attr, page, breadcrumbLd, site } from './shell.mjs';
import { ATT_TITLES, fileOf, groupAnchor } from './ctx.mjs';

export { fileOf };

const TYPE_PLURAL = { person: 'People', term: 'Terms', place: 'Places', deity: 'Deities', text: 'Texts' };
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const inWords = n => WORDS[n] ?? String(n);
const andList = xs => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const longDate = iso => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const common = (ctx, v) => ({ root: '../../', assets: '../assets/', v, textTitle: ctx.text.title.en, textHref: 'index.html', search: 'search.json' });
const isCC0 = text => /^CC0\b/i.test(text.publish.license);

function licenceSentence(text) {
  const link = label => (text.publish.licenseUrl ? `<a href="${attr(text.publish.licenseUrl)}">${esc(label)}</a>` : esc(label));
  return isCC0(text)
    ? `The translation, notes and glossary are in the public domain (${link('CC0')}).`
    : `Translation licence: ${link(text.publish.license)}.`;
}

function footer(ctx, root) {
  const { text } = ctx;
  return `  <p>${esc(ctx.imprint)}. Each ${esc(text.unitLabel.toLowerCase())} is drafted with Claude, an AI model, and published only after ${esc(ctx.reviewer)} has checked it line by line against the source. ${licenceSentence(text)} ${text.publish.credits.map(esc).join(' ')}</p>
  <p>Made in the manner of the 84000 Reading Room; not affiliated with 84000.</p>
  <p class="foot__links"><a href="about.html">About this edition</a><a href="${root}translations/index.html">All translations</a><a href="${root}index.html">37practices.space</a><a href="${root}privacy.html">Privacy</a><a href="#" data-consent-open>Cookie choices</a></p>`;
}

/** Every song in order; unpublished runs in the same state fold into one line ("2–22 not yet translated"). */
function contentsRows(ctx) {
  const { text, records, unitById } = ctx;
  const total = text.catalog.total || Math.max(0, ...ctx.units.map(u => u.n));
  const rows = [];
  for (let n = 1; n <= total; n++) {
    const id = unitId(text, n);
    const r = records.get(id), u = unitById.get(id);
    if (r) {
      const poet = u.poet && ctx.publishable(ctx.entries.get(u.poet)) ? ctx.entries.get(u.poet).en : '';
      rows.push({ kind: 'song', n, id, r, poet });
      continue;
    }
    const kind = text.catalog.lost.includes(n) ? 'lost' : u ? 'review' : 'todo';
    const last = rows[rows.length - 1];
    if (last && last.kind === kind && last.to === n - 1) last.to = n; else rows.push({ kind, from: n, to: n });
  }
  const state = row => ({ lost: row.from === row.to ? 'survives only in Tibetan' : 'survive only in Tibetan', review: 'in review', todo: 'not yet translated' })[row.kind];
  const range = row => (row.from === row.to ? String(row.from) : `${row.from}–${row.to}`);
  return { rows, state, range };
}

function railNav(ctx, current) {
  const { text } = ctx;
  const { rows, state, range } = contentsRows(ctx);
  const items = rows.map(row => (row.kind === 'song'
    ? `<li><span class="n">${row.n}</span><a href="${fileOf(text, row.n)}"${row.id === current ? ' aria-current="page"' : ''}><span class="t">${esc(row.r.title)}</span>${row.poet ? `<span class="p">${esc(row.poet)}</span>` : ''}</a></li>`
    : `<li class="idle"><span class="n">${range(row)}</span><span class="t">${esc(state(row))}</span></li>`));
  return `<nav class="rail" id="rail" aria-label="Contents">
  <p class="rail__h"><a href="index.html">${esc(text.title.en)}</a></p>
  <ol>
${items.join('\n')}
  </ol>
  <p class="rail__more"><a href="glossary.html">Glossary</a><a href="about.html">About this edition</a></p>
</nav>`;
}

/** The colophon that closes each song, as a manuscript closes with who copied it. */
function colophon(ctx, r, u) {
  const { text } = ctx;
  const from = u.witnesses.map(wid => text.witnesses.find(w => w.id === wid)).filter(Boolean).map(w => esc(w.label || w.citation));
  let src = from.length ? `Translated from the ${andList(from)}` : 'Translated';
  if (text.catalog.lost.includes(u.n)) src += `; the ${esc(ctx.langName(text.lang.root))} original is lost`;
  else if (text.catalog.partial.includes(u.n)) src += `; its end survives only in Tibetan`;
  if (r.commentary.length && text.commentary) src += `, with ${esc(text.commentary.author)}’s commentary`;
  if (r.status !== 'approved') return `<p class="colophon draft">${src}. Unreviewed draft, for local preview only.</p>`;
  const rv = r.provenance.review;
  const passages = new Set(u.lines.filter(l => l.role === 'line').map(l => l.group));
  const keys = Object.keys(rv.decisions);
  const edited = k => rv.decisions[k] === 'edited';
  const ep = keys.filter(k => passages.has(k) && edited(k)).length;
  const np = passages.size;
  const revised = [
    ep && (ep === np ? (np === 1 ? 'its one passage' : `all ${inWords(np)} of its passages`) : `${inWords(ep)} of its ${inWords(np)} passages`),
    keys.some(k => k === u.id && edited(k)) && 'the title or summary',
    keys.some(k => /\.m\d+$/.test(k) && edited(k)) && 'the commentary translation',
  ].filter(Boolean);
  const when = longDate(rv.date);
  const review = revised.length
    ? `reviewed line by line by ${esc(rv.by)}, who approved it on ${when} after revising ${andList(revised)}`
    : `reviewed line by line by ${esc(rv.by)}, who approved it as drafted on ${when}`;
  return `<p class="colophon">${src}. Drafted with Claude and ${review}.</p>`;
}

function sidenote(ctx, c, label) {
  const who = ctx.text.commentary?.author || 'Commentary';
  const cl = ctx.htmlLang(ctx.text.lang.commentary);
  // A run-in name, unless the note already opens with it ("Munidatta reads…").
  const runIn = markup.strip(c.note).startsWith(who) ? '' : `<span class="who">${esc(who)}.</span> `;
  return `<aside class="sidenote" aria-label="${attr(`${who} on ${label}`)}"><p>${runIn}${ctx.md(c.note)}</p>`
    + `<details><summary>Full comment</summary><div class="full"><p>${ctx.md(c.translation)}</p>`
    + (c.translit ? `<p class="tl" lang="${attr(cl)}-Latn">${esc(c.translit)}</p>` : '')
    + '</div></details></aside>';
}

/** One passage (couplet or heading) as the song page renders it. */
function passageHtml(ctx, u, r, g, { href = null, refsFor = () => '' } = {}) {
  const lines = new Map(r.lines.map(l => [l.id, l]));
  const first = g.lines[0];
  if (first.role === 'lacuna') return `<section class="passage"><p class="lacuna">[A gap in the manuscript${first.note ? ': ' + esc(first.note) : ''}.]</p></section>`;
  const ln = g.lines.map((l, i) => {
    const t = lines.get(l.id);
    if (!t) return '';
    const hl = ctx.htmlLang(l.lang);
    const refs = i === g.lines.length - 1 ? refsFor(g) : '';
    return `<div class="ln"><p class="en">${ctx.md(t.en)}${refs}</p><p class="src" lang="${attr(hl)}">${esc(l.src)}</p>`
      + (t.translit ? `<p class="tl" lang="${attr(hl)}-Latn">${esc(t.translit)}</p>` : '')
      + (t.gloss && first.role !== 'heading' ? `<p class="lit">${esc(t.gloss)}</p>` : '') + '</div>';
  }).join('');
  if (first.role === 'heading') return `<section class="passage heading"><div class="passage__no"></div><div class="passage__verse">${ln}</div></section>`;
  const notes = r.commentary.filter(c => c.anchor === g.id || g.lines.some(l => l.id === c.anchor)).map(c => sidenote(ctx, c, passageNo(g.id))).join('');
  const anchor = groupAnchor(g.id);
  return `<section class="passage" id="${anchor}" data-unit="${attr(g.id)}">`
    + `<div class="passage__no"><a class="pno" href="${href || '#' + anchor}" title="Passage ${passageNo(g.id)}: link or cite">${passageNo(g.id)}</a>${first.refrain ? '<span class="refrain">refrain</span>' : ''}</div>`
    + `<div class="passage__verse">${ln}</div>${notes}</section>`;
}

function groupsOf(u) {
  const out = [];
  for (const l of u.lines) { const g = out[out.length - 1]; if (g && g.id === l.group) g.lines.push(l); else out.push({ id: l.group, lines: [l] }); }
  return out;
}

function glossFor(ctx, ids) {
  const out = {};
  for (const id of ids) { const e = ctx.entries.get(id); if (ctx.publishable(e)) out[id] = ctx.popData(e); }
  return out;
}

const ORN = '<div class="orn" aria-hidden="true">॥</div>';

export function songPage(ctx, r, prev, next, v) {
  const { text } = ctx;
  const u = ctx.unitById.get(r.unit);
  const file = fileOf(text, u.n);
  const url = `${site()}/${text.publish.dir}/${file}`;
  const poet = u.poet && ctx.entries.get(u.poet);
  const used = new Set();
  const collect = s => markup.terms(s).forEach(t => used.add(t.id));
  r.lines.forEach(l => collect(l.en)); r.notes.forEach(n => collect(n.text)); r.commentary.forEach(c => { collect(c.translation); collect(c.note); }); collect(r.summary);
  if (poet) used.add(u.poet);

  const order = [...r.notes.filter(n => n.anchor === u.id), ...r.notes.filter(n => n.anchor !== u.id)];
  const num = new Map(order.map((n, i) => [n, i + 1]));
  const refsFor = g => {
    const refs = r.notes.filter(n => n.anchor === g.id || g.lines.some(l => l.id === n.anchor))
      .map(n => `<a href="#n${num.get(n)}" id="nr${num.get(n)}" aria-label="Note ${num.get(n)}">${num.get(n)}</a>`);
    return refs.length ? `<sup class="nref">${refs.join(',')}</sup>` : '';
  };
  // Passages, with the ॥ mark between couplets as the manuscript separates them.
  const groups = groupsOf(u);
  const parts = [];
  groups.forEach((g, i) => {
    if (i && g.lines[0].role === 'line' && groups[i - 1].lines[0].role === 'line') parts.push(ORN);
    parts.push(passageHtml(ctx, u, r, g, { refsFor }));
  });

  const heading = u.lines.find(l => l.role === 'heading');
  const raga = heading ? markup.strip(r.lines.find(l => l.id === heading.id)?.en || '') : u.raga ? `Rāga ${cap(u.raga)}` : '';
  const sub = [`${esc(text.unitLabel)} ${u.n}`,
    poet && ctx.publishable(poet) && `by <a class="gl" href="glossary.html#g-${attr(u.poet)}" data-g="${attr(u.poet)}" aria-expanded="false">${esc(poet.en)}</a>`,
    raga && esc(raga)].filter(Boolean).join(' · ');
  const songComments = r.commentary.filter(c => c.anchor === u.id);
  const who = text.commentary?.author || 'Commentary';
  const terms = [...used].map(id => ctx.entries.get(id)).filter(e => ctx.publishable(e) && e.type !== 'person')
    .sort((a, b) => a.en.localeCompare(b.en)).map(e => `<a href="glossary.html#g-${attr(e.id)}">${esc(e.en)}</a>`);
  const year = (r.provenance.review?.date || new Date().toISOString()).slice(0, 4);
  const title = `${text.unitLabel} ${u.n}: ${r.title} · ${text.title.en}`;
  const pager = !(prev || next) ? '' : `<nav class="pager" aria-label="Previous and next">`
    + (prev ? `<a href="${fileOf(text, prev.n)}" rel="prev">‹ ${text.unitLabel} ${prev.n}, <i>${esc(prev.title)}</i></a>` : '')
    + (next ? `<a class="next" href="${fileOf(text, next.n)}" rel="next">${text.unitLabel} ${next.n}, <i>${esc(next.title)}</i> ›</a>` : '')
    + '</nav>';
  const body = `<div class="room">
${railNav(ctx, u.id)}
<main class="text" id="main">
  <header class="head">
    <h1>${esc(r.title)}</h1>
    <p class="head__sub">${sub}</p>
    <p class="head__prov">${r.status === 'approved' ? `Drafted with Claude and reviewed by ${esc(r.provenance.review.by)}` : 'Unreviewed draft, for local preview only'}</p>
  </header>
  <p class="summary">${ctx.md(r.summary)}</p>
  ${songComments.map(c => `<div class="song-comment"><p><span class="who">${esc(who)}, introducing the ${esc(text.unitLabel.toLowerCase())}.</span> ${ctx.md(c.note)}</p><details><summary>Full comment</summary><div class="full"><p>${ctx.md(c.translation)}</p></div></details></div>`).join('')}
  <div class="passages">
${parts.join('\n')}
  </div>
  <p class="end" aria-hidden="true">॥&#8239;${u.n}&#8239;॥</p>
  ${colophon(ctx, r, u)}
  <div class="after">
    ${order.length ? `<h2>Notes</h2><ol class="notes">${order.map(n => `<li id="n${num.get(n)}" data-kind="${attr(n.kind)}">${ctx.md(n.text)}${n.anchor !== u.id ? `&nbsp;<a class="back" href="#nr${num.get(n)}" aria-label="Back to the passage">↩</a>` : ''}</li>`).join('')}</ol>` : ''}
    ${terms.length ? `<p class="terms">Glossary terms in this ${esc(text.unitLabel.toLowerCase())}: ${terms.join(', ')}.</p>` : ''}
  </div>
  ${pager}
</main>
</div>`;
  return page({
    ...common(ctx, v), url, title, pageType: 'translation', unitAttr: u.id, rail: true,
    description: `${text.unitLabel} ${u.n} of ${text.title.en}: ${markup.strip(r.summary)}`.slice(0, 300),
    citation: `${ctx.imprint.replace(/^Translated by /, '')}, trans. ${text.title.en}, ${text.unitLabel.toLowerCase()} {p}. 37practices.space, ${year}.`,
    tibetan: u.lines.some(l => ctx.htmlLang(l.lang) === 'bo'), glossData: glossFor(ctx, used), noindex: r.status !== 'approved',
    ld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebPage', '@id': url, url, name: title, inLanguage: 'en', isPartOf: { '@id': `${site()}/#website` }, breadcrumb: { '@id': url + '#breadcrumb' } },
      breadcrumbLd(url, [['Home', `${site()}/`], ['Translations', `${site()}/translations/index.html`], [text.title.en, `${site()}/${text.publish.dir}/index.html`], [`${text.unitLabel} ${u.n}`, url]]),
    ] },
    body, footer: footer(ctx, '../../'),
  });
}

/** The title page: the title in its own script, the imprint, how to read the edition, and the contents. */
export function titlePage(ctx, v) {
  const { text, records, unitById } = ctx;
  const url = `${site()}/${text.publish.dir}/index.html`;
  const total = text.catalog.total || Math.max(0, ...ctx.units.map(u => u.n));
  const published = [...records.values()].filter(r => r.status === 'approved').length;
  const wits = text.witnesses.filter(w => w.usage !== 'reviewer-only').map(w => esc(w.label || w.citation));
  const { rows, state, range } = contentsRows(ctx);
  const contents = rows.map(row => (row.kind === 'song'
    ? `<li><span class="n">${row.n}</span><a href="${fileOf(text, row.n)}">${esc(row.r.title)}</a><span class="p">${esc(row.poet)}</span></li>`
    : `<li class="idle"><span class="n">${range(row)}</span><span>${esc(cap(state(row)))}</span></li>`)).join('\n');

  // A worked example: the first published couplet with a glossary term and a comment beside it.
  let howto = '';
  for (const r of [...records.values()].sort((a, b) => a.n - b.n)) {
    const u = unitById.get(r.unit);
    const g = groupsOf(u).find(gr => gr.lines[0].role === 'line' && gr.lines.some(l => markup.terms(r.lines.find(x => x.id === l.id)?.en || '').some(t => ctx.publishable(ctx.entries.get(t.id))))
      && r.commentary.some(c => c.anchor === gr.id));
    if (!g) continue;
    const key = k => `<sup class="key" aria-hidden="true">${k}</sup>`;
    const html = passageHtml(ctx, u, r, g, { href: `${fileOf(text, u.n)}#${groupAnchor(g.id)}` })
      .replace(/(<a class="pno"[^>]*>[^<]*<\/a>)/, `$1${key('a')}`)
      .replace(/(<a class="gl"[^>]*>[^<]*<\/a>)/, `$1${key('b')}`)
      .replace(/(<aside class="sidenote"[^>]*><p>)/, `$1${key('c')}`)
      .replace(` id="${groupAnchor(g.id)}"`, '');
    const who = text.commentary?.author;
    howto = `<h2 class="section-h" id="how">How to read this edition</h2>
  <div class="howto">
    <div>${html}</div>
    <ol type="a">
      <li>The number in the margin gives ${esc(text.unitLabel.toLowerCase())} and couplet. Select it to copy a link or a citation.</li>
      <li>Underlined words are in the glossary. Hover for a short entry, or select the word to open the full one.</li>
      ${who ? `<li>${esc(who)}’s comment stands beside the couplet it explains; “Full comment” gives it whole.</li>` : ''}
      <li>Display, at the head of each page, sets the ${esc(ctx.langName(text.lang.root))} beside the English; the study view adds a transliteration and a word-by-word gloss.</li>
    </ol>
  </div>`;
    break;
  }
  const status = `${cap(inWords(published))} of ${inWords(total)} ${esc(text.unitLabel.toLowerCase())}s ${published === 1 ? 'is' : 'are'} published so far${ctx.preview ? ' (this preview includes drafts)' : ''}.`;
  const body = `<main class="titlepage" id="main">
  <div class="tp">
    <p class="tp__orn" aria-hidden="true">॥</p>
    ${text.title.orig ? `<p class="tp__orig" lang="${attr(text.title.orig.lang)}">${esc(text.title.orig.text)}</p>` : ''}
    <h1>${esc(text.title.en)}</h1>
    ${text.title.alt.length ? `<p class="tp__alt">${text.title.alt.map(esc).join(', ')}</p>` : ''}
    ${text.description ? `<p class="tp__desc">${esc(text.description)}</p>` : ''}
    ${wits.length ? `<p class="tp__wit">From the ${andList(wits)}.</p>` : ''}
    <p class="tp__imprint">${esc(ctx.imprint)}</p>
    <p class="tp__state">${status}${text.catalog.note ? ' ' + esc(text.catalog.note) : ''}</p>
    <nav class="tp__toc" aria-label="On this page"><a href="#contents">Contents</a>${howto ? '<a href="#how">How to read it</a>' : ''}<a href="glossary.html">Glossary</a><a href="about.html">About this edition</a></nav>
  </div>
  ${howto}
  <h2 class="section-h" id="contents">Contents</h2>
  <ol class="contents">
${contents}
  </ol>
</main>`;
  const usedHere = howto ? [...howto.matchAll(/data-g="([^"]+)"/g)].map(m => m[1]) : [];
  return page({
    ...common(ctx, v), url, title: `${text.title.en} · Illuminated Translations`, description: text.description, pageType: 'translation_title',
    noindex: ctx.preview, glossData: glossFor(ctx, usedHere),
    ld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'Book', '@id': url, url, name: text.title.en, alternateName: text.title.alt, inLanguage: 'en', description: text.description, breadcrumb: { '@id': url + '#breadcrumb' } },
      breadcrumbLd(url, [['Home', `${site()}/`], ['Translations', `${site()}/translations/index.html`], [text.title.en, url]]),
    ] },
    body, footer: footer(ctx, '../../'),
  });
}

export function glossaryPage(ctx, v) {
  const { text } = ctx;
  const url = `${site()}/${text.publish.dir}/glossary.html`;
  const fold = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const list = [...ctx.where.keys()].map(id => ctx.entries.get(id)).filter(e => ctx.publishable(e)).sort((a, b) => fold(a.en).localeCompare(fold(b.en)));
  const types = [...new Set(list.map(e => e.type))];
  const byLetter = new Map();
  for (const e of list) { const L = fold(e.en).charAt(0).toUpperCase() || '#'; (byLetter.get(L) || byLetter.set(L, []).get(L)).push(e); }
  const entry = e => {
    const forms = e.forms.map(f => `${esc(ctx.langName(f.lang))} ${f.script ? `<span lang="${attr(ctx.htmlLang(f.lang))}">${esc(f.script)}</span> ` : ''}<i>${esc(f.translit || f.wylie || '')}</i> <abbr class="att" title="${attr(ATT_TITLES[f.att] || '')}">${esc(f.att)}</abbr>`).join('; ');
    const bySong = new Map();
    for (const w of ctx.where.get(e.id) || []) (bySong.get(w.n) || bySong.set(w.n, []).get(w.n)).push(w);
    const where = [...bySong].map(([n, ws]) => `${esc(text.unitLabel.toLowerCase())} ${n} at ${andList(ws.map(w => `<a href="${attr(w.href)}">${esc(w.label)}</a>`))}`);
    const sym = ctx.symText(e);
    return `<article class="gentry" id="g-${attr(e.id)}" data-type="${attr(e.type)}">
  <div class="ghead"><h3>${esc(e.en)}</h3> <i class="ty">${esc(e.type)}${e.status !== 'approved' ? ', proposed (preview only)' : ''}</i></div>
  ${forms ? `<p class="forms">${forms}</p>` : ''}
  ${e.definition ? `<p>${esc(e.definition)}</p>` : ''}
  ${sym ? `<p class="sym">${esc(sym)}</p>` : ''}
  ${e.alt.length ? `<p class="forms">Also rendered as ${andList(e.alt.map(esc))}.</p>` : ''}
  ${where.length ? `<p class="where">In ${where.join('; ')}.</p>` : ''}
</article>`;
  };
  const body = `<main class="prose" id="main">
  <h1>Glossary</h1>
  <p class="lede">The entries are written for this edition. Each source form carries a code for how it is attested, and each reading of an image names who reads it so, and where.</p>
  <div class="gtools"><input type="search" id="gfilter" placeholder="Filter the glossary" aria-label="Filter the glossary">${types.length > 1 ? `<span class="gtypes" role="group" aria-label="Show"><button type="button" class="seg" data-type="all" aria-pressed="true">All</button>${types.map(t => `<button type="button" class="seg" data-type="${attr(t)}" aria-pressed="false">${esc(TYPE_PLURAL[t] || cap(t) + 's')}</button>`).join('')}</span>` : ''}</div>
  <nav class="alpha" aria-label="Jump to a letter">${[...byLetter.keys()].map(L => `<a href="#l-${attr(L)}">${esc(L)}</a>`).join('')}</nav>
${[...byLetter].map(([L, es]) => `  <h2 class="letter" id="l-${attr(L)}">${esc(L)}</h2>\n${es.map(entry).join('\n')}`).join('\n') || '  <p>No entries are published yet.</p>'}
  <p class="legend">Attestation codes: ${Object.entries(ATT_TITLES).map(([k, t]) => `<abbr class="att">${k}</abbr> ${esc(t)}`).join('; ')}.</p>
</main>`;
  return page({
    ...common(ctx, v), url, title: `Glossary · ${text.title.en}`, description: `Terms, names and images in ${text.title.en}, with their source forms and readings.`,
    pageType: 'translation_glossary', noindex: ctx.preview,
    ld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'DefinedTermSet', '@id': url, url, name: `Glossary · ${text.title.en}`, inLanguage: 'en' },
      breadcrumbLd(url, [['Home', `${site()}/`], ['Translations', `${site()}/translations/index.html`], [text.title.en, `${site()}/${text.publish.dir}/index.html`], ['Glossary', url]]),
    ] },
    body, footer: footer(ctx, '../../'),
  });
}

export function aboutPage(ctx, v) {
  const { text } = ctx;
  const url = `${site()}/${text.publish.dir}/about.html`;
  const wits = text.witnesses.filter(w => w.usage !== 'reviewer-only');
  const who = text.commentary?.author;
  const unit = esc(text.unitLabel.toLowerCase());
  const licence = isCC0(text)
    ? `<p>The translation, notes, glossary and commentary translations are dedicated to the public domain under <a href="${attr(text.publish.licenseUrl || 'https://creativecommons.org/publicdomain/zero/1.0/')}">CC0 1.0</a>. You may copy, change and republish them, commercially or not, without asking. If you do, saying where they came from, and that they were drafted with Claude and reviewed by a person, helps your readers; it is not required.</p>`
    : `<p>${licenceSentence(text)}</p>`;
  const body = `<main class="prose" id="main">
  <h1>About this edition</h1>
  <p class="lede">${esc(text.title.en)}${text.description ? ': ' + esc(text.description.replace(/\.$/, '')) : ''}. The English links its key terms to a glossary${who ? `, and ${esc(who)}’s commentary stands beside each couplet he explains` : ''}.</p>
  <h2>How it is made</h2>
  <p>Each ${unit} is drafted with Claude, an AI model, from the source text${who ? `, ${esc(who)}’s commentary` : ''} and this edition’s glossary and style notes. The draft goes to ${esc(ctx.reviewer)}, who checks every line against the source, edits it, and either approves it or sends it back for another draft. A ${unit} is published only when every passage and glossary term in it has been approved; the colophon at its end says who approved it and when.</p>
  <p>Where the drafter was unsure of a reading, the doubt was flagged beside the line for the reviewer. Readings that come from the tradition are attributed in the notes and never replace the image in the verse.</p>
  <h2>Sources</h2>
  <ul class="sources">
${wits.map(w => `    <li>${esc(w.citation)}</li>`).join('\n')}
  </ul>
  <h2>Conventions</h2>
  <dl>
    <dt><span class="pno">10.1</span></dt><dd>A passage number: ${unit} 10, couplet 1, set in red as manuscripts mark their sections. Select it to copy a link or a citation.</dd>
    <dt><span class="glx">term</span></dt><dd>A glossary term. Select it for its source forms, definition and readings.</dd>
    <dt>॥</dt><dd>The double daṇḍa, which closes a couplet in the manuscript, separates couplets here.</dd>
    <dt><i>ā ṛ ṃ</i></dt><dd>Old Bengali and Sanskrit are transliterated in IAST from the edition’s Bengali script. Bengali script does not distinguish b from v, so some transliterations are editorial.</dd>
    <dt><abbr class="att">AS</abbr></dt><dd>How a source form is attested: ${Object.entries(ATT_TITLES).map(([k, t]) => `<abbr class="att">${k}</abbr> ${esc(t)}`).join('; ')}.</dd>
  </dl>
  <h2>Licence and credits</h2>
  ${licence}
  <p>${text.publish.credits.map(esc).join(' ')} The type is Gentium Book Plus by SIL International and Tiro Bangla by Tiro Typeworks, both under the SIL Open Font License.</p>
  <p>The design of these pages takes its cue from the 84000 Reading Room. This edition is not affiliated with 84000.</p>
</main>`;
  return page({
    ...common(ctx, v), url, title: `About this edition · ${text.title.en}`, description: `How ${text.title.en} is translated, reviewed and published, its sources and conventions.`,
    pageType: 'translation_about', noindex: ctx.preview,
    ld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'AboutPage', '@id': url, url, name: `About this edition · ${text.title.en}`, inLanguage: 'en' },
      breadcrumbLd(url, [['Home', `${site()}/`], ['Translations', `${site()}/translations/index.html`], [text.title.en, `${site()}/${text.publish.dir}/index.html`], ['About', url]]),
    ] },
    body, footer: footer(ctx, '../../'),
  });
}

export function textsIndexPage(list, v) {
  const url = `${site()}/translations/index.html`;
  const items = list.map(({ text, published, total, imprint }) => `  <li>
    ${text.title.orig ? `<p class="shelf__orig" lang="${attr(text.title.orig.lang)}">${esc(text.title.orig.text)}</p>` : ''}
    <p class="shelf__title"><a href="${attr(text.publish.dir.replace(/^translations\//, ''))}/index.html">${esc(text.title.en)}</a></p>
    <p class="shelf__desc">${esc(text.description)}</p>
    <p class="shelf__meta">${esc(imprint)}. ${cap(inWords(published))} of ${total} ${esc(text.unitLabel.toLowerCase())}s published.</p>
  </li>`).join('\n');
  const body = `<main class="prose" id="main">
  <p class="tp__orn" aria-hidden="true">॥</p>
  <h1>Illuminated Translations</h1>
  <p class="lede">Buddhist texts in English, with key terms linked to a glossary and the traditional commentary beside each passage. Each is drafted with Claude and checked line by line against the source by a human reviewer before anything is published.</p>
  <ul class="shelf">
${items || '<li>Nothing is published yet.</li>'}
  </ul>
</main>`;
  return page({
    root: '../', assets: 'assets/', v, url, title: 'Illuminated Translations · 37practices.space',
    description: 'Buddhist texts in English, with glossary-linked terms and the traditional commentary woven in.', pageType: 'translation_index',
    ld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'CollectionPage', '@id': url, url, name: 'Illuminated Translations', inLanguage: 'en', breadcrumb: { '@id': url + '#breadcrumb' } },
      breadcrumbLd(url, [['Home', `${site()}/`], ['Translations', url]]),
    ] },
    body,
    footer: '  <p>Made in the manner of the 84000 Reading Room; not affiliated with 84000.</p>\n  <p class="foot__links"><a href="../index.html">37practices.space</a><a href="../privacy.html">Privacy</a><a href="#" data-consent-open>Cookie choices</a></p>',
  });
}
