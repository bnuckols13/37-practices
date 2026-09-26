/** The Reading Room pages: song, title page, glossary, about, and the texts index. */

import { passageNo, unitId } from '../ids.mjs';
import * as markup from '../markup.mjs';
import { esc, attr, page, crumbs, breadcrumbLd, site } from './shell.mjs';
import { ATT_TITLES, fileOf, groupAnchor } from './ctx.mjs';

export { fileOf };

const TYPE_PLURAL = { person: 'People', term: 'Terms', place: 'Places', deity: 'Deities', text: 'Texts' };
const longDate = iso => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const common = (ctx, v) => ({ root: '../../', assets: '../assets/', v, textTitle: ctx.text.title.en, textHref: 'index.html', search: 'search.json' });

function footer(ctx, root) {
  const { text } = ctx;
  const lic = text.publish.licenseUrl ? `<a href="${attr(text.publish.licenseUrl)}">${esc(text.publish.license)}</a>` : esc(text.publish.license);
  return `  <p>${esc(ctx.imprint)}. Every ${esc(text.unitLabel.toLowerCase())} was drafted with Claude, an AI model, then read, edited and approved line by line by the reviewer before publication; each page says when. The glossary, notes and commentary translations are original to this edition. <a href="about.html">About this edition</a>.</p>
  <p>${text.publish.credits.map(esc).join(' ')} Translation licence: ${lic}.</p>
  <p>Made in the manner of the 84000 Reading Room; not affiliated with 84000. · <a href="${root}translations/index.html">All translations</a> · <a href="${root}index.html">37practices.space</a> · <a href="${root}privacy.html">Privacy</a> · <a href="#" data-consent-open>Cookie choices</a></p>`;
}

function railNav(ctx, current) {
  const { text, records, unitById } = ctx;
  const total = text.catalog.total || Math.max(0, ...ctx.units.map(u => u.n));
  const items = [];
  for (let n = 1; n <= total; n++) {
    const id = unitId(text, n);
    const r = records.get(id);
    const u = unitById.get(id);
    const poet = u?.poet && ctx.publishable(ctx.entries.get(u.poet)) ? ctx.entries.get(u.poet).en : '';
    if (r) {
      items.push(`<li><a class="ri" href="${fileOf(text, n)}"${id === current ? ' aria-current="page"' : ''}><span class="n">${n}</span><span class="t">${esc(r.title)}${poet ? `<span class="p">${esc(poet)}</span>` : ''}</span></a></li>`);
    } else {
      const why = text.catalog.lost.includes(n) ? 'survives only in Tibetan' : u ? 'in review' : 'not yet translated';
      items.push(`<li><span class="ri ri--idle"><span class="n">${n}</span><span class="t">${esc(why)}</span></span></li>`);
    }
  }
  return `<nav class="rail" id="rail" aria-label="${esc(text.unitLabel)}s">
  <p class="rail__h smallcaps">${esc(text.unitLabel)}s</p>
  <ol>
${items.join('\n')}
  </ol>
  <div class="rail__more"><a href="index.html">Title page and contents</a><a href="glossary.html">Glossary</a><a href="about.html">About this edition</a></div>
</nav>`;
}

function provenance(ctx, r, u) {
  if (r.status !== 'approved') return '<p class="prov draft">Unreviewed draft: local preview only, not for publication.</p>';
  const rv = r.provenance.review;
  const passages = new Set(u.lines.filter(l => l.role === 'line').map(l => l.group));
  const edited = k => rv.decisions[k] === 'edited';
  const keys = Object.keys(rv.decisions);
  const ep = keys.filter(k => passages.has(k) && edited(k)).length;
  const also = [keys.some(k => k === u.id && edited(k)) && 'the title or summary', keys.some(k => /\.m\d+$/.test(k) && edited(k)) && 'the commentary'].filter(Boolean);
  const said = ep ? `The reviewer edited ${ep} of ${passages.size} passage${passages.size === 1 ? '' : 's'}${also.length ? ' and revised ' + also.join(' and ') : ''}.`
    : also.length ? `Every passage approved as drafted; the reviewer revised ${also.join(' and ')}.` : 'Approved as drafted.';
  return `<p class="prov">Drafted with Claude; reviewed and approved by ${esc(rv.by)} on ${esc(longDate(rv.date))}. ${said}</p>`;
}

