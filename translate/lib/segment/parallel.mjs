/**
 * A parallel witness: a translation of the same text (the Tibetan of the songs
 * and of Munidatta's commentary), marked with the same directives, whose lines
 * attach to the ids the reading text already has instead of making new ones.
 *
 * A source file whose first directive is @parallel is read this way:
 *   @song N          the unit it runs parallel to
 *   @heading @verse  the following lines match the unit's headings / verse lines, in order
 *   @couplet N       the next verse line matches couplet N's first half-line
 *   @comm [K]        the following lines match the reading text's segment on couplet K
 *                    (bare: on the whole unit); a second @comm K matches the second such segment
 *   @primary         from here on in this unit, the lines are the reading text itself, for
 *                    what the reading witness lacks (a lost song, a lost ending): verse lines
 *                    pair into couplets and @comm makes a segment, in this witness's language
 *   @parallel        back to matching
 *   @refrain @bhanita @raga @poet @title @lacuna @emend   as in the reading text (for @primary)
 *   @skip @--
 * Lines of a comment are joined with a space, which restores the imported text exactly
 * (the importer breaks lines only at a space).
 */

import { fail } from '../io.mjs';

export const isParallel = content => {
  for (const line of content.split('\n')) {
    const m = /^\s*@([a-z]+|--)/.exec(line);
    if (m && m[1] !== '--') return m[1] === 'parallel';
  }
  return false;
};

/** Read one parallel file into per-unit records; nothing is attached yet. */
export function readParallel(st, evs) {
  const wid = st.witness.id, lang = st.witness.lang[0];
  const recs = [];
  let rec = null, primary = false, mode = 'skip', comm = null, buf = [], flags = {};

  const need = at => rec || fail(`${at}: text before any @song`);
  const closeCouplet = () => {
    if (!buf.length) return;
    rec.pVerse.push({ lines: buf, flags });
    buf = []; flags = {};
  };
  const flush = () => { closeCouplet(); comm = null; };

  for (const e of evs) {
    if (e.type === 'directive') {
      const { name, arg, at } = e;
      switch (name) {
        case '--': break;
        case 'parallel': flush(); primary = false; break;
        case 'primary': flush(); need(at); primary = true; break;
        case 'song': case 'unit': {
          flush();
          const n = Number(arg.split(/\s+/)[0]);
          if (!Number.isInteger(n) || n < 1) fail(`${at}: unit number must be a positive integer`);
          rec = { n, at, witness: wid, lang, heading: [], verse: [], comm: [], pHeading: [], pVerse: [], pComm: [], pLacuna: [], meta: {} };
          recs.push(rec); primary = false; mode = 'verse';
          break;
        }
        case 'raga': case 'poet': case 'title': need(at).meta[name] = arg; break;
        case 'heading': flush(); need(at); mode = 'heading'; break;
        case 'verse': flush(); need(at); mode = 'verse'; break;
        case 'skip': flush(); mode = 'skip'; break;
        case 'comm': {
          flush(); need(at); mode = 'comm';
          if (arg && !/^\d+$/.test(arg)) fail(`${at}: @comm takes a couplet number or nothing`);
          comm = { arg, at, text: [] };
          (primary ? rec.pComm : rec.comm).push(comm);
          break;
        }
        case 'couplet': {
          const k = Number(arg);
          if (!Number.isInteger(k)) fail(`${at}: @couplet needs a number`);
          if (primary) { closeCouplet(); flags.couplet = k; } else need(at).jump = k;
          break;
        }
        case 'refrain': case 'bhanita':
          if (!primary) fail(`${at}: @${name} marks the reading text; in a parallel it belongs on the reading witness's own line (or put @primary first)`);
          closeCouplet(); flags[name] = true; break;
        case 'lacuna':
          if (!primary) fail(`${at}: @lacuna in a parallel: the reading text keeps its own lacunae`);
          flush(); rec.pLacuna.push({ note: arg, at }); break;
        case 'lang': fail(`${at}: a parallel file is in its witness's language (${lang})`); break;
        case 'emend':
          if (!primary) fail(`${at}: @emend corrects the reading text; put it after @primary`);
          st.parseEmend(arg, at); break;
        default: fail(`${at}: unknown directive @${name}`);
      }
      continue;
    }
    if (e.type === 'blank' || mode === 'skip') continue;
    need(e.at);
    if (mode === 'comm') comm.text.push(e.text);
    else if (mode === 'heading') (primary ? rec.pHeading : rec.heading).push({ text: e.text, at: e.at });
    else if (primary) { buf.push(e.text); if (buf.length === 2) closeCouplet(); }
    else { rec.verse.push({ text: e.text, at: e.at, ...(rec.jump ? { couplet: rec.jump } : {}) }); delete rec.jump; }
  }
  flush();
  return recs;
}

