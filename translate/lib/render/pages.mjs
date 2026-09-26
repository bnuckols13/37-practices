/** Song pages, the text hub, the glossary page and the texts index. */

import { passageNo, partOf, pad, unitId } from '../ids.mjs';
import * as markup from '../markup.mjs';
import { esc, attr, page, crumbs, breadcrumbLd, site } from './shell.mjs';

const ATT_TITLES = {
  AS: 'attested in the source manuscript', AO: 'attested in other manuscripts', AD: 'attested in dictionaries',
  AA: 'approximate', RP: 'reconstructed phonetically', RS: 'reconstructed semantically', SU: 'source unspecified',
};

export const fileOf = (text, n) => pad(n, text.idWidth) + '.html';
const groupAnchor = gid => 'c' + partOf(gid);

/** Everything the page renderers need, computed once per render. */
export function makeCtx({ text, units, records, entries, preview }) {
  const publishable = e => e && (e.status === 'approved' || (preview && e.status === 'proposed'));
  const unitById = new Map(units.map(u => [u.id, u]));
  const langName = l => text.lang.names[l] || l;
  const htmlLang = l => text.lang.html[l] || l;

  // Where each term occurs in the published text.
  const where = new Map();
  for (const r of records.values()) {
    const u = unitById.get(r.unit);
    const groupOf = new Map(u.lines.map(l => [l.id, l.group]));
    const add = (id, gid) => {
      const list = where.get(id) || where.set(id, []).get(id);
      const ref = { href: `${fileOf(text, u.n)}#${groupAnchor(gid)}`, label: passageNo(gid) };
      if (!list.some(x => x.href === ref.href)) list.push(ref);
    };
    for (const l of r.lines) for (const t of markup.terms(l.en)) add(t.id, groupOf.get(l.id));
    for (const c of r.commentary) {
      const gid = groupOf.get(c.anchor) || c.anchor;
      for (const t of [...markup.terms(c.translation), ...markup.terms(c.note)]) add(t.id, gid === u.id ? u.lines[0]?.group || gid : gid);
    }
    if (u.poet) add(u.poet, u.lines.find(l => l.role === 'line')?.group || u.id);
  }
  const order = ref => { const [f, a] = ref.href.split('#c'); return [f, Number.parseInt(a, 10) || 0]; };
  for (const list of where.values()) list.sort((x, y) => { const [fa, na] = order(x), [fb, nb] = order(y); return fa.localeCompare(fb) || na - nb; });

  // A reading cites commentary segments; readers see the passage the comment is on.
  const segAnchor = new Map(units.flatMap(u => u.commentary.map(c => [c.id, c.anchor])));
  const onPassage = sid => passageNo(segAnchor.get(sid) || sid);
  const symText = e => {
    if (!e.symbolic.image && !e.symbolic.readings.length) return '';
    const rs = e.symbolic.readings.map(rd => `${rd.referent} (${rd.per}${rd.where.length ? ', on ' + [...new Set(rd.where.map(onPassage))].join(', ') : ''})`);
    return (e.symbolic.image ? `Image: ${e.symbolic.image}. ` : '') + (rs.length ? `Read as ${rs.join('; ')}.` : '');
  };
  const popData = e => ({
    en: e.en, type: e.type,
    forms: e.forms.map(f => ({ lang: langName(f.lang), text: [f.script, f.translit || f.wylie].filter(Boolean).join(' '), att: f.att, attTitle: ATT_TITLES[f.att] || '' })),
    def: e.definition, sym: symText(e),
  });

  const termLink = (surface, id) => {
    const e = entries.get(id);
    if (!publishable(e)) return esc(surface);
    return `<a class="gl${e.type === 'person' ? ' pname' : ''}" href="glossary.html#g-${attr(id)}" data-g="${attr(id)}" aria-expanded="false">${esc(surface)}</a>`;
  };
  const md = s => markup.render(s, termLink, esc);

  return { text, units, unitById, records, entries, preview, publishable, where, langName, htmlLang, popData, md, symText };
}