function witnessLine(ctx, u) {
  const { text } = ctx;
  const bits = [];
  for (const wid of u.witnesses) {
    const w = text.witnesses.find(x => x.id === wid);
    if (!w) continue;
    const l = u.lines.find(x => x.witness === wid);
    bits.push(`<span title="${attr(w.citation)}">${esc(ctx.langName(l?.lang || w.lang[0]))} · ${esc(w.label || w.id)}</span>`);
  }
  if (text.catalog.lost.includes(u.n)) bits.push('Original lost; translated from the Tibetan');
  else if (text.catalog.partial.includes(u.n)) bits.push('The end survives only in Tibetan');
  return bits.join('<span class="dot">·</span>');
}

function sidenote(ctx, c, label) {
  const who = ctx.text.commentary?.author || 'Commentary';
  const cl = ctx.htmlLang(ctx.text.lang.commentary);
  return `<aside class="sidenote" aria-label="${attr(`${who} on ${label}`)}"><p class="sidenote__who smallcaps">${esc(who)}</p><p>${ctx.md(c.note)}</p>`
    + `<details><summary>Full comment</summary><div class="full"><p>${ctx.md(c.translation)}</p>`
    + (c.translit ? `<p class="tl" lang="${attr(cl)}-Latn">${esc(c.translit)}</p>` : '')
    + '</div></details></aside>';
}

