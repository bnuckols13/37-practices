/**
 * Caryāgīti songs: a rāga heading, couplets of two half-lines ("a । b ॥"),
 * a refrain marked ধ্রু, and the poet naming himself in the last couplet.
 * A couplet ends at a line whose tail carries ॥ (or at a blank line / directive).
 * One line holding both halves is split at its first internal daṇḍa.
 */

import { fail } from '../io.mjs';

const CLOSES = /[\s॥০-৯0-9]*(?:ধ্রু[\s॥০-৯0-9]*)?$/;
const closesCouplet = t => CLOSES.exec(t)[0].includes('॥');

function halves(buf) {
  if (buf.length > 1) return buf;
  const t = buf[0];
  const i = t.indexOf('।');
  if (i > 0 && t.slice(i + 1).replace(/[\s।॥০-৯0-9]|ধ্রু/g, '')) {
    return [t.slice(0, i + 1).trim(), t.slice(i + 1).trim()];
  }
  return [t];
}

export const caryagiti = {
  file(st, evs) {
    let mode = 'verse', buf = [], seg = null, flags = {};

    const closeCouplet = () => {
      if (!buf.length) return;
      const u = st.unit;
      const k = flags.couplet ?? u.counters.couplet + 1;
      u.counters.couplet = k;
      const refrain = !!flags.refrain || buf.some(t => t.includes('ধ্রু'));
      halves(buf).forEach((src, i) => {
        const line = {
          id: `${u.id}.${k}${String.fromCharCode(97 + i)}`, group: `${u.id}.${k}`, role: 'line', couplet: k,
          lang: st.lang, witness: st.witness.id, src,
        };
        if (refrain) line.refrain = true;
        if (flags.bhanita) line.bhanita = true;
        st.pushLine(u, line);
      });
      if (flags.bhanita) u.explicitBhanita = true;
      buf = []; flags = {};
    };
    const closeSeg = () => { seg = null; };
    const flush = () => { closeCouplet(); closeSeg(); };

    for (const e of evs) {
      if (e.type === 'directive') {
        const { name, arg, at } = e;
        switch (name) {
          case '--': break;
          case 'song': case 'unit':
            flush(); st.unit = st.unitOf(Number(arg.split(/\s+/)[0]), at); mode = 'verse'; st.lang = st.witness.lang[0]; break;
          case 'raga': st.requireUnit(at).raga = arg; break;
          case 'poet': st.requireUnit(at).poet = arg; break;
          case 'title': st.requireUnit(at).title = arg; break;
          case 'heading': flush(); st.requireUnit(at); mode = 'heading'; break;
          case 'verse': flush(); st.requireUnit(at); mode = 'verse'; break;
          case 'skip': flush(); mode = 'skip'; break;
          case 'comm': {
            flush(); const u = st.requireUnit(at); mode = 'comm';
            const anchor = !arg ? u.id : /^\d+$/.test(arg) ? `${u.id}.${arg}` : fail(`${at}: @comm takes a couplet number or nothing`);
            seg = { id: `${u.id}.m${++u.counters.seg}`, anchor, lang: st.commLang(), witness: st.witness.id, src: '' };
            u.commentary.push(seg);
            break;
          }
          case 'couplet': closeCouplet(); flags.couplet = Number(arg); if (!Number.isInteger(flags.couplet)) fail(`${at}: @couplet needs a number`); break;
          case 'refrain': closeCouplet(); flags.refrain = true; break;
          case 'bhanita': closeCouplet(); flags.bhanita = true; break;
          case 'lang': st.lang = arg || fail(`${at}: @lang needs a code`); if (seg) seg.lang = st.lang; break;
          case 'lacuna': {
            flush(); const u = st.requireUnit(at); const id = `${u.id}.x${++u.counters.lacuna}`;
            st.pushLine(u, { id, group: id, role: 'lacuna', lang: st.lang, witness: st.witness.id, src: '', ...(arg ? { note: arg } : {}) });
            break;
          }
          case 'emend': st.parseEmend(arg, at); break;
          default: fail(`${at}: unknown directive @${name}`);
        }
        continue;
      }
      if (e.type === 'blank') {
        if (mode === 'verse') closeCouplet();
        else if (mode === 'comm' && seg && seg.src) seg.src += '\n';
        continue;
      }
      if (mode === 'skip') continue;
      const u = st.requireUnit(e.at);
      if (mode === 'heading') {
        const k = ++u.counters.heading;
        st.pushLine(u, { id: `${u.id}.h${k}`, group: `${u.id}.h`, role: 'heading', lang: st.lang, witness: st.witness.id, src: e.text });
      } else if (mode === 'comm') {
        seg.src += (seg.src && !seg.src.endsWith('\n') ? ' ' : '') + e.text;
      } else {
        buf.push(e.text);
        if (closesCouplet(e.text)) closeCouplet();
      }
    }
    flush();
  },

  finish(st) {
    for (const u of st.units.values()) {
      if (u.explicitBhanita) continue;
      const last = Math.max(0, ...u.lines.filter(l => l.role === 'line').map(l => l.couplet));
      for (const l of u.lines) if (l.role === 'line' && l.couplet === last) l.bhanita = true;
    }
  },
};
