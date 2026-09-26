/**
 * Shared vocabulary of review sheets: the header, glossary-entry blocks,
 * the symbolic-reading line format, and decision words.
 */

import { sha256, short, fail } from '../io.mjs';

const HDR_RE = /^<!-- translate:(sheet|glossary-sheet) ([^>]*?) -->\r?\n/;

export function header(s) {
  const m = HDR_RE.exec(s);
  if (!m) return null;
  const kv = Object.fromEntries(m[2].trim().split(/\s+/).map(p => p.split('=')));
  return { kind: m[1], ...kv, body: s.slice(m[0].length) };
}

export const withHeader = (kind, fields, body) => {
  const h = Object.entries({ ...fields, sheet: short(sha256(body)) }).map(([k, v]) => `${k}=${v}`).join(' ');
  return `<!-- translate:${kind} ${h} -->\n${body}`;
};

/** A sheet counts as hand-edited when its body no longer matches the hash it was written with. */
export const isEdited = s => { const h = header(s); return !h || h.sheet !== short(sha256(h.body)); };

export const quote = s => String(s).split('\n').map(l => '> ' + l).join('\n');

export function decision(v, kind = 'unit') {
  const s = String(v || '').toLowerCase().replace(/[.!]+$/, '').trim();
  if (!s) return 'pending';
  if (kind === 'glossary') {
    if (['approve', 'approved', 'ok', 'okay', 'yes', 'y', '✓'].includes(s)) return 'approve';
    if (['reject', 'rejected', 'no', 'n', 'drop'].includes(s)) return 'reject';
    if (['defer', 'later', 'skip', 'pending'].includes(s)) return 'defer';
  } else {
    if (['ok', 'okay', 'approve', 'approved', 'yes', 'y', '✓', 'good'].includes(s)) return 'ok';
    if (['redraft', 'revise', 'no', 'n', 'redo'].includes(s)) return 'redraft';
    if (s === 'pending') return 'pending';
  }
  return 'invalid';
}

export function formatSymbolic(sym) {
  if (!sym.image && !sym.readings.length) return '';
  const rs = sym.readings.map(r => `${r.referent} (${r.per}${r.where.length ? ', ' + r.where.join(' ') : ''})`).join('; ');
  return `${sym.image || '—'} → ${rs || 'unattested'}`;
}

export function parseSymbolic(s, where = '') {
  s = String(s || '').trim();
  if (!s) return { image: '', readings: [] };
  const [img, rest = ''] = s.split(/\s*→\s*|\s*->\s*/);
  const readings = [];
  for (const part of rest.split(';').map(x => x.trim()).filter(Boolean)) {
    if (part === 'unattested') continue;
    const m = /^(.*?)\s*\(([^,()]+?)(?:,\s*([^()]*))?\)$/.exec(part);
    if (!m) fail(`${where}: symbolic reading "${part}" needs the form "referent (who, segment-ids)"`);
    readings.push({ referent: m[1].trim(), per: m[2].trim(), where: (m[3] || '').split(/[\s,]+/).filter(Boolean) });
  }
  return { image: img === '—' ? '' : img.trim(), readings };
}

const list = a => a.join('; ');
export const splitList = s => String(s || '').split(';').map(x => x.trim()).filter(Boolean);

/** The editable block for one glossary entry (used in unit sheets and the glossary sheet). */
export function entryBlock(e, extra = []) {
  return [
    `### ${e.en} · ${e.id}`,
    `**EN:** ${e.en}`,
    `**Type:** ${e.type}`,
    `**Policy:** ${e.policy}`,
    `**Alt:** ${list(e.alt)}`,
    `**Variants:** ${list(e.variants)}`,
    `**Definition:** ${e.definition}`,
    `**Symbolic:** ${formatSymbolic(e.symbolic)}`,
    `**Never in a line:** ${list(e.forbiddenInLine)}`,
    `**Decision:**`,
    quote([
      `Status: ${e.status}` + (e.provenance.proposed ? ` · proposed by ${e.provenance.proposed.by}, ${e.provenance.proposed.date}` : ''),
      'Forms: ' + (e.forms.map(f => [f.lang, f.script, f.translit].filter(Boolean).join(' ') + ` (${f.att}${f.where ? ', ' + f.where : ''})`).join(' · ') || '—'),
      ...extra,
    ].join('\n')),
  ].join('\n');
}