/** Records marked @primary become lines and segments of the unit, as if the reading witness had them. */
export function addPrimary(st, recs) {
  for (const r of recs) {
    if (!r.pHeading.length && !r.pVerse.length && !r.pComm.length && !r.pLacuna.length) continue;
    const u = st.unitOf(r.n, r.at);
    for (const [k, v] of Object.entries(r.meta)) if (!u[k]) u[k] = v;
    for (const h of r.pHeading) {
      st.pushLine(u, { id: `${u.id}.h${++u.counters.heading}`, group: `${u.id}.h`, role: 'heading', lang: r.lang, witness: r.witness, src: h.text });
    }
    for (const c of r.pVerse) {
      const k = c.flags.couplet ?? u.counters.couplet + 1;
      u.counters.couplet = k;
      if (c.flags.refrain) u.explicitRefrain = true;
      if (c.flags.bhanita) u.explicitBhanita = true;
      c.lines.forEach((src, i) => st.pushLine(u, {
        id: `${u.id}.${k}${String.fromCharCode(97 + i)}`, group: `${u.id}.${k}`, role: 'line', couplet: k,
        lang: r.lang, witness: r.witness, src,
        ...(c.flags.refrain ? { refrain: true } : {}), ...(c.flags.bhanita ? { bhanita: true } : {}),
      }));
    }
    for (const x of r.pLacuna) {
      const id = `${u.id}.x${++u.counters.lacuna}`;
      st.pushLine(u, { id, group: id, role: 'lacuna', lang: r.lang, witness: r.witness, src: '', ...(x.note ? { note: x.note } : {}) });
    }
    for (const c of r.pComm) {
      u.commentary.push({ id: `${u.id}.m${++u.counters.seg}`, anchor: c.arg ? `${u.id}.${c.arg}` : u.id, lang: r.lang, witness: r.witness, src: c.text.join(' ') });
    }
  }
}

/**
 * Attach the matching (non-primary) records to the reading text's ids.
 * Returns warnings for reading-text lines and segments left without a parallel,
 * in units the witness covers at all. More parallel lines than the reading text has is an error.
 */
export function attachParallels(st, recs) {
  const warnings = [];
  const covered = new Map();   // unit id -> Set of witnesses with parallel material
  for (const r of recs) {
    if (!r.heading.length && !r.verse.length && !r.comm.length) continue;
    const u = st.units.get(r.n);
    if (!u) fail(`${r.at}: the reading text has no unit ${r.n}; if the ${r.witness} text is all that survives, mark its lines @primary`);
    const par = ((u.parallels ||= {})[r.witness] ||= { lang: r.lang, lines: {}, commentary: {} });
    (covered.get(u.id) || covered.set(u.id, new Set()).get(u.id)).add(r.witness);
    const own = x => x.witness !== r.witness;

    const headings = u.lines.filter(l => own(l) && l.role === 'heading');
    r.heading.forEach((x, i) => {
      const t = headings[i] || fail(`${x.at}: ${u.id} has ${headings.length} heading line(s) in the reading text; this is one more`);
      par.lines[t.id] = x.text;
    });

    const verse = u.lines.filter(l => own(l) && l.role === 'line');
    let at = 0;
    for (const x of r.verse) {
      if (x.couplet) {
        at = verse.findIndex(l => l.couplet === x.couplet);
        if (at < 0) fail(`${x.at}: ${u.id} has no couplet ${x.couplet} in the reading text`);
      }
      const t = verse[at++];
      if (!t) fail(`${x.at}: ${u.id} has ${verse.length} verse line(s) in the reading text and the ${r.witness} text has more here; if the reading witness lacks them, put @primary before them`);
      if (par.lines[t.id]) fail(`${x.at}: ${t.id} already has a ${r.witness} line`);
      par.lines[t.id] = x.text;
    }

    const byAnchor = new Map();
    for (const s of u.commentary.filter(own)) (byAnchor.get(s.anchor) || byAnchor.set(s.anchor, []).get(s.anchor)).push(s);
    const used = new Map();
    for (const c of r.comm) {
      const anchor = c.arg ? `${u.id}.${c.arg}` : u.id;
      const i = used.get(anchor) || 0;
      const t = (byAnchor.get(anchor) || [])[i];
      if (!t) fail(`${c.at}: ${u.id} has ${i ? 'only ' + i : 'no'} commentary segment${c.arg ? ` on couplet ${c.arg}` : ' on the whole unit'} in the reading text${i ? '' : `; if the reading witness lacks it, put @primary before it`}`);
      used.set(anchor, i + 1);
      par.commentary[t.id] = (par.commentary[t.id] ? par.commentary[t.id] + ' ' : '') + c.text.join(' ');
    }
  }
  for (const [uid, wids] of covered) {
    const u = [...st.units.values()].find(x => x.id === uid);
    for (const wid of wids) {
      const par = u.parallels[wid];
      const lines = u.lines.filter(l => l.witness !== wid && l.role !== 'lacuna' && !(l.id in par.lines)).map(l => l.id);
      const segs = u.commentary.filter(s => s.witness !== wid && !(s.id in par.commentary)).map(s => s.id);
      if (lines.length || segs.length) warnings.push(`${uid}: no ${wid} parallel for ${[...lines, ...segs].join(', ')}`);
    }
  }
  return warnings;
}
