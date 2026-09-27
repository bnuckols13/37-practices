/**
 * Readable names for the engine's ids, for anything a person reads: cp.10.2a is
 * "10.2a", and cp.01.m2, Munidatta's comment on couplet 1, is "Munidatta on 1.1".
 * Pure (no Node imports): the Studio bundles this file.
 *
 *   places.short(id)  compact, for lists and references: 10.2a · 10.2 · Munidatta on 1.1
 *   places.long(id)   in a sentence: song 10, line 2a · Munidatta's comment on 1.1
 *   places.ref(id)    bare, where the commentator is already named: 1.1
 *   places.text(s)    every id inside a piece of prose replaced by its short name
 */

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * `comments` maps each commentary segment id to the part it is about ('1' for
 * couplet 1, '' for the whole unit); segments it does not list are named by unit.
 */
export function makePlaces({ prefix, unitLabel = 'Song', groupLabel = 'passage', commentator = 'the commentary', comments = {} }) {
  const unit = unitLabel.toLowerCase();
  const PART = '(?:\\.(h|[a-z]?\\d+[a-z]?))?';
  const ID = new RegExp(`(?<![\\w.])${esc(prefix)}\\.(\\d+)${PART}(?![\\w])`, 'g');
  const parse = id => {
    const m = new RegExp(`^${esc(prefix)}\\.(\\d+)${PART}$`).exec(String(id));
    if (!m) return null;
    const n = String(Number(m[1])), part = m[2] || '';
    if (!part) return { kind: 'unit', n };
    if (/^m\d+$/.test(part)) {
      const on = comments[id];
      return { kind: 'comment', n, on: on === undefined ? null : on };
    }
    if (/^h\d*$/.test(part)) return { kind: 'heading', n };
    if (/^x\d+$/.test(part)) return { kind: 'lacuna', n };
    if (/^s\d+$/.test(part)) return { kind: 'group', n, k: part.slice(1) };
    if (/^\d+$/.test(part)) return { kind: 'group', n, k: part };
    return { kind: 'line', n, k: part };
  };
  const short = id => {
    const p = parse(id);
    if (!p) return String(id);
    switch (p.kind) {
      case 'unit': return `${unit} ${p.n}`;
      case 'comment': return p.on ? `${commentator} on ${p.n}.${p.on}` : `${commentator} on ${unit} ${p.n}`;
      case 'heading': return `${unit} ${p.n}, heading`;
      case 'lacuna': return `${unit} ${p.n}, gap`;
      default: return `${p.n}.${p.k}`;
    }
  };
  const long = id => {
    const p = parse(id);
    if (!p) return String(id);
    switch (p.kind) {
      case 'unit': return `${unit} ${p.n}`;
      case 'comment': return p.on ? `${commentator}’s comment on ${p.n}.${p.on}` : `${commentator}’s introduction to ${unit} ${p.n}`;
      case 'heading': return `the heading of ${unit} ${p.n}`;
      case 'lacuna': return `a gap in ${unit} ${p.n}`;
      case 'group': return `${unit} ${p.n}, ${groupLabel} ${p.k}`;
      default: return `${unit} ${p.n}, line ${p.k}`;
    }
  };
  // Bare, where the commentator is already named: a comment on couplet 1 is "1.1".
  const ref = id => {
    const p = parse(id);
    if (p?.kind === 'comment') return p.on ? `${p.n}.${p.on}` : `${unit} ${p.n}`;
    return short(id);
  };
  const text = s => String(s || '').replace(ID, m => short(m));
  return { parse, short, long, ref, text, isId: id => !!parse(id) };
}