function footer(ctx, root) {
  const { text } = ctx;
  const lic = text.publish.licenseUrl
    ? `<a href="${attr(text.publish.licenseUrl)}">${esc(text.publish.license)}</a>` : esc(text.publish.license);
  return `  <p><strong>About these translations.</strong> Each ${esc(text.unitLabel.toLowerCase())} was drafted with Claude, an AI model, then read, edited and approved line by line by a named human reviewer before publication; every page says who reviewed it and when. The glossary definitions, notes and commentary translations are original to this edition. ${text.publish.credits.map(esc).join(' ')}</p>
  <p>Translation licence: ${lic}. Made in the manner of the 84000 Reading Room; not affiliated with 84000. · <a href="${root}translations/index.html">All translations</a> · <a href="${root}index.html">37practices.space</a> · <a href="${root}privacy.html">Privacy</a> · <a href="#" data-consent-open>Cookie choices</a></p>`;
}

function sidebar(ctx, current) {
  const { text, records, unitById } = ctx;
  const total = text.catalog.total || Math.max(0, ...ctx.units.map(u => u.n));
  const items = [];
  for (let n = 1; n <= total; n++) {
    const id = unitId(text, n);
    const r = records.get(id);
    const known = unitById.has(id);
    const label = r ? r.title : known ? 'in progress' : text.catalog.lost.includes(n) ? 'lost in the manuscript' : 'not yet translated';
    const cls = 'vlink' + (r ? '' : known ? ' textonly' : ' later') + (id === current ? ' current' : '');
    const inner = `<span class="num">${n}</span><span class="t">${esc(label)}</span>`;
    items.push(r ? `<a class="${cls}" href="${fileOf(text, n)}"${id === current ? ' aria-current="page"' : ''}>${inner}</a>` : `<span class="${cls}">${inner}</span>`);
  }
  return `<aside class="sidebar"><nav aria-label="All ${esc(text.unitLabel.toLowerCase())}s">
<div class="block-label">${esc(text.title.en)}</div>
${items.join('\n')}
<div class="block-label">Reference</div>
<a class="vlink" href="glossary.html"><span class="num">·</span><span class="t">Glossary</span></a>
<a class="vlink" href="index.html"><span class="num">·</span><span class="t">About this edition</span></a>
</nav></aside>`;
}

function provenanceLine(r) {
  if (r.status !== 'approved') return '<p class="prov draft">Unreviewed draft: local preview only, not for publication.</p>';
  const rv = r.provenance.review;
  const n = Object.keys(rv.decisions).length;
  const edited = Object.values(rv.decisions).filter(d => d === 'edited').length;
  return `<p class="prov" title="Draft: ${attr(r.provenance.draft.model)}, ${attr(r.provenance.draft.date)}">Drafted with Claude; reviewed and approved by ${esc(rv.by)}, ${esc(rv.date)} (the reviewer edited ${edited} of ${n} passages).</p>`;
}

function witnessBadges(ctx, u) {
  const { text } = ctx;
  const out = [];
  const lost = text.catalog.lost.includes(u.n), partial = text.catalog.partial.includes(u.n);
  for (const wid of u.witnesses) {
    const w = text.witnesses.find(x => x.id === wid);
    if (!w) continue;
    const l = u.lines.find(x => x.witness === wid);
    out.push(`<span class="badge" title="${attr(w.citation)}">${esc(ctx.langName(l?.lang || w.lang[0]))} · ${esc(w.label || w.id)}</span>`);
  }
  if (lost) out.push('<span class="badge lost">Original lost · translated from the Tibetan</span>');
  else if (partial) out.push('<span class="badge lost">Partly preserved only in Tibetan</span>');
  return out.join('');
}

function muniAside(ctx, c) {
  const who = ctx.text.commentary?.author || 'Commentary';
  return `<aside class="muni" aria-label="${attr(who)}"><div class="label">${esc(who)}</div><p>${ctx.md(c.note)}</p>`
    + `<details><summary>${esc(who)}’s full comment</summary><div class="full"><p>${ctx.md(c.translation)}</p>`
    + (c.translit ? `<p class="tl" lang="${attr(ctx.htmlLang(ctx.text.lang.commentary))}-Latn">${esc(c.translit)}</p>` : '')
    + '</div></details></aside>';
}