/** One passage (couplet or heading) as the song page renders it. */
function passageHtml(ctx, u, r, g, { href = null, refsFor = () => '' } = {}) {
  const lines = new Map(r.lines.map(l => [l.id, l]));
  const first = g.lines[0];
  if (first.role === 'lacuna') return `<section class="passage"><div class="lacuna">A gap in the manuscript${first.note ? ': ' + esc(first.note) : ''}.</div></section>`;
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
  const tags = [first.refrain && 'Refrain', first.bhanita && 'The poet names himself'].filter(Boolean);
  const notes = r.commentary.filter(c => c.anchor === g.id || g.lines.some(l => l.id === c.anchor)).map(c => sidenote(ctx, c, passageNo(g.id))).join('');
  const anchor = groupAnchor(g.id);
  return `<section class="passage" id="${anchor}" data-unit="${attr(g.id)}">`
    + `<div class="passage__no"><a class="pno" href="${href || '#' + anchor}" title="Passage ${passageNo(g.id)}: link or cite">${passageNo(g.id)}</a></div>`
    + `<div class="passage__verse">${tags.length ? `<p class="tag">${tags.join(' · ')}</p>` : ''}${ln}</div>${notes}</section>`;
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
  const passages = groupsOf(u).map(g => passageHtml(ctx, u, r, g, { refsFor })).join('\n');
  const songComments = r.commentary.filter(c => c.anchor === u.id);
  const who = text.commentary?.author || 'Commentary';
  const terms = [...used].map(id => ctx.entries.get(id)).filter(e => ctx.publishable(e) && e.type !== 'person')
    .sort((a, b) => a.en.localeCompare(b.en)).map(e => `<li><a href="glossary.html#g-${attr(e.id)}">${esc(e.en)}</a></li>`).join('');
  const year = (r.provenance.review?.date || new Date().toISOString()).slice(0, 4);
  const title = `${text.unitLabel} ${u.n}: ${r.title} · ${text.title.en}`;
  const pager = !(prev || next) ? '' : `<nav class="pager" aria-label="Previous and next">`
    + (prev ? `<a href="${fileOf(text, prev.n)}" rel="prev"><span class="dir smallcaps">Previous</span><span class="t">${text.unitLabel} ${prev.n} · ${esc(prev.title)}</span></a>` : '')
    + (next ? `<a class="next" href="${fileOf(text, next.n)}" rel="next"><span class="dir smallcaps">Next</span><span class="t">${text.unitLabel} ${next.n} · ${esc(next.title)}</span></a>` : '')
    + '</nav>';
  const body = `<div class="room">
${railNav(ctx, u.id)}
<main class="text" id="main">
  <header class="head">
    <p class="head__eyebrow smallcaps">${esc(text.unitLabel)} ${u.n}${text.catalog.total ? ' of ' + text.catalog.total : ''}${u.raga && !u.lines.some(l => l.role === 'heading') ? ' · rāga ' + esc(u.raga) : ''}</p>
    <h1>${esc(r.title)}</h1>
    <p class="head__meta">${poet && ctx.publishable(poet) ? `by <a class="gl" href="glossary.html#g-${attr(u.poet)}" data-g="${attr(u.poet)}" aria-expanded="false">${esc(poet.en)}</a><span class="dot">·</span>` : ''}${witnessLine(ctx, u)}</p>
    ${provenance(ctx, r, u)}
  </header>
  <p class="summary">${ctx.md(r.summary)}</p>
  ${songComments.map(c => `<div class="song-comment"><p class="sidenote__who smallcaps">${esc(who)} on the whole ${esc(text.unitLabel.toLowerCase())}</p><p>${ctx.md(c.note)}</p><details><summary>Full comment</summary><p>${ctx.md(c.translation)}</p></details></div>`).join('')}
  <div class="passages">
${passages}
  </div>
  <div class="after">
    ${order.length ? `<h2 class="smallcaps">Notes</h2><ol class="notes">${order.map(n => `<li id="n${num.get(n)}"><span class="kind">${esc(n.kind)}</span>${ctx.md(n.text)}${n.anchor !== u.id ? ` <a href="#nr${num.get(n)}" aria-label="Back to the passage">↩</a>` : ''}</li>`).join('')}</ol>` : ''}
    ${terms ? `<h2 class="smallcaps">Terms in this ${esc(text.unitLabel.toLowerCase())}</h2><ul class="terms">${terms}</ul>` : ''}
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
    crumbsHtml: crumbs([['Home', '../../index.html'], ['Translations', '../index.html'], [text.title.en, 'index.html'], [`${text.unitLabel} ${u.n}`]]),
    body, footer: footer(ctx, '../../'),
  });
}

/** The title page: the text's title in its own script, its witnesses, the imprint, how to read it, and every song. */
export function titlePage(ctx, v) {
  const { text, records, unitById } = ctx;
  const url = `${site()}/${text.publish.dir}/index.html`;
  const total = text.catalog.total || Math.max(0, ...ctx.units.map(u => u.n));
  const published = [...records.values()].filter(r => r.status === 'approved').length;
  const wits = text.witnesses.filter(w => w.usage !== 'reviewer-only').map(w => esc(w.label || w.id));
  const rows = [];
  for (let n = 1; n <= total; n++) {
    const id = unitId(text, n); const r = records.get(id); const u = unitById.get(id);
    const poet = r && u?.poet && ctx.publishable(ctx.entries.get(u.poet)) ? ctx.entries.get(u.poet).en : '';
    const status = r ? '' : text.catalog.lost.includes(n) ? 'Survives only in the Tibetan translation' : u ? 'In review' : 'Not yet translated';
    rows.push(`<tr${r ? '' : ' class="idle"'}><td>${n}</td><td>${r ? `<a href="${fileOf(text, n)}">${esc(r.title)}</a>` : `<span class="st">${esc(status)}</span>`}</td><td>${esc(poet)}</td><td>${r && u.raga ? esc(u.raga) : ''}</td></tr>`);
  }
  // A worked example: the first published couplet that has a glossary term and a comment beside it.
  let howto = '';
  for (const r of [...records.values()].sort((a, b) => a.n - b.n)) {
    const u = unitById.get(r.unit);
    const g = groupsOf(u).find(gr => gr.lines[0].role === 'line' && gr.lines.some(l => markup.terms(r.lines.find(x => x.id === l.id)?.en || '').some(t => ctx.publishable(ctx.entries.get(t.id))))
      && r.commentary.some(c => c.anchor === gr.id));
    if (!g) continue;
    let html = passageHtml(ctx, u, r, g, { href: `${fileOf(text, u.n)}#${groupAnchor(g.id)}` })
      .replace('<div class="passage__no">', '<div class="passage__no"><span class="callout" aria-hidden="true">1</span>')
      .replace(/(<a class="gl"[^>]*>[^<]*<\/a>)/, '$1<span class="callout" aria-hidden="true">2</span>')
      .replace('<p class="sidenote__who smallcaps">', '<p class="sidenote__who smallcaps"><span class="callout" aria-hidden="true">3</span>')
      .replace(` id="${groupAnchor(g.id)}"`, '');
    howto = `<h2 class="section-h smallcaps" id="how">How to read this edition</h2>
  <div class="howto">
    <div>${html}</div>
    <ol>
      <li>The passage number, set in red as a manuscript marks its sections. Select it to copy a link or a citation.</li>
      <li>An underlined word opens the glossary: the source word, how it is attested, and how the tradition reads the image.</li>
      <li>${esc(text.commentary?.author || 'The commentary')} sits beside the passage he explains. Open “Full comment” for his whole gloss.</li>
      <li>Display, at the top of every page, adds the ${esc(ctx.langName(text.lang.root))} text, a transliteration and a word-by-word gloss under each line.</li>
    </ol>
  </div>`;
    break;
  }
  const body = `<main class="titlepage" id="main">
  <div class="frame">
    ${text.title.orig ? `<p class="frame__orig" lang="${attr(text.title.orig.lang)}">${esc(text.title.orig.text)}</p>` : ''}
    <h1>${esc(text.title.en)}</h1>
    ${text.title.alt.length ? `<p class="frame__alt">${text.title.alt.map(esc).join(' · ')}</p>` : ''}
    ${text.description ? `<p class="frame__by">${esc(text.description)}</p>` : ''}
    ${wits.length ? `<p class="frame__wit smallcaps">· ${wits.join(' · ')} ·</p>` : ''}
  </div>
  <p class="imprint"><strong>${esc(ctx.imprint)}</strong><br>${published} of ${total} ${esc(text.unitLabel.toLowerCase())}s published${ctx.preview ? ' (preview includes drafts)' : ''}${text.catalog.note ? '. ' + esc(text.catalog.note) : ''}</p>
  <nav class="toc" aria-label="Contents"><a href="#songs">${esc(text.unitLabel)}s</a>${howto ? '<a href="#how">How to read it</a>' : ''}<a href="glossary.html">Glossary</a><a href="about.html">About this edition</a></nav>
  ${howto}
  <h2 class="section-h smallcaps" id="songs">${esc(text.unitLabel)}s</h2>
  <div class="tablewrap"><table class="songtable"><thead><tr><th scope="col"><span class="sr-only">Number</span></th><th scope="col">${esc(text.unitLabel)}</th><th scope="col">Poet</th><th scope="col">Rāga</th></tr></thead><tbody>
${rows.join('\n')}
  </tbody></table></div>
</main>`;
  const usedHere = howto ? [...howto.matchAll(/data-g="([^"]+)"/g)].map(m => m[1]) : [];
  return page({
    ...common(ctx, v), url, title: `${text.title.en} · Illuminated Translations`, description: text.description, pageType: 'translation_title',
    noindex: ctx.preview, glossData: glossFor(ctx, usedHere),
    ld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'Book', '@id': url, url, name: text.title.en, alternateName: text.title.alt, inLanguage: 'en', description: text.description, breadcrumb: { '@id': url + '#breadcrumb' } },
      breadcrumbLd(url, [['Home', `${site()}/`], ['Translations', `${site()}/translations/index.html`], [text.title.en, url]]),
    ] },
    crumbsHtml: crumbs([['Home', '../../index.html'], ['Translations', '../index.html'], [text.title.en]]),
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
    const forms = e.forms.map(f => `${esc(ctx.langName(f.lang))} ${f.script ? `<span lang="${attr(ctx.htmlLang(f.lang))}">${esc(f.script)}</span> ` : ''}<i>${esc(f.translit || f.wylie || '')}</i><abbr class="att" title="${attr(ATT_TITLES[f.att] || '')}">${esc(f.att)}</abbr>`).join(' · ');
    const refs = ctx.where.get(e.id) || [];
    const bySong = new Map();
    for (const w of refs) (bySong.get(w.n) || bySong.set(w.n, []).get(w.n)).push(w);
    const where = [...bySong].map(([n, ws]) => `${esc(text.unitLabel)} ${n}: ${ws.map(w => `<a href="${attr(w.href)}">${esc(w.label)}</a>`).join(', ')}`).join('<span class="dot"> · </span>');
    const sym = ctx.symText(e);
    return `<article class="gentry" id="g-${attr(e.id)}" data-type="${attr(e.type)}">
  <h3>${esc(e.en)}</h3><p class="ty smallcaps">${esc(e.type)}${e.status !== 'approved' ? ' · proposed (preview)' : ''}</p>
  ${forms ? `<p class="forms">${forms}</p>` : ''}
  ${e.definition ? `<p>${esc(e.definition)}</p>` : ''}
  ${sym ? `<p><i>${esc(sym)}</i></p>` : ''}
  ${e.alt.length ? `<p class="forms">Also rendered: ${e.alt.map(esc).join(', ')}</p>` : ''}
  ${where ? `<p class="where">Appears in ${where}</p>` : ''}
</article>`;
  };
  const body = `<main class="prose" id="main">
  <h1>Glossary</h1>
  <p class="lede">Every entry is written for this edition. Source forms carry a code saying how the form is attested; readings of an image are attributed to whoever reads it that way, with the passage where they say so.</p>
  <div class="gtools"><input type="search" id="gfilter" placeholder="Filter the glossary" aria-label="Filter the glossary">${types.length > 1 ? `<span role="group" aria-label="Type"><button type="button" class="seg" data-type="all" aria-pressed="true">All</button>${types.map(t => `<button type="button" class="seg" data-type="${attr(t)}" aria-pressed="false">${esc(TYPE_PLURAL[t] || t.charAt(0).toUpperCase() + t.slice(1) + 's')}</button>`).join('')}</span>` : ''}</div>
  <nav class="alpha" aria-label="Jump to a letter">${[...byLetter.keys()].map(L => `<a href="#l-${attr(L)}">${esc(L)}</a>`).join('')}</nav>
${[...byLetter].map(([L, es]) => `  <h2 class="letter" id="l-${attr(L)}">${esc(L)}</h2>\n${es.map(entry).join('\n')}`).join('\n') || '  <p>No entries are published yet.</p>'}
  <p class="legend">${Object.entries(ATT_TITLES).map(([k, t]) => `<abbr class="att">${k}</abbr> ${esc(t)}`).join(' · ')}</p>
</main>`;
  return page({
    ...common(ctx, v), url, title: `Glossary · ${text.title.en}`, description: `Terms, names and images in ${text.title.en}, with their source forms and readings.`,
    pageType: 'translation_glossary', noindex: ctx.preview,
    ld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'DefinedTermSet', '@id': url, url, name: `Glossary · ${text.title.en}`, inLanguage: 'en' },
      breadcrumbLd(url, [['Home', `${site()}/`], ['Translations', `${site()}/translations/index.html`], [text.title.en, `${site()}/${text.publish.dir}/index.html`], ['Glossary', url]]),
    ] },
    crumbsHtml: crumbs([['Home', '../../index.html'], ['Translations', '../index.html'], [text.title.en, 'index.html'], ['Glossary']]),
    body, footer: footer(ctx, '../../'),
  });
}

