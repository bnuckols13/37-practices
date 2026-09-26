/**
 * Glossary markup inside English:  [Ḍombī]{dombi}
 * The drafter writes it, the reviewer edits it, render turns it into links.
 * A link travels with its words, so there are no offsets to go stale.
 */

export const TERM_RE = /\[([^\[\]{}\n]+)\]\{([a-z0-9][a-z0-9-]*)\}/g;

export function terms(s) {
  return [...String(s || '').matchAll(TERM_RE)].map(m => ({ surface: m[1], id: m[2] }));
}

export const strip = s => String(s || '').replace(TERM_RE, '$1');

/** Malformed markup: anything that still looks like markup once valid terms are removed. */
export function problems(s) {
  const out = [];
  const rest = String(s || '').replace(TERM_RE, '');
  if (/\]\s*\{/.test(rest)) out.push('malformed [surface]{id}');
  if (/\{[^}]*\}/.test(rest)) out.push('stray {…} outside a term');
  for (const t of terms(s)) if (!t.surface.trim()) out.push(`empty surface for {${t.id}}`);
  return out;
}

/** Replace every term with render(surface, id); everything else goes through esc. */
export function render(s, renderTerm, esc) {
  let out = '', last = 0;
  const str = String(s || '');
  for (const m of str.matchAll(TERM_RE)) {
    out += esc(str.slice(last, m.index)) + renderTerm(m[1], m[2]);
    last = m.index + m[0].length;
  }
  return out + esc(str.slice(last));
}
