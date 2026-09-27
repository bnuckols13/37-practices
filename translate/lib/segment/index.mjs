/**
 * Segmentation: marked source files -> units with stable ids.
 *
 * Directives are whole lines starting with "@":
 *   @song N / @unit N [title]   start (or continue) a unit
 *   @raga X  @poet ID  @title X unit metadata
 *   @heading  @verse  @skip     what the following text lines are
 *   @comm [K|sK]                commentary segment about couplet K (or stanza sK); bare = whole unit
 *   @couplet N                  number the next couplet N
 *   @refrain  @bhanita          flag the next couplet
 *   @lang CODE                  language of the following lines
 *   @lacuna [note]              a gap in the witness
 *   @emend ID FROM => TO | why  correct a line; recorded on the unit, raw text untouched
 *   @-- anything                comment
 *
 * A file that starts with @parallel is a translation of the same text; its lines
 * attach to the reading text's ids (see parallel.mjs).
 */

import { hashOf, fail, rel } from '../io.mjs';
import { unitId } from '../ids.mjs';
import { transliterate } from '../translit/index.mjs';
import { isDirective } from '../source.mjs';
import { caryagiti } from './caryagiti.mjs';
import { lines as linesRule } from './lines.mjs';
import { isParallel, readParallel, addPrimary, attachParallels } from './parallel.mjs';

const RULES = { caryagiti, lines: linesRule };

export function events(content, file) {
  return content.replace(/\r\n?/g, '\n').split('\n').map((raw, i) => {
    const line = raw.normalize('NFC');
    const at = `${file}:${i + 1}`;
    if (isDirective(line)) {
      const m = /^\s*@(--|[a-z]+)\s*(.*)$/.exec(line);
      if (!m) fail(`${at}: malformed directive "${line.trim()}"`);
      return { type: 'directive', name: m[1], arg: m[2].trim(), at };
    }
    if (!line.trim()) return { type: 'blank', at };
    return { type: 'text', text: line.trim().replace(/\s+/g, ' '), at };
  });
}

/** Shared state + helpers handed to a rule. */
export function makeState(text) {
  const units = new Map();
  const emends = [];
  const st = {
    text, units, emends,
    unit: null, witness: null, lang: '',
    unitOf(n, at) {
      if (!Number.isInteger(n) || n < 1) fail(`${at}: unit number must be a positive integer`);
      if (!units.has(n)) {
        units.set(n, {
          id: unitId(text, n), n, title: '', raga: '', poet: '',
          lines: [], commentary: [], witnesses: new Set(),
          counters: { couplet: 0, heading: 0, seg: 0, lacuna: 0, line: 0, stanza: 1 },
          explicitBhanita: false,
        });
      }
      return units.get(n);
    },
    // Commentary defaults to the text's commentary language when this witness carries it.
    commLang() {
      const c = text.lang.commentary;
      return c && st.witness.lang.includes(c) ? c : st.lang;
    },
    requireUnit(at) {
      if (!st.unit) fail(`${at}: text before any unit directive (wrap page titles etc. in @skip)`);
      return st.unit;
    },
    pushLine(u, line) {
      if (u.lines.some(l => l.id === line.id)) fail(`duplicate line id ${line.id} (check @couplet numbering)`);
      u.witnesses.add(line.witness);
      u.lines.push(line);
    },
    parseEmend(arg, at) {
      const m = /^(\S+)\s+(.+?)\s*=>\s*(.*?)\s*(?:\|\s*(.*))?$/.exec(arg);
      if (!m) fail(`${at}: @emend needs "ID FROM => TO | reason"`);
      emends.push({ id: m[1], from: m[2], to: m[3], reason: m[4] || '', at });
    },
  };
  return st;
}