export function songPage(ctx, r, prev, next) {
  const { text } = ctx;
  const u = ctx.unitById.get(r.unit);
  const url = `${site()}/${text.publish.dir}/${fileOf(text, u.n)}`;
  const lines = new Map(r.lines.map(l => [l.id, l]));
  const poet = u.poet && ctx.entries.get(u.poet);
  const used = new Set();
  const note = (() => {   // endnote numbering in reading order
    const order = [...r.notes.filter(n => n.anchor === u.id), ...r.notes.filter(n => n.anchor !== u.id)];
    const num = new Map(order.map((n, i) => [n, i + 1]));
    return { order, num };
  })();
  const refsFor = anchors => {
    const refs = r.notes.filter(n => anchors.has(n.anchor))
      .map(n => `<a href="#n${note.num.get(n)}" id="nr${note.num.get(n)}">${note.num.get(n)}</a>`);
    return refs.length ? `<sup class="nref">${refs.join(', ')}</sup>` : '';
  };
  const collect = s => markup.terms(s).forEach(t => used.add(t.id));

  let body = '';
  const headSegs = r.commentary.filter(c => c.anchor === u.id);
  const groups = [];
  for (const l of u.lines) {
    const g = groups[groups.length - 1];
    if (g && g.id === l.group) g.lines.push(l); else groups.push({ id: l.group, lines: [l] });
  }
  for (const g of groups) {
    const first = g.lines[0];
    if (first.role === 'lacuna') { body += `<div class="lacuna">A gap in the manuscript${first.note ? ': ' + esc(first.note) : ''}.</div>\n`; continue; }
    const lnHtml = g.lines.map((l, i) => {
      const t = lines.get(l.id);
      if (!t) return '';
      collect(t.en);
      const refs = i === g.lines.length - 1 ? refsFor(new Set([g.id, ...g.lines.map(x => x.id)])) : '';
      const hl = ctx.htmlLang(l.lang);
      return `<div class="ln"><p class="${first.role === 'heading' ? 'song-head' : 'en'}">${ctx.md(t.en)}${refs}</p>`
        + `<p class="src" lang="${attr(hl)}">${esc(l.src)}</p>`
        + (t.translit ? `<p class="tl" lang="${attr(hl)}-Latn">${esc(t.translit)}</p>` : '')
        + (t.gloss && first.role !== 'heading' ? `<p class="lit">${esc(t.gloss)}</p>` : '') + '</div>';
    }).join('');
    if (first.role === 'heading') { body += `<div class="couplet-head">${lnHtml}</div>\n`; continue; }
    const tags = [first.refrain && 'Refrain', first.bhanita && 'The poet names himself'].filter(Boolean);
    const segs = r.commentary.filter(c => c.anchor === g.id || g.lines.some(l => l.id === c.anchor));
    segs.forEach(c => { collect(c.translation); collect(c.note); });
    body += `<section class="couplet${first.refrain ? ' refrain' : ''}" id="${groupAnchor(g.id)}" data-unit="${attr(g.id)}">`
      + `<a class="pno" href="#${groupAnchor(g.id)}" title="Passage ${passageNo(g.id)}">${passageNo(g.id)}</a>`
      + (tags.length ? `<span class="tag">${tags.join(' · ')}</span>` : '')
      + lnHtml + segs.map(c => muniAside(ctx, c)).join('') + '</section>\n';
  }
  headSegs.forEach(c => { collect(c.translation); collect(c.note); });
  r.notes.forEach(n => collect(n.text));
  collect(r.summary);
  if (poet) used.add(u.poet);

  const glossData = {};
  for (const id of used) { const e = ctx.entries.get(id); if (ctx.publishable(e)) glossData[id] = ctx.popData(e); }
  const termItems = [...used].map(id => ctx.entries.get(id)).filter(e => ctx.publishable(e) && e.type !== 'person')
    .sort((a, b) => a.en.localeCompare(b.en))
    .map(e => `<li><a href="glossary.html#g-${attr(e.id)}">${esc(e.en)}</a></li>`).join('');

  const pos = `${text.unitLabel} ${u.n}${text.catalog.total ? ' of ' + text.catalog.total : ''}${u.raga ? ' · rāga ' + esc(u.raga) : ''}`;
  const title = `${text.unitLabel} ${u.n}: ${r.title} · ${text.title.en}`;
  const pager = (prev ? `<a href="${fileOf(text, prev.n)}"><span class="dir">← Previous</span><span class="t">${text.unitLabel} ${prev.n} · ${esc(prev.title)}</span></a>` : '<a class="spacer"></a>')
    + (next ? `<a class="next" href="${fileOf(text, next.n)}"><span class="dir">Next →</span><span class="t">${text.unitLabel} ${next.n} · ${esc(next.title)}</span></a>` : '<a class="spacer"></a>');
  const hasComm = r.commentary.length > 0;
  const toggles = `<div class="toggles" role="group" aria-label="Show">`
    + `<button type="button" data-toggle="show-src" aria-pressed="false">Source</button>`
    + `<button type="button" data-toggle="show-tl" aria-pressed="false">Transliteration</button>`
    + `<button type="button" data-toggle="show-lit" aria-pressed="false">Literal gloss</button>`
    + (hasComm ? `<button type="button" data-toggle="show-comm" aria-pressed="true">${esc(text.commentary?.author || 'Commentary')}</button>` : '')
    + '</div>';
  const endnotes = note.order.length
    ? `<div class="sec-label">Notes</div><ol class="endnotes">${note.order.map(n => `<li id="n${note.num.get(n)}"><span class="kind">${esc(n.kind)}</span>${ctx.md(n.text)}${n.anchor !== u.id ? ` <a href="#nr${note.num.get(n)}" aria-label="Back to the passage">↩</a>` : ''}</li>`).join('')}</ol>` : '';
  const scripts = [...new Set(u.lines.map(l => ctx.htmlLang(l.lang)))];

  const article = `<div class="vhead"><div class="eyebrow">${pos}</div><h1>${esc(r.title)}</h1><div class="rule"></div></div>
<div class="badges">${poet && ctx.publishable(poet) ? `<a class="gl person" href="glossary.html#g-${attr(u.poet)}" data-g="${attr(u.poet)}" aria-expanded="false">${esc(poet.en)}</a>` : ''}${witnessBadges(ctx, u)}</div>
${provenanceLine(r)}
<p class="summary">${ctx.md(r.summary)}</p>
${toggles}
${headSegs.map(c => muniAside(ctx, c)).join('')}
${body}${endnotes}
${termItems ? `<div class="sec-label">Terms in this ${esc(text.unitLabel.toLowerCase())}</div><ul class="termlist">${termItems}</ul>` : ''}`;

  return page({
    root: '../../', url, title, description: `${text.unitLabel} ${u.n} of ${text.title.en}: ${markup.strip(r.summary)}`.slice(0, 300),
    pageType: 'translation', unitAttr: u.id, fonts: scripts, glossData, bodyClass: hasComm ? 'show-comm' : '',
    noindex: r.status !== 'approved',
    ld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebPage', '@id': url, url, name: title, inLanguage: 'en', isPartOf: { '@id': `${site()}/#website` }, breadcrumb: { '@id': url + '#breadcrumb' } },
      breadcrumbLd(url, [['Home', `${site()}/`], ['Translations', `${site()}/translations/index.html`], [text.title.en, `${site()}/${text.publish.dir}/index.html`], [`${text.unitLabel} ${u.n}`, url]]),
    ] },
    masthead: `<div class="title"><a href="index.html">${esc(text.title.en)}</a></div>`,
    crumbsHtml: crumbs([['Home', '../../index.html'], ['Translations', '../index.html'], [text.title.en, 'index.html'], [`${text.unitLabel} ${u.n}`]]),
    body: `<div class="app">
${sidebar(ctx, u.id)}
  <main class="reader">
    <article>${article}</article>
    <nav class="pager" aria-label="Previous and next">${pager}</nav>
  </main>
</div>`,
    footer: footer(ctx, '../../'),
  });
}

