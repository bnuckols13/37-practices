/**
 * Import one text of the Degé Tengyur from Esukhia's digital edition
 * (github.com/Esukhia/derge-tengyur, public domain), pinned to a commit.
 * The witness in text.json supplies:
 *   "fetch": "https://raw.githubusercontent.com/Esukhia/derge-tengyur/<commit>/text/<volume>.txt#D2293"
 * The volume is downloaded and the text between its {D2293} and the next {D…}
 * marker kept, normalized so that directives can sit between lines:
 *   - folio markers ([158b], [158b.2]) removed and folio lines joined (they break mid-sentence);
 *   - a new line wherever a shad follows a space ("X། །Y", or "Xག །Y" where the shad
 *     after ga is omitted), so each verse line (pāda) and sentence stands alone,
 *     and a new line at each lemma ("X zhes bya ba la sogs pa ni"), where a comment begins;
 *   - Esukhia's annotations resolved to the Degé reading: (X,Y) and {X,Y} keep X,
 *     [X] keeps X, and # (a note point) is dropped;
 *   - NFC.
 * Every character of the Degé text is kept; the import label records the source.
 */

import { fail } from '../io.mjs';

const FOLIO = /^\[\d+x?[ab](?:\.\d+)?\]/;
// "། " then a clause (no shad inside) ending in "zhes bya ba (la sogs pa) ni" or "zhes pa ni"
// (also ces/shes after other finals): a quoted lemma.
const LEMMA = /([།][ \u00A0]+)([^།]*?(?:ཞེས|ཅེས|ཤེས)་(?:བྱ་བ་|པ་)(?:ལ་སོགས་པ་)?ནི)/gu;

export function normalizeTengyur(raw) {
  const joined = raw.replace(/^\uFEFF/, '').split('\n').map(l => l.replace(FOLIO, '')).join('');
  const text = joined
    .replace(/\{D\d+[a-z]?\}/g, '')
    .replace(/\(([^(),]*),[^()]*\)/g, '$1')      // (edition, suggested correction) -> edition
    .replace(/\{([^{},]*),[^{}]*\}/g, '$1')      // {archaic, modern} -> archaic (the edition's spelling)
    .replace(/\[([^\]]*)\]/g, '$1')              // [suspicious] -> as printed
    .replace(/#/g, '')
    .normalize('NFC');
  // A verse line or sentence ends where a shad follows a space: "X། །Y", and "Xག །Y"
  // where the shad after ga is omitted by rule.
  const lines = text.replace(/([ \u00A0]+)(?=[།༎])/g, '$1\n').split('\n');
  // A commentary quotes the verse it explains as "X zhes bya ba la sogs pa ni" (X ityādi);
  // start a new line at each such lemma so a directive can mark where the comment begins.
  const split = lines.flatMap(l => l.replace(LEMMA, '$1\n$2').split('\n'));
  return split.map(l => l.trimEnd()).filter(Boolean).join('\n') + '\n';
}

export function extractText(volume, toh) {
  const start = volume.indexOf(`{D${toh}}`);
  if (start < 0) fail(`{D${toh}} is not in this volume`);
  const next = volume.slice(start + 1).search(/\{D\d+[a-z]?\}/);
  return volume.slice(start, next < 0 ? volume.length : start + 1 + next);
}

export async function fetchTengyur(template) {
  const u = new URL(template);
  const m = /^#D(\d+)$/.exec(u.hash);
  if (!m) fail(`the fetch template needs a #D<Tohoku number> at the end: ${template}`);
  u.hash = '';
  let res;
  try {
    res = await fetch(u, { headers: { 'User-Agent': 'illuminated-translation-engine (37practices.space)' } });
  } catch (e) {
    fail(`could not reach ${u.hostname} (${e.cause?.code || e.message}); allow it in the environment's network settings`);
  }
  if (!res.ok) fail(`${u.hostname} answered ${res.status} for ${decodeURIComponent(u.pathname)}`);
  const text = normalizeTengyur(extractText(await res.text(), m[1]));
  const volume = decodeURIComponent(u.pathname.split('/').pop());
  const commit = u.pathname.split('/')[3];
  return { text, label: `Esukhia Derge Tengyur @${commit.slice(0, 7)}, ${volume}, D${m[1]}; normalized (folio lines joined, one line per pāda or sentence, Esukhia notes resolved to the Degé reading)` };
}
