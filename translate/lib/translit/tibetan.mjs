/**
 * Unicode Tibetan to Wylie (EWTS), by BDRC's converter (jsewts). Its "_" marks a
 * space in the Tibetan (between shads, "/_/"); here that is an ordinary space.
 */
import J from 'jsewts';

export const tibetanToWylie = s => J.toWylie(String(s).normalize('NFC')).replace(/_/g, ' ').replace(/ {2,}/g, ' ').trim();

export const wylieToTibetan = s => J.fromWylie(String(s)).normalize('NFC');

// Tibetan has no spaces between words: a form matches only whole syllables, starting
// after a tsheg, shad or space and ending before one, or before a particle written
// onto the last syllable ('i, 'o, 'am, 'ang, 'u, -s, -r: pa'i, mos, lor).
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const EDGE = '\\u0F04-\\u0F14\\s';
const cache = new Map();
function boundaryRe(form) {
  let re = cache.get(form);
  if (!re) {
    re = new RegExp(`(?<=^|[${EDGE}])${esc(form)}(?=$|[${EDGE}]|(?:འི|འོ|འམ|འང|འུ|ས|ར)(?:$|[${EDGE}]))`, 'u');
    cache.set(form, re);
  }
  return re;
}

/** Every place a Tibetan form stands in a text as whole syllables, as [start, end) spans. */
export function tibetanSpans(src, form) {
  const f = String(form).normalize('NFC').replace(/[\u0F0B\u0F0D]+$/u, '');
  if (!f) return [];
  const re = new RegExp(boundaryRe(f).source, 'gu');
  return [...String(src).normalize('NFC').matchAll(re)].map(m => [m.index, m.index + f.length]);
}

/** Where a Tibetan form stands in a text as whole syllables, or -1. */
export function tibetanIndex(src, form) {
  const f = String(form).normalize('NFC').replace(/[་།]+$/u, '');
  if (!f) return -1;
  const m = boundaryRe(f).exec(String(src).normalize('NFC'));
  return m ? m.index : -1;
}
