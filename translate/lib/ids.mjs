/**
 * Stable IDs. Grammar:  prefix.NN[.part]
 *   cp.10        unit (song)
 *   cp.10.1      group (couplet 1)       cp.10.1a  line a of couplet 1
 *   cp.10.h      heading group           cp.10.h1  heading line
 *   cp.10.s2     stanza group (lines rule)
 *   cp.10.m3     commentary segment      cp.10.x1  lacuna
 * IDs are never renumbered; retired IDs are tombstoned in units/index.json.
 */

import { fail } from './io.mjs';

export const ID_RE = /^([a-z][a-z0-9]*)\.(\d+)(?:\.(\d+[a-z]?|h\d*|r\d*|m\d+|x\d+|s\d+))?$/;
export const TERM_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

export const pad = (n, w = 2) => String(n).padStart(w, '0');
export const unitId = (text, n) => `${text.idPrefix}.${pad(n, text.idWidth || 2)}`;

export function parseId(id) {
  const m = ID_RE.exec(String(id));
  return m ? { prefix: m[1], n: Number(m[2]), part: m[3] || '' } : null;
}

export const isId = id => ID_RE.test(String(id));
export const unitOf = id => { const p = parseId(id); return p ? String(id).split('.').slice(0, 2).join('.') : ''; };
export const partOf = id => parseId(id)?.part || '';

/** The number shown to readers: cp.10.1 -> "10.1", cp.10 -> "10". */
export function passageNo(id) {
  const p = parseId(id);
  if (!p) return id;
  return p.part ? `${p.n}.${p.part.replace(/[a-z]$/, '')}` : String(p.n);
}

/**
 * Resolve a unit selector against the known unit ids:
 *   undefined | "all" | "cp.01..cp.03" | "cp.01,cp.10" | "1,10,14" | "1..3"
 */
export function selectUnits(all, spec) {
  if (!spec || spec === 'all') return all.slice();
  const byN = new Map(all.map(id => [parseId(id).n, id]));
  const toN = s => {
    s = s.trim();
    if (/^\d+$/.test(s)) return Number(s);
    const p = parseId(s);
    if (!p) fail(`not a unit id: ${s}`);
    return p.n;
  };
  const out = [];
  for (const part of spec.split(',')) {
    const [a, b] = part.split('..');
    const lo = toN(a), hi = b === undefined ? lo : toN(b);
    for (let n = lo; n <= hi; n++) {
      if (byN.has(n)) out.push(byN.get(n));
      else if (b === undefined) fail(`no such unit: ${part.trim()} (run segment first?)`);
    }
  }
  return [...new Set(out)];
}
