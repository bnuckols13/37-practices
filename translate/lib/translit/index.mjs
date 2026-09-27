import { brahmicToIAST } from './brahmic.mjs';
import { tibetanToWylie } from './tibetan.mjs';

export function detectScript(s) {
  const counts = { Beng: 0, Deva: 0, Tibt: 0, Latn: 0 };
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if (c >= 0x0980 && c <= 0x09ff) counts.Beng++;
    else if (c >= 0x0900 && c <= 0x097f) counts.Deva++;
    else if (c >= 0x0f00 && c <= 0x0fff) counts.Tibt++;
    else if (/[A-Za-zÀ-ɏḀ-ỿ]/.test(ch)) counts.Latn++;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best[1] ? best[0] : '';
}

/**
 * Machine transliteration for a source line: IAST for Bengali and Devanagari, Wylie for Tibetan.
 * warn(message) hears what the machine left out (a stray vowel sign), for the segment report.
 */
export function transliterate(src, { lang = '', script = '', overrides = {}, warn } = {}) {
  const sc = script || detectScript(src);
  if (sc === 'Beng' || sc === 'Deva') return brahmicToIAST(src, { script: sc, lang, overrides, warn });
  if (sc === 'Tibt') return tibetanToWylie(src);
  if (sc === 'Latn') return src;
  return '';
}