export function hubPage(ctx) {
  const { text, records, unitById } = ctx;
  const url = `${site()}/${text.publish.dir}/index.html`;
  const total = text.catalog.total || Math.max(0, ...ctx.units.map(u => u.n));
  const rows = [];
  for (let n = 1; n <= total; n++) {
    const id = unitId(text, n);
    const r = records.get(id), u = unitById.get(id);
    const poet = r && u?.poet && ctx.entries.get(u.poet);
    const status = r ? (r.status === 'approved' ? 'published' : 'draft (preview)') : u ? 'in progress' : text.catalog.lost.includes(n) ? 'lost in the manuscript; survives in Tibetan' : 'not yet translated';
    rows.push(`<tr${r ? '' : ' class="pending"'}><td>${n}</td><td>${r ? `<a href="${fileOf(text, n)}">${esc(r.title)}</a>` : '—'}</td>`
      + `<td>${poet && ctx.publishable(poet) ? esc(poet.en) : '—'}</td><td>${r && u.raga ? esc(u.raga) : '—'}</td><td>${esc(status)}</td></tr>`);
  }
  const published = [...records.values()].filter(r => r.status === 'approved').length;
  const who = text.commentary?.author;
  return page({
    root: '../../', url, title: `${text.title.en} · Illuminated Translations`, description: text.description, pageType: 'translation_hub',
    noindex: ctx.preview,
    ld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'CollectionPage', '@id': url, url, name: text.title.en, description: text.description, inLanguage: 'en', breadcrumb: { '@id': url + '#breadcrumb' } },
      breadcrumbLd(url, [['Home', `${site()}/`], ['Translations', `${site()}/translations/index.html`], [text.title.en, url]]),
    ] },
    masthead: `<h1>${esc(text.title.en)}</h1>\n  <p>${esc(text.description)}</p>`,
    crumbsHtml: crumbs([['Home', '../../index.html'], ['Translations', '../index.html'], [text.title.en]]),
    body: `<main class="reader hub" style="margin:0 auto">
  <p class="hub-intro">This is an illuminated translation. Key terms in the English link to a <a href="glossary.html">glossary</a> giving the source word, how it is attested and how the tradition reads it${who ? `, and ${esc(who)}’s commentary is woven in beside each passage it explains` : ''}. You can show the source text, a transliteration and a word-by-word gloss under every line.</p>
  <p class="hub-intro">Each ${esc(text.unitLabel.toLowerCase())} was drafted with Claude and then read, edited and approved by a named human reviewer; nothing is published without that review. ${published} of ${total} ${esc(text.unitLabel.toLowerCase())}s are published so far.${text.catalog.note ? ' ' + esc(text.catalog.note) : ''}</p>
  <table class="hubtable"><thead><tr><th>#</th><th>${esc(text.unitLabel)}</th><th>Poet</th><th>Rāga</th><th>Status</th></tr></thead><tbody>
${rows.join('\n')}
  </tbody></table>
</main>`,
    footer: footer(ctx, '../../'),
  });
}

