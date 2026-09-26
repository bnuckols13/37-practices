/** What every page renderer needs, computed once per render. */

import { passageNo, partOf, pad } from '../ids.mjs';
import * as markup from '../markup.mjs';
import { config } from '../io.mjs';
import { esc, attr } from './shell.mjs';

export const ATT_TITLES = {
  AS: 'attested in the source manuscript', AO: 'attested in other manuscripts', AD: 'attested in dictionaries',
  AA: 'approximate', RP: 'reconstructed phonetically', RS: 'reconstructed semantically', SU: 'source unspecified',
};

export const fileOf = (text, n) => pad(n, text.idWidth) + '.html';
export const groupAnchor = gid => 'c' + partOf(gid);

export function makeCtx({ text, units, records, entries, preview }) {
  const publishable = e => e && (e.status === 'approved' || (preview && e.status === 'proposed'));
  const unitById = new Map(units.map(u => [u.id, u]));
  const langName = l => text.lang.names[l] || l;
  const htmlLang = l => text.lang.html[l] || l;
  const imprint = text.publish.imprint || `Translated by ${config().reviewer || 'the reviewer'} with Claude`;

  // Where each term occurs in the published text, in reading order.
  const where = new Map();
  for (const r of [...records.values()].sort((a, b) => a.n - b.n)) {
    const u = unitById.get(r.unit);
    const groupOf = new Map(u.lines.map(l => [l.id, l.group]));
    const firstGroup = u.lines.find(l => l.role === 'line')?.group || u.id;
    const add = (id, gid) => {
      const list = where.get(id) || where.set(id, []).get(id);
      const ref = { href: `${fileOf(text, u.n)}#${groupAnchor(gid)}`, label: passageNo(gid), n: u.n };
      if (!list.some(x => x.href === ref.href)) list.push(ref);
    };
    for (const l of r.lines) for (const t of markup.terms(l.en)) add(t.id, groupOf.get(l.id));
    for (const c of r.commentary) {
      const gid = groupOf.get(c.anchor) || (c.anchor === u.id ? firstGroup : c.anchor);
      for (const t of [...markup.terms(c.translation), ...markup.terms(c.note)]) add(t.id, gid);
    }
    if (u.poet) add(u.poet, firstGroup);
  }
  for (const list of where.values()) {
    list.sort((a, b) => a.n - b.n || Number.parseInt(a.href.split('#c')[1], 10) - Number.parseInt(b.href.split('#c')[1], 10));
  }

  // A reading cites commentary segments; readers see the passage the comment is on.
  const segAnchor = new Map(units.flatMap(u => u.commentary.map(c => [c.id, c.anchor])));
  const onPassage = sid => passageNo(segAnchor.get(sid) || sid);
  const symText = e => {
    if (!e.symbolic.image && !e.symbolic.readings.length) return '';
    const rs = e.symbolic.readings.map(rd => `${rd.referent} (${rd.per}${rd.where.length ? ', on ' + [...new Set(rd.where.map(onPassage))].join(', ') : ''})`);
    return (e.symbolic.image ? `Image: ${e.symbolic.image}. ` : '') + (rs.length ? `Read as ${rs.join('; ')}.` : '');
  };
  const popData = e => ({
    en: e.en, type: e.type, def: e.definition, sym: symText(e),
    forms: e.forms.map(f => ({ lang: langName(f.lang), html: htmlLang(f.lang), script: f.script, translit: f.translit || f.wylie || '', att: f.att, attTitle: ATT_TITLES[f.att] || '' })),
    where: (where.get(e.id) || []).map(w => ({ href: w.href, label: w.label })),
  });

  const termLink = (surface, id) => {
    const e = entries.get(id);
    if (!publishable(e)) return esc(surface);
    return `<a class="gl" href="glossary.html#g-${attr(id)}" data-g="${attr(id)}" aria-expanded="false">${esc(surface)}</a>`;
  };
  const md = s => markup.render(s, termLink, esc);

  return { text, units, unitById, records, entries, preview, publishable, where, langName, htmlLang, popData, md, symText, imprint };
}

/** The client-side search index for one text. */
export function searchIndex(ctx) {
  const docs = [];
  const { text } = ctx;
  for (const r of [...ctx.records.values()].sort((a, b) => a.n - b.n)) {
    const u = ctx.unitById.get(r.unit);
    const file = fileOf(text, u.n);
    const byGroup = new Map();
    for (const l of u.lines.filter(x => x.role === 'line')) {
      const t = r.lines.find(x => x.id === l.id);
      if (!t) continue;
      const g = byGroup.get(l.group) || byGroup.set(l.group, { en: [], tl: [] }).get(l.group);
      g.en.push(markup.strip(t.en)); g.tl.push(t.translit);
    }
    const poet = u.poet && ctx.entries.get(u.poet)?.en;
    for (const [gid, g] of byGroup) docs.push(['p', passageNo(gid), `${file}#${groupAnchor(gid)}`, `${text.unitLabel} ${u.n}${poet ? ' · ' + poet : ''}`, g.en.join(' / '), g.tl.join(' / ')]);
    for (const c of r.commentary) {
      const gid = u.lines.find(l => l.id === c.anchor)?.group || c.anchor;
      const target = gid === u.id ? file : `${file}#${groupAnchor(gid)}`;
      docs.push(['c', gid === u.id ? String(u.n) : passageNo(gid), target, text.commentary?.author || 'Commentary', markup.strip(c.note), markup.strip(c.translation)]);
    }
  }
  for (const [id] of ctx.where) {
    const e = ctx.entries.get(id);
    if (ctx.publishable(e)) docs.push(['g', id, `glossary.html#g-${id}`, e.en, e.definition, [...e.alt, ...e.forms.map(f => f.translit)].join(' ')]);
  }
  return { v: 1, text: text.slug, docs };
}
