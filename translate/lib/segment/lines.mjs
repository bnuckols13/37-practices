/**
 * Generic rule for "any text": each text line is a line; blank lines separate
 * stanzas (groups). Without a @unit directive everything is unit 1.
 */

import { fail } from '../io.mjs';

export const lines = {
  file(st, evs) {
    let mode = 'verse', seg = null;
    const unit = at => st.unit || (st.unit = st.unitOf(1, at));

    for (const e of evs) {
      if (e.type === 'directive') {
        const { name, arg, at } = e;
        switch (name) {
          case '--': break;
          case 'unit': case 'song': {
            const [n, ...title] = arg.split(/\s+/);
            st.unit = st.unitOf(Number(n), at); if (title.length) st.unit.title = title.join(' ');
            mode = 'verse'; seg = null; st.lang = st.witness.lang[0]; break;
          }
          case 'title': unit(at).title = arg; break;
          case 'heading': seg = null; unit(at); mode = 'heading'; break;
          case 'verse': seg = null; mode = 'verse'; break;
          case 'skip': seg = null; mode = 'skip'; break;
          case 'comm': {
            const u = unit(at); mode = 'comm';
            const anchor = !arg ? u.id : /^\d+$/.test(arg) ? `${u.id}.${arg}` : /^s\d+$/.test(arg) ? `${u.id}.${arg}`
              : fail(`${at}: @comm takes a line number, a stanza (s2) or nothing`);
            seg = { id: `${u.id}.m${++u.counters.seg}`, anchor, lang: st.commLang(), witness: st.witness.id, src: '' };
            u.commentary.push(seg);
            break;
          }
          case 'lang': st.lang = arg || fail(`${at}: @lang needs a code`); if (seg) seg.lang = st.lang; break;
          case 'lacuna': {
            const u = unit(at); const id = `${u.id}.x${++u.counters.lacuna}`;
            st.pushLine(u, { id, group: id, role: 'lacuna', lang: st.lang, witness: st.witness.id, src: '', ...(arg ? { note: arg } : {}) });
            break;
          }
          case 'emend': st.parseEmend(arg, at); break;
          case 'raga': case 'poet': unit(at)[name] = arg; break;
          default: fail(`${at}: unknown directive @${name}`);
        }
        continue;
      }
      if (e.type === 'blank') {
        if (mode === 'verse' && st.unit) {
          const u = st.unit;
          if (u.lines.some(l => l.group === `${u.id}.s${u.counters.stanza}`)) u.counters.stanza++;
        } else if (mode === 'comm' && seg && seg.src) seg.src += '\n';
        continue;
      }
      if (mode === 'skip') continue;
      const u = unit(e.at);
      if (mode === 'heading') {
        const k = ++u.counters.heading;
        st.pushLine(u, { id: `${u.id}.h${k}`, group: `${u.id}.h`, role: 'heading', lang: st.lang, witness: st.witness.id, src: e.text });
      } else if (mode === 'comm') {
        seg.src += (seg.src && !seg.src.endsWith('\n') ? ' ' : '') + e.text;
      } else {
        const k = ++u.counters.line;
        st.pushLine(u, { id: `${u.id}.${k}`, group: `${u.id}.s${u.counters.stanza}`, role: 'line', lang: st.lang, witness: st.witness.id, src: e.text });
      }
    }
  },
  finish() {},
};