export function glossaryPage(ctx) {
  const { text } = ctx;
  const url = `${site()}/${text.publish.dir}/glossary.html`;
  const ids = [...ctx.where.keys()].filter(id => ctx.publishable(ctx.entries.get(id)));
  const fold = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const list = ids.map(id => ctx.entries.get(id)).sort((a, b) => fold(a.en).localeCompare(fold(b.en)));
  const types = [...new Set(list.map(e => e.type))];
  const items = list.map(e => {
    const forms = e.forms.map(f => `${esc(ctx.langName(f.lang))} ${f.script ? `<span lang="${attr(ctx.htmlLang(f.lang))}">${esc(f.script)}</span> ` : ''}<em>${esc(f.translit || f.wylie || '')}</em><span class="att" title="${attr(ATT_TITLES[f.att] || '')}">${esc(f.att)}</span>`).join(' · ');
    const refs = (ctx.where.get(e.id) || []).map(x => `<a href="${attr(x.href)}">${esc(x.label)}</a>`).join(', ');
    const sym = ctx.symText(e);
    return `<article class="gentry" id="g-${attr(e.id)}" data-type="${attr(e.type)}">
  <h2>${esc(e.en)}</h2><div class="ty">${esc(e.type)}${e.status !== 'approved' ? ' · proposed (preview)' : ''}</div>
  ${forms ? `<p class="forms">${forms}</p>` : ''}
  ${e.definition ? `<p>${esc(e.definition)}</p>` : ''}
  ${sym ? `<p>${esc(sym)}</p>` : ''}
  ${e.alt.length ? `<p class="forms">Also rendered: ${e.alt.map(esc).join(', ')}</p>` : ''}
  ${refs ? `<p class="where">Appears in: ${refs}</p>` : ''}
</article>`;
  }).join('\n');
  return page({
    root: '../../', url, title: `Glossary · ${text.title.en}`, description: `Glossary of terms, names and images in ${text.title.en}.`, pageType: 'translation_glossary',
    noindex: ctx.preview,
    ld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'DefinedTermSet', '@id': url, url, name: `Glossary · ${text.title.en}`, inLanguage: 'en' },
      breadcrumbLd(url, [['Home', `${site()}/`], ['Translations', `${site()}/translations/index.html`], [text.title.en, `${site()}/${text.publish.dir}/index.html`], ['Glossary', url]]),
    ] },
    masthead: `<div class="title"><a href="index.html">${esc(text.title.en)}</a></div>\n  <p>Glossary</p>`,
    crumbsHtml: crumbs([['Home', '../../index.html'], ['Translations', '../index.html'], [text.title.en, 'index.html'], ['Glossary']]),
    body: `<main class="reader hub" style="margin:0 auto">
  <p class="hub-intro">Every entry is written for this edition. Source forms carry a code saying how the form is attested; readings are attributed to whoever reads the image that way, with the passage where they say so.</p>
  ${types.length > 1 ? `<div class="gfilters" role="group" aria-label="Filter by type"><button type="button" data-type="all" aria-pressed="true">All</button>${types.map(t => `<button type="button" data-type="${attr(t)}" aria-pressed="false">${esc(t)}s</button>`).join('')}</div>` : ''}
${items || '<p>No entries published yet.</p>'}
  <p class="legend">${Object.entries(ATT_TITLES).map(([k, v]) => `<span class="att">${k}</span> ${esc(v)}`).join(' · ')}</p>
</main>`,
    footer: footer(ctx, '../../'),
  });
}

