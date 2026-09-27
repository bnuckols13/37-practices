/**
 * Caryāgīti songs: a rāga heading, couplets of two half-lines ("a । b ॥"),
 * a refrain marked ধ্রু, and the poet naming himself in the last couplet.
 * A couplet ends at a line whose tail carries ॥, at a directive, or at a blank
 * line once it holds both halves (Wikisource sets a blank line between halves).
 * One line holding both halves is split at its first internal daṇḍa.
 *
 * An explicit @refrain in a song overrides the ধ্রু marks there: Shastri's
 * edition prints ধ্রু after every couplet that follows the refrain, as a cue
 * to sing it again, so the marks alone would flag every couplet.
 *
 * @split TEXT divides the next line where TEXT begins, as in a parallel file: the
 * part before ends the current block, the rest begins the block the next directive
 * opens (Munidatta running one comment into the next), so the source stays as imported.
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
    let split = null, carry = null;   // @split: the text to cut at, then the cut-off rest awaiting its block

    const closeCouplet = () => {
      if (!buf.length) return;
      const u = st.unit;
      const k = flags.couplet ?? u.counters.couplet + 1;
      u.counters.couplet = k;
      const dhru = buf.some(t => t.includes('ধ্রু'));
      if (flags.refrain) u.explicitRefrain = true;
      halves(buf).forEach((src, i) => {
        const line = {
          id: `${u.id}.${k}${String.fromCharCode(97 + i)}`, group: `${u.id}.${k}`, role: 'line', couplet: k,
          lang: st.lang, witness: st.witness.id, src,
        };
        if (flags.refrain) line.refrain = true;
        else if (dhru) line.dhru = true;
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
          case 'heading': flush(); st.requireUnit(at); mode = 'heading'; resume(); break;
          case 'verse': flush(); st.requireUnit(at); mode = 'verse'; resume(); break;
          case 'skip': flush(); mode = 'skip'; carry = null; break;
          case 'comm': {
            flush(); const u = st.requireUnit(at); mode = 'comm';
            const anchor = !arg ? u.id : /^\d+$/.test(arg) ? `${u.id}.${arg}` : fail(`${at}: @comm takes a couplet number or nothing`);
            seg = { id: `${u.id}.m${++u.counters.seg}`, anchor, lang: st.commLang(), witness: st.witness.id, src: '' };
            u.commentary.push(seg);
            resume();
            break;
          }
          case 'split':
            if (!arg) fail(`${at}: @split needs the text where the next line divides`);
            split = { text: arg.normalize('NFC'), at }; break;
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
        if (mode === 'verse' && buf.length > 1) closeCouplet();
        else if (mode === 'comm' && seg && seg.src) seg.src += '\n';
        continue;
      }
      if (mode === 'skip') continue;
      if (carry) fail(`${carry.at}: the rest of the split line needs a directive right after the line to say where it goes (@comm K, @verse…)`);
      if (split) {
        const i = e.text.indexOf(split.text);
        if (i <= 0) fail(`${split.at}: "${split.text}" is not inside the next line (after its start)`);
        carry = { text: e.text.slice(i).trim(), at: e.at };
        take(e.text.slice(0, i).trim(), e.at);
        split = null;
        continue;
      }
      take(e.text, e.at);
    }
    if (carry) fail(`${carry.at}: the rest of the split line was never placed`);
    flush();

    function take(text, at) {
      const u = st.requireUnit(at);
      if (mode === 'heading') {
        const k = ++u.counters.heading;
        st.pushLine(u, { id: `${u.id}.h${k}`, group: `${u.id}.h`, role: 'heading', lang: st.lang, witness: st.witness.id, src: text });
      } else if (mode === 'comm') {
        seg.src += (seg.src && !seg.src.endsWith('\n') ? ' ' : '') + text;
      } else {
        buf.push(text);
        if (closesCouplet(text)) closeCouplet();
      }
    }
    // The rest of a split line starts the block just opened.
    function resume() { if (carry) { const c = carry; carry = null; take(c.text, c.at); } }
  },

  finish(st) {
    for (const u of st.units.values()) {
      for (const l of u.lines) {
        if (l.dhru && !u.explicitRefrain) l.refrain = true;
        delete l.dhru;
      }
      if (u.explicitBhanita) continue;
      const last = Math.max(0, ...u.lines.filter(l => l.role === 'line').map(l => l.couplet));
      for (const l of u.lines) if (l.role === 'line' && l.couplet === last) l.bhanita = true;
    }
  },
};