export function segment(text, sources, overrides = {}) {
  const rule = RULES[text.segmentation.rule];
  if (!rule) fail(`unknown segmentation rule ${text.segmentation.rule}`);
  const st = makeState(text);
  const parallel = [];
  for (const src of sources) {
    st.witness = src.witness;
    st.lang = src.witness.lang[0];
    st.unit = null;
    const evs = events(src.content, rel(src.path));
    if (isParallel(src.content)) parallel.push(...readParallel(st, evs));
    else rule.file(st, evs);
  }
  addPrimary(st, parallel);
  rule.finish(st);

  for (const e of st.emends) {
    const line = [...st.units.values()].flatMap(u => u.lines).find(l => l.id === e.id);
    if (!line) fail(`${e.at}: @emend names unknown line ${e.id}`);
    if (!line.src.includes(e.from)) fail(`${e.at}: @emend: "${e.from}" not found in ${e.id}`);
    line.src = line.src.replace(e.from, e.to).trim();
    (line.emended ||= []).push({ from: e.from, to: e.to, reason: e.reason });
  }
  const warnings = attachParallels(st, parallel);

  const scriptOf = wid => text.witnesses.find(w => w.id === wid)?.script || '';
  const tr = (id, src, lang, wid) => transliterate(src, {
    lang, script: scriptOf(wid), overrides, warn: m => warnings.push(`${id}: ${m}`),
  });
  const out = [...st.units.values()].sort((a, b) => a.n - b.n).map(u => {
    const lines = u.lines.map(l => ({
      ...l, translit: l.role === 'lacuna' ? '' : tr(l.id, l.src, l.lang, l.witness),
    }));
    const commentary = u.commentary.map(s => ({
      ...s, src: s.src.trim(),
      translit: tr(s.id, s.src.trim(), s.lang, s.witness),
    }));
    const unit = {
      id: u.id, n: u.n, title: u.title, raga: u.raga, poet: u.poet, sourceSha: '',
      witnesses: [...u.witnesses].sort(), lines, commentary,
    };
    unit.sourceSha = sourceSha(unit);
    if (u.parallels) {
      const tl = (id, src, lang, wid) => ({ src, translit: tr(`${id} (${wid})`, src, lang, wid) });
      unit.parallels = {};
      for (const [wid, p] of Object.entries(u.parallels).sort(([a], [b]) => a.localeCompare(b))) {
        // In reading order, whatever order the directives came in.
        const lineOrder = u.lines.map(l => l.id).filter(id => id in p.lines);
        const segOrder = u.commentary.map(s => s.id).filter(id => id in p.commentary);
        unit.parallels[wid] = {
          lang: p.lang,
          lines: Object.fromEntries(lineOrder.map(id => [id, tl(id, p.lines[id], p.lang, wid)])),
          commentary: Object.fromEntries(segOrder.map(id => [id, tl(id, p.commentary[id], p.lang, wid)])),
        };
      }
      unit.parallelSha = parallelSha(unit);
    }
    return unit;
  });
  // Lines and segments the parallel witnesses leave unmatched, and what the
  // transliteration left out, for the segment report.
  Object.defineProperty(out, 'warnings', { value: warnings });
  return out;
}

// Parallels are hashed apart from the source: correcting the Tibetan never makes
// an approved song stale, though the next drafting pack carries the change.
export function parallelSha(unit) {
  return hashOf(Object.fromEntries(Object.entries(unit.parallels || {}).map(([wid, p]) => [wid, {
    lang: p.lang,
    lines: Object.entries(p.lines).map(([id, x]) => [id, x.src]),
    commentary: Object.entries(p.commentary).map(([id, x]) => [id, x.src]),
  }])));
}

// What a draft depends on. Transliteration is excluded: fixing the machine
// IAST must not make every draft stale.
export function sourceSha(unit) {
  return hashOf({
    id: unit.id, title: unit.title, raga: unit.raga, poet: unit.poet,
    lines: unit.lines.map(l => ({ id: l.id, role: l.role, couplet: l.couplet, lang: l.lang, witness: l.witness,
      src: l.src, refrain: l.refrain, bhanita: l.bhanita })),
    commentary: unit.commentary.map(s => ({ id: s.id, anchor: s.anchor, lang: s.lang, witness: s.witness, src: s.src })),
  });
}