export function aboutPage(ctx, v) {
  const { text } = ctx;
  const url = `${site()}/${text.publish.dir}/about.html`;
  const wits = text.witnesses.filter(w => w.usage !== 'reviewer-only');
  const who = text.commentary?.author;
  const body = `<main class="prose" id="main">
  <h1>About this edition</h1>
  <p class="lede">${esc(text.title.en)}${text.description ? ': ' + esc(text.description.replace(/\.$/, '')) : ''}. This is an illuminated translation: the English links its key terms to a glossary${who ? `, and ${esc(who)}’s commentary sits beside each passage he explains` : ''}.</p>
  <h2>How it is made</h2>
  <p>Each ${esc(text.unitLabel.toLowerCase())} is drafted with Claude, an AI model, working from the source text, the commentary and this edition’s glossary and style notes. The draft then goes to the reviewer, ${esc(ctx.imprint.replace(/^Translated by /, '').replace(/ with Claude$/, ''))}, who reads every line against the source, edits it, and approves it or sends it back for another draft. Nothing is published until every passage and every glossary term in it has been approved, and each page says who approved it and when.</p>
  <p>Where the drafter was unsure of a reading, the reviewer saw that doubt flagged beside the line. Readings of an image that come from the tradition are attributed in the notes and never replace the image in the verse.</p>
  <h2>Sources</h2>
  <ul class="sources">
${wits.map(w => `    <li>${esc(w.citation)}</li>`).join('\n')}
  </ul>
  <h2>Conventions</h2>
  <dl>
    <dt><span class="pno">10.1</span></dt><dd>A passage number: ${esc(text.unitLabel.toLowerCase())} 10, couplet 1. Numbers are set in red, as manuscripts mark their sections. Select one to copy a link or a citation.</dd>
    <dt><span class="glx">term</span></dt><dd>A glossary term. Select it for its source forms, definition and readings.</dd>
    <dt>ā ṛ ṃ</dt><dd>Old Bengali and Sanskrit are transliterated in IAST from the edition’s Bengali script. Bengali script does not separate b and v, so some transliterations are editorial.</dd>
    <dt><abbr class="att">AS</abbr></dt><dd>How a source form is attested: ${Object.entries(ATT_TITLES).map(([k, t]) => `${k}, ${esc(t)}`).join('; ')}.</dd>
  </dl>
  <h2>Licence and credits</h2>
  <p>Translation licence: ${text.publish.licenseUrl ? `<a href="${attr(text.publish.licenseUrl)}">${esc(text.publish.license)}</a>` : esc(text.publish.license)}. ${text.publish.credits.map(esc).join(' ')}</p>
  <p>The design of these pages takes its cue from the 84000 Reading Room. This edition is not affiliated with 84000.</p>
</main>`;
  return page({
    ...common(ctx, v), url, title: `About this edition · ${text.title.en}`, description: `How ${text.title.en} is translated, reviewed and published, its sources and conventions.`,
    pageType: 'translation_about', noindex: ctx.preview,
    ld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'AboutPage', '@id': url, url, name: `About this edition · ${text.title.en}`, inLanguage: 'en' },
      breadcrumbLd(url, [['Home', `${site()}/`], ['Translations', `${site()}/translations/index.html`], [text.title.en, `${site()}/${text.publish.dir}/index.html`], ['About', url]]),
    ] },
    crumbsHtml: crumbs([['Home', '../../index.html'], ['Translations', '../index.html'], [text.title.en, 'index.html'], ['About this edition']]),
    body, footer: footer(ctx, '../../'),
  });
}

