/**
 * Fetch one page of a Wikisource transcription as plain text, via the
 * MediaWiki parse API. The witness in text.json supplies a page template:
 *   "fetch": "https://bn.wikisource.org/wiki/<Title>/চর্য্যাচর্য্যবিনিশ্চয়/{n}"
 * {n} becomes the unit number (in Bengali digits on bn.wikisource.org).
 * Untested until the environment's network policy allows the host.
 */

import { fail } from '../io.mjs';

const BENGALI_DIGITS = '০১২৩৪৫৬৭৮৯';
const toBengali = n => String(n).replace(/\d/g, d => BENGALI_DIGITS[d]);

export function pageUrl(template, n) {
  if (!template) fail('this witness has no "fetch" page template in text.json');
  const u = new URL(template.replace('{n}', '__N__'));
  const num = u.hostname.startsWith('bn.') ? toBengali(n) : String(n);
  const title = decodeURIComponent(u.pathname.replace(/^\/wiki\//, '')).replace('__N__', num);
  const api = new URL(`https://${u.hostname}/w/api.php`);
  api.search = new URLSearchParams({ action: 'parse', page: title, prop: 'text', format: 'json', formatversion: '2', disabletoc: '1' });
  return { api: api.toString(), title, host: u.hostname };
}

export function htmlToText(html) {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<sup[^>]*class="[^"]*reference[^"]*"[\s\S]*?<\/sup>/gi, '')
    .replace(/<span[^>]*class="[^"]*pagenum[^"]*"[\s\S]*?<\/span>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|tr|dd|dt|table|pre|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export async function fetchWikisource(template, n) {
  const { api, title, host } = pageUrl(template, n);
  let res;
  try {
    res = await fetch(api, { headers: { 'User-Agent': 'illuminated-translation-engine (37practices.space)' } });
  } catch (e) {
    fail(`could not reach ${host} (${e.cause?.code || e.message}). If the environment's network policy blocks it, `
      + `allow ${host} in the environment settings, or paste the text: import <slug> --witness <id> -`);
  }
  if (!res.ok) fail(`${host} answered ${res.status} for "${title}"`);
  const body = await res.json();
  if (body.error) fail(`${host}: ${body.error.info || body.error.code} ("${title}")`);
  return { text: htmlToText(body.parse.text), label: `${host}: ${title}` };
}