export function textsIndexPage(list) {
  const url = `${site()}/translations/index.html`;
  const items = list.map(({ text, published, total }) => `<a class="vlink" href="${attr(text.publish.dir.replace(/^translations\//, ''))}/index.html"><span class="num">${published}</span><span class="t"><strong>${esc(text.title.en)}</strong> · ${esc(text.description)} (${published} of ${total} published)</span></a>`).join('\n');
  return page({
    root: '../', url, title: 'Illuminated Translations · 37practices.space', description: 'Buddhist texts in English with glossary-linked terms and the traditional commentary woven in.',
    pageType: 'translation_index',
    ld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'CollectionPage', '@id': url, url, name: 'Illuminated Translations', inLanguage: 'en', breadcrumb: { '@id': url + '#breadcrumb' } },
      breadcrumbLd(url, [['Home', `${site()}/`], ['Translations', url]]),
    ] },
    masthead: '<h1>Illuminated Translations</h1>\n  <p>Buddhist texts in English, with key terms linked to a glossary and the traditional commentary woven in.</p>',
    crumbsHtml: crumbs([['Home', '../index.html'], ['Translations']]),
    body: `<main class="reader hub" style="margin:0 auto">
  <p class="hub-intro">Each text is drafted with Claude and reviewed, edited and approved line by line by a human reviewer before anything is published.</p>
  <nav aria-label="Texts">
${items || '<p>Nothing published yet.</p>'}
  </nav>
</main>`,
    footer: `  <p>Made in the manner of the 84000 Reading Room; not affiliated with 84000. · <a href="../index.html">37practices.space</a> · <a href="../privacy.html">Privacy</a> · <a href="#" data-consent-open>Cookie choices</a></p>`,
  });
}