export function textsIndexPage(list, v) {
  const url = `${site()}/translations/index.html`;
  const items = list.map(({ text, published, total, imprint }) => `  <li>
    ${text.title.orig ? `<p class="shelf__orig" lang="${attr(text.title.orig.lang)}">${esc(text.title.orig.text)}</p>` : ''}
    <p class="shelf__title"><a href="${attr(text.publish.dir.replace(/^translations\//, ''))}/index.html">${esc(text.title.en)}</a></p>
    <p class="shelf__desc">${esc(text.description)}</p>
    <p class="shelf__meta">${esc(imprint)} · ${published} of ${total} ${esc(text.unitLabel.toLowerCase())}s published</p>
  </li>`).join('\n');
  const body = `<main class="prose" id="main">
  <h1>Illuminated Translations</h1>
  <p class="lede">Buddhist texts in English, with key terms linked to a glossary and the traditional commentary beside each passage. Each is drafted with Claude and read, edited and approved line by line by a human reviewer before anything is published.</p>
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
    crumbsHtml: crumbs([['Home', '../index.html'], ['Translations']]),
    body,
    footer: '  <p>Made in the manner of the 84000 Reading Room; not affiliated with 84000. · <a href="../index.html">37practices.space</a> · <a href="../privacy.html">Privacy</a> · <a href="#" data-consent-open>Cookie choices</a></p>',
  });
}
