/**
 * Read a review sheet back. Only **Label:** lines inside a section count;
 * a label's value may continue on following plain lines until a blank line.
 * Quoted (>) lines, headings and anything outside sections are ignored.
 * Sections are keyed by the id after the last "·" in their heading.
 */

import { header } from './sheet.mjs';
import { fail } from '../io.mjs';

const LABEL_RE = /^(?:\*\*|__)\s*([^*_]+?)\s*:\s*(?:\*\*|__)\s?(.*)$/;

export function parseSheet(s) {
  const h = header(s);
  if (!h) fail('not a review sheet (missing the <!-- translate:… --> header on the first line)');
  const sections = [];
  const warnings = [];
  let cur = null, last = null;
  h.body.replace(/\r\n?/g, '\n').split('\n').forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '');
    const lineNo = i + 2;
    const hm = /^(#{2,3})\s+(.*)$/.exec(line);
    if (hm) {
      const key = hm[2].split('·').pop().trim();
      cur = { level: hm[1].length, title: hm[2].trim(), key, labels: {}, lineNo };
      sections.push(cur); last = null;
      return;
    }
    if (/^#\s/.test(line) || /^\s*>/.test(line) || !line.trim()) { last = null; return; }
    const m = LABEL_RE.exec(line);
    if (m && cur) {
      const label = m[1].replace(/\s+/g, ' ');
      if (label in cur.labels) warnings.push(`line ${lineNo}: "${label}" appears twice in ${cur.key}; the later one wins`);
      cur.labels[label] = m[2].trim();
      last = label;
      return;
    }
    if (last && cur) { cur.labels[last] += (cur.labels[last] ? ' ' : '') + line.trim(); return; }
    if (cur) warnings.push(`line ${lineNo}: text outside a **Label:** in ${cur.key} is ignored`);
  });
  return { header: h, sections, warnings };
}

/** Note labels: "Note 3 · imagery · cites cp.10.m1, cp.10.m2" */
export function parseNoteLabel(label) {
  const m = /^Note\s+(\d+)\s*·\s*([a-z]+)(?:\s*·\s*cites\s+(.+))?$/i.exec(label);
  if (!m) return null;
  return { n: Number(m[1]), kind: m[2].toLowerCase(), cites: (m[3] || '').split(/[\s,]+/).filter(Boolean) };
}
